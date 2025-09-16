/**
 * Unit Tests for Invoice Save Logic Components
 *
 * Tests the core save/update logic in isolation to prevent regression
 */

const { InvoiceState } = require('../../src/js/state/InvoiceState.js');
const { InvoiceStorage } = require('../../src/js/storage/InvoiceStorage.js');

// Mock UserManager
const mockUserManager = {
  getCurrentUser: () => ({
    id: 'test-user-123',
    email: 'test@example.com'
  }),
  subscribe: jest.fn()
};

describe('InvoiceState Edit Mode Logic', () => {
  let invoiceState;

  beforeEach(() => {
    invoiceState = new InvoiceState();
  });

  test('should start in create mode by default', () => {
    expect(invoiceState.getIsEditMode()).toBe(false);
    expect(invoiceState.getCurrentInvoiceId()).toBeNull();
  });

  test('should enter edit mode when loading existing invoice', () => {
    const mockInvoiceData = {
      vessel: { name: 'Test Vessel' },
      customer: { customerName: 'Test Customer' },
      scope: { lineItems: [] },
      notes: { comments: [] }
    };

    invoiceState.loadInvoiceForEditing(mockInvoiceData, 'invoice-123');

    expect(invoiceState.getIsEditMode()).toBe(true);
    expect(invoiceState.getCurrentInvoiceId()).toBe('invoice-123');
  });

  test('should maintain edit mode state correctly', () => {
    // Enter edit mode
    invoiceState.setCurrentInvoiceId('invoice-456');
    expect(invoiceState.getIsEditMode()).toBe(true);

    // Clear edit mode
    invoiceState.clearEditMode();
    expect(invoiceState.getIsEditMode()).toBe(false);
    expect(invoiceState.getCurrentInvoiceId()).toBeNull();
  });

  test('should reset to create mode when invoice is reset', () => {
    // Set up edit mode
    invoiceState.setCurrentInvoiceId('invoice-789');
    expect(invoiceState.getIsEditMode()).toBe(true);

    // Reset state
    invoiceState.reset();

    expect(invoiceState.getIsEditMode()).toBe(false);
    expect(invoiceState.getCurrentInvoiceId()).toBeNull();
  });

  test('should preserve line item counter during edit mode', () => {
    const mockInvoiceData = {
      vessel: { name: 'Test Vessel' },
      customer: { customerName: 'Test Customer' },
      scope: {
        lineItems: [
          { id: 5, description: 'Item 1' },
          { id: 10, description: 'Item 2' }
        ]
      },
      notes: { comments: [] }
    };

    invoiceState.loadInvoiceForEditing(mockInvoiceData, 'invoice-123');

    // Next line item should have ID 11 (max existing ID + 1)
    const newItemId = invoiceState.addLineItem({ description: 'New Item' });
    expect(newItemId).toBe(11);
  });
});

describe('InvoiceStorage Save vs Update Logic', () => {
  let invoiceStorage;

  beforeEach(() => {
    // Clear localStorage
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };

    // Mock fetch
    global.fetch = jest.fn();

    invoiceStorage = new InvoiceStorage(mockUserManager);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('saveInvoice creates new invoice with new ID', async () => {
    const mockInvoiceData = {
      vessel: { name: 'New Vessel' },
      customer: { customerName: 'New Customer' },
      scope: { lineItems: [] }
    };

    // Mock successful server response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        invoice: { id: 'server-123' }
      }))
    });

    // Mock localStorage getItem to return empty array
    global.localStorage.getItem.mockReturnValue('[]');

    const invoiceId = await invoiceStorage.saveInvoice(mockInvoiceData, 'New Invoice');

    expect(invoiceId).toMatch(/^inv_\d+_/); // Matches generated ID pattern
    expect(global.localStorage.setItem).toHaveBeenCalled();

    // Should call server create endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v2/invoice/save',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  test('updateExistingInvoice modifies existing invoice in-place', async () => {
    const existingInvoice = {
      id: 'existing-123',
      userId: 'test-user-123',
      userEmail: 'test@example.com',
      title: 'Original Title',
      data: {
        vessel: { name: 'Original Vessel' },
        customer: { customerName: 'Original Customer' }
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };

    // Mock localStorage to return existing invoice
    global.localStorage.getItem.mockReturnValue(JSON.stringify([existingInvoice]));

    // Mock successful server response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invoice: { id: 'existing-123' } })
    });

    const updatedData = {
      vessel: { name: 'Updated Vessel' },
      customer: { customerName: 'Updated Customer' },
      scope: { lineItems: [] }
    };

    const resultId = await invoiceStorage.updateExistingInvoice(
      'existing-123',
      updatedData,
      'Updated Title'
    );

    // Should return the same ID (not create new one)
    expect(resultId).toBe('existing-123');

    // Should call smart-save endpoint for updates
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v3/invoices/smart-save',
      expect.objectContaining({
        method: 'POST'
      })
    );

    // Should update localStorage with modified invoice
    const saveCall = global.localStorage.setItem.mock.calls.find(
      call => call[0] === 'marine_invoices'
    );
    expect(saveCall).toBeTruthy();

    const savedInvoices = JSON.parse(saveCall[1]);
    expect(savedInvoices).toHaveLength(1);
    expect(savedInvoices[0].id).toBe('existing-123');
    expect(savedInvoices[0].title).toBe('Updated Title');
    expect(savedInvoices[0].data.vessel.name).toBe('Updated Vessel');
  });

  test('updateExistingInvoice throws error for non-existent invoice', async () => {
    // Mock localStorage to return empty array
    global.localStorage.getItem.mockReturnValue('[]');

    const updatedData = {
      vessel: { name: 'Updated Vessel' }
    };

    await expect(
      invoiceStorage.updateExistingInvoice('non-existent-123', updatedData)
    ).rejects.toThrow('Invoice not found');
  });

  test('updateExistingInvoice validates ownership', async () => {
    const existingInvoice = {
      id: 'existing-123',
      userId: 'different-user', // Different user
      userEmail: 'different@example.com',
      title: 'Original Title',
      data: { vessel: { name: 'Original Vessel' } }
    };

    global.localStorage.getItem.mockReturnValue(JSON.stringify([existingInvoice]));

    const updatedData = {
      vessel: { name: 'Updated Vessel' }
    };

    await expect(
      invoiceStorage.updateExistingInvoice('existing-123', updatedData)
    ).rejects.toThrow('Access denied');
  });

  test('saves preserve timestamps correctly', async () => {
    const existingInvoice = {
      id: 'existing-123',
      userId: 'test-user-123',
      userEmail: 'test@example.com',
      title: 'Original Title',
      data: { vessel: { name: 'Original Vessel' } },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      serverId: 'server-123'
    };

    global.localStorage.getItem.mockReturnValue(JSON.stringify([existingInvoice]));
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invoice: { id: 'server-123' } })
    });

    const updatedData = { vessel: { name: 'Updated Vessel' } };

    await invoiceStorage.updateExistingInvoice('existing-123', updatedData, 'Updated Title');

    const saveCall = global.localStorage.setItem.mock.calls.find(
      call => call[0] === 'marine_invoices'
    );
    const savedInvoice = JSON.parse(saveCall[1])[0];

    // createdAt should be preserved
    expect(savedInvoice.createdAt).toBe('2023-01-01T00:00:00.000Z');

    // updatedAt should be updated
    expect(savedInvoice.updatedAt).not.toBe('2023-01-01T00:00:00.000Z');
    expect(new Date(savedInvoice.updatedAt)).toBeInstanceOf(Date);

    // serverId should be preserved
    expect(savedInvoice.serverId).toBe('server-123');

    // id should remain the same
    expect(savedInvoice.id).toBe('existing-123');
  });
});

