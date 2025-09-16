import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || 'logs';

// Custom format for structured logging
const structuredFormat = winston.format.printf(({ timestamp, level, message, correlationId, ...metadata }) => {
  const log = {
    timestamp,
    level,
    message,
    correlationId,
    ...metadata,
  };
  
  // Remove sensitive data
  if ('password' in log) log.password = '[REDACTED]';
  if ('token' in log) log.token = '[REDACTED]';
  if ('csrfToken' in log) log.csrfToken = '[REDACTED]';
  if ('cookie' in log) log.cookie = '[REDACTED]';
  if ('authorization' in log) log.authorization = '[REDACTED]';
  
  return JSON.stringify(log);
});

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    structuredFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
    }),
  ],
});

// Create specialized loggers for different components
export const authLogger = logger.child({ component: 'auth' });
export const apiLogger = logger.child({ component: 'api' });
export const queueLogger = logger.child({ component: 'queue' });

// Metrics collection
class Metrics {
  private counters: Map<string, number> = new Map();
  private timers: Map<string, number[]> = new Map();

  increment(metric: string, value = 1): void {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + value);
  }

  recordTime(metric: string, duration: number): void {
    const times = this.timers.get(metric) || [];
    times.push(duration);
    this.timers.set(metric, times);
  }

  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    // Add counters
    this.counters.forEach((value, key) => {
      metrics[key] = value;
    });
    
    // Add timer stats
    this.timers.forEach((times, key) => {
      if (times.length > 0) {
        const sorted = times.sort((a, b) => a - b);
        metrics[`${key}_count`] = times.length;
        metrics[`${key}_min`] = sorted[0];
        metrics[`${key}_max`] = sorted[sorted.length - 1];
        metrics[`${key}_median`] = sorted[Math.floor(sorted.length / 2)];
        metrics[`${key}_p95`] = sorted[Math.floor(sorted.length * 0.95)];
        metrics[`${key}_p99`] = sorted[Math.floor(sorted.length * 0.99)];
      }
    });
    
    return metrics;
  }

  reset(): void {
    this.counters.clear();
    this.timers.clear();
  }
}

export const metrics = new Metrics();

// Middleware for request logging
export const requestLogger = (req: any, res: any, next: any): void => {
  const startTime = Date.now();
  const correlationId = req.correlationId || 'unknown';
  
  // Log request
  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Outgoing response', {
      correlationId,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length'),
    });
    
    // Record metrics
    metrics.increment(`http_requests_total`);
    metrics.increment(`http_requests_${req.method.toLowerCase()}_total`);
    metrics.increment(`http_requests_${res.statusCode}_total`);
    metrics.recordTime('http_request_duration_ms', duration);
    
    if (res.statusCode === 401) {
      metrics.increment('auth_failures_total');
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

export default logger;