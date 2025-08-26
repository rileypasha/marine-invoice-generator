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
const sessionConfig = {
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  name: 'connect.sid',
  resave: false,
  saveUninitialized: true, // Changed to true to ensure sessions are created
  rolling: true, // Reset expiry on activity
  cookie: {
    secure: false, // Set to false for now - HTTPS not required
    httpOnly: true,
    sameSite: 'lax', // Changed from 'none' to 'lax' for better compatibility
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/' // Ensure cookie is available on all paths
  }
};

// Only require secure cookies if explicitly in production with HTTPS
if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_HTTPS === 'true') {
  sessionConfig.cookie.secure = true;
  sessionConfig.cookie.sameSite = 'none';
}

app.use(session(sessionConfig));

// Log session creation for debugging
app.use((req, res, next) => {
  if (req.session && !req.session.logged) {
    req.session.logged = true;
    logger.info({
      event: 'SESSION_MIDDLEWARE',
      sessionId: req.sessionID,
      hasUser: !!req.session.user,
      path: req.path
    });
  }
  next();
});

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

// Request logging with session info
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    sessionId: req.sessionID,
    hasSession: !!req.session,
    hasUser: !!req.session?.user
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
const masterChangesRouter = require('./routes/master-changes');
const { loadUser, requireMaster } = require('./middleware/auth');
const { trackRevision } = require('./middleware/revision-tracker');

// Load user from session for all requests
app.use(loadUser);

// Track revisions for invoice updates
app.use(trackRevision);

// Auth routes (login/logout)
app.use('/api/auth', authRouter);

// Standard API routes
app.use('/api/v1', apiRouter);

// Master dashboard API routes
app.use('/api/master', masterRouter);

// Master change tracking routes
app.use('/api/master', masterChangesRouter);

// Master dashboard UI routes (protected)
app.get('/master', requireMaster, (req, res) => {
  // In production, serve from dist; in development, from src
  const dashboardPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '../dist/master/dashboard.html')
    : path.join(__dirname, '../src/master/dashboard.html');
  res.sendFile(dashboardPath);
});

// Master changes view route
app.get('/master/changes', requireMaster, (req, res) => {
  const changesPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '../dist/master/changes.html')
    : path.join(__dirname, '../src/master/changes.html');
  res.sendFile(changesPath);
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