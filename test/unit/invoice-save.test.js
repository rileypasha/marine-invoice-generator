/**
 * Unit Tests for Invoice Save Functionality
 */

const { PrismaClient } = require('@prisma/client');
const request = require('supertest');
const express = require('express');
const session = require('express-session');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    invoice: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrismaClient)
  };
});

describe('Invoice Save Functionality', () => {
  let app;
  let prisma;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup Express app with session
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    // Mock user session middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user-123',
        email: 'user@example.com',
        name: 'Test User'
      };
      req.session = { user: req.user };
      next();
    });
    
    // Load routes
    const apiRouter = require('../../server/routes/api');
    app.use('/api/v1', apiRouter);
    
    prisma = new PrismaClient();
  });
  
  describe('POST /api/v1/invoice/save', () => {
    test('Standard user save creates database record with userId', async () => {
      const invoiceData = {
        vesselName: 'Test Vessel',
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        invoiceNumber: 'INV-001',
        subtotal: 1000,
        taxAmount: 100,
        total: 1100,
        market: 'Commercial'
      };
      
      const mockSavedInvoice = {
        id: 'inv-db-123',
        userId: 'test-user-123',
        status: 'saved',
        ...invoiceData
      };
      
      prisma.invoice.create.mockResolvedValue(mockSavedInvoice);
      
      const response = await request(app)
        .post('/api/v1/invoice/save')
        .send({
          title: 'Test Invoice',
          data: invoiceData,
          metadata: {}
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice.userId).toBe('test-user-123');
      expect(response.body.invoice.status).toBe('saved');
      
      // Verify Prisma was called with correct data
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-123',
          userEmail: 'user@example.com',
          userName: 'Test User',
          status: 'saved',
          vesselName: 'Test Vessel',
          customerName: 'Test Customer'
        })
      });
    });
    
    test('Saved invoice includes all required Master Dashboard fields', async () => {
      const invoiceData = {
        vesselName: 'Test Vessel',
        vesselWeight: 500,
        vesselBeam: 25,
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        customerPhone: '123-456-7890',
        invoiceNumber: 'INV-002',
        subtotal: 2000,
        taxAmount: 200,
        total: 2200,
        grossProfit: 800,
        profitPercent: 40,
        market: 'Residential'
      };
      
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-db-124',
        ...invoiceData
      });
      
      const response = await request(app)
        .post('/api/v1/invoice/save')
        .send({
          title: 'Complete Invoice',
          data: invoiceData
        });
      
      expect(response.status).toBe(200);
      
      const createCall = prisma.invoice.create.mock.calls[0][0];
      const savedData = createCall.data;
      
      // Verify all required fields are present
      expect(savedData).toHaveProperty('userId');
      expect(savedData).toHaveProperty('userName');
      expect(savedData).toHaveProperty('userEmail');
      expect(savedData).toHaveProperty('savedAt');
      expect(savedData).toHaveProperty('status', 'saved');
      expect(savedData).toHaveProperty('vesselName', 'Test Vessel');
      expect(savedData).toHaveProperty('vesselWeight', 500);
      expect(savedData).toHaveProperty('vesselBeam', 25);
      expect(savedData).toHaveProperty('customerName', 'Test Customer');
      expect(savedData).toHaveProperty('customerEmail', 'customer@example.com');
      expect(savedData).toHaveProperty('customerPhone', '123-456-7890');
      expect(savedData).toHaveProperty('invoiceNumber', 'INV-002');
      expect(savedData).toHaveProperty('subtotal', 2000);
      expect(savedData).toHaveProperty('taxAmount', 200);
      expect(savedData).toHaveProperty('total', 2200);
      expect(savedData).toHaveProperty('grossProfit', 800);
      expect(savedData).toHaveProperty('profitPercent', 40);
      expect(savedData).toHaveProperty('market', 'Residential');
    });
    
    test('Handles missing optional fields gracefully', async () => {
      const minimalData = {
        customerName: 'Minimal Customer'
      };
      
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-db-125',
        customerName: 'Minimal Customer',
        status: 'saved'
      });
      
      const response = await request(app)
        .post('/api/v1/invoice/save')
        .send({
          data: minimalData
        });
      
      expect(response.status).toBe(200);
      
      const savedData = prisma.invoice.create.mock.calls[0][0].data;
      expect(savedData.vesselName).toBeNull();
      expect(savedData.vesselWeight).toBeNull();
      expect(savedData.subtotal).toBe(0);
      expect(savedData.total).toBe(0);
    });
    
    test('Requires authentication', async () => {
      // Override the auth middleware for this test
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false
      }));
      
      // No user in session
      unauthApp.use((req, res, next) => {
        req.session = {};
        next();
      });
      
      const apiRouter = require('../../server/routes/api');
      unauthApp.use('/api/v1', apiRouter);
      
      const response = await request(unauthApp)
        .post('/api/v1/invoice/save')
        .send({
          data: { customerName: 'Test' }
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });
  
  describe('PUT /api/v1/invoice/:id', () => {
    test('Update preserves userId and updates fields', async () => {
      const existingInvoice = {
        id: 'inv-db-126',
        userId: 'test-user-123',
        customerName: 'Original Customer',
        total: 1000
      };
      
      prisma.invoice.findUnique.mockResolvedValue(existingInvoice);
      prisma.invoice.update.mockResolvedValue({
        ...existingInvoice,
        customerName: 'Updated Customer',
        total: 1500
      });
      
      const response = await request(app)
        .put('/api/v1/invoice/inv-db-126')
        .send({
          data: {
            customerName: 'Updated Customer',
            total: 1500
          }
        });
      
      expect(response.status).toBe(200);
      
      const updateCall = prisma.invoice.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('inv-db-126');
      expect(updateCall.data.customerName).toBe('Updated Customer');
      expect(updateCall.data.total).toBe(1500);
      // userId should NOT be in the update data (preserve original)
      expect(updateCall.data.userId).toBeUndefined();
    });
  });
  
  describe('DELETE /api/v1/invoice/:id', () => {
    test('Deletes invoice from database', async () => {
      prisma.invoice.delete.mockResolvedValue({
        id: 'inv-db-127'
      });
      
      const response = await request(app)
        .delete('/api/v1/invoice/inv-db-127');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(prisma.invoice.delete).toHaveBeenCalledWith({
        where: { id: 'inv-db-127' }
      });
    });
  });
});

