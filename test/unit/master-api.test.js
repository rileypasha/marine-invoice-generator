const request = require('supertest');
const express = require('express');
const session = require('express-session');

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    invoice: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn()
    }
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrismaClient)
  };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Set up environment
process.env.MASTER_EMAILS = 'rpasha@marinegroupbw.com';
process.env.SESSION_SECRET = 'test-secret';

describe('Master API Endpoints', () => {
  let app;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create Express app with session
    app = express();
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    app.use(express.json());

    // Add master user session for all tests
    app.use((req, res, next) => {
      req.session = { 
        user: { 
          email: 'rpasha@marinegroupbw.com', 
          name: 'Master User',
          id: 'master-user-id'
        } 
      };
      req.user = req.session.user;
      next();
    });

    // Mount master routes
    const masterRouter = require('../../server/routes/master');
    app.use('/api/master', masterRouter);
  });

  describe('GET /api/master/invoices', () => {
    test('should return paginated invoices list', async () => {
      const mockInvoices = [
        {
          id: '1',
          invoiceNumber: 'INV-001',
          status: 'saved',
          savedAt: new Date(),
          userName: 'John Doe',
          userEmail: 'john@example.com',
          vesselName: 'Test Vessel',
          customerName: 'Customer A',
          total: 1000,
          grossProfit: 200,
          profitPercent: 20
        }
      ];

      prisma.invoice.count.mockResolvedValue(1);
      prisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const response = await request(app)
        .get('/api/master/invoices?page=1&limit=20')
        .expect(200);

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });
    });

    test('should filter by search term', async () => {
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/master/invoices?search=vessel')
        .expect(200);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'saved',
            OR: expect.arrayContaining([
              expect.objectContaining({ 
                vesselName: { contains: 'vessel', mode: 'insensitive' } 
              })
            ])
          })
        })
      );
    });

    test('should filter by date range', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-12-31';

      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.findMany.mockResolvedValue([]);

      await request(app)
        .get(`/api/master/invoices?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .expect(200);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            savedAt: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo)
            }
          })
        })
      );
    });

    test('should sort by specified field', async () => {
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/master/invoices?sortBy=total&sortOrder=asc')
        .expect(200);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { total: 'asc' }
        })
      );
    });
  });

  describe('GET /api/master/invoices/:id', () => {
    test('should return invoice details', async () => {
      const mockInvoice = {
        id: '1',
        invoiceNumber: 'INV-001',
        status: 'saved',
        data: JSON.stringify({ lineItems: [] }),
        user: { id: 'user-1', email: 'user@example.com', name: 'User' },
        submissions: [],
        revisions: []
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .get('/api/master/invoices/1')
        .expect(200);

      expect(response.body.id).toBe('1');
      expect(response.body.parsedData).toEqual({ lineItems: [] });
    });

    test('should return 404 for non-existent invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/master/invoices/999')
        .expect(404);

      expect(response.body.error).toBe('Invoice not found');
    });
  });

  describe('GET /api/master/invoices/:id/export.csv', () => {
    test('should export invoice as CSV', async () => {
      const mockInvoice = {
        id: '1',
        invoiceNumber: 'INV-001',
        status: 'saved',
        savedAt: new Date(),
        vesselName: 'Test Vessel',
        customerName: 'Customer A',
        total: 1000,
        data: JSON.stringify({
          lineItems: [
            { description: 'Service A', type: 'Labor', cost: 500 }
          ]
        })
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .get('/api/master/invoices/1/export.csv')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('invoice-INV-001.csv');
      expect(response.text).toContain('Invoice Export');
      expect(response.text).toContain('INV-001');
    });

    test('should return 404 for non-existent invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/master/invoices/999/export.csv')
        .expect(404);

      expect(response.body.error).toBe('Invoice not found');
    });
  });

  describe('GET /api/master/stats', () => {
    test('should return dashboard statistics', async () => {
      prisma.invoice.count.mockResolvedValueOnce(100); // total saved
      prisma.invoice.count.mockResolvedValueOnce(5);   // today count
      prisma.invoice.findMany.mockResolvedValue([
        { total: 1000 },
        { total: 2000 },
        { total: 3000 }
      ]);

      const response = await request(app)
        .get('/api/master/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        totalSaved: 100,
        todayCount: 5,
        weekTotal: 6000
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authorization Tests', () => {
    test('should deny access to non-master user', async () => {
      // Override with non-master user
      app = express();
      app.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false
      }));
      app.use((req, res, next) => {
        req.session = { 
          user: { 
            email: 'regular@example.com', 
            name: 'Regular User' 
          } 
        };
        req.user = req.session.user;
        next();
      });

      const masterRouter = require('../../server/routes/master');
      app.use('/api/master', masterRouter);

      const response = await request(app)
        .get('/api/master/invoices')
        .expect(403);

      expect(response.body.error).toBe('Access denied - Master account required');
    });

    test('should require authentication', async () => {
      // Override with no session
      app = express();
      app.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false
      }));

      const masterRouter = require('../../server/routes/master');
      app.use('/api/master', masterRouter);

      const response = await request(app)
        .get('/api/master/invoices')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });
});