describe('Save Logic Integration', () => {
  let invoiceState;
  let invoiceStorage;

  beforeEach(() => {
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };

    global.fetch = jest.fn();

    invoiceState = new InvoiceState();
    invoiceStorage = new InvoiceStorage(mockUserManager);
  });

  test('create-then-edit workflow preserves invoice ID', async () => {
    const mockInvoiceData = {
      vessel: { name: 'Test Vessel' },
      customer: { customerName: 'Test Customer' },
      scope: { lineItems: [] }
    };

    // Mock successful server response for create
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        invoice: { id: 'server-123' }
      }))
    });

    global.localStorage.getItem.mockReturnValue('[]');

    // Step 1: Create new invoice
    const newInvoiceId = await invoiceStorage.saveInvoice(mockInvoiceData, 'Test Invoice');

    // Step 2: Enter edit mode
    invoiceState.setCurrentInvoiceId(newInvoiceId);

    // Verify state
    expect(invoiceState.getIsEditMode()).toBe(true);
    expect(invoiceState.getCurrentInvoiceId()).toBe(newInvoiceId);

    // Step 3: Mock existing invoice in localStorage for update
    const createdInvoice = {
      id: newInvoiceId,
      userId: 'test-user-123',
      userEmail: 'test@example.com',
      title: 'Test Invoice',
      data: mockInvoiceData,
      serverId: 'server-123'
    };

    global.localStorage.getItem.mockReturnValue(JSON.stringify([createdInvoice]));

    // Mock successful server response for update
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invoice: { id: 'server-123' } })
    });

    // Step 4: Update the invoice
    const modifiedData = {
      ...mockInvoiceData,
      vessel: { name: 'Modified Vessel' }
    };

    const updatedId = await invoiceStorage.updateExistingInvoice(
      newInvoiceId,
      modifiedData,
      'Modified Test Invoice'
    );

    // Should return same ID
    expect(updatedId).toBe(newInvoiceId);

    // Verify update endpoint was called
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/v3/invoices/smart-save',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  test('edit mode decision logic in app save handler', () => {
    // Simulate app.js save handler logic
    const mockCurrentState = {
      vessel: { name: 'Current Vessel' },
      customer: { customerName: 'Current Customer' }
    };

    // Test case 1: Not in edit mode - should create
    invoiceState.clearEditMode();

    const currentInvoiceId1 = invoiceState.getCurrentInvoiceId();
    const isEditMode1 = invoiceState.getIsEditMode();

    expect(isEditMode1).toBe(false);
    expect(currentInvoiceId1).toBeNull();

    // App would call: invoiceStorage.saveInvoice()

    // Test case 2: In edit mode - should update
    invoiceState.setCurrentInvoiceId('existing-invoice-456');

    const currentInvoiceId2 = invoiceState.getCurrentInvoiceId();
    const isEditMode2 = invoiceState.getIsEditMode();

    expect(isEditMode2).toBe(true);
    expect(currentInvoiceId2).toBe('existing-invoice-456');

    // App would call: invoiceStorage.updateExistingInvoice(currentInvoiceId2, ...)
  });
});