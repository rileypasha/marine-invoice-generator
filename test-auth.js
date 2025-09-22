const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const cors = require('cors');

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

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    res.json({
      success: true,
      userCount: result.rows[0].count,
      message: 'Database connection successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simple login endpoint
app.post('/api/v1/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    const result = await pool.query(
      'SELECT id, email, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password'
      });
    }

    // Success
    res.json({
      userId: user.id,
      email: user.email,
      username: user.username,
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Test auth server running on port ${port}`);
});