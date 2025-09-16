import request from 'supertest';
import app from '../../server/app';
import { logger } from '../../server/utils/logger';

// Silence logs during tests
logger.silent = true;

describe('Auth Flow Integration', () => {
  let agent: request.SuperTest<request.Test>;
  let csrfToken: string;
  let sessionCookie: string;

  beforeEach(() => {
    agent = request.agent(app);
  });

  describe('Session Management', () => {
    it('should handle complete auth flow', async () => {
      // 1. Get CSRF token
      const csrfRes = await agent.get('/api/v1/csrf-token');
      expect(csrfRes.status).toBe(200);
      expect(csrfRes.body.csrfToken).toBeDefined();
      csrfToken = csrfRes.body.csrfToken;

      // 2. Login
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .send({
          username: 'test',
          password: 'password123',
        });
      
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.userId).toBeDefined();
      expect(loginRes.body.csrfToken).toBeDefined();
      csrfToken = loginRes.body.csrfToken;

      // 3. Access protected route with session
      const saveRes = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', csrfToken)
        .send({
          amount: 100,
          customerName: 'Test Customer',
        });
      
      expect(saveRes.status).toBe(200);
      expect(saveRes.body.id).toBeDefined();

      // 4. Logout
      const logoutRes = await agent
        .post('/api/v1/auth/logout')
        .set('X-CSRF-Token', csrfToken);
      
      expect(logoutRes.status).toBe(200);

      // 5. Try to access protected route after logout
      const afterLogoutRes = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', csrfToken)
        .send({
          amount: 200,
          customerName: 'Another Customer',
        });
      
      expect(afterLogoutRes.status).toBe(401);
      expect(afterLogoutRes.body.code).toBe('AUTH_REQUIRED');
    });

    it('should reject requests without session', async () => {
      const res = await request(app)
        .post('/api/v1/invoice/save')
        .send({
          amount: 100,
          customerName: 'Test Customer',
        });
      
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
      expect(res.headers['www-authenticate']).toBeDefined();
    });

    it('should include credentials with cookies', async () => {
      // Login first
      await agent.post('/api/v1/auth/login').send({
        username: 'test',
        password: 'password123',
      });

      // Check auth status
      const checkRes = await agent.get('/api/v1/auth/check');
      
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.userId).toBeDefined();
      expect(checkRes.body.csrfToken).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    beforeEach(async () => {
      // Login to get session
      const loginRes = await agent.post('/api/v1/auth/login').send({
        username: 'test',
        password: 'password123',
      });
      csrfToken = loginRes.body.csrfToken;
    });

    it('should reject POST without CSRF token', async () => {
      const res = await agent
        .post('/api/v1/invoice/save')
        .send({
          amount: 100,
          customerName: 'Test Customer',
        });
      
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_TOKEN_REQUIRED');
    });

    it('should reject POST with invalid CSRF token', async () => {
      const res = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', 'invalid-token')
        .send({
          amount: 100,
          customerName: 'Test Customer',
        });
      
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('should accept valid CSRF token', async () => {
      const res = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', csrfToken)
        .send({
          amount: 100,
          customerName: 'Test Customer',
        });
      
      expect(res.status).toBe(200);
    });

    it('should not require CSRF for GET requests', async () => {
      const res = await agent.get('/api/v1/invoice');
      
      // Should get 401 for auth, not 403 for CSRF
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Idempotency', () => {
    beforeEach(async () => {
      const loginRes = await agent.post('/api/v1/auth/login').send({
        username: 'test',
        password: 'password123',
      });
      csrfToken = loginRes.body.csrfToken;
    });

    it('should return cached response for duplicate idempotency key', async () => {
      const idempotencyKey = `test_${Date.now()}_abc123`;
      const invoiceData = {
        amount: 100,
        customerName: 'Test Customer',
      };

      // First request
      const res1 = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', csrfToken)
        .set('Idempotency-Key', idempotencyKey)
        .send(invoiceData);
      
      expect(res1.status).toBe(200);
      const invoiceId1 = res1.body.id;

      // Second request with same idempotency key
      const res2 = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', csrfToken)
        .set('Idempotency-Key', idempotencyKey)
        .send(invoiceData);
      
      expect(res2.status).toBe(200);
      expect(res2.body.id).toBe(invoiceId1);
      expect(res2.headers['x-idempotent-replay']).toBe('true');
    });

    it('should create new invoice with different idempotency key', async () => {
      const invoiceData = {
        amount: 100,
        customerName: 'Test Customer',
      };

      const res1 = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', csrfToken)
        .set('Idempotency-Key', `key1_${Date.now()}`)
        .send(invoiceData);
      
      const res2 = await agent
        .post('/api/v1/invoice/save')
        .set('X-CSRF-Token', csrfToken)
        .set('Idempotency-Key', `key2_${Date.now()}`)
        .send(invoiceData);
      
      expect(res1.body.id).not.toBe(res2.body.id);
    });
  });

  describe('Correlation IDs', () => {
    it('should include correlation ID in responses', async () => {
      const correlationId = `test_correlation_${Date.now()}`;
      
      const res = await request(app)
        .get('/health')
        .set('X-Correlation-ID', correlationId);
      
      expect(res.headers['x-correlation-id']).toBe(correlationId);
    });

    it('should generate correlation ID if not provided', async () => {
      const res = await request(app).get('/health');
      
      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.headers['x-correlation-id']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });
});