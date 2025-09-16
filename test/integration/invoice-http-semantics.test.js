/**
 * Integration tests for proper HTTP semantics in invoice operations
 * Tests the separation of create vs update operations and proper status codes
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../../server/server');

const prisma = new PrismaClient();

describe('Invoice HTTP Semantics', () => {
  let testUser;
  let authHeaders;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test-http@example.com',
        name: 'Test HTTP User',
        role: 'standard'
      }
    });

    // Set up auth headers (simplified for testing)
    authHeaders = {
      'cookie': `test@marinegroupbw.com=test_user_session`,
      'x-request-id': 'test-http-semantics'
    };
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.invoice.deleteMany({
      where: { userEmail: testUser.email }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v3/invoices (Create)', () => {
    test('should create new invoice with 201 status', async () => {
      const invoiceData = {
        title: 'Test Create Invoice',
        data: {
          customer: { customerName: 'Test Customer' },
          scope: { lineItems: [] }
        },
        metadata: { source: 'test' }
      };

      const response = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send(invoiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.invoice.id).toBeDefined();
      expect(response.body.invoice.title).toBe('Test Create Invoice');
      expect(response.body.action).toBeUndefined(); // Only smart-save returns action
    });

    test('should reject create with existing ID in body', async () => {
      const invoiceData = {
        id: 'existing-id-should-be-ignored',
        title: 'Test Create with ID',
        data: { customer: {}, scope: { lineItems: [] } }
      };

      const response = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send(invoiceData);

      expect(response.status).toBe(201);
      // ID should be generated, not use the provided one
      expect(response.body.invoice.id).not.toBe('existing-id-should-be-ignored');
    });
  });

  describe('PUT /api/v3/invoices/:id (Full Update)', () => {
    let invoiceId;

    beforeEach(async () => {
      // Create an invoice to update
      const createResponse = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send({
          title: 'Original Title',
          data: {
            customer: { customerName: 'Original Customer' },
            scope: { lineItems: [] }
          }
        });

      invoiceId = createResponse.body.invoice.id;
    });

    test('should update existing invoice with 200 status', async () => {
      const updateData = {
        title: 'Updated Title',
        data: {
          customer: { customerName: 'Updated Customer' },
          scope: { lineItems: [{ description: 'New item', quantity: 1, cost: 100 }] }
        },
        metadata: { updated: true }
      };

      const response = await request(app)
        .put(`/api/v3/invoices/${invoiceId}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.invoice.id).toBe(invoiceId);
      expect(response.body.invoice.title).toBe('Updated Title');
      expect(response.body.action).toBe('UPDATED');
      expect(response.body.invoice.data.customer.customerName).toBe('Updated Customer');
    });

    test('should return 404 for non-existent invoice', async () => {
      const updateData = {
        title: 'Update Non-existent',
        data: { customer: {}, scope: { lineItems: [] } }
      };

      await request(app)
        .put('/api/v3/invoices/non-existent-id')
        .set(authHeaders)
        .send(updateData)
        .expect(404);
    });

    test('should preserve ID in full update', async () => {
      const updateData = {
        id: 'different-id', // This should be ignored
        title: 'Updated with Different ID',
        data: { customer: {}, scope: { lineItems: [] } }
      };

      const response = await request(app)
        .put(`/api/v3/invoices/${invoiceId}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      // Original ID should be preserved
      expect(response.body.invoice.id).toBe(invoiceId);
      expect(response.body.invoice.id).not.toBe('different-id');
    });
  });

  describe('PATCH /api/v3/invoices/:id (Partial Update)', () => {
    let invoiceId;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send({
          title: 'Original Title',
          data: {
            customer: {
              customerName: 'Original Customer',
              customerEmail: 'original@example.com'
            },
            scope: {
              lineItems: [{ description: 'Original item', quantity: 1, cost: 50 }],
              markupRate: 0.2
            }
          },
          metadata: { version: 1 }
        });

      invoiceId = createResponse.body.invoice.id;
    });

    test('should partially update invoice with 200 status', async () => {
      const patchData = {
        title: 'Patched Title Only'
        // Don't include data or metadata - they should be preserved
      };

      const response = await request(app)
        .patch(`/api/v3/invoices/${invoiceId}`)
        .set(authHeaders)
        .send(patchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('PATCHED');
      expect(response.body.patchedFields).toEqual(['title']);
      expect(response.body.invoice.title).toBe('Patched Title Only');
      // Original data should be preserved
      expect(response.body.invoice.data.customer.customerName).toBe('Original Customer');
    });

    test('should merge data objects in partial update', async () => {
      const patchData = {
        data: {
          customer: {
            customerPhone: '+1234567890' // Add phone, preserve name and email
          }
        }
      };

      const response = await request(app)
        .patch(`/api/v3/invoices/${invoiceId}`)
        .set(authHeaders)
        .send(patchData)
        .expect(200);

      expect(response.body.patchedFields).toContain('data');
      // Should have merged the phone with existing customer data
      expect(response.body.invoice.data.customer.customerName).toBe('Original Customer');
      expect(response.body.invoice.data.customer.customerEmail).toBe('original@example.com');
      expect(response.body.invoice.data.customer.customerPhone).toBe('+1234567890');
      // Other data should be preserved
      expect(response.body.invoice.data.scope.markupRate).toBe(0.2);
    });

    test('should recalculate totals when line items change', async () => {
      const patchData = {
        data: {
          scope: {
            lineItems: [
              { description: 'Updated item', quantity: 2, cost: 100 }
            ]
          }
        }
      };

      const response = await request(app)
        .patch(`/api/v3/invoices/${invoiceId}`)
        .set(authHeaders)
        .send(patchData)
        .expect(200);

      expect(response.body.patchedFields).toContain('subtotal');
      expect(response.body.patchedFields).toContain('total');
      expect(response.body.invoice.subtotal).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v3/invoices/smart-save (Smart Save)', () => {
    test('should create new invoice when no ID provided', async () => {
      const invoiceData = {
        title: 'Smart Save Create',
        data: { customer: {}, scope: { lineItems: [] } }
      };

      const response = await request(app)
        .post('/api/v3/invoices/smart-save')
        .set(authHeaders)
        .send(invoiceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('CREATED');
      expect(response.body.invoice.id).toBeDefined();
    });

    test('should update existing invoice when ID provided', async () => {
      // First create an invoice
      const createResponse = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send({
          title: 'To Be Updated',
          data: { customer: {}, scope: { lineItems: [] } }
        });

      const invoiceId = createResponse.body.invoice.id;

      // Then update it via smart-save
      const updateData = {
        id: invoiceId,
        title: 'Smart Save Updated',
        data: { customer: { customerName: 'Updated via Smart Save' }, scope: { lineItems: [] } }
      };

      const response = await request(app)
        .post('/api/v3/invoices/smart-save')
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.action).toBe('UPDATED');
      expect(response.body.invoice.id).toBe(invoiceId);
      expect(response.body.invoice.title).toBe('Smart Save Updated');
    });
  });

  describe('Idempotency', () => {
    test('should handle idempotent creates', async () => {
      const invoiceData = {
        title: 'Idempotent Create',
        data: { customer: {}, scope: { lineItems: [] } }
      };

      const idempotencyKey = `test-create-${Date.now()}`;

      // First request
      const response1 = await request(app)
        .post('/api/v3/invoices')
        .set({
          ...authHeaders,
          'idempotency-key': idempotencyKey
        })
        .send(invoiceData)
        .expect(201);

      // Second request with same idempotency key
      const response2 = await request(app)
        .post('/api/v3/invoices')
        .set({
          ...authHeaders,
          'idempotency-key': idempotencyKey
        })
        .send(invoiceData)
        .expect(200); // Should return cached response

      expect(response1.body.invoice.id).toBe(response2.body.invoice.id);
      expect(response2.body._meta.idempotent).toBe(true);
    });

    test('should handle idempotent updates', async () => {
      // Create an invoice first
      const createResponse = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send({
          title: 'For Idempotent Update',
          data: { customer: {}, scope: { lineItems: [] } }
        });

      const invoiceId = createResponse.body.invoice.id;
      const updateData = {
        title: 'Idempotent Update',
        data: { customer: { customerName: 'Idempotent' }, scope: { lineItems: [] } }
      };

      const idempotencyKey = `test-update-${Date.now()}`;

      // First update
      const response1 = await request(app)
        .put(`/api/v3/invoices/${invoiceId}`)
        .set({
          ...authHeaders,
          'idempotency-key': idempotencyKey
        })
        .send(updateData)
        .expect(200);

      // Second update with same idempotency key
      const response2 = await request(app)
        .put(`/api/v3/invoices/${invoiceId}`)
        .set({
          ...authHeaders,
          'idempotency-key': idempotencyKey
        })
        .send(updateData)
        .expect(200);

      expect(response2.body._meta.idempotent).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should return proper validation errors', async () => {
      const invalidData = {
        // Missing required fields
        data: { invalid: 'structure' }
      };

      const response = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    test('should handle unauthorized access', async () => {
      const invoiceData = {
        title: 'Unauthorized',
        data: { customer: {}, scope: { lineItems: [] } }
      };

      // Request without proper auth headers
      await request(app)
        .post('/api/v3/invoices')
        .send(invoiceData)
        .expect(401);
    });
  });

  describe('Data Integrity', () => {
    test('should preserve metadata timestamps on update', async () => {
      // Create invoice
      const createResponse = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send({
          title: 'Timestamp Test',
          data: { customer: {}, scope: { lineItems: [] } }
        });

      const originalCreatedAt = createResponse.body.invoice.createdAt;
      const invoiceId = createResponse.body.invoice.id;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update invoice
      const updateResponse = await request(app)
        .put(`/api/v3/invoices/${invoiceId}`)
        .set(authHeaders)
        .send({
          title: 'Updated Timestamp Test',
          data: { customer: {}, scope: { lineItems: [] } }
        });

      // CreatedAt should be preserved, updatedAt should be new
      expect(updateResponse.body.invoice.createdAt).toBe(originalCreatedAt);
      expect(updateResponse.body.invoice.updatedAt).not.toBe(originalCreatedAt);
    });

    test('should increment version on updates', async () => {
      // Create invoice
      const createResponse = await request(app)
        .post('/api/v3/invoices')
        .set(authHeaders)
        .send({
          title: 'Version Test',
          data: { customer: {}, scope: { lineItems: [] } }
        });

      const invoiceId = createResponse.body.invoice.id;
      const originalVersion = createResponse.body.invoice.version || 1;

      // Update invoice
      const updateResponse = await request(app)
        .put(`/api/v3/invoices/${invoiceId}`)
        .set(authHeaders)
        .send({
          title: 'Updated Version Test',
          data: { customer: {}, scope: { lineItems: [] } }
        });

      expect(updateResponse.body.invoice.version).toBe(originalVersion + 1);
    });
  });
});