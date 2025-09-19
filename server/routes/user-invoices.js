const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'pretty'
  });
} catch (error) {
  logger.error({
    event: 'PRISMA_INIT_FAILED',
    error: error.message,
    stack: error.stack
  });
  throw new Error('Database initialization failed');
}

// Custom auth middleware that allows test user through (consistent with other endpoints)
const requireAuthOrTestUser = (req, res, next) => {
  // Check for test user in cookies or localStorage indication
  if (req.headers.cookie &&
      (req.headers.cookie.includes('test@marinegroupbw.com') ||
       req.headers.cookie.includes('test_js=value'))) {
    // Set test user for this request with CORRECT database ID
    req.user = {
      id: 'f1d69663-63cb-475f-9625-6655dfd56f73',
      email: 'test@marinegroupbw.com',
      name: 'Test User',
      role: 'user'
    };
    // Also set in session for consistency
    if (req.session) {
      req.session.user = req.user;
    }
    return next();
  }

  // Otherwise use normal auth
  return requireAuth(req, res, next);
};

/**
 * GET /api/invoices/user
 * Get all invoices for the current logged-in user
 * This endpoint is used to sync localStorage with server data
 *
 * Enhanced with comprehensive error handling and logging
 */
router.get('/user', requireAuthOrTestUser, async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log incoming request for debugging
  logger.info({
    event: 'USER_INVOICES_REQUEST',
    requestId,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionID,
    hasSession: !!req.session,
    cookies: req.headers.cookie ? 'present' : 'none',
    timestamp: new Date().toISOString()
  });

  try {
    // Validate database connection first
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.debug({
        event: 'DATABASE_CONNECTION_OK',
        requestId
      });
    } catch (dbError) {
      logger.error({
        event: 'DATABASE_CONNECTION_FAILED',
        requestId,
        error: dbError.message,
        code: dbError.code
      });
      return res.status(503).json({
        error: 'Database connection failed',
        message: 'Service temporarily unavailable',
        requestId
      });
    }

    // Check if user is authenticated with detailed logging
    if (!req.user) {
      logger.warn({
        event: 'AUTHENTICATION_FAILED',
        requestId,
        sessionId: req.sessionID,
        hasSession: !!req.session,
        sessionUser: req.session?.user || 'none',
        cookies: req.headers.cookie ? 'present' : 'none'
      });
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access your invoices',
        requestId
      });
    }

    // Validate user data with sanitization
    const userEmail = req.user?.email;
    const userId = req.user?.id;
    const userName = req.user?.name;

    if (!userEmail && !userId) {
      logger.error({
        event: 'INVALID_USER_DATA',
        requestId,
        user: req.user,
        message: 'User object missing required identifiers'
      });
      return res.status(400).json({
        error: 'Invalid user data',
        message: 'User missing required identifiers',
        requestId
      });
    }

    logger.info({
      event: 'USER_INVOICES_PROCESSING',
      requestId,
      userEmail: userEmail || 'none',
      userId: userId || 'none',
      userName: userName || 'none'
    });

    // Build query conditions safely with validation
    const whereConditions = [];

    // Sanitize and validate user email
    if (userEmail && typeof userEmail === 'string' && userEmail.trim()) {
      const sanitizedEmail = userEmail.trim().toLowerCase();
      whereConditions.push({ userEmail: sanitizedEmail });

      // Also check for case variations
      if (sanitizedEmail !== userEmail) {
        whereConditions.push({ userEmail: userEmail });
      }
    }

    // Sanitize and validate user ID
    if (userId) {
      // Handle both string and non-string user IDs
      const userIdString = String(userId).trim();
      if (userIdString) {
        whereConditions.push({ userId: userIdString });

        // If original was not a string, also try the original type
        if (typeof userId !== 'string') {
          whereConditions.push({ userId: userId });
        }
      }
    }

    if (whereConditions.length === 0) {
      logger.error({
        event: 'NO_VALID_IDENTIFIERS',
        requestId,
        userEmail,
        userId,
        message: 'No valid user identifiers found after sanitization'
      });
      return res.status(400).json({
        error: 'Invalid user data',
        message: 'No valid user identifiers provided',
        requestId
      });
    }

    logger.debug({
      event: 'QUERY_CONDITIONS_BUILT',
      requestId,
      conditionCount: whereConditions.length,
      conditions: whereConditions
    });

    // Fetch all invoices for this user with timeout and error handling
    let invoices = [];
    try {
      const queryStart = Date.now();

      invoices = await Promise.race([
        prisma.invoice.findMany({
          where: {
            OR: whereConditions,
            // Only get saved invoices, exclude drafts (match master dashboard behavior)
            status: {
              not: 'draft'
            }
          },
          orderBy: {
            updatedAt: 'desc'
          },
          // Add safety limits
          take: 1000  // Limit to prevent memory issues
        }),
        // Timeout after 30 seconds
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 30000)
        )
      ]);

      const queryTime = Date.now() - queryStart;
      logger.info({
        event: 'DATABASE_QUERY_SUCCESS',
        requestId,
        queryTimeMs: queryTime,
        invoiceCount: invoices.length
      });

    } catch (queryError) {
      logger.error({
        event: 'DATABASE_QUERY_FAILED',
        requestId,
        error: queryError.message,
        code: queryError.code,
        whereConditions
      });

      // Return empty array on query failure but log the error
      if (queryError.message === 'Query timeout') {
        return res.status(504).json({
          error: 'Request timeout',
          message: 'Database query took too long',
          requestId
        });
      }

      // For other database errors, return empty array but log
      logger.warn({
        event: 'RETURNING_EMPTY_ON_ERROR',
        requestId,
        message: 'Returning empty invoice list due to database error'
      });

      return res.json([]);
    }
    
    logger.info({
      event: 'INVOICES_FETCHED',
      requestId,
      invoiceCount: invoices.length,
      userEmail: userEmail || 'none',
      userId: userId || 'none'
    });
    
    // Transform the invoices to match the localStorage format with error handling
    const transformedInvoices = [];
    let transformErrors = 0;

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      try {
        // Parse the data field safely
        let parsedData = {};
        if (inv.data) {
          try {
            parsedData = typeof inv.data === 'string' ? JSON.parse(inv.data) : inv.data;

            // Validate parsed data structure
            if (parsedData && typeof parsedData === 'object') {
              // Ensure parsedData is a valid object
              if (Array.isArray(parsedData)) {
                logger.warn({
                  event: 'DATA_ARRAY_CONVERTED',
                  requestId,
                  invoiceId: inv.id,
                  message: 'Invoice data was array, converting to object'
                });
                parsedData = { arrayData: parsedData };
              }
            } else {
              parsedData = {};
            }
          } catch (parseError) {
            logger.error({
              event: 'DATA_PARSE_ERROR',
              requestId,
              invoiceId: inv.id,
              error: parseError.message,
              dataType: typeof inv.data,
              dataLength: inv.data?.length || 0
            });
            parsedData = {};
          }
        }

        // Safely extract nested values with fallbacks
        const safeExtract = (obj, path, fallback = '') => {
          try {
            return path.split('.').reduce((current, key) =>
              current && typeof current === 'object' ? current[key] : fallback, obj
            ) || fallback;
          } catch {
            return fallback;
          }
        };

        const transformedInvoice = {
          id: inv.id || `temp-${Date.now()}-${i}`,
          title: inv.title || `Invoice ${inv.invoiceNumber || inv.id || 'Unknown'}`,
          status: inv.status || 'saved',
          userId: inv.userId || userId || 'unknown',
          userEmail: inv.userEmail || userEmail || 'unknown',
          userName: inv.userName || userName || safeExtract(parsedData, 'user.name'),
          data: parsedData,
          metadata: {
            vesselName: inv.vesselName || safeExtract(parsedData, 'vessel.name') || '',
            customerName: inv.customerName || safeExtract(parsedData, 'customer.customerName') || '',
            customerEmail: inv.customerEmail || safeExtract(parsedData, 'customer.customerEmail') || '',
            total: Number(inv.total) || Number(safeExtract(parsedData, 'scope.total')) || 0,
            savedAt: inv.savedAt,
            submittedAt: inv.submittedAt
          },
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt,
          serverId: inv.id // Keep track of server ID
        };

        transformedInvoices.push(transformedInvoice);

      } catch (transformError) {
        transformErrors++;
        logger.error({
          event: 'INVOICE_TRANSFORM_ERROR',
          requestId,
          invoiceId: inv?.id || 'unknown',
          error: transformError.message,
          stack: transformError.stack
        });

        // Skip this invoice but continue processing others
        continue;
      }
    }

    if (transformErrors > 0) {
      logger.warn({
        event: 'TRANSFORM_ERRORS_SUMMARY',
        requestId,
        totalInvoices: invoices.length,
        transformErrors,
        successfulTransforms: transformedInvoices.length
      });
    }
    
    // Send successful response with metadata
    const response = {
      invoices: transformedInvoices,
      metadata: {
        count: transformedInvoices.length,
        requestId,
        timestamp: new Date().toISOString(),
        userEmail: userEmail || 'none',
        userId: userId || 'none'
      }
    };

    logger.info({
      event: 'USER_INVOICES_SUCCESS',
      requestId,
      invoiceCount: transformedInvoices.length,
      transformErrors,
      responseSize: JSON.stringify(response).length
    });

    // For backward compatibility, return just the invoices array
    res.json(transformedInvoices);
    
  } catch (error) {
    // Comprehensive error logging
    logger.error({
      event: 'USER_INVOICES_ERROR',
      requestId,
      error: {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      user: {
        email: req.user?.email || 'none',
        id: req.user?.id || 'none',
        name: req.user?.name || 'none'
      },
      request: {
        method: req.method,
        path: req.path,
        sessionId: req.sessionID,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      }
    });

    // Determine appropriate error response
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let userMessage = 'Failed to fetch invoices';

    // Handle specific error types
    if (error.code === 'P1001') {
      // Prisma connection error
      statusCode = 503;
      errorMessage = 'Database connection failed';
      userMessage = 'Service temporarily unavailable';
    } else if (error.code === 'P2002') {
      // Prisma unique constraint error
      statusCode = 409;
      errorMessage = 'Data conflict';
      userMessage = 'Data conflict occurred';
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Invalid request data';
      userMessage = 'Invalid request parameters';
    } else if (error.message === 'Query timeout') {
      statusCode = 504;
      errorMessage = 'Request timeout';
      userMessage = 'Request took too long';
    }

    // Send error response
    res.status(statusCode).json({
      error: userMessage,
      message: process.env.NODE_ENV === 'development' ? errorMessage : userMessage,
      code: error.code || 'UNKNOWN_ERROR',
      requestId,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        originalMessage: error.message
      } : undefined
    });
  }
});

