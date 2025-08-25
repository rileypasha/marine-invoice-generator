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
      
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
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

    logger.info({
      event: 'USER_LOGIN',
      email: user.email,
      role: user.role,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
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
  if (!req.session || !req.session.user) {
    return res.json({ isMaster: false });
  }

  const masterEmails = (process.env.MASTER_EMAILS || '')
    .split(',')
    .map(email => email.trim())
    .filter(email => email);

  const isMaster = masterEmails.includes(req.session.user.email);

  res.json({ 
    isMaster,
    email: req.session.user.email 
  });
});

module.exports = router;