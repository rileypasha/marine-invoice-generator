import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import path from 'path';
import { configureSecurity, getSecurityConfig } from './config/security';
import { attachCorrelationId, requireAuth, optionalAuth } from './middleware/auth';
import { ensureCsrfToken, csrfProtection, getCsrfToken, rateLimitCsrfGeneration, getCsrfRateLimitStats } from './middleware/csrf';
import { idempotency } from './middleware/idempotency';
import { logger, requestLogger, metrics } from './utils/logger';
import { TIMEOUTS_ENV, NETWORK } from './config/constants';
import './types/session';
import invoiceRoutes from './routes/invoice';
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import vesselRoutes from './routes/vessels';
import geoRoutes from './routes/geo';

/**
 * Enhanced compression middleware with intelligent content detection
 */
function createOptimizedCompression() {
  return compression({
    level: NETWORK.COMPRESSION_LEVEL,
    threshold: NETWORK.COMPRESSION_THRESHOLD,
    filter: (req, res) => {
      // Don't compress if client requests no compression
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Don't compress images, videos, or already compressed content
      const contentType = res.get('Content-Type') || '';
      if (
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/gzip')
      ) {
        return false;
      }

      // Compress text-based content
      return compression.filter(req, res);
    },
    // Enable Brotli compression for modern browsers if available
    // Note: Brotli config removed due to type incompatibility
  });
}

/**
 * Performance monitoring middleware
 */
function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = process.hrtime.bigint();
    req.startTime = startTime;

    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds

      // Log slow requests
      if (duration > 1000) {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration: `${duration.toFixed(2)}ms`,
          correlationId: req.correlationId,
        });
      }

      // Record metrics (disabled - method not available)
      // metrics.recordRequestDuration(req.method, req.route?.path || req.path, duration);
    });

    next();
  };
}

const app = express();
const PORT = process.env.PORT || 3001;

// Optimized middleware stack
app.use(createOptimizedCompression());
app.use(bodyParser.json({
  limit: NETWORK.REQUEST_SIZE_LIMIT,
  verify: (req, _res, buf) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({
  extended: true,
  limit: NETWORK.REQUEST_SIZE_LIMIT,
  parameterLimit: 1000 // Prevent parameter pollution
}));

// Security configuration
const securityConfig = getSecurityConfig();
configureSecurity(app, securityConfig);

// Global middleware with performance monitoring
app.use(attachCorrelationId);
app.use(performanceMiddleware());
app.use(requestLogger);
app.use(ensureCsrfToken);

// Health check endpoint (no auth required)
app.get('/health', (_req: any, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    correlationId: _req.correlationId,
  });
});

// Enhanced metrics endpoint with performance data
app.get('/metrics', optionalAuth, (req, res) => {
  const metricsData = metrics.getMetrics();
  const isAuthenticated = !!(req as any).userId;

  if (isAuthenticated) {
    // Full metrics for authenticated users
    res.json({
      ...metricsData,
      performance: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
      },
      csrf: getCsrfRateLimitStats(),
      timestamp: new Date().toISOString(),
    });
  } else {
    // Basic metrics for public access
    res.json({
      status: 'healthy',
      requestCount: metricsData.http_requests_total || 0,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
});

// CSRF token endpoint
app.get('/api/v1/csrf-token', rateLimitCsrfGeneration, getCsrfToken);

// Auth routes (no CSRF for login)
app.use('/api/v1/auth', authRoutes);

// Protected routes
app.use('/api/v1/invoice',
  requireAuth,
  csrfProtection,
  idempotency,
  invoiceRoutes
);

app.use('/api/v1/customers',
  requireAuth,
  csrfProtection,
  customerRoutes
);

app.use('/api/v1/vessels',
  requireAuth,
  csrfProtection,
  vesselRoutes
);

app.use('/api/geo',
  requireAuth,
  geoRoutes
);

// API 404 handler - ensures API routes return JSON errors, not HTML pages
app.use('/api/*', (req: any, res: any) => {
  const correlationId = req.correlationId || 'api_404';

  logger.warn('API endpoint not found', {
    path: req.path,
    method: req.method,
    correlationId,
  });

  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'API endpoint not found',
    path: req.path,
    correlationId,
  });
});

// Serve static files from built React app
const isDevelopment = process.env.NODE_ENV === 'development';

if (!isDevelopment) {
  // In production, serve the built React app
  app.use(express.static(path.join(__dirname, '../dist'), {
    setHeaders: (res, filePath) => {
      // Cache static assets for 1 year, HTML for 5 minutes
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
      }
    }
  }));
} else {
  // In development, serve from the current directory (for any non-API routes)
  app.use(express.static('.', {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      // Cache static assets for 1 hour, HTML for 5 minutes
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
      }
    }
  }));
}

// Error handling middleware
app.use((err: any, req: any, res: any, _next: any) => {
  const correlationId = req.correlationId || 'error';
  
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    correlationId,
    path: req.path,
    method: req.method,
  });

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    code: err.code || 'INTERNAL_ERROR',
    message: isDev ? err.message : 'An error occurred processing your request',
    correlationId,
    ...(isDev && { stack: err.stack }),
  });
});

// Client-side routing support for React app
if (!isDevelopment) {
  app.get('*', (req, res) => {
    // Serve React app for all non-API routes
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  // 404 handler for development
  app.use((req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      path: req.path,
      correlationId: (req as any).correlationId,
    });
  });
}

// Graceful shutdown
let server: any;

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connections, Redis, etc.
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, TIMEOUTS_ENV.GRACEFUL_SHUTDOWN);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
if (require.main === module) {
  server = app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`, {
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
    });
  });
}

export default app;