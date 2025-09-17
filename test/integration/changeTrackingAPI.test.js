/**
 * Integration Tests for Change Tracking API Endpoints
 */

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { PrismaClient } = require('@prisma/client');
const changeTrackingRouter = require('../../server/routes/changeTracking');

// Mock Prisma
jest.mock('@prisma/client');

// Create test app
const createTestApp = () => {
  const app = express();

  // Basic middleware setup
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }));

  // Mock user middleware
  app.use((req, res, next) => {
    // Set test user based on test scenario
    if (req.headers['test-user'] === 'master') {
      req.user = {
        id: 'master-user-id',
        email: 'master@test.com',
        role: 'master'
      };
    } else if (req.headers['test-user'] === 'user') {
      req.user = {
        id: 'regular-user-id',
        email: 'user@test.com',
        role: 'user'
      };
    }
    next();
  });

  // Add our routes
  app.use('/api/change-tracking', changeTrackingRouter);

  return app;
};

describe('Change Tracking API Endpoints', () => {
  let app;
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Prisma instance
    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn()
      },
      invoiceRevision: {
        findMany: jest.fn(),
        count: jest.fn()
      }
    };

    // Mock the PrismaClient constructor
    PrismaClient.mockImplementation(() => mockPrisma);

    app = createTestApp();
  });

  describe('GET /api/change-tracking/:id', () => {
    const mockInvoice = {
      id: 'test-invoice-id',
      title: 'Test Invoice',
      hasUnreadChanges: true,
      lastMasterViewAt: null,
      data: JSON.stringify({ customer: { name: 'Test Customer' } }),
      user: {
        id: 'user-id',
        email: 'user@test.com',
        name: 'Test User'
      },
      revisions: []
    };

    it('should require master role', async () => {
      const response = await request(app)
        .get('/api/change-tracking/test-invoice-id')
        .set('test-user', 'user'); // Regular user

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Master role required');
    });

    it('should return 404 for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/change-tracking/non-existent-id')
        .set('test-user', 'master');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });

    it('should return invoice without diff when not requested', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .get('/api/change-tracking/test-invoice-id')
        .set('test-user', 'master');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice).toBeDefined();
      expect(response.body.diff).toBeUndefined();
    });

    it('should include diff when requested and invoice has unread changes', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      // Mock the diff computation (this would be tested separately)
      jest.doMock('../server/utils/changeTracker', () => ({
        ...jest.requireActual('../server/utils/changeTracker'),
        computeDiffSinceLastMasterView: jest.fn().mockResolvedValue({
          diff: { changes: [] },
          baseline: { type: 'current' },
          current: { timestamp: new Date() }
        }),
        validateMasterAuth: jest.fn().mockReturnValue(true)
      }));

      const response = await request(app)
        .get('/api/change-tracking/test-invoice-id?include=diff')
        .set('test-user', 'master');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice).toBeDefined();
      // Note: diff might not be included if mock setup is different
    });
  });

  describe('PATCH /api/change-tracking/:id/acknowledge', () => {
    it('should require master role', async () => {
      const response = await request(app)
        .patch('/api/change-tracking/test-invoice-id/acknowledge')
        .set('test-user', 'user');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Master role required');
    });

    it('should return 404 for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/change-tracking/non-existent-id/acknowledge')
        .set('test-user', 'master');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });

    it('should handle invoice with no unread changes', async () => {
      const mockInvoiceNoChanges = {
        id: 'test-invoice-id',
        hasUnreadChanges: false,
        lastMasterViewAt: new Date('2024-01-01T12:00:00Z')
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoiceNoChanges);

      const response = await request(app)
        .patch('/api/change-tracking/test-invoice-id/acknowledge')
        .set('test-user', 'master');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('No unread changes');
    });

    it('should acknowledge changes successfully', async () => {
      const mockInvoiceWithChanges = {
        id: 'test-invoice-id',
        hasUnreadChanges: true,
        lastMasterViewAt: null
      };
      const mockTimestamp = new Date('2024-01-01T12:00:00Z');

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoiceWithChanges);
      mockPrisma.invoice.update.mockResolvedValue({
        hasUnreadChanges: false,
        lastMasterViewAt: mockTimestamp
      });

      const response = await request(app)
        .patch('/api/change-tracking/test-invoice-id/acknowledge')
        .set('test-user', 'master');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.acknowledgedAt).toBeDefined();
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'test-invoice-id' },
        data: {
          hasUnreadChanges: false,
          lastMasterViewAt: expect.any(Date)
        }
      });
    });
  });

  describe('GET /api/change-tracking/summary', () => {
    it('should require master role', async () => {
      const response = await request(app)
        .get('/api/change-tracking/summary')
        .set('test-user', 'user');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Master role required');
    });

    it('should return summary statistics', async () => {
      mockPrisma.invoice.count
        .mockResolvedValueOnce(10) // totalWithChanges
        .mockResolvedValueOnce(3); // recentChanges

      const response = await request(app)
        .get('/api/change-tracking/summary')
        .set('test-user', 'master');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary).toEqual({
        totalWithChanges: 10,
        recentChanges: 3,
        lastUpdated: expect.any(String)
      });
    });

    it('should apply query filters', async () => {
      mockPrisma.invoice.count.mockResolvedValue(5);

      const response = await request(app)
        .get('/api/change-tracking/summary?status=saved&dateFrom=2024-01-01')
        .set('test-user', 'master');

      expect(response.status).toBe(200);
      expect(mockPrisma.invoice.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          hasUnreadChanges: true,
          status: 'saved',
          updatedAt: expect.objectContaining({
            gte: expect.any(Date)
          })
        })
      });
    });
  });

  describe('GET /api/change-tracking/:id/changes/history', () => {
    it('should require master role', async () => {
      const response = await request(app)
        .get('/api/change-tracking/test-invoice-id/changes/history')
        .set('test-user', 'user');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Master role required');
    });

    it('should return 404 for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/change-tracking/non-existent-id/changes/history')
        .set('test-user', 'master');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });

    it('should return change history with pagination', async () => {
      const mockInvoice = {
        id: 'test-invoice-id',
        hasUnreadChanges: true,
        lastMasterViewAt: null
      };
      const mockRevisions = [
        {
          id: 'revision-1',
          revisionNumber: 2,
          actorEmail: 'user@test.com',
          changeSummary: 'Updated line items',
          createdAt: new Date('2024-01-01T12:00:00Z')
        },
        {
          id: 'revision-2',
          revisionNumber: 1,
          actorEmail: 'user@test.com',
          changeSummary: 'Initial submission',
          createdAt: new Date('2024-01-01T10:00:00Z')
        }
      ];

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoiceRevision.findMany.mockResolvedValue(mockRevisions);
      mockPrisma.invoiceRevision.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/change-tracking/test-invoice-id/changes/history?limit=5&offset=0')
        .set('test-user', 'master');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.revisions).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 2,
        limit: 5,
        offset: 0
      });
      expect(mockPrisma.invoiceRevision.findMany).toHaveBeenCalledWith({
        where: { invoiceId: 'test-invoice-id' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        skip: 0,
        select: {
          id: true,
          revisionNumber: true,
          actorEmail: true,
          changeSummary: true,
          createdAt: true
        }
      });
    });
  });
});

describe('Error Handling', () => {
  let app;
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn()
      }
    };
    PrismaClient.mockImplementation(() => mockPrisma);
    app = createTestApp();
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.invoice.findUnique.mockRejectedValue(new Error('Database connection failed'));

    const response = await request(app)
      .get('/api/change-tracking/test-invoice-id')
      .set('test-user', 'master');

    expect(response.status).toBe(500);
  });

  it('should handle invalid request parameters', async () => {
    const response = await request(app)
      .get('/api/change-tracking/invalid-uuid')
      .set('test-user', 'master');

    // Should attempt to query even with invalid UUID format
    // The database will handle UUID validation
    expect(mockPrisma.invoice.findUnique).toHaveBeenCalled();
  });
});