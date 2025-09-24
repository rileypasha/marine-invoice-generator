import { Application } from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  sessionSecret: string;
  corsOrigins: string[];
  redisUrl?: string;
  trustProxy: boolean;
  cookieDomain?: string;
}

export function configureSecurity(app: Application, config: SecurityConfig): void {
  // Trust proxy for proper IP detection behind reverse proxies
  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust for your needs
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS configuration
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Log all CORS requests for debugging
      logger.info('CORS request', {
        origin,
        allowedOrigins: config.corsOrigins,
        matches: config.corsOrigins.includes(origin)
      });

      if (config.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', { origin, allowedOrigins: config.corsOrigins });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Correlation-ID', 'Idempotency-Key'],
    exposedHeaders: ['X-Correlation-ID', 'X-Idempotent-Replay'],
    maxAge: 86400, // 24 hours
  };
  
  app.use(cors(corsOptions));

  // Session configuration
  const sessionConfig: session.SessionOptions = {
    secret: config.sessionSecret,
    name: 'invoice.sid',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
      maxAge: 30 * 60 * 1000, // 30 minutes
      domain: config.cookieDomain,
    },
  };

  // Use Redis for session storage in production
  if (config.redisUrl) {
    const redisClient = createClient({
      url: config.redisUrl,
      legacyMode: true,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err });
    });

    redisClient.connect().then(() => {
      logger.info('Connected to Redis for session storage');
    });

    sessionConfig.store = new RedisStore({
      client: redisClient,
      prefix: 'sess:',
      ttl: 1800, // 30 minutes
    });
  }

  app.use(session(sessionConfig));

  // Rate limiting
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Limit each IP to 10,000 requests per windowMs (development-friendly)
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      });
    },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit auth attempts (development-friendly)
    skipSuccessfulRequests: true,
    handler: (req, res) => {
      logger.warn('Auth rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });
      res.status(429).json({
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts',
      });
    },
  });

  const saveLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 saves per minute (development-friendly)
    keyGenerator: (req: any) => req.session?.userId || req.ip,
    handler: (req, res) => {
      logger.warn('Save rate limit exceeded', {
        ip: req.ip,
        userId: (req as any).userId,
      });
      res.status(429).json({
        code: 'SAVE_RATE_LIMIT_EXCEEDED',
        message: 'Too many save attempts, please wait',
      });
    },
  });

  // Apply rate limiters
  app.use('/api/', generalLimiter);
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1/invoice/save', saveLimiter);

  // Security headers middleware
  app.use((_req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  });

  logger.info('Security middleware configured', {
    corsOrigins: config.corsOrigins,
    sessionStore: config.redisUrl ? 'Redis' : 'MemoryStore',
    trustProxy: config.trustProxy,
  });
}

// Environment-specific configurations
export function getSecurityConfig(): SecurityConfig {
  const env = process.env.NODE_ENV || 'development';
  
  const configs: Record<string, SecurityConfig> = {
    development: {
      sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      corsOrigins: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'],
      trustProxy: false,
    },
    production: {
      sessionSecret: process.env.SESSION_SECRET!,
      corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
      redisUrl: process.env.REDIS_URL,
      trustProxy: true,
      cookieDomain: process.env.COOKIE_DOMAIN,
    },
    test: {
      sessionSecret: 'test-secret',
      corsOrigins: ['http://localhost:3000'],
      trustProxy: false,
    },
  };

  if (!configs[env]) {
    throw new Error(`Unknown environment: ${env}`);
  }

  if (env === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in production');
  }

  return configs[env];
}