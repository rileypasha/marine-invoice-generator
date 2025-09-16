const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Secure login with proper password validation
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('LOGIN ATTEMPT:', email);

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Try to find user in database
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      if (!user.password) {
        return res.status(401).json({ success: false, error: 'Account not properly configured' });
      }

      // Check password with bcrypt
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
        
        // Create session
        req.session.user = {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          role: user.role || 'user'
        };
        
        // Save session
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ success: false, error: 'Session save failed' });
          }
          
          console.log('SESSION SAVED:', req.sessionID);
          
          return res.json({
            success: true,
            user: req.session.user,
            sessionId: req.sessionID
          });
        });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ success: false, error: 'Authentication service unavailable' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if user is logged in
router.get('/check', (req, res) => {
  console.log('AUTH CHECK - Session ID:', req.sessionID);
  console.log('AUTH CHECK - Session user:', req.session.user);
  
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user
    });
  } else {
    res.status(401).json({
      authenticated: false
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

module.exports = router;