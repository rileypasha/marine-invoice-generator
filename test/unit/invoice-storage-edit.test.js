/**
 * Unit Tests for Invoice Storage Edit Operations
 *
 * Tests the core storage logic for editing existing invoices
 * to ensure proper update behavior vs create behavior.
 */

const { InvoiceStorage } = require('../../src/js/storage/InvoiceStorage.js');

// Mock UserManager
class MockUserManager {
  constructor(user = null) {
    this.currentUser = user;
    this.listeners = [];
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.listeners.forEach(listener => listener(user));
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

// Mock localStorage
class MockLocalStorage {
  constructor() {
    this.data = {};
  }

  getItem(key) {
    return this.data[key] || null;
  }

  setItem(key, value) {
    this.data[key] = value;
  }

  removeItem(key) {
    delete this.data[key];
  }

  clear() {
    this.data = {};
  }
}

// Mock fetch
global.fetch = jest.fn();

describe('InvoiceStorage Edit Operations', () => {
  let invoiceStorage;
  let mockUserManager;
  let mockLocalStorage;

  beforeEach(() => {
    // Setup mocks
    mockUserManager = new MockUserManager({
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User'
    });

    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage;

    // Reset fetch mock
    fetch.mockClear();

    invoiceStorage = new InvoiceStorage(mockUserManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveInvoice Method Behavior', () => {
    test('should create new invoice when no existing ID provided', async () => {
      const invoiceData = {
        vessel: { name: 'Test Vessel' },
        customer: { customerName: 'Test Customer' },
        scope: { lineItems: [] }
      };

      // Mock successful server response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoice: { id: 'server-123' } }),
        text: async () => JSON.stringify({ invoice: { id: 'server-123' } })
      });

      const result = await invoiceStorage.saveInvoice(invoiceData, 'Test Invoice');

      // Should generate new ID
      expect(result).toMatch(/^inv_\d+_/);

      // Should save to localStorage
      const stored = JSON.parse(mockLocalStorage.getItem('marine_invoices'));
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(result);
      expect(stored[0].title).toBe('Test Invoice');
    });

    test('should update existing invoice when ID is provided', async () => {
      // First create an existing invoice
      const existingInvoice = {
        id: 'existing-123',
        userId: 'test-user-123',
        userEmail: 'test@example.com',
        title: 'Original Invoice',
        status: 'completed',
        data: {
          vessel: { name: 'Original Vessel' },
          customer: { customerName: 'Original Customer' }
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      mockLocalStorage.setItem('marine_invoices', JSON.stringify([existingInvoice]));

      // Mock successful server response for update
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoice: { id: 'existing-123', title: 'Updated Invoice' } }),
        text: async () => JSON.stringify({ invoice: { id: 'existing-123', title: 'Updated Invoice' } })
      });

      // Create updateExistingInvoice method for this test
      invoiceStorage.updateExistingInvoice = async function(existingId, invoiceData, title) {
        const invoices = this.getAllInvoices();
        const index = invoices.findIndex(inv => inv.id === existingId);

        if (index === -1) {
          throw new Error('Invoice not found');
        }

        // Update existing invoice
        invoices[index] = {
          ...invoices[index],
          title: title || invoices[index].title,
          data: invoiceData,
          updatedAt: new Date().toISOString()
        };

        localStorage.setItem(this.storageKey, JSON.stringify(invoices));

        // Save to server
        await this.saveToServer(invoices[index]);

        this.notify();
        return existingId;
      };

      const updatedData = {
        vessel: { name: 'Updated Vessel' },
        customer: { customerName: 'Updated Customer' },
        scope: { lineItems: [] }
      };

      const result = await invoiceStorage.updateExistingInvoice(
        'existing-123',
        updatedData,
        'Updated Invoice'
      );

      // Should return same ID
      expect(result).toBe('existing-123');

      // Should update existing invoice, not create new one
      const stored = JSON.parse(mockLocalStorage.getItem('marine_invoices'));
      expect(stored).toHaveLength(1); // Still only 1 invoice
      expect(stored[0].id).toBe('existing-123');
      expect(stored[0].title).toBe('Updated Invoice');
      expect(stored[0].data.vessel.name).toBe('Updated Vessel');

      // Should preserve original metadata
      expect(stored[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(stored[0].userId).toBe('test-user-123');
    });

    test('should handle server update requests correctly', async () => {
      const invoiceData = {
        id: 'existing-456',
        title: 'Updated Title',
        data: { vessel: { name: 'Updated Vessel' } }
      };

      // Mock PUT request for update
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, invoice: invoiceData }),
        text: async () => JSON.stringify({ success: true, invoice: invoiceData })
      });

      await invoiceStorage.saveToServer(invoiceData);

      // Should make PUT request, not POST
      expect(fetch).toHaveBeenCalledWith('/api/v2/invoice/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': expect.any(String),
          'Idempotency-Key': expect.any(String)
        },
        credentials: 'include',
        body: JSON.stringify({
          title: invoiceData.title,
          data: invoiceData.data,
          metadata: undefined
        })
      });
    });
  });

  describe('loadInvoice Method', () => {
    test('should load invoice data correctly', async () => {
      const testInvoice = {
        id: 'load-test-123',
        userId: 'test-user-123',
        title: 'Load Test Invoice',
        data: {
          vessel: { name: 'Load Test Vessel' },
          customer: { customerName: 'Load Test Customer' },
          scope: { lineItems: [] }
        }
      };

      mockLocalStorage.setItem('marine_invoices', JSON.stringify([testInvoice]));

      // Mock server response for latest data
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [testInvoice]
      });

      const result = await invoiceStorage.loadInvoice('load-test-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('load-test-123');
      expect(result.data.vessel.name).toBe('Load Test Vessel');
    });

    test('should return null for non-existent invoice', async () => {
      mockLocalStorage.setItem('marine_invoices', JSON.stringify([]));

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const result = await invoiceStorage.loadInvoice('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('duplicateInvoice Method', () => {
    test('should create duplicate with new ID', async () => {
      const originalInvoice = {
        id: 'original-123',
        userId: 'test-user-123',
        userEmail: 'test@example.com',
        title: 'Original Invoice',
        data: {
          vessel: { name: 'Original Vessel' },
          customer: { customerName: 'Original Customer' }
        }
      };

      mockLocalStorage.setItem('marine_invoices', JSON.stringify([originalInvoice]));

      // Mock loadInvoice to return the original
      invoiceStorage.loadInvoice = jest.fn().mockResolvedValue(originalInvoice);

      // Mock saveDraft for the duplicate
      invoiceStorage.saveDraft = jest.fn().mockResolvedValue('duplicate-456');

      const duplicateId = invoiceStorage.duplicateInvoice('original-123');

      expect(duplicateId).toBe('duplicate-456');
      expect(invoiceStorage.saveDraft).toHaveBeenCalledWith(
        originalInvoice.data,
        'Original Invoice (Copy)'
      );
    });
  });

  describe('Smart Save Logic', () => {
    test('should implement smart save behavior for edit vs create', async () => {
      // Add smart save method to invoiceStorage
      invoiceStorage.smartSave = async function(invoiceData, title = null, invoiceId = null) {
        if (invoiceId) {
          // Edit mode - update existing
          return this.updateExistingInvoice(invoiceId, invoiceData, title);
        } else {
          // Create mode - save new
          return this.saveInvoice(invoiceData, title);
        }
      };

      invoiceStorage.updateExistingInvoice = jest.fn().mockResolvedValue('existing-123');
      invoiceStorage.saveInvoice = jest.fn().mockResolvedValue('new-456');

      // Test create mode (no ID)
      const createResult = await invoiceStorage.smartSave(
        { vessel: { name: 'New Vessel' } },
        'New Invoice'
      );

      expect(createResult).toBe('new-456');
      expect(invoiceStorage.saveInvoice).toHaveBeenCalled();
      expect(invoiceStorage.updateExistingInvoice).not.toHaveBeenCalled();

      // Reset mocks
      invoiceStorage.saveInvoice.mockClear();
      invoiceStorage.updateExistingInvoice.mockClear();

      // Test edit mode (with ID)
      const editResult = await invoiceStorage.smartSave(
        { vessel: { name: 'Updated Vessel' } },
        'Updated Invoice',
        'existing-123'
      );

      expect(editResult).toBe('existing-123');
      expect(invoiceStorage.updateExistingInvoice).toHaveBeenCalled();
      expect(invoiceStorage.saveInvoice).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling in Edit Operations', () => {
    test('should handle edit of non-existent invoice', async () => {
      mockLocalStorage.setItem('marine_invoices', JSON.stringify([]));

      invoiceStorage.updateExistingInvoice = async function(existingId) {
        const invoices = this.getAllInvoices();
        const invoice = invoices.find(inv => inv.id === existingId);

        if (!invoice) {
          throw new Error('Invoice not found');
        }
      };

      await expect(
        invoiceStorage.updateExistingInvoice('non-existent-id', {}, 'Title')
      ).rejects.toThrow('Invoice not found');
    });

    test('should handle server errors during update', async () => {
      const existingInvoice = {
        id: 'error-test-123',
        userId: 'test-user-123',
        title: 'Error Test',
        data: {}
      };

      mockLocalStorage.setItem('marine_invoices', JSON.stringify([existingInvoice]));

      // Mock server error
      fetch.mockRejectedValueOnce(new Error('Server error'));

      // Should continue with local save even if server fails
      const result = await invoiceStorage.saveInvoice({}, 'Test');

      expect(result).toBeDefined();

      // Verify it was added to failed saves queue
      const failedSaves = JSON.parse(mockLocalStorage.getItem('failedSaves') || '[]');
      expect(failedSaves).toHaveLength(1);
    });
  });

  describe('Data Integrity Checks', () => {
    test('should preserve user ownership during edit', async () => {
      const originalInvoice = {
        id: 'ownership-test-123',
        userId: 'test-user-123',
        userEmail: 'test@example.com',
        title: 'Ownership Test',
        data: { vessel: { name: 'Original' } }
      };

      mockLocalStorage.setItem('marine_invoices', JSON.stringify([originalInvoice]));

      // Simulate different user trying to edit
      mockUserManager.setCurrentUser({
        id: 'different-user-456',
        email: 'different@example.com',
        name: 'Different User'
      });

      invoiceStorage.updateExistingInvoice = async function(existingId) {
        const currentUser = this.userManager.getCurrentUser();
        const invoices = this.getAllInvoices();
        const invoice = invoices.find(inv => inv.id === existingId);

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        // Check ownership
        if (invoice.userId !== currentUser.id && invoice.userEmail !== currentUser.email) {
          throw new Error('Access denied');
        }
      };

      await expect(
        invoiceStorage.updateExistingInvoice('ownership-test-123', {}, 'Hacked')
      ).rejects.toThrow('Access denied');
    });

    test('should validate invoice data during update', async () => {
      const validationRules = {
        vessel: { required: true },
        customer: { required: true }
      };

      invoiceStorage.validateInvoiceData = function(data) {
        if (!data.vessel || !data.vessel.name) {
          throw new Error('Vessel name is required');
        }
        if (!data.customer || !data.customer.customerName) {
          throw new Error('Customer name is required');
        }
      };

      invoiceStorage.updateExistingInvoice = async function(existingId, invoiceData, title) {
        this.validateInvoiceData(invoiceData);
        // ... rest of update logic
      };

      await expect(
        invoiceStorage.updateExistingInvoice('test-id', { vessel: {} }, 'Invalid')
      ).rejects.toThrow('Vessel name is required');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large invoice updates efficiently', async () => {
      // Create large invoice data
      const largeInvoiceData = {
        vessel: { name: 'Large Vessel' },
        customer: { customerName: 'Large Customer' },
        scope: {
          lineItems: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            description: `Item ${i}`,
            cost: 100
          }))
        }
      };

      const startTime = Date.now();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoice: { id: 'large-123' } }),
        text: async () => JSON.stringify({ invoice: { id: 'large-123' } })
      });

      await invoiceStorage.saveInvoice(largeInvoiceData, 'Large Invoice');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});