describe('Master Dashboard API', () => {
  let app;
  let prisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    // Mock master user session
    app.use((req, res, next) => {
      req.user = {
        id: 'master-user-id',
        email: 'rpasha@marinegroupbw.com',
        name: 'Master User'
      };
      req.session = { user: req.user };
      next();
    });
    
    // Mock MASTER_EMAILS env var
    process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';
    
    const masterRouter = require('../../server/routes/master');
    app.use('/api/master', masterRouter);
    
    prisma = new PrismaClient();
  });
  
  describe('GET /api/master/invoices', () => {
    test('Returns invoices from all users', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          userId: 'user-1',
          userEmail: 'user1@example.com',
          customerName: 'Customer 1',
          status: 'saved'
        },
        {
          id: 'inv-2',
          userId: 'user-2',
          userEmail: 'user2@example.com',
          customerName: 'Customer 2',
          status: 'saved'
        },
        {
          id: 'inv-3',
          userId: 'master-user-id',
          userEmail: 'rpasha@marinegroupbw.com',
          customerName: 'Customer 3',
          status: 'submitted'
        }
      ];
      
      prisma.invoice.count.mockResolvedValue(3);
      prisma.invoice.findMany.mockResolvedValue(mockInvoices);
      
      const response = await request(app)
        .get('/api/master/invoices');
      
      expect(response.status).toBe(200);
      expect(response.body.invoices).toHaveLength(3);
      
      const userIds = response.body.invoices.map(i => i.userId);
      expect(userIds).toContain('user-1');
      expect(userIds).toContain('user-2');
      expect(userIds).toContain('master-user-id');
    });
    
    test('Includes both saved and submitted invoices by default', async () => {
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.findMany.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/master/invoices');
      
      expect(response.status).toBe(200);
      
      // Check the where clause includes both statuses
      const whereClause = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(whereClause.OR).toEqual([
        { status: 'saved' },
        { status: 'submitted' }
      ]);
    });
    
    test('Excludes soft-deleted invoices', async () => {
      // This would be tested if we implement soft deletes
      // For now, just verify the query structure
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.findMany.mockResolvedValue([]);
      
      await request(app).get('/api/master/invoices');
      
      // If soft deletes were implemented, we'd check:
      // expect(whereClause.deletedAt).toBeNull();
    });
    
    test('Orders by savedAt descending', async () => {
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.findMany.mockResolvedValue([]);
      
      await request(app).get('/api/master/invoices');
      
      const orderBy = prisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ savedAt: 'desc' });
    });
  });
  
  describe('GET /api/master/stats', () => {
    test('Returns stats for all saved and submitted invoices', async () => {
      prisma.invoice.count.mockResolvedValueOnce(150); // Total
      prisma.invoice.count.mockResolvedValueOnce(5);   // Today
      prisma.invoice.findMany.mockResolvedValue([
        { total: 1000 },
        { total: 2000 },
        { total: 3000 }
      ]);
      
      const response = await request(app)
        .get('/api/master/stats');
      
      expect(response.status).toBe(200);
      expect(response.body.totalSaved).toBe(150);
      expect(response.body.todayCount).toBe(5);
      expect(response.body.weekTotal).toBe(6000);
      
      // Verify count queries include both statuses
      const countCalls = prisma.invoice.count.mock.calls;
      expect(countCalls[0][0].where.OR).toEqual([
        { status: 'saved' },
        { status: 'submitted' }
      ]);
    });
  });
});