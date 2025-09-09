const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * POST /api/auth/form-login
 * Form-based login that redirects instead of returning JSON
 */
router.post('/form-login', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Login Failed</h1>
            <p>Email is required</p>
            <a href="/simple-login">Try again</a>
          </body>
        </html>
      `);
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Auto-create user for email-only auth
      const emailParts = email.split('@');
      const defaultName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
      
      user = await prisma.user.create({
        data: {
          email,
          name: defaultName,
          role: 'standard'
        }
      });
    }

    // Create session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    // Force session save before redirecting
    req.session.save((err) => {
      if (err) {
        logger.error({
          event: 'SESSION_SAVE_ERROR',
          error: err.message,
          sessionId: req.sessionID
        });
        return res.status(500).send(`
          <html>
            <body>
              <h1>Login Failed</h1>
              <p>Session creation failed</p>
              <a href="/simple-login">Try again</a>
            </body>
          </html>
        `);
      }
      
      logger.info({
        event: 'FORM_LOGIN_SUCCESS',
        sessionId: req.sessionID,
        userEmail: user.email,
        redirecting: true
      });

      // Redirect to app
      res.redirect('/app');
    });
  } catch (error) {
    logger.error({
      event: 'FORM_LOGIN_ERROR',
      error: error.message
    });
    
    res.status(500).send(`
      <html>
        <body>
          <h1>Login Error</h1>
          <p>${error.message}</p>
          <a href="/simple-login">Try again</a>
        </body>
      </html>
    `);
  }
});

module.exports = router;