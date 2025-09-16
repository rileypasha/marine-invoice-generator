/**
 * Unit Tests: InvoiceState Duplicate Line Item Prevention
 *
 * Tests the core state management fixes for preventing duplicate line items.
 * Focused on the InvoiceState class logic without DOM dependencies.
 */

describe('InvoiceState Duplicate Prevention', () => {
  let InvoiceState;
  let invoiceState;

  beforeAll(() => {
    // Mock browser APIs for Node.js environment
    global.requestAnimationFrame = jest.fn((callback) => {
      setTimeout(callback, 0);
      return 1;
    });

    global.cancelAnimationFrame = jest.fn();

    // Mock the dependencies
    global.TaxCalculator = {
      getDefaultTaxConfig: jest.fn(() => ({ taxStatus: 'taxable', taxRate: 0.0875 })),
      calculateLineTax: jest.fn(() => 0)
    };

    global.TaxValidator = {
      validateTaxRate: jest.fn(() => true),
      validateTaxStatus: jest.fn(() => true)
    };

    global.MarkupValidator = {
      validateCustomMarkup: jest.fn(() => ({ isValid: true, sanitizedValue: 2.5 }))
    };

    // Import the class
    const stateModule = require('../../src/js/state/InvoiceState.js');
    InvoiceState = stateModule.InvoiceState;
  });

  beforeEach(() => {
    invoiceState = new InvoiceState();
  });

  describe('Basic Line Item Addition', () => {

    test('should add exactly one line item on single call', () => {
      const initialCount = invoiceState.state.scope.lineItems.length;

      const newItemId = invoiceState.addLineItem();

      expect(newItemId).not.toBeNull();
      expect(typeof newItemId).toBe('number');
      expect(invoiceState.state.scope.lineItems.length).toBe(initialCount + 1);

      const addedItem = invoiceState.state.scope.lineItems.find(item => item.id === newItemId);
      expect(addedItem).toBeDefined();
      expect(addedItem.id).toBe(newItemId);
    });

    test('should generate unique incremental IDs', () => {
      const ids = [];
      const addCount = 5;

      for (let i = 0; i < addCount; i++) {
        const id = invoiceState.addLineItem();
        ids.push(id);
      }

      // All IDs should be unique
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(addCount);

      // IDs should be incremental
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBe(ids[i - 1] + 1);
      }

      expect(invoiceState.state.scope.lineItems.length).toBe(addCount);
    });

    test('should include timestamp for debugging', () => {
      const beforeTime = Date.now();
      const newItemId = invoiceState.addLineItem();
      const afterTime = Date.now();

      const newItem = invoiceState.state.scope.lineItems.find(item => item.id === newItemId);
      expect(newItem.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(newItem.createdAt).toBeLessThanOrEqual(afterTime);
    });

  });

  describe('Concurrent Operation Protection', () => {

    test('should prevent concurrent addLineItem calls', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Simulate concurrent call by manually setting the lock
      invoiceState.isAddingLineItem = true;

      const result = invoiceState.addLineItem();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ addLineItem operation already in progress, ignoring duplicate call');

      consoleSpy.mockRestore();
    });

    test('should release lock after operation completes', () => {
      expect(invoiceState.isAddingLineItem).toBe(false);

      const newItemId = invoiceState.addLineItem();

      expect(newItemId).not.toBeNull();
      expect(invoiceState.isAddingLineItem).toBe(false); // Lock should be released
    });

    test('should release lock even when operation throws error', () => {
      const originalPush = Array.prototype.push;
      Array.prototype.push = jest.fn(() => {
        throw new Error('Simulated error');
      });

      expect(() => {
        invoiceState.addLineItem();
      }).toThrow('Simulated error');

      expect(invoiceState.isAddingLineItem).toBe(false); // Lock should be released

      // Restore
      Array.prototype.push = originalPush;
    });

  });

  describe('State Integrity Protection', () => {

    test('should detect and handle state corruption', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Corrupt the lineItems array
      invoiceState.state.scope.lineItems = null;

      const newItemId = invoiceState.addLineItem();

      expect(newItemId).not.toBeNull();
      expect(Array.isArray(invoiceState.state.scope.lineItems)).toBe(true);
      expect(invoiceState.state.scope.lineItems.length).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ LineItems array corrupted, reinitializing');

      consoleSpy.mockRestore();
    });

    test('should validate count changes during addition', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock push to not actually add items (simulate corruption)
      const originalPush = Array.prototype.push;
      Array.prototype.push = jest.fn(() => {
        // Don't actually add anything
        return 0;
      });

      expect(() => {
        invoiceState.addLineItem();
      }).toThrow('Line item addition failed: state corruption');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('State corruption detected'));

      // Restore
      Array.prototype.push = originalPush;
      consoleSpy.mockRestore();
    });

    test('should handle ID collisions gracefully', () => {
      // Setup existing items with specific IDs
      invoiceState.state.scope.lineItems = [
        { id: 0, jobType: 'Existing Item 1' },
        { id: 1, jobType: 'Existing Item 2' },
        { id: 2, jobType: 'Existing Item 3' }
      ];

      // Set counter to cause collision
      invoiceState.lineItemIdCounter = 1;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const newItemId = invoiceState.addLineItem();

      expect(newItemId).toBeGreaterThan(2); // Should skip existing IDs
      expect(invoiceState.state.scope.lineItems.length).toBe(4);

      // Verify no duplicate IDs
      const ids = invoiceState.state.scope.lineItems.map(item => item.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(ids.length);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ID collision detected'));

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

  });

  describe('Edge Cases and Robustness', () => {

    test('should handle rapid sequential calls correctly', () => {
      const results = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const id = invoiceState.addLineItem();
        results.push(id);
      }

      // All calls should succeed
      expect(results.filter(id => id !== null)).toHaveLength(iterations);

      // All IDs should be unique
      const uniqueIds = [...new Set(results)];
      expect(uniqueIds.length).toBe(iterations);

      // State should be consistent
      expect(invoiceState.state.scope.lineItems.length).toBe(iterations);
      expect(invoiceState.lineItemIdCounter).toBe(iterations);
    });

    test('should maintain counter integrity across operations', () => {
      const initialCounter = invoiceState.lineItemIdCounter;

      // Add some items
      invoiceState.addLineItem();
      invoiceState.addLineItem();
      invoiceState.addLineItem();

      expect(invoiceState.lineItemIdCounter).toBe(initialCounter + 3);

      // Try to add an item that fails
      const originalNotify = invoiceState.notify;
      invoiceState.notify = jest.fn(() => {
        throw new Error('Notify error');
      });

      expect(() => {
        invoiceState.addLineItem();
      }).toThrow('Notify error');

      // Counter should still be incremented even if notify fails
      expect(invoiceState.lineItemIdCounter).toBe(initialCounter + 4);

      // Restore
      invoiceState.notify = originalNotify;
    });

    test('should validate item structure and defaults', () => {
      const newItemId = invoiceState.addLineItem();
      const newItem = invoiceState.state.scope.lineItems.find(item => item.id === newItemId);

      // Verify all required fields are present
      expect(newItem).toHaveProperty('id');
      expect(newItem).toHaveProperty('jobType');
      expect(newItem).toHaveProperty('itemType');
      expect(newItem).toHaveProperty('manualCost');
      expect(newItem).toHaveProperty('laborHours');
      expect(newItem).toHaveProperty('otHours');
      expect(newItem).toHaveProperty('description');
      expect(newItem).toHaveProperty('createdAt');

      // Verify default values
      expect(newItem.jobType).toBe('');
      expect(newItem.itemType).toBe('');
      expect(newItem.manualCost).toBe('');
      expect(newItem.description).toBe('');
    });

  });

  describe('Performance and Memory', () => {

    test('should not leak memory with failed operations', () => {
      const initialItemCount = invoiceState.state.scope.lineItems.length;

      // Simulate a failing operation
      const originalPush = Array.prototype.push;
      Array.prototype.push = jest.fn(() => {
        throw new Error('Memory test error');
      });

      try {
        invoiceState.addLineItem();
      } catch (error) {
        // Expected to throw
      }

      // State should be unchanged
      expect(invoiceState.state.scope.lineItems.length).toBe(initialItemCount);
      expect(invoiceState.isAddingLineItem).toBe(false);

      // Restore and verify normal operation still works
      Array.prototype.push = originalPush;

      const newItemId = invoiceState.addLineItem();
      expect(newItemId).not.toBeNull();
      expect(invoiceState.state.scope.lineItems.length).toBe(initialItemCount + 1);
    });

    test('should handle large number of items efficiently', () => {
      const largeCount = 1000;
      const startTime = Date.now();

      for (let i = 0; i < largeCount; i++) {
        invoiceState.addLineItem();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(invoiceState.state.scope.lineItems.length).toBe(largeCount);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify IDs are still unique
      const ids = invoiceState.state.scope.lineItems.map(item => item.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(largeCount);
    });

  });

});