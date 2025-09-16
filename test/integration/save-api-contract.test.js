/**
 * Integration Tests for Invoice Save API Contract
 *
 * Tests the full API contract to ensure correct HTTP methods and endpoints
 * are used for create vs update operations
 */

const request = require('supertest');
const { describe, beforeEach, afterEach, test, expect } = require('@jest/globals');

// Mock app setup - adjust path based on your server structure
const app = require('../../server/server.js');

describe('Invoice Save API Contract', () => {
  let authenticatedAgent;
  let testUser;
  let createdInvoiceId;

  beforeEach(async () => {
    // Set up authenticated test session
    authenticatedAgent = request.agent(app);

    // Create or login test user
    testUser = {
      email: 'test@marinegroup.com',
      password: 'test123'
    };

    // Authenticate
    const loginResponse = await authenticatedAgent
      .post('/api/auth/login')
      .send(testUser)
      .expect(200);

    expect(loginResponse.body.user).toBeDefined();
  });

  afterEach(async () => {
    // Clean up created invoices
    if (createdInvoiceId) {
      try {
        await authenticatedAgent
          .delete(`/api/v1/invoice/${createdInvoiceId}`)
          .expect(200);
      } catch (error) {
        console.warn('Cleanup failed:', error.message);
      }
    }
  });

  test('POST /api/v2/invoice/save creates new invoice', async () => {
    const newInvoiceData = {
      title: 'API Test Invoice',
      data: {
        vessel: { name: 'API Test Vessel' },
        customer: { customerName: 'API Test Customer', customerEmail: 'test@example.com' },
        scope: {
          markupRate: '2.5',
          isTaxable: false,
          lineItems: [
            {
              id: 0,
              jobType: 'Manual Entry',
              itemType: 'Materials',
              description: 'Test Service',
              manualCost: '100',
              taxStatus: 'taxable',
              taxRate: 0.0875,
              markupType: 'preset',
              markupRate: '2.5'
            }
          ]
        },
        notes: { comments: [] }
      },
      metadata: {
        vesselName: 'API Test Vessel',
        customerName: 'API Test Customer',
        lineItemCount: 1
      }
    };

    const response = await authenticatedAgent
      .post('/api/v2/invoice/save')
      .send(newInvoiceData)
      .expect(200);

    expect(response.body.invoice).toBeDefined();
    expect(response.body.invoice.id).toBeDefined();
    expect(response.body.invoice.title).toBe('API Test Invoice');

    createdInvoiceId = response.body.invoice.id;

    // Verify invoice was actually created
    const getResponse = await authenticatedAgent
      .get('/api/invoices/user')
      .expect(200);

    const foundInvoice = getResponse.body.find(inv => inv.id === createdInvoiceId);
    expect(foundInvoice).toBeDefined();
    expect(foundInvoice.data.vessel.name).toBe('API Test Vessel');
  });

  test('POST /api/v3/invoices/smart-save updates existing invoice', async () => {
    // First create an invoice
    const createData = {
      title: 'Original Invoice for Update Test',
      data: {
        vessel: { name: 'Original Vessel' },
        customer: { customerName: 'Original Customer', customerEmail: 'original@example.com' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      },
      metadata: {
        vesselName: 'Original Vessel',
        customerName: 'Original Customer',
        lineItemCount: 0
      }
    };

    const createResponse = await authenticatedAgent
      .post('/api/v2/invoice/save')
      .send(createData)
      .expect(200);

    createdInvoiceId = createResponse.body.invoice.id;

    // Now update it using smart-save
    const updateData = {
      id: createdInvoiceId,
      title: 'Updated Invoice Title',
      data: {
        vessel: { name: 'Updated Vessel Name' },
        customer: { customerName: 'Updated Customer', customerEmail: 'updated@example.com' },
        scope: {
          markupRate: '3.0',
          isTaxable: true,
          lineItems: [
            {
              id: 0,
              jobType: 'Manual Entry',
              itemType: 'Labor',
              description: 'Added Service',
              manualCost: '200',
              taxStatus: 'taxable',
              taxRate: 0.0875
            }
          ]
        },
        notes: { comments: [{ text: 'Added note', timestamp: new Date().toISOString() }] }
      },
      metadata: {
        vesselName: 'Updated Vessel Name',
        customerName: 'Updated Customer',
        lineItemCount: 1
      }
    };

    const updateResponse = await authenticatedAgent
      .post('/api/v3/invoices/smart-save')
      .send(updateData)
      .expect(200);

    expect(updateResponse.body.invoice).toBeDefined();
    expect(updateResponse.body.invoice.id).toBe(createdInvoiceId); // Same ID
    expect(updateResponse.body.action).toBe('updated'); // Indicates update, not create

    // Verify the update was applied
    const getResponse = await authenticatedAgent
      .get('/api/invoices/user')
      .expect(200);

    const updatedInvoice = getResponse.body.find(inv => inv.id === createdInvoiceId);
    expect(updatedInvoice).toBeDefined();
    expect(updatedInvoice.title).toBe('Updated Invoice Title');
    expect(updatedInvoice.data.vessel.name).toBe('Updated Vessel Name');
    expect(updatedInvoice.data.scope.lineItems).toHaveLength(1);
    expect(updatedInvoice.data.notes.comments).toHaveLength(1);
  });

  test('smart-save creates new invoice when ID not provided', async () => {
    const newInvoiceData = {
      // No ID provided - should create new
      title: 'Smart Save New Invoice',
      data: {
        vessel: { name: 'Smart Save Vessel' },
        customer: { customerName: 'Smart Save Customer', customerEmail: 'smartsave@example.com' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      },
      metadata: {
        vesselName: 'Smart Save Vessel',
        customerName: 'Smart Save Customer',
        lineItemCount: 0
      }
    };

    const response = await authenticatedAgent
      .post('/api/v3/invoices/smart-save')
      .send(newInvoiceData)
      .expect(200);

    expect(response.body.invoice).toBeDefined();
    expect(response.body.invoice.id).toBeDefined();
    expect(response.body.action).toBe('created'); // Indicates creation

    createdInvoiceId = response.body.invoice.id;

    // Verify invoice was created
    const getResponse = await authenticatedAgent
      .get('/api/invoices/user')
      .expect(200);

    const foundInvoice = getResponse.body.find(inv => inv.id === createdInvoiceId);
    expect(foundInvoice).toBeDefined();
    expect(foundInvoice.title).toBe('Smart Save New Invoice');
  });

  test('smart-save rejects updates to non-existent invoices', async () => {
    const updateData = {
      id: 'non-existent-invoice-id',
      title: 'This Should Fail',
      data: {
        vessel: { name: 'Should Not Work' },
        customer: { customerName: 'Should Not Work' },
        scope: { lineItems: [] },
        notes: { comments: [] }
      }
    };

    const response = await authenticatedAgent
      .post('/api/v3/invoices/smart-save')
      .send(updateData)
      .expect(404);

    expect(response.body.error).toContain('Invoice not found');
  });

  test('update endpoints validate ownership', async () => {
    // Create invoice with one user
    const createData = {
      title: 'Ownership Test Invoice',
      data: {
        vessel: { name: 'Ownership Vessel' },
        customer: { customerName: 'Ownership Customer' },
        scope: { lineItems: [] },
        notes: { comments: [] }
      }
    };

    const createResponse = await authenticatedAgent
      .post('/api/v2/invoice/save')
      .send(createData)
      .expect(200);

    createdInvoiceId = createResponse.body.invoice.id;

    // Log out and create different user
    await authenticatedAgent
      .post('/api/auth/logout')
      .expect(200);

    const differentUser = {
      email: 'different@example.com',
      password: 'different123'
    };

    // Login as different user (assuming registration endpoint exists)
    const differentAgent = request.agent(app);
    await differentAgent
      .post('/api/auth/register')
      .send({
        ...differentUser,
        name: 'Different User'
      });

    await differentAgent
      .post('/api/auth/login')
      .send(differentUser)
      .expect(200);

    // Try to update the other user's invoice
    const unauthorizedUpdate = {
      id: createdInvoiceId,
      title: 'Unauthorized Update',
      data: {
        vessel: { name: 'Hacked Vessel' },
        customer: { customerName: 'Hacked Customer' },
        scope: { lineItems: [] },
        notes: { comments: [] }
      }
    };

    await differentAgent
      .post('/api/v3/invoices/smart-save')
      .send(unauthorizedUpdate)
      .expect(403); // Should be forbidden

    // Verify original invoice unchanged
    await authenticatedAgent
      .post('/api/auth/login')
      .send(testUser)
      .expect(200);

    const getResponse = await authenticatedAgent
      .get('/api/invoices/user')
      .expect(200);

    const originalInvoice = getResponse.body.find(inv => inv.id === createdInvoiceId);
    expect(originalInvoice.title).toBe('Ownership Test Invoice');
    expect(originalInvoice.data.vessel.name).toBe('Ownership Vessel');
  });

  test('API endpoints return consistent data structures', async () => {
    const testData = {
      title: 'Structure Test Invoice',
      data: {
        vessel: { name: 'Structure Vessel', weight: '1000', beam: '20' },
        customer: {
          customerName: 'Structure Customer',
          customerEmail: 'structure@example.com',
          customerPhone: '555-0123'
        },
        scope: {
          markupRate: '2.5',
          isTaxable: true,
          lineItems: []
        },
        notes: { comments: [] }
      },
      metadata: {
        vesselName: 'Structure Vessel',
        customerName: 'Structure Customer',
        customerEmail: 'structure@example.com',
        lineItemCount: 0,
        totalAmount: 0
      }
    };

    // Test create response structure
    const createResponse = await authenticatedAgent
      .post('/api/v2/invoice/save')
      .send(testData)
      .expect(200);

    expect(createResponse.body).toHaveProperty('invoice');
    expect(createResponse.body.invoice).toHaveProperty('id');
    expect(createResponse.body.invoice).toHaveProperty('title');
    expect(createResponse.body.invoice).toHaveProperty('data');
    expect(createResponse.body.invoice).toHaveProperty('metadata');
    expect(createResponse.body.invoice).toHaveProperty('createdAt');
    expect(createResponse.body.invoice).toHaveProperty('updatedAt');

    createdInvoiceId = createResponse.body.invoice.id;

    // Test update response structure
    const updateData = { ...testData, id: createdInvoiceId, title: 'Updated Structure' };

    const updateResponse = await authenticatedAgent
      .post('/api/v3/invoices/smart-save')
      .send(updateData)
      .expect(200);

    expect(updateResponse.body).toHaveProperty('invoice');
    expect(updateResponse.body).toHaveProperty('action');
    expect(updateResponse.body.action).toBe('updated');
    expect(updateResponse.body.invoice.id).toBe(createdInvoiceId);

    // Verify timestamp handling
    const originalCreatedAt = createResponse.body.invoice.createdAt;
    const originalUpdatedAt = createResponse.body.invoice.updatedAt;
    const newUpdatedAt = updateResponse.body.invoice.updatedAt;

    expect(updateResponse.body.invoice.createdAt).toBe(originalCreatedAt); // Preserved
    expect(new Date(newUpdatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime()); // Updated
  });

  test('API handles malformed requests gracefully', async () => {
    // Missing required fields
    await authenticatedAgent
      .post('/api/v2/invoice/save')
      .send({})
      .expect(400);

    // Invalid data structure
    await authenticatedAgent
      .post('/api/v2/invoice/save')
      .send({
        title: 'Invalid',
        data: 'this should be an object'
      })
      .expect(400);

    // Invalid JSON
    await authenticatedAgent
      .post('/api/v2/invoice/save')
      .set('Content-Type', 'application/json')
      .send('invalid json{')
      .expect(400);
  });

  test('API enforces authentication', async () => {
    const unauthenticatedAgent = request(app);

    await unauthenticatedAgent
      .post('/api/v2/invoice/save')
      .send({
        title: 'Unauthorized Test',
        data: { vessel: { name: 'Test' } }
      })
      .expect(401);

    await unauthenticatedAgent
      .post('/api/v3/invoices/smart-save')
      .send({
        id: 'some-id',
        title: 'Unauthorized Update',
        data: { vessel: { name: 'Test' } }
      })
      .expect(401);

    await unauthenticatedAgent
      .get('/api/invoices/user')
      .expect(401);
  });
});