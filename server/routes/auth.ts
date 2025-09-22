import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';
import { generateCsrfToken } from '../middleware/csrf';
import { csrfProtection } from '../middleware/csrf';
import { query } from '../config/database';
import '../types/session';

const router = Router();

interface AuthRequest extends Request {
  correlationId?: string;
}

// POST /api/v1/auth/register
router.post('/register', async (req: AuthRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const { email, username, password } = req.body;

  try {
    // Validate input
    if (!email || !username || !password) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email, username, and password are required',
        correlationId,
      });
    }

    // Check if user exists
    const existingUser = await query('SELECT id FROM "User" WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      logger.warn('Registration attempt with existing email', {
        correlationId,
        email,
      });

      return res.status(409).json({
        code: 'USER_EXISTS',
        message: 'User with this email already exists',
        correlationId,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in PostgreSQL
    const result = await query(
      'INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()) RETURNING id, email, name, role, "createdAt"',
      [email, username, passwordHash, 'standard']
    );

    const user = result.rows[0];

    // Create session
    if (req.session) {
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // Generate CSRF token
      if (!req.session.csrfToken) {
        req.session.csrfToken = generateCsrfToken();
      }
    }

    logger.info('User registered successfully', {
      correlationId,
      userId: user.id,
      email: user.email,
    });

    res.status(201).json({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      csrfToken: req.session?.csrfToken,
      sessionExpiry: req.session?.expiresAt,
      correlationId,
    });

  } catch (error: any) {
    logger.error('Registration failed', {
      error: error.message,
      correlationId,
    });

    res.status(500).json({
      code: 'REGISTRATION_FAILED',
      message: 'Failed to register user',
      correlationId,
    });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: AuthRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const { email, password } = req.body;

  try {
    // Find user by email in PostgreSQL database
    if (!email || !password) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email and password are required',
        correlationId,
      });
    }

    const result = await query(
      'SELECT id, email, name, password, role, "createdAt" FROM "User" WHERE email = $1',
      [email]
    );

    const user = result.rows.length > 0 ? result.rows[0] : null;

    if (!user) {
      logger.warn('Login attempt with invalid credentials', {
        correlationId,
        email,
      });

      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        correlationId,
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      logger.warn('Login attempt with incorrect password', {
        correlationId,
        userId: user.id,
      });

      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        correlationId,
      });
    }

    // Create session
    if (req.session) {
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      
      // Generate new CSRF token on login
      req.session.csrfToken = generateCsrfToken();
    }

    logger.info('User logged in successfully', {
      correlationId,
      userId: user.id,
      email: user.email,
    });

    res.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      csrfToken: req.session?.csrfToken,
      sessionExpiry: req.session?.expiresAt,
      correlationId,
    });

  } catch (error: any) {
    logger.error('Login failed', {
      error: error.message,
      correlationId,
    });

    res.status(500).json({
      code: 'LOGIN_FAILED',
      message: 'Failed to log in',
      correlationId,
    });
  }
});

// POST /api/v1/auth/logout (requires CSRF)
router.post('/logout', csrfProtection, (req: AuthRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.session?.userId;

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Failed to destroy session', {
          error: err,
          correlationId,
          userId,
        });
      }
    });
  }

  logger.info('User logged out', {
    correlationId,
    userId,
  });

  res.json({
    message: 'Logged out successfully',
    correlationId,
  });
});

// GET /api/v1/auth/check
router.get('/check', (req: AuthRequest, res: Response) => {
  const correlationId = req.correlationId!;

  if (!req.session?.userId) {
    return res.status(401).json({
      code: 'NOT_AUTHENTICATED',
      message: 'Not authenticated',
      correlationId,
    });
  }

  // Check if session is expired
  if (req.session.expiresAt && new Date() > new Date(req.session.expiresAt)) {
    req.session.destroy(() => {});
    
    return res.status(401).json({
      code: 'SESSION_EXPIRED',
      message: 'Session expired',
      correlationId,
    });
  }

  res.json({
    userId: req.session.userId,
    email: req.session.email,
    csrfToken: req.session.csrfToken,
    sessionExpiry: req.session.expiresAt,
    correlationId,
  });
});

// POST /api/v1/auth/refresh (requires CSRF)
router.post('/refresh', csrfProtection, (req: AuthRequest, res: Response) => {
  const correlationId = req.correlationId!;

  if (!req.session?.userId) {
    return res.status(401).json({
      code: 'NOT_AUTHENTICATED',
      message: 'Not authenticated',
      correlationId,
    });
  }

  // Extend session
  req.session.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  
  // Generate new CSRF token
  req.session.csrfToken = generateCsrfToken();

  logger.info('Session refreshed', {
    correlationId,
    userId: req.session.userId,
    newExpiry: req.session.expiresAt,
  });

  res.json({
    csrfToken: req.session.csrfToken,
    sessionExpiry: req.session.expiresAt,
    correlationId,
  });
});

export default router;