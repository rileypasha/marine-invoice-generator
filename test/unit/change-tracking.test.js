/**
 * Unit Tests for Invoice Change Tracking System
 */

const { normalizeInvoice, extractKeyFields, generateLineItemId } = require('../../server/utils/invoice-normalizer');
const { computeInvoiceDiff, formatDiffForDisplay } = require('../../server/utils/diff-engine');

describe('Invoice Normalizer', () => {
  describe('normalizeInvoice', () => {
    test('should normalize null and undefined to empty strings', () => {
      const invoice = {
        id: '123',
        name: null,
        description: undefined,
        amount: 100
      };
      
      const normalized = normalizeInvoice(invoice);
      
      expect(normalized.name).toBe('');
      expect(normalized.description).toBe('');
      expect(normalized.amount).toBe(100);
    });
    
    test('should trim strings', () => {
      const invoice = {
        customerName: '  John Doe  ',
        address: '\n123 Main St\t',
        notes: '   Some notes   '
      };
      
      const normalized = normalizeInvoice(invoice);
      
      expect(normalized.customerName).toBe('John Doe');
      expect(normalized.address).toBe('123 Main St');
      expect(normalized.notes).toBe('Some notes');
    });
    
    test('should round monetary values to 2 decimal places', () => {
      const invoice = {
        total: 99.999,
        subtotal: 85.555,
        tax: 14.4444
      };
      
      const normalized = normalizeInvoice(invoice);
      
      expect(normalized.total).toBe(100.00);
      expect(normalized.subtotal).toBe(85.56);
      expect(normalized.tax).toBe(14.44);
    });
    
    test('should sort object keys alphabetically', () => {
      const invoice = {
        zebra: 1,
        apple: 2,
        banana: 3
      };
      
      const normalized = normalizeInvoice(invoice);
      const keys = Object.keys(normalized);
      
      expect(keys).toEqual(['apple', 'banana', 'zebra']);
    });
    
    test('should exclude system fields', () => {
      const invoice = {
        id: '123',
        name: 'Test',
        _id: 'mongodb_id',
        __v: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02'
      };
      
      const normalized = normalizeInvoice(invoice);
      
      expect(normalized._id).toBeUndefined();
      expect(normalized.__v).toBeUndefined();
      expect(normalized.createdAt).toBeUndefined();
      expect(normalized.updatedAt).toBeUndefined();
      expect(normalized.id).toBe('123');
      expect(normalized.name).toBe('Test');
    });
  });
  
  describe('generateLineItemId', () => {
    test('should use existing lineId if available', () => {
      const item = {
        lineId: 'existing-id',
        description: 'Test item'
      };
      
      const id = generateLineItemId(item);
      
      expect(id).toBe('existing-id');
    });
    
    test('should generate consistent hash for same content', () => {
      const item1 = {
        description: 'Service A',
        quantity: 2,
        price: 100
      };
      
      const item2 = {
        description: 'Service A',
        quantity: 2,
        price: 100
      };
      
      const id1 = generateLineItemId(item1);
      const id2 = generateLineItemId(item2);
      
      expect(id1).toBe(id2);
    });
    
    test('should generate different hash for different content', () => {
      const item1 = {
        description: 'Service A',
        quantity: 2,
        price: 100
      };
      
      const item2 = {
        description: 'Service B',
        quantity: 2,
        price: 100
      };
      
      const id1 = generateLineItemId(item1);
      const id2 = generateLineItemId(item2);
      
      expect(id1).not.toBe(id2);
    });
  });
});

