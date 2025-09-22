const express = require('express');
const session = require('express-session');
const cors = require('cors');
const pino = require('pino');
const net = require('net');
require('dotenv').config();

const app = express();

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

// Trust proxy for session handling
app.set('trust proxy', true);

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Session configuration - exactly like the legacy system
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  name: 'connect.sid',
  resave: false,
  saveUninitialized: true,
  rolling: true,
  cookie: {
    secure: false, // False for development
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  }
}));

// Session logging middleware
app.use((req, res, next) => {
  if (req.session && !req.session.logged) {
    req.session.logged = true;
    logger.info({
      event: 'SESSION_MIDDLEWARE',
      sessionId: req.sessionID,
      hasUser: !!req.session.user,
      path: req.path,
      hostname: req.hostname,
      cookieHeader: req.headers.cookie
    });
  }
  next();
});

// Use legacy auth routes with error handling
try {
  const authRoutes = require('./server/routes/legacy-auth');
  app.use('/api/auth', authRoutes);
} catch (error) {
  logger.error('❌ Failed to load auth routes:', error.message);
  process.exit(1);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    session: req.session?.user?.email || 'none',
    sessionId: req.sessionID
  });
});

// Protected invoices endpoint using legacy middleware
try {
  const { requireAuth } = require('./server/middleware/legacy-auth');
  app.get('/api/invoices', requireAuth, (req, res) => {
    res.json({
      message: 'Welcome to invoices! 🧾',
      user: req.user,
      invoices: []
    });
  });
} catch (error) {
  logger.error('❌ Failed to load auth middleware:', error.message);
  // Continue without protected routes - they'll just return 404
}

// Port conflict detection
function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        reject(err);
      }
    });
  });
}

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
let server;
const gracefulShutdown = () => {
  logger.info('🛑 Received shutdown signal, gracefully closing server...');
  if (server) {
    server.close(() => {
      logger.info('✅ Server closed gracefully');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server with port conflict detection
async function startServer() {
  const port = process.env.PORT || 3001;

  try {
    const isPortFree = await checkPort(port);
    if (!isPortFree) {
      logger.error(`❌ Port ${port} is already in use. Please stop the other server first.`);
      logger.info('💡 Try: killall node OR pkill -f "legacy-auth-server"');
      process.exit(1);
    }

    server = app.listen(port, () => {
      logger.info('🚀 Legacy Auth Server running on port ' + port);
      logger.info('📋 Available endpoints:');
      logger.info('   POST /api/auth/login');
      logger.info('   POST /api/auth/logout');
      logger.info('   GET /api/auth/me');
      logger.info('   GET /api/invoices (protected)');
      logger.info('   GET /health');
      logger.info('🌐 Frontend should connect to: http://localhost:' + port);
      logger.info('🔑 Test credentials: test@marinegroupbw.com / TempPassword123!');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${port} is already in use`);
      } else {
        logger.error('❌ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();