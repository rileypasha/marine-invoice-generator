const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const cors = require('cors');
const session = require('express-session');

const app = express();

// PostgreSQL connection
const pool = new Pool({
  connectionString: 'postgresql://marine_invoice_db_user:K94yCcurh0hW7evjgDr6SC5aEYGS5jd0@dpg-d2m2uqbe5dus739bmuv0-a.oregon-postgres.render.com/marine_invoice_db',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Session configuration
app.use(session({
  secret: 'dev-secret-change-in-production',
  name: 'invoice.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000, // 30 minutes
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    session: req.session?.userId || 'none'
  });
});

// Login endpoint
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, name, password, role, "createdAt" FROM "User" WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.name = user.name;
    req.session.role = user.role;

    console.log('Login successful:', {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    // Success response
    res.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 'LOGIN_FAILED',
      message: 'Failed to log in'
    });
  }
});

// Logout endpoint
app.post('/api/v1/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Failed to destroy session:', err);
      }
    });
  }

  res.json({
    message: 'Logged out successfully'
  });
});

// Check authentication status
app.get('/api/v1/auth/check', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      code: 'NOT_AUTHENTICATED',
      message: 'Not authenticated'
    });
  }

  res.json({
    userId: req.session.userId,
    email: req.session.email,
    name: req.session.name,
    role: req.session.role,
    message: 'Authenticated'
  });
});

// Protected invoices endpoint (placeholder)
app.get('/api/v1/invoices', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      code: 'NOT_AUTHENTICATED',
      message: 'Not authenticated'
    });
  }

  res.json({
    message: 'Welcome to invoices!',
    user: {
      userId: req.session.userId,
      email: req.session.email,
      name: req.session.name,
      role: req.session.role
    }
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Auth server running on port ${port}`);
  console.log(`Test users in database:`);
  console.log(`- rpasha@marinegroupbw.com`);
  console.log(`- test@marinegroupbw.com`);
  console.log(`- rpasha@maringroupbw.com`);
});