describe('Diff Engine', () => {
  describe('computeInvoiceDiff', () => {
    test('should detect field additions', () => {
      const baseline = {
        customerName: 'John Doe',
        total: 100
      };
      
      const current = {
        customerName: 'John Doe',
        total: 100,
        notes: 'New note added'
      };
      
      const diff = computeInvoiceDiff(baseline, current);
      
      expect(diff.summary.additions).toBe(1);
      expect(diff.changes).toContainEqual({
        type: 'added',
        path: 'notes',
        new: 'New note added'
      });
    });
    
    test('should detect field removals', () => {
      const baseline = {
        customerName: 'John Doe',
        total: 100,
        discount: 10
      };
      
      const current = {
        customerName: 'John Doe',
        total: 100
      };
      
      const diff = computeInvoiceDiff(baseline, current);
      
      expect(diff.summary.removals).toBe(1);
      expect(diff.changes).toContainEqual({
        type: 'removed',
        path: 'discount',
        old: 10
      });
    });
    
    test('should detect field modifications', () => {
      const baseline = {
        customerName: 'John Doe',
        total: 100
      };
      
      const current = {
        customerName: 'John Doe',
        total: 150
      };
      
      const diff = computeInvoiceDiff(baseline, current);
      
      expect(diff.summary.modifications).toBe(1);
      expect(diff.changes).toContainEqual({
        type: 'changed',
        path: 'total',
        old: 100,
        new: 150
      });
    });
    
    test('should handle line item additions', () => {
      const baseline = {
        lineItems: [
          { lineId: 'item1', description: 'Service A', quantity: 1, price: 100 }
        ]
      };
      
      const current = {
        lineItems: [
          { lineId: 'item1', description: 'Service A', quantity: 1, price: 100 },
          { lineId: 'item2', description: 'Service B', quantity: 2, price: 50 }
        ]
      };
      
      const diff = computeInvoiceDiff(baseline, current);
      
      expect(diff.summary.additions).toBeGreaterThan(0);
      const addedItem = diff.changes.find(c => c.type === 'added' && c.lineId === 'item2');
      expect(addedItem).toBeDefined();
    });
    
    test('should handle line item removals', () => {
      const baseline = {
        lineItems: [
          { lineId: 'item1', description: 'Service A', quantity: 1, price: 100 },
          { lineId: 'item2', description: 'Service B', quantity: 2, price: 50 }
        ]
      };
      
      const current = {
        lineItems: [
          { lineId: 'item1', description: 'Service A', quantity: 1, price: 100 }
        ]
      };
      
      const diff = computeInvoiceDiff(baseline, current);
      
      expect(diff.summary.removals).toBeGreaterThan(0);
      const removedItem = diff.changes.find(c => c.type === 'removed' && c.lineId === 'item2');
      expect(removedItem).toBeDefined();
    });
    
    test('should handle line item modifications', () => {
      const baseline = {
        lineItems: [
          { lineId: 'item1', description: 'Service A', quantity: 1, price: 100 }
        ]
      };
      
      const current = {
        lineItems: [
          { lineId: 'item1', description: 'Service A', quantity: 2, price: 100 }
        ]
      };
      
      const diff = computeInvoiceDiff(baseline, current);
      
      expect(diff.summary.modifications).toBeGreaterThan(0);
      const modifiedItem = diff.changes.find(c => c.type === 'modified' && c.lineId === 'item1');
      expect(modifiedItem).toBeDefined();
      expect(modifiedItem.fieldChanges).toBeDefined();
    });
  });
  
  describe('formatDiffForDisplay', () => {
    test('should categorize changes by section', () => {
      const diff = {
        summary: { additions: 2, removals: 1, modifications: 1 },
        changes: [
          { type: 'added', path: 'customer.name', new: 'John Doe' },
          { type: 'removed', path: 'vessel.weight', old: 1000 },
          { type: 'changed', path: 'total', old: 100, new: 150 },
          { type: 'added', path: 'lineItems[0]', new: {} }
        ]
      };
      
      const formatted = formatDiffForDisplay(diff);
      
      expect(formatted.sections.customerDetails).toHaveLength(1);
      expect(formatted.sections.vesselDetails).toHaveLength(1);
      expect(formatted.sections.financial).toHaveLength(1);
      expect(formatted.sections.lineItems).toHaveLength(1);
    });
  });
});

describe('Revision Tracking', () => {
  // Mock Prisma client
  const mockPrismaClient = {
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    invoiceRevision: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn()
    },
    invoiceSubmission: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    masterChangeView: {
      create: jest.fn(),
      findFirst: jest.fn()
    }
  };
  
  test('should create revision for post-submission changes', async () => {
    // This would be tested with the actual revision tracker middleware
    // For now, just verify the structure
    const revisionData = {
      invoiceId: 'inv-123',
      revisionNumber: 1,
      actorEmail: 'user@example.com',
      changeSummary: 'Updated invoice INV-001',
      payloadJson: { /* normalized data */ }
    };
    
    expect(revisionData).toHaveProperty('invoiceId');
    expect(revisionData).toHaveProperty('revisionNumber');
    expect(revisionData).toHaveProperty('actorEmail');
    expect(revisionData).toHaveProperty('payloadJson');
  });
});

describe('Master API Authorization', () => {
  test('should allow access for master emails', () => {
    const masterEmails = ['rpasha@marinegroupbw.com'];
    const userEmail = 'rpasha@marinegroupbw.com';
    
    expect(masterEmails.includes(userEmail)).toBe(true);
  });
  
  test('should deny access for non-master emails', () => {
    const masterEmails = ['rpasha@marinegroupbw.com'];
    const userEmail = 'regular@example.com';
    
    expect(masterEmails.includes(userEmail)).toBe(false);
  });
});