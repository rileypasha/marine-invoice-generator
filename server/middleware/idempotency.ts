import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

// In-memory cache for simplicity (use Redis in production)
interface IdempotencyRecord {
  key: string;
  response: any;
  statusCode: number;
  timestamp: Date;
  userId?: string;
}

class IdempotencyStore {
  private store: Map<string, IdempotencyRecord> = new Map();
  private readonly ttl = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old entries every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.store.forEach((record, key) => {
      if (now - record.timestamp.getTime() > this.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.store.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.debug('Cleaned up idempotency records', { count: keysToDelete.length });
    }
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.store.get(key);
    
    if (record) {
      // Check if expired
      if (Date.now() - record.timestamp.getTime() > this.ttl) {
        this.store.delete(key);
        return null;
      }
      return record;
    }
    
    return null;
  }

  async set(key: string, response: any, statusCode: number, userId?: string): Promise<void> {
    this.store.set(key, {
      key,
      response,
      statusCode,
      timestamp: new Date(),
      userId,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// For production, use Redis:
class RedisIdempotencyStore {
  private redis: any; // Import Redis client

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const data = await this.redis.get(`idempotency:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, response: any, statusCode: number, userId?: string): Promise<void> {
    const record: IdempotencyRecord = {
      key,
      response,
      statusCode,
      timestamp: new Date(),
      userId,
    };
    
    await this.redis.setex(
      `idempotency:${key}`,
      86400, // 24 hours
      JSON.stringify(record)
    );
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`idempotency:${key}`);
  }

  destroy(): void {
    // Redis connection handled elsewhere
  }
}

// Create store instance
const idempotencyStore = new IdempotencyStore();

export const idempotency = async (
  req: Request & { correlationId?: string; userId?: string },
  res: Response,
  next: NextFunction
): Promise<void> => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  // Skip if no idempotency key provided
  if (!idempotencyKey) {
    return next();
  }

  // Validate idempotency key format
  if (!isValidIdempotencyKey(idempotencyKey)) {
    logger.warn('Invalid idempotency key format', {
      correlationId: req.correlationId,
      key: idempotencyKey,
    });
    
    res.status(400).json({
      code: 'INVALID_IDEMPOTENCY_KEY',
      message: 'Invalid idempotency key format',
      correlationId: req.correlationId,
    });
    return;
  }

  try {
    // Check for existing response
    const cached = await idempotencyStore.get(idempotencyKey);
    
    if (cached) {
      // Verify user matches (prevent cross-user replay)
      if (cached.userId && req.userId && cached.userId !== req.userId) {
        logger.warn('Idempotency key user mismatch', {
          correlationId: req.correlationId,
          key: idempotencyKey,
          cachedUser: cached.userId,
          requestUser: req.userId,
        });
        
        res.status(409).json({
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          message: 'This idempotency key belongs to another user',
          correlationId: req.correlationId,
        });
        return;
      }

      logger.info('Returning cached idempotent response', {
        correlationId: req.correlationId,
        key: idempotencyKey,
        originalTimestamp: cached.timestamp,
      });

      res.status(cached.statusCode)
        .header('X-Idempotent-Replay', 'true')
        .json(cached.response);
      return;
    }

    // Store response after successful processing
    const originalJson = res.json.bind(res);
    
    res.json = function (body: any): Response {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 400) {
        idempotencyStore.set(idempotencyKey, body, res.statusCode, req.userId)
          .catch(err => {
            logger.error('Failed to store idempotent response', {
              error: err,
              correlationId: req.correlationId,
              key: idempotencyKey,
            });
          });

        logger.debug('Stored idempotent response', {
          correlationId: req.correlationId,
          key: idempotencyKey,
          statusCode: res.statusCode,
        });
      }
      
      return originalJson(body);
    };

    next();
    
  } catch (error) {
    logger.error('Idempotency middleware error', {
      error,
      correlationId: req.correlationId,
      key: idempotencyKey,
    });
    
    // Continue without idempotency on error
    next();
  }
};

function isValidIdempotencyKey(key: string): boolean {
  // Validate format: timestamp_random_hash
  const pattern = /^\d+_[a-z0-9]+_[a-zA-Z0-9+/=]+$/;
  return pattern.test(key) && key.length < 256;
}

// Utility to generate idempotency key on server side
export function generateServerIdempotencyKey(data: any): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const hash = createHash('sha256')
    .update(JSON.stringify({ ...data, timestamp, random }))
    .digest('base64')
    .substring(0, 16);
  
  return `${timestamp}_${random}_${hash}`;
}

// Cleanup on shutdown
process.on('SIGTERM', () => {
  idempotencyStore.destroy();
});

export default idempotency;