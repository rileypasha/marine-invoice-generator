const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// In-memory token store (in production, use Redis or database)
const tokenStore = new Map();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(token);
      logger.info({ event: 'TOKEN_EXPIRED', token: token.substring(0, 10) });
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /api/token-auth/login
 * Login with token-based authentication for CloudFlare issues
 */
router.post('/login', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      const masterEmails = (process.env.MASTER_EMAILS || '')
        .split(',')
        .map(e => e.trim())
        .filter(e => e);
      
      const isMaster = masterEmails.includes(email);
      
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          role: isMaster ? 'master' : 'standard'
        }
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    // Store token
    tokenStore.set(token, {
      userId: user.id,
      email: user.email,
      role: user.role,
      expiresAt
    });

    // Also create traditional session if possible
    if (req.session) {
      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
      
      req.session.save((err) => {
        if (err) {
          logger.error({ event: 'SESSION_SAVE_ERROR', error: err.message });
        }
      });
    }

    logger.info({
      event: 'TOKEN_LOGIN',
      email: user.email,
      role: user.role,
      token: token.substring(0, 10) + '...',
      hasSession: !!req.session
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token, // Send token to be stored in localStorage
      expiresAt
    });

  } catch (error) {
    logger.error({
      event: 'TOKEN_LOGIN_ERROR',
      error: error.message,
      email: req.body.email
    });
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/token-auth/verify
 * Verify token and get user info
 */
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const tokenData = tokenStore.get(token);

  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (tokenData.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return res.status(401).json({ error: 'Token expired' });
  }

  res.json({
    user: {
      id: tokenData.userId,
      email: tokenData.email,
      role: tokenData.role
    }
  });
});

/**
 * POST /api/token-auth/logout
 * Logout and invalidate token
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    tokenStore.delete(token);
    logger.info({ event: 'TOKEN_LOGOUT', token: token.substring(0, 10) });
  }

  // Also destroy session if it exists
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.error({ event: 'SESSION_DESTROY_ERROR', error: err.message });
      }
    });
  }

  res.json({ success: true });
});

module.exports = router;