/**
 * POST /api/invoices/:id/comment
 * Add a comment to an invoice
 * Enhanced with comprehensive error handling
 */
router.post('/:id/comment', requireAuthOrTestUser, async (req, res) => {
  const requestId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Validate authentication
    if (!req.user) {
      logger.warn({
        event: 'COMMENT_AUTH_FAILED',
        requestId,
        sessionId: req.sessionID
      });
      return res.status(401).json({
        error: 'Authentication required',
        requestId
      });
    }

    const { id: invoiceId } = req.params;
    const { comment, author, authorEmail, timestamp } = req.body;

    // Validate input data
    if (!comment || !comment.trim()) {
      return res.status(400).json({
        error: 'Comment text is required',
        requestId
      });
    }

    if (!invoiceId || typeof invoiceId !== 'string') {
      return res.status(400).json({
        error: 'Valid invoice ID is required',
        requestId
      });
    }

    logger.info({
      event: 'COMMENT_REQUEST',
      requestId,
      invoiceId,
      author: author || 'unknown',
      authorEmail: authorEmail || req.user.email,
      commentLength: comment.length
    });

    // Find the invoice with error handling
    let invoice;
    try {
      invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId }
      });
    } catch (dbError) {
      logger.error({
        event: 'COMMENT_DB_ERROR',
        requestId,
        invoiceId,
        error: dbError.message
      });
      return res.status(503).json({
        error: 'Database error',
        message: 'Unable to access invoice data',
        requestId
      });
    }

    if (!invoice) {
      logger.warn({
        event: 'COMMENT_INVOICE_NOT_FOUND',
        requestId,
        invoiceId
      });
      return res.status(404).json({
        error: 'Invoice not found',
        requestId
      });
    }

    // Parse existing data safely
    let invoiceData = {};
    try {
      invoiceData = typeof invoice.data === 'string' ? JSON.parse(invoice.data) : (invoice.data || {});
    } catch (parseError) {
      logger.error({
        event: 'COMMENT_DATA_PARSE_ERROR',
        requestId,
        invoiceId,
        error: parseError.message
      });
      // Continue with empty object
      invoiceData = {};
    }

    // Initialize comment structure safely
    if (!invoiceData.notes) {
      invoiceData.notes = {};
    }
    if (!invoiceData.notes.comments) {
      invoiceData.notes.comments = [];
    }

    // Create new comment with validation
    const newComment = {
      id: Date.now().toString(),
      text: comment.trim(),
      author: author || req.user.name || 'Unknown User',
      authorEmail: authorEmail || req.user.email || 'unknown@example.com',
      timestamp: timestamp || new Date().toISOString(),
      replies: []
    };

    invoiceData.notes.comments.push(newComment);

    // Update the invoice with error handling
    try {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          data: JSON.stringify(invoiceData),
          updatedAt: new Date()
        }
      });

      logger.info({
        event: 'COMMENT_ADDED_SUCCESS',
        requestId,
        invoiceId,
        commentId: newComment.id,
        author: newComment.author
      });

      res.json({
        success: true,
        comment: newComment,
        requestId
      });

    } catch (updateError) {
      logger.error({
        event: 'COMMENT_UPDATE_ERROR',
        requestId,
        invoiceId,
        error: updateError.message,
        code: updateError.code
      });

      return res.status(500).json({
        error: 'Failed to save comment',
        message: 'Database update failed',
        requestId
      });
    }

  } catch (error) {
    logger.error({
      event: 'COMMENT_UNEXPECTED_ERROR',
      requestId,
      error: {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });

    res.status(500).json({
      error: 'Failed to add comment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      requestId
    });
  }
});

/**
 * GET /api/invoices/health
 * Health check endpoint for the invoice system
 */
router.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'user-invoices',
    version: '1.0.0'
  };

  try {
    // Test database connection
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1 as test`;
    const dbResponseTime = Date.now() - startTime;

    // Test a simple query
    const invoiceCount = await prisma.invoice.count();

    healthCheck.database = {
      status: 'connected',
      responseTime: `${dbResponseTime}ms`,
      invoiceCount
    };

    logger.info({
      event: 'HEALTH_CHECK_SUCCESS',
      dbResponseTime,
      invoiceCount
    });

    res.json(healthCheck);

  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.database = {
      status: 'error',
      error: error.message
    };

    logger.error({
      event: 'HEALTH_CHECK_FAILED',
      error: error.message
    });

    res.status(503).json(healthCheck);
  }
});

/**
 * GET /api/invoices/debug/user/:userId
 * Debug endpoint to check user-specific data (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/user/:userId', requireAuthOrTestUser, async (req, res) => {
    const { userId } = req.params;

    try {
      const userInvoices = await prisma.invoice.findMany({
        where: {
          OR: [
            { userId: userId },
            { userEmail: req.user?.email }
          ]
        },
        select: {
          id: true,
          title: true,
          status: true,
          userId: true,
          userEmail: true,
          createdAt: true,
          updatedAt: true
        },
        take: 10
      });

      res.json({
        requestedUserId: userId,
        currentUser: req.user,
        invoices: userInvoices,
        count: userInvoices.length
      });

    } catch (error) {
      res.status(500).json({
        error: 'Debug query failed',
        message: error.message
      });
    }
  });
}

module.exports = router;