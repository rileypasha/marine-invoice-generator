const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Idempotency middleware for invoice operations
 * Prevents duplicate processing of requests with same idempotency key
 */
const idempotencyMiddleware = (options = {}) => {
  const {
    keyHeader = 'idempotency-key',
    maxAge = 24 * 60 * 60 * 1000, // 24 hours
    methods = ['POST', 'PUT', 'PATCH']
  } = options;

  return async (req, res, next) => {
    // Only apply to specified methods
    if (!methods.includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[keyHeader];

    // If no idempotency key provided, continue normally
    if (!idempotencyKey) {
      return next();
    }

    try {
      // Generate a unique key combining idempotency key with user ID
      const userId = req.user?.id || 'anonymous';
      const compositeKey = crypto
        .createHash('sha256')
        .update(`${userId}:${idempotencyKey}`)
        .digest('hex');

      // Check if this key already exists
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { key: compositeKey }
      });

      if (existingRecord) {
        // Return cached response
        logger.info({
          event: 'IDEMPOTENCY_HIT',
          key: compositeKey,
          requestId: existingRecord.requestId,
          originalTimestamp: existingRecord.createdAt
        });

        return res.status(200).json({
          ...existingRecord.response,
          _meta: {
            idempotent: true,
            originalTimestamp: existingRecord.createdAt
          }
        });
      }

      // Store the idempotency key for this request
      req.idempotencyKey = compositeKey;

      // Intercept the response to cache it
      const originalJson = res.json;
      res.json = function(body) {
        // Only cache successful responses (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Store the response asynchronously (don't wait)
          const expiresAt = new Date(Date.now() + maxAge);

          prisma.idempotencyRecord.create({
            data: {
              key: compositeKey,
              requestId: res.locals.requestId || `req_${Date.now()}`,
              response: body,
              expiresAt
            }
          }).catch(error => {
            // Log but don't fail the request if caching fails
            logger.warn({
              event: 'IDEMPOTENCY_CACHE_FAILED',
              error: error.message,
              key: compositeKey
            });
          });
        }

        // Call the original json method
        return originalJson.call(this, body);
      };

      next();

    } catch (error) {
      logger.error({
        event: 'IDEMPOTENCY_MIDDLEWARE_ERROR',
        error: error.message,
        idempotencyKey
      });

      // Don't fail the request due to idempotency issues
      next();
    }
  };
};

/**
 * Cleanup expired idempotency records
 * Should be called periodically (e.g., via cron job)
 */
const cleanupExpiredRecords = async () => {
  try {
    const result = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    logger.info({
      event: 'IDEMPOTENCY_CLEANUP',
      deletedCount: result.count
    });

    return result.count;
  } catch (error) {
    logger.error({
      event: 'IDEMPOTENCY_CLEANUP_ERROR',
      error: error.message
    });
    throw error;
  }
};

module.exports = {
  idempotencyMiddleware,
  cleanupExpiredRecords
};