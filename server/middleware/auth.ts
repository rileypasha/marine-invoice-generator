import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string || `auth_${Date.now()}`;
  req.correlationId = correlationId;

  // Check session
  if (!req.session?.userId) {
    logger.warn('Authentication required', {
      correlationId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(401)
      .header('WWW-Authenticate', 'Session realm="Invoice System"')
      .json({
        code: 'AUTH_REQUIRED',
        message: 'Please log in to continue',
        timestamp: new Date().toISOString(),
        correlationId,
      });
    return;
  }

  // Check session expiry
  const sessionExpiry = req.session.expiresAt;
  if (sessionExpiry && new Date() > new Date(sessionExpiry)) {
    logger.warn('Session expired', {
      correlationId,
      userId: req.session.userId,
      expiredAt: sessionExpiry,
    });

    // Clear expired session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Failed to destroy expired session', { error: err, correlationId });
      }
    });

    res.status(401)
      .header('WWW-Authenticate', 'Session realm="Invoice System"')
      .json({
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please log in again.',
        timestamp: new Date().toISOString(),
        correlationId,
      });
    return;
  }

  // Extend session on activity
  if (req.session.touch) {
    req.session.touch();
  }

  // Attach user info to request
  req.userId = req.session.userId;
  req.sessionId = req.sessionID;

  logger.debug('Auth check passed', {
    correlationId,
    userId: req.userId,
    path: req.path,
  });

  next();
};

export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string || `auth_${Date.now()}`;
  req.correlationId = correlationId;

  if (req.session?.userId) {
    req.userId = req.session.userId;
    req.sessionId = req.sessionID;

    // Check expiry
    const sessionExpiry = req.session.expiresAt;
    if (sessionExpiry && new Date() > new Date(sessionExpiry)) {
      req.session.destroy((err) => {
        if (err) {
          logger.error('Failed to destroy expired session', { error: err, correlationId });
        }
      });
      req.userId = undefined;
      req.sessionId = undefined;
    }
  }

  next();
};

export const refreshSession = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.session?.userId) {
    // Update session expiry
    const expiryTime = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes
    req.session.expiresAt = expiryTime.toISOString();
    
    logger.debug('Session refreshed', {
      correlationId: req.correlationId,
      userId: req.userId,
      newExpiry: req.session.expiresAt,
    });
  }
  next();
};

export const attachCorrelationId = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string 
    || `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};