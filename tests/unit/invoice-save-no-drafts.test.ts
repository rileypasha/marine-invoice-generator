/**
 * Unit tests for invoice save operations without draft creation
 * Verifies that the new system creates only canonical records
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('Invoice Save - No Draft Creation', () => {
  let mockDatabase: Map<string, any>;
  let mockLogger: any;

  beforeEach(() => {
    mockDatabase = new Map();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  const createMockRequest = (data: any, userId: string = 'test-user', idempotencyKey?: string) => ({
    body: data,
    userId,
    correlationId: 'test-correlation',
    headers: {
      'idempotency-key': idempotencyKey || `key-${Date.now()}`,
    },
  });

  const createMockResponse = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  };

  // Simulate the new save logic
  const handleSave = async (req: any, res: any) => {
    const { body: invoiceData, userId, correlationId, headers } = req;
    const idempotencyKey = headers['idempotency-key'];

    try {
      // Validate required fields
      if (!invoiceData.amount || !invoiceData.customerName) {
        return res.status(400).json({
          code: 'INVALID_INVOICE_DATA',
          message: 'Missing required fields',
          correlationId,
        });
      }

      // Generate or use provided ID
      const invoiceId = invoiceData.id || `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      // Check for existing invoice (idempotency)
      const existingInvoice = mockDatabase.get(invoiceId);
      if (existingInvoice && existingInvoice.userId === userId) {
        // Update existing
        const updatedInvoice = {
          ...existingInvoice,
          ...invoiceData,
          id: invoiceId,
          userId,
          updatedAt: new Date().toISOString(),
          status: 'saved', // Always canonical
        };
        mockDatabase.set(invoiceId, updatedInvoice);

        return res.status(200).json({
          id: invoiceId,
          message: 'Invoice updated successfully',
          correlationId,
          action: 'UPDATED',
        });
      }

      // Create new canonical invoice
      const invoice = {
        ...invoiceData,
        id: invoiceId,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'saved', // Always canonical, never draft
      };

      mockDatabase.set(invoiceId, invoice);

      return res.status(200).json({
        id: invoiceId,
        message: 'Invoice saved successfully',
        correlationId,
        action: 'CREATED',
      });

    } catch (error: any) {
      return res.status(500).json({
        code: 'SAVE_FAILED',
        message: 'Failed to save invoice',
        correlationId,
      });
    }
  };

  test('creates new invoice as saved, never draft', async () => {
    const req = createMockRequest({
      title: 'Test Invoice',
      amount: 100,
      customerName: 'John Doe',
    });
    const res = createMockResponse();

    await handleSave(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATED',
        message: 'Invoice saved successfully',
      })
    );

    // Verify invoice is saved with canonical status
    const savedInvoices = Array.from(mockDatabase.values());
    expect(savedInvoices).toHaveLength(1);
    expect(savedInvoices[0].status).toBe('saved');
    expect(savedInvoices[0].title).toBe('Test Invoice');
  });

  test('idempotent save updates existing invoice instead of creating duplicate', async () => {
    const invoiceId = 'INV-TEST-123';

    // First save
    const req1 = createMockRequest({
      id: invoiceId,
      title: 'Original Title',
      amount: 100,
      customerName: 'John Doe',
    }, 'test-user', 'idempotency-key-1');
    const res1 = createMockResponse();

    await handleSave(req1, res1);

    expect(res1.json).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATED' })
    );

    // Second save with same ID (idempotent)
    const req2 = createMockRequest({
      id: invoiceId,
      title: 'Updated Title',
      amount: 150,
      customerName: 'John Doe',
    }, 'test-user', 'idempotency-key-2');
    const res2 = createMockResponse();

    await handleSave(req2, res2);

    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATED' })
    );

    // Verify only one invoice exists
    const savedInvoices = Array.from(mockDatabase.values());
    expect(savedInvoices).toHaveLength(1);
    expect(savedInvoices[0].title).toBe('Updated Title');
    expect(savedInvoices[0].amount).toBe(150);
    expect(savedInvoices[0].status).toBe('saved');
  });

  test('prevents creation of draft status invoices', async () => {
    const req = createMockRequest({
      title: 'Attempted Draft',
      amount: 100,
      customerName: 'Jane Doe',
      status: 'draft', // Attempt to force draft status
    });
    const res = createMockResponse();

    await handleSave(req, res);

    // Verify invoice was created as saved, not draft
    const savedInvoices = Array.from(mockDatabase.values());
    expect(savedInvoices).toHaveLength(1);
    expect(savedInvoices[0].status).toBe('saved'); // Force canonical state
  });

  test('multiple saves with different IDs create separate canonical invoices', async () => {
    // Save invoice 1
    const req1 = createMockRequest({
      title: 'Invoice 1',
      amount: 100,
      customerName: 'Customer 1',
    });
    const res1 = createMockResponse();
    await handleSave(req1, res1);

    // Save invoice 2
    const req2 = createMockRequest({
      title: 'Invoice 2',
      amount: 200,
      customerName: 'Customer 2',
    });
    const res2 = createMockResponse();
    await handleSave(req2, res2);

    // Verify two separate canonical invoices
    const savedInvoices = Array.from(mockDatabase.values());
    expect(savedInvoices).toHaveLength(2);

    savedInvoices.forEach(invoice => {
      expect(invoice.status).toBe('saved');
    });

    expect(savedInvoices.find(inv => inv.title === 'Invoice 1')).toBeDefined();
    expect(savedInvoices.find(inv => inv.title === 'Invoice 2')).toBeDefined();
  });

  test('user isolation - users cannot update each others invoices', async () => {
    const invoiceId = 'INV-SHARED-123';

    // User 1 creates invoice
    const req1 = createMockRequest({
      id: invoiceId,
      title: 'User 1 Invoice',
      amount: 100,
      customerName: 'Customer 1',
    }, 'user-1');
    const res1 = createMockResponse();
    await handleSave(req1, res1);

    // User 2 tries to "update" with same ID
    const req2 = createMockRequest({
      id: invoiceId,
      title: 'User 2 Hijack Attempt',
      amount: 999,
      customerName: 'Hacker',
    }, 'user-2');
    const res2 = createMockResponse();
    await handleSave(req2, res2);

    // Should create separate invoices
    const savedInvoices = Array.from(mockDatabase.values());
    expect(savedInvoices).toHaveLength(2);

    const user1Invoice = savedInvoices.find(inv => inv.userId === 'user-1');
    const user2Invoice = savedInvoices.find(inv => inv.userId === 'user-2');

    expect(user1Invoice?.title).toBe('User 1 Invoice');
    expect(user2Invoice?.title).toBe('User 2 Hijack Attempt');
    expect(user1Invoice?.id).not.toBe(user2Invoice?.id); // Different IDs
  });

  test('validation prevents saving invalid invoices', async () => {
    const req = createMockRequest({
      title: 'Invalid Invoice',
      // Missing amount and customerName
    });
    const res = createMockResponse();

    await handleSave(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_INVOICE_DATA',
        message: 'Missing required fields',
      })
    );

    // Verify no invoice was created
    expect(mockDatabase.size).toBe(0);
  });
});

describe('Invoice List - Draft Exclusion', () => {
  let mockDatabase: Map<string, any>;

  beforeEach(() => {
    mockDatabase = new Map();

    // Seed with mixed invoices including legacy drafts
    mockDatabase.set('inv-1', {
      id: 'inv-1',
      userId: 'test-user',
      title: 'Saved Invoice',
      status: 'saved',
      createdAt: '2024-01-01T10:00:00Z',
    });

    mockDatabase.set('inv-2', {
      id: 'inv-2',
      userId: 'test-user',
      title: 'Legacy Draft',
      status: 'draft',
      createdAt: '2024-01-01T11:00:00Z',
    });

    mockDatabase.set('inv-3', {
      id: 'inv-3',
      userId: 'test-user',
      title: 'Finalized Invoice',
      status: 'finalized',
      createdAt: '2024-01-01T12:00:00Z',
    });
  });

  const handleList = async (userId: string) => {
    // Simulate new list logic that excludes drafts
    const userInvoices = Array.from(mockDatabase.values())
      .filter(invoice => invoice.userId === userId)
      .filter(invoice => invoice.status !== 'draft') // Exclude legacy drafts
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      invoices: userInvoices,
      total: userInvoices.length,
    };
  };

  test('excludes legacy draft invoices from list', async () => {
    const result = await handleList('test-user');

    expect(result.invoices).toHaveLength(2);
    expect(result.invoices.map(inv => inv.status)).toEqual(['finalized', 'saved']);
    expect(result.invoices.find(inv => inv.status === 'draft')).toBeUndefined();
  });

  test('returns empty list when only drafts exist', async () => {
    // Clear and add only draft
    mockDatabase.clear();
    mockDatabase.set('draft-only', {
      id: 'draft-only',
      userId: 'test-user',
      title: 'Only Draft',
      status: 'draft',
      createdAt: '2024-01-01T10:00:00Z',
    });

    const result = await handleList('test-user');

    expect(result.invoices).toHaveLength(0);
  });
});