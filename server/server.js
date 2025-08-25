const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pino = require('pino');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

const prisma = new PrismaClient();
const app = express();

// Trust proxy - MUST be before session middleware
app.set('trust proxy', 1);

// Session middleware - must come before other middleware
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https://i.imgur.com", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
const apiRouter = require('./routes/api');
const masterRouter = require('./routes/master');
const authRouter = require('./routes/auth');
const { loadUser, requireMaster } = require('./middleware/auth');

// Load user from session for all requests
app.use(loadUser);

// Auth routes (login/logout)
app.use('/api/auth', authRouter);

// Standard API routes
app.use('/api/v1', apiRouter);

// Master dashboard API routes
app.use('/api/master', masterRouter);

// Master dashboard UI routes (protected)
app.get('/master', requireMaster, (req, res) => {
  // In production, serve from dist; in development, from src
  const dashboardPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '../dist/master/dashboard.html')
    : path.join(__dirname, '../src/master/dashboard.html');
  res.sendFile(dashboardPath);
});

// Serve master assets - in production from dist, in development from src
if (process.env.NODE_ENV === 'production') {
  app.use('/master', express.static(path.join(__dirname, '../dist/master')));
} else {
  app.use('/master', express.static(path.join(__dirname, '../src/master')));
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Important for Render

const server = app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  await prisma.$disconnect();
  logger.info('Database connection closed');
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);