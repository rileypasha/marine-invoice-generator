/**
 * Unit Tests for Change Tracking System
 */

const { PrismaClient } = require('@prisma/client');
const {
  flagUnreadChanges,
  acknowledgeChanges,
  computeDiffSinceLastMasterView,
  getChangeTrackingSummary,
  validateMasterAuth
} = require('../../server/utils/changeTracker');

// Mock Prisma
jest.mock('@prisma/client');

describe('Change Tracking System', () => {
  let mockPrisma;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Prisma instance
    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn()
      },
      invoiceRevision: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn()
      }
    };

    // Mock the PrismaClient constructor
    PrismaClient.mockImplementation(() => mockPrisma);
  });

  describe('flagUnreadChanges', () => {
    it('should skip change tracking for new invoices', async () => {
      // Mock invoice not found (new invoice)
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const result = await flagUnreadChanges('new-invoice-id', {}, 'user@test.com');

      expect(result.success).toBe(true);
      expect(result.action).toBe('new_invoice');
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });

    it('should flag existing invoice with unread changes', async () => {
      // Mock existing invoice
      const mockExistingInvoice = {
        id: 'existing-invoice-id',
        revisions: []
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockExistingInvoice);
      mockPrisma.invoiceRevision.count.mockResolvedValue(2);
      mockPrisma.invoice.update.mockResolvedValue({});
      mockPrisma.invoiceRevision.create.mockResolvedValue({});

      const result = await flagUnreadChanges(
        'existing-invoice-id',
        { title: 'Updated Invoice' },
        'user@test.com'
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('flagged_changes');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'existing-invoice-id' },
        data: { hasUnreadChanges: true }
      });
      expect(mockPrisma.invoiceRevision.create).toHaveBeenCalledWith({
        data: {
          invoiceId: 'existing-invoice-id',
          revisionNumber: 3, // count + 1
          actorEmail: 'user@test.com',
          changeSummary: 'Invoice updated by user@test.com',
          payloadJson: expect.any(Object)
        }
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.invoice.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        flagUnreadChanges('error-invoice-id', {}, 'user@test.com')
      ).rejects.toThrow('Database error');
    });
  });

  describe('acknowledgeChanges', () => {
    it('should clear unread flag and set last master view timestamp', async () => {
      const mockTimestamp = new Date('2024-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockTimestamp);

      mockPrisma.invoice.update.mockResolvedValue({
        id: 'invoice-id',
        hasUnreadChanges: false,
        lastMasterViewAt: mockTimestamp
      });

      const result = await acknowledgeChanges('invoice-id', 'master@test.com');

      expect(result.success).toBe(true);
      expect(result.acknowledgedAt).toEqual(mockTimestamp);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-id' },
        data: {
          hasUnreadChanges: false,
          lastMasterViewAt: mockTimestamp
        }
      });

      global.Date.mockRestore();
    });

    it('should handle database errors', async () => {
      mockPrisma.invoice.update.mockRejectedValue(new Error('Update failed'));

      await expect(
        acknowledgeChanges('error-invoice-id', 'master@test.com')
      ).rejects.toThrow('Update failed');
    });
  });

  describe('computeDiffSinceLastMasterView', () => {
    it('should return null for invoices with no unread changes', async () => {
      const mockInvoice = {
        id: 'invoice-id',
        hasUnreadChanges: false,
        revisions: []
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await computeDiffSinceLastMasterView('invoice-id', 'master@test.com');

      expect(result).toBeNull();
    });

    it('should throw error for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        computeDiffSinceLastMasterView('non-existent-id', 'master@test.com')
      ).rejects.toThrow('Invoice not found');
    });

    it('should compute diff when invoice has unread changes', async () => {
      const mockInvoice = {
        id: 'invoice-id',
        hasUnreadChanges: true,
        lastMasterViewAt: new Date('2024-01-01T10:00:00Z'),
        data: JSON.stringify({ title: 'Current Invoice' }),
        revisions: [
          {
            id: 'revision-1',
            createdAt: new Date('2024-01-01T12:00:00Z'),
            payloadJson: { title: 'Updated Invoice' }
          },
          {
            id: 'revision-2',
            createdAt: new Date('2024-01-01T09:00:00Z'),
            payloadJson: { title: 'Old Invoice' }
          }
        ]
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await computeDiffSinceLastMasterView('invoice-id', 'master@test.com');

      expect(result).not.toBeNull();
      expect(result.diff).toBeDefined();
      expect(result.baseline.type).toBe('revision');
      expect(result.current.revisionId).toBe('revision-1');
    });
  });

  describe('getChangeTrackingSummary', () => {
    it('should return summary statistics', async () => {
      mockPrisma.invoice.count
        .mockResolvedValueOnce(5) // totalWithChanges
        .mockResolvedValueOnce(2); // recentChanges

      const result = await getChangeTrackingSummary();

      expect(result.totalWithChanges).toBe(5);
      expect(result.recentChanges).toBe(2);
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should apply filters when provided', async () => {
      const filters = { status: 'saved' };
      mockPrisma.invoice.count.mockResolvedValue(3);

      await getChangeTrackingSummary(filters);

      expect(mockPrisma.invoice.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          hasUnreadChanges: true,
          status: 'saved'
        })
      });
    });
  });

  describe('validateMasterAuth', () => {
    it('should return true for master user', () => {
      const masterUser = { role: 'master', email: 'master@test.com' };

      expect(validateMasterAuth(masterUser)).toBe(true);
    });

    it('should return false for non-master user', () => {
      const regularUser = { role: 'user', email: 'user@test.com' };

      expect(validateMasterAuth(regularUser)).toBe(false);
    });

    it('should return false for undefined user', () => {
      expect(validateMasterAuth(undefined)).toBe(false);
    });

    it('should return false for user without role', () => {
      const userWithoutRole = { email: 'user@test.com' };

      expect(validateMasterAuth(userWithoutRole)).toBe(false);
    });
  });
});

describe('Change Tracking Integration', () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      invoiceRevision: {
        count: jest.fn(),
        create: jest.fn()
      }
    };
    PrismaClient.mockImplementation(() => mockPrisma);
  });

  it('should handle complete workflow: flag changes then acknowledge', async () => {
    // Setup mocks for flagging changes
    const mockExistingInvoice = {
      id: 'workflow-test-id',
      revisions: []
    };
    mockPrisma.invoice.findUnique.mockResolvedValue(mockExistingInvoice);
    mockPrisma.invoiceRevision.count.mockResolvedValue(0);
    mockPrisma.invoice.update.mockResolvedValue({});
    mockPrisma.invoiceRevision.create.mockResolvedValue({});

    // Step 1: Flag changes
    const flagResult = await flagUnreadChanges(
      'workflow-test-id',
      { title: 'Updated Invoice' },
      'user@test.com'
    );

    expect(flagResult.success).toBe(true);
    expect(flagResult.action).toBe('flagged_changes');

    // Step 2: Acknowledge changes
    const acknowledgeResult = await acknowledgeChanges(
      'workflow-test-id',
      'master@test.com'
    );

    expect(acknowledgeResult.success).toBe(true);
    expect(acknowledgeResult.acknowledgedAt).toBeInstanceOf(Date);

    // Verify the sequence of operations
    expect(mockPrisma.invoice.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.invoiceRevision.create).toHaveBeenCalledTimes(1);
  });
});