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

// Configure cookie domain for production
if (process.env.COOKIE_DOMAIN) {
  sessionConfig.cookie.domain = process.env.COOKIE_DOMAIN;
  logger.info(`Setting cookie domain to: ${process.env.COOKIE_DOMAIN}`);
}

// Only require secure cookies if explicitly in production with HTTPS
if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_HTTPS === 'true') {
  sessionConfig.cookie.secure = true;
  sessionConfig.cookie.sameSite = 'none';
} else if (process.env.NODE_ENV === 'production') {
  // For production without explicit HTTPS requirement, use secure cookies
  sessionConfig.cookie.secure = true;
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
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
    },
  },
}));
// Configure CORS to allow multiple origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Parse allowed origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3000'];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
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
const authFormRouter = require('./routes/auth-form');
const masterChangesRouter = require('./routes/master-changes');
const { loadUser, requireMaster } = require('./middleware/auth');
const { trackRevision } = require('./middleware/revision-tracker');

// Load user from session for all requests
app.use(loadUser);

// Track revisions for invoice updates
app.use(trackRevision);

// Auth routes (login/logout)
app.use('/api/auth', authRouter);
app.use('/api/auth', authFormRouter);

// Emergency login page (temporary fix for modal issues)
app.get('/login', (req, res) => {
  const loginPath = path.join(__dirname, '../src/emergency-login.html');
  res.sendFile(loginPath);
});

// Simple login page (guaranteed to work)
app.get('/simple-login', (req, res) => {
  const loginPath = path.join(__dirname, '../src/simple-login.html');
  res.sendFile(loginPath);
});

// Form-based login page (server-side redirect)
app.get('/form-login', (req, res) => {
  const loginPath = path.join(__dirname, '../src/form-login.html');
  res.sendFile(loginPath);
});

// Diagnostic page
app.get('/diagnostic', (req, res) => {
  const diagnosticPath = path.join(__dirname, '../src/diagnostic.html');
  res.sendFile(diagnosticPath);
});

// TEMPORARY: Security fix route (REMOVE AFTER FIXING PRODUCTION DATA)
const securityFixRouter = require('./routes/security-fix');
app.use('/api/security', securityFixRouter);

// TEMPORARY: Invoice fix route (REMOVE AFTER FIXING PRODUCTION DATA)
const invoiceFixRouter = require('./routes/invoice-fix');
app.use('/api/invoice-fix', invoiceFixRouter);

// TEMPORARY: Manual fix route (REMOVE AFTER FIXING PRODUCTION DATA)
const manualFixRouter = require('./routes/manual-fix');
app.use('/api/manual-fix', manualFixRouter);

// TEMPORARY: Migration route for changes tracker (REMOVE AFTER RUNNING)
const migrationRouter = require('./routes/run-migration');
app.use('/api/migration', migrationRouter);

// V2 API routes with improved validation and error handling
const invoiceV2Router = require('./routes/invoiceV2');
app.use('/api/v2/invoice', invoiceV2Router);

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
  
  // Serve app.html for /app route
  app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/app.html'));
  });
  
  // Serve index.html for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling middleware (must be last)
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

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