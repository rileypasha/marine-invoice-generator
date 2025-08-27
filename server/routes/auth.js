const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * POST /api/auth/login
 * Login endpoint to create session
 */
router.post('/login', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Security validation: ensure name doesn't contain password-like patterns
    const sanitizedName = (() => {
      // For existing users logging in, we don't need a name
      // Name should only be provided during initial signup
      if (!name) return null;
      
      // Security check: reject names that look like passwords
      const nameStr = String(name).trim();
      
      // Check for password patterns
      const hasNumbers = /\d/.test(nameStr);
      const hasSpecialChars = /[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(nameStr);
      const looksLikePassword = hasNumbers && (nameStr.length > 20 || hasSpecialChars);
      
      // If it looks like a password, reject it
      if (looksLikePassword || nameStr.toLowerCase().includes('password')) {
        logger.warn({
          event: 'SUSPICIOUS_NAME_REJECTED',
          email,
          suspiciousName: nameStr.substring(0, 10) + '...',
          reason: 'Name appears to be a password'
        });
        return null; // Reject suspicious names
      }
      
      return nameStr;
    })();

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Determine role based on master emails config
      const masterEmails = (process.env.MASTER_EMAILS || '')
        .split(',')
        .map(e => e.trim())
        .filter(e => e);
      
      const isMaster = masterEmails.includes(email);
      
      // Create new user with sanitized name
      // Use the sanitized name if provided, otherwise use email prefix
      const finalName = sanitizedName || email.split('@')[0];
      
      user = await prisma.user.create({
        data: {
          email,
          name: finalName,
          role: isMaster ? 'master' : 'standard'
        }
      });
      
      logger.info({
        event: 'USER_CREATED',
        email,
        role: user.role
      });
    }

    // Create session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    // Force session save before responding
    req.session.save((err) => {
      if (err) {
        logger.error({
          event: 'SESSION_SAVE_ERROR',
          error: err.message,
          sessionId: req.sessionID
        });
        return res.status(500).json({ error: 'Session creation failed' });
      }
      
      logger.info({
        event: 'SESSION_CREATED',
        sessionId: req.sessionID,
        userEmail: user.email,
        sessionUser: req.session.user,
        cookie: req.session.cookie
      });

      logger.info({
        event: 'USER_LOGIN',
        email: user.email,
        role: user.role,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        sessionId: req.sessionID // Include for debugging
      });
    });
  } catch (error) {
    logger.error({
      event: 'LOGIN_ERROR',
      error: error.message,
      email: req.body.email
    });
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout endpoint to destroy session
 */
router.post('/logout', (req, res) => {
  const email = req.session?.user?.email;
  
  req.session.destroy((err) => {
    if (err) {
      logger.error({
        event: 'LOGOUT_ERROR',
        error: err.message,
        email
      });
      return res.status(500).json({ error: 'Logout failed' });
    }

    logger.info({
      event: 'USER_LOGOUT',
      email,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: req.session.user
  });
});

/**
 * GET /api/auth/check-master
 * Check if current user is a master user
 */
router.get('/check-master', (req, res) => {
  logger.info({ 
    event: 'CHECK_MASTER_REQUEST',
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionUser: req.session?.user,
    headers: req.headers
  });
  
  if (!req.session || !req.session.user) {
    logger.info({ event: 'CHECK_MASTER_NO_SESSION' });
    return res.json({ isMaster: false });
  }

  const masterEmails = (process.env.MASTER_EMAILS || '')
    .split(',')
    .map(email => email.trim())
    .filter(email => email);

  const isMaster = masterEmails.includes(req.session.user.email);
  
  logger.info({ 
    event: 'CHECK_MASTER',
    email: req.session.user.email,
    isMaster,
    masterEmails: masterEmails.length > 0 ? 'configured' : 'not configured'
  });

  res.json({ 
    isMaster,
    email: req.session.user.email 
  });
});

module.exports = router;