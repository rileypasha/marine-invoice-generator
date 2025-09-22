import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger';
import { RATE_LIMITS, PERFORMANCE_ENV } from '../config/constants';

/**
 * Optimized LRU Cache for rate limiting with memory bounds
 */
class LRURateLimitCache {
  private cache = new Map<string, number[]>();
  private accessOrder = new Map<string, number>();
  private readonly maxSize: number;
  private accessCounter = 0;

  constructor(maxSize: number = PERFORMANCE_ENV.MAX_RATE_LIMIT_ENTRIES) {
    this.maxSize = maxSize;
  }

  get(key: string): number[] {
    const timestamps = this.cache.get(key) || [];

    // Update access order
    this.accessOrder.set(key, this.accessCounter++);

    return timestamps;
  }

  set(key: string, timestamps: number[]): void {
    // Remove least recently used entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, timestamps);
    this.accessOrder.set(key, this.accessCounter++);
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruAccess = Number.MAX_SAFE_INTEGER;

    for (const [key, access] of this.accessOrder.entries()) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      logger.debug('Evicted LRU rate limit entry', { key: lruKey });
    }
  }

  cleanup(windowMs: number): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, timestamps] of this.cache.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

      if (validTimestamps.length === 0) {
        this.delete(key);
        removedCount++;
      } else if (validTimestamps.length < timestamps.length) {
        this.set(key, validTimestamps);
      }
    }

    return removedCount;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsageKB: this.estimateMemoryUsage(),
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation: key (50 bytes) + timestamps array (8 bytes per timestamp)
    let totalBytes = 0;
    for (const [key, timestamps] of this.cache.entries()) {
      totalBytes += key.length * 2 + timestamps.length * 8 + 100; // 100 bytes overhead
    }
    return Math.round(totalBytes / 1024);
  }
}

interface CsrfRequest extends Request {
  csrfToken?: () => string;
  correlationId?: string;
  session: any;
}

// CSRF token generation
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// Double-submit cookie pattern CSRF protection
export const csrfProtection = (req: CsrfRequest, res: Response, next: NextFunction): void => {
  const correlationId = req.correlationId || 'csrf_check';
  
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API endpoints that use different auth (e.g., API keys)
  if (req.path.startsWith('/api/v1/webhook/')) {
    return next();
  }

  // Get CSRF token from header or body
  const tokenFromHeader = req.headers['x-csrf-token'] as string;
  const tokenFromBody = req.body?._csrf;
  const submittedToken = tokenFromHeader || tokenFromBody;

  // Get session CSRF token
  const sessionToken = req.session?.csrfToken;

  if (!sessionToken) {
    logger.warn('No CSRF token in session', {
      correlationId,
      method: req.method,
      path: req.path,
      hasSession: !!req.session,
    });

    res.status(403).json({
      code: 'CSRF_TOKEN_MISSING',
      message: 'CSRF token not found in session',
      correlationId,
    });
    return;
  }

  if (!submittedToken) {
    logger.warn('No CSRF token in request', {
      correlationId,
      method: req.method,
      path: req.path,
    });

    res.status(403).json({
      code: 'CSRF_TOKEN_REQUIRED',
      message: 'CSRF token is required for this request',
      correlationId,
    });
    return;
  }

  // Validate token
  if (submittedToken !== sessionToken) {
    logger.warn('CSRF token mismatch', {
      correlationId,
      method: req.method,
      path: req.path,
      submittedToken: submittedToken.substring(0, 8) + '...',
      sessionToken: sessionToken.substring(0, 8) + '...',
    });

    res.status(403).json({
      code: 'CSRF_VALIDATION_FAILED',
      message: 'Invalid CSRF token',
      correlationId,
    });
    return;
  }

  logger.debug('CSRF check passed', {
    correlationId,
    method: req.method,
    path: req.path,
  });

  next();
};

// Middleware to ensure CSRF token exists in session
export const ensureCsrfToken = (req: CsrfRequest, _res: Response, next: NextFunction): void => {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
    logger.debug('Generated new CSRF token', {
      correlationId: req.correlationId,
      tokenPrefix: req.session.csrfToken.substring(0, 8),
    });
  }

  // Add helper method to request
  req.csrfToken = () => req.session?.csrfToken || '';

  next();
};

// Endpoint to get CSRF token
export const getCsrfToken = (req: CsrfRequest, res: Response): void => {
  if (!req.session) {
    res.status(400).json({
      code: 'NO_SESSION',
      message: 'Session not initialized',
      correlationId: req.correlationId,
    });
    return;
  }

  // Ensure token exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  res.json({
    csrfToken: req.session.csrfToken,
    correlationId: req.correlationId,
  });
};

// SameSite cookie configuration for CSRF protection
export const csrfCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 60 * 1000, // 30 minutes
};

/**
 * Enhanced CSRF token manager with performance optimizations
 */
export class CsrfTokenManager {
  private _secret: string;
  private tokenCache = new Map<string, { token: string; timestamp: number }>();
  private readonly tokenTTL = 30 * 60 * 1000; // 30 minutes

  constructor(secret: string) {
    this._secret = secret;

    // Cleanup expired tokens periodically
    setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000); // Every 5 minutes
  }

  generate(sessionId: string): string {
    // Check if we have a valid cached token
    const cached = this.tokenCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < this.tokenTTL) {
      return cached.token;
    }

    // Generate new token
    const timestamp = Date.now();
    const random = randomBytes(16).toString('hex');
    const data = `${sessionId}:${timestamp}:${random}`;

    // In production, use proper encryption
    const token = Buffer.from(data).toString('base64');

    // Cache the token
    this.tokenCache.set(sessionId, { token, timestamp });

    return token;
  }

  validate(token: string, sessionId: string, maxAge = 3600000): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const [tokenSessionId, timestamp] = decoded.split(':');

      if (tokenSessionId !== sessionId) {
        logger.warn('CSRF token session mismatch', {
          expected: sessionId,
          received: tokenSessionId,
        });
        return false;
      }

      const tokenAge = Date.now() - parseInt(timestamp, 10);
      if (tokenAge > maxAge) {
        logger.warn('CSRF token expired', {
          tokenAge,
          maxAge,
          sessionId,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('CSRF token validation error', { error, sessionId });
      return false;
    }
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [sessionId, { timestamp }] of this.tokenCache.entries()) {
      if (now - timestamp > this.tokenTTL) {
        this.tokenCache.delete(sessionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug('Cleaned up expired CSRF tokens', {
        removedCount,
        remainingTokens: this.tokenCache.size,
      });
    }
  }

  getStats() {
    return {
      cachedTokens: this.tokenCache.size,
      rateLimitCache: tokenGenerationLimits.getStats(),
    };
  }

  clearCache(): void {
    this.tokenCache.clear();
  }
}

// Optimized rate limiting for CSRF token generation with LRU cache
const tokenGenerationLimits = new LRURateLimitCache(PERFORMANCE_ENV.MAX_RATE_LIMIT_ENTRIES);

export const rateLimitCsrfGeneration = (req: CsrfRequest, res: Response, next: NextFunction): void => {
  const identifier = req.session?.userId || req.ip;
  const now = Date.now();
  const windowMs = RATE_LIMITS.CSRF_WINDOW_MS;
  const maxRequests = RATE_LIMITS.CSRF_MAX_REQUESTS;

  // Get request timestamps for this identifier
  let timestamps = tokenGenerationLimits.get(identifier);

  // Remove old timestamps outside the window
  timestamps = timestamps.filter(ts => now - ts < windowMs);

  if (timestamps.length >= maxRequests) {
    logger.warn('CSRF token generation rate limit exceeded', {
      correlationId: req.correlationId,
      identifier,
      requests: timestamps.length,
      cacheStats: tokenGenerationLimits.getStats(),
    });

    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many CSRF token requests',
      correlationId: req.correlationId,
      retryAfter: Math.ceil(windowMs / 1000),
    });
    return;
  }

  timestamps.push(now);
  tokenGenerationLimits.set(identifier, timestamps);

  next();
};

// Optimized cleanup with performance monitoring
const cleanupInterval = setInterval(() => {
  const startTime = performance.now();
  const removedCount = tokenGenerationLimits.cleanup(RATE_LIMITS.CSRF_WINDOW_MS);
  const duration = performance.now() - startTime;

  if (removedCount > 0) {
    logger.debug('CSRF rate limit cache cleanup completed', {
      removedEntries: removedCount,
      cleanupDurationMs: duration.toFixed(2),
      cacheStats: tokenGenerationLimits.getStats(),
    });
  }
}, RATE_LIMITS.CSRF_WINDOW_MS); // Clean up every window period

// Export cache stats for monitoring
export const getCsrfRateLimitStats = () => tokenGenerationLimits.getStats();

// Graceful cleanup on process exit
process.on('beforeExit', () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
});