const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { requireMaster, requireAuth, loadUser } = require('../../server/middleware/auth');

// Mock environment variables
process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';
process.env.SESSION_SECRET = 'test-secret';

describe('Authentication Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    app.use(express.json());
  });

  describe('requireAuth', () => {
    test('should return 401 if no session', async () => {
      app.get('/protected', requireAuth, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/protected')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    test('should allow access with valid session', async () => {
      app.use((req, res, next) => {
        req.session = { user: { email: 'test@example.com', name: 'Test User' } };
        next();
      });

      app.get('/protected', requireAuth, (req, res) => {
        res.json({ success: true, user: req.user });
      });

      const response = await request(app)
        .get('/protected')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
    });
  });

  describe('requireMaster', () => {
    test('should return 403 for non-master user', async () => {
      app.use((req, res, next) => {
        req.session = { user: { email: 'regular@example.com', name: 'Regular User' } };
        next();
      });

      app.get('/master', requireMaster, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/master')
        .set('Accept', 'application/json')
        .expect(403);

      expect(response.body.error).toBe('Access denied - Master account required');
    });

    test('should allow access for master user', async () => {
      app.use((req, res, next) => {
        req.session = { user: { email: 'rpasha@marinegroupbw.com', name: 'Master User' } };
        next();
      });

      app.get('/master', requireMaster, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/master')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return 401 if no session', async () => {
      app.get('/master', requireMaster, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/master')
        .set('Accept', 'application/json')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    test('should return HTML 403 page when Accept header is HTML', async () => {
      app.use((req, res, next) => {
        req.session = { user: { email: 'regular@example.com', name: 'Regular User' } };
        next();
      });

      app.get('/master', requireMaster, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/master')
        .set('Accept', 'text/html')
        .expect(403);

      expect(response.text).toContain('403 - Access Denied');
      expect(response.text).toContain('Master Account Required');
    });
  });

  describe('loadUser', () => {
    test('should populate req.user from session', async () => {
      app.use((req, res, next) => {
        req.session = { user: { email: 'test@example.com', name: 'Test User' } };
        next();
      });

      app.use(loadUser);

      app.get('/user', (req, res) => {
        res.json({ user: req.user });
      });

      const response = await request(app)
        .get('/user')
        .expect(200);

      expect(response.body.user.email).toBe('test@example.com');
    });

    test('should not error if no session', async () => {
      app.use(loadUser);

      app.get('/user', (req, res) => {
        res.json({ user: req.user || null });
      });

      const response = await request(app)
        .get('/user')
        .expect(200);

      expect(response.body.user).toBe(null);
    });
  });
});

describe('Master Email Configuration', () => {
  test('should support multiple master emails', () => {
    process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com,admin@marinegroupbw.com';
    
    const app = express();
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));

    app.use((req, res, next) => {
      req.session = { user: { email: 'admin@marinegroupbw.com' } };
      next();
    });

    app.get('/master', requireMaster, (req, res) => {
      res.json({ success: true });
    });

    return request(app)
      .get('/master')
      .expect(200);
  });
});