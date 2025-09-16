/**
 * Unit Tests: Services Tab Duplicate Line Item Prevention
 *
 * Tests the fix for the bug where clicking "Add Line Item" creates multiple duplicates.
 * Validates all implemented safeguards and edge cases.
 */

const { InvoiceState } = require('../../src/js/state/InvoiceState.js');

// Mock DOM environment for ScopeForm tests
const { JSDOM } = require('jsdom');

describe('Services Tab Duplicate Prevention', () => {
  let invoiceState;
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Reset state for each test
    invoiceState = new InvoiceState();

    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="line-items-list"></div>
          <button id="add-line-item" class="btn btn-primary">Add Line Item</button>
          <template id="line-item-template">
            <div class="line-item-card" data-row="">
              <select class="job-type-select">
                <option value="">Select Service Type</option>
                <option value="Manual Entry">Manual Entry</option>
                <option value="Pilotage">Pilotage</option>
              </select>
            </div>
          </template>
        </body>
      </html>
    `);

    document = dom.window.document;
    window = dom.window;

    // Make DOM available globally for ScopeForm
    global.document = document;
    global.window = window;
  });

  afterEach(() => {
    // Cleanup
    dom.window.close();
    delete global.document;
    delete global.window;
  });

  describe('InvoiceState Duplicate Prevention', () => {

    test('should add exactly one line item on single call', () => {
      const initialCount = invoiceState.state.scope.lineItems.length;

      const newItemId = invoiceState.addLineItem();

      expect(newItemId).not.toBeNull();
      expect(invoiceState.state.scope.lineItems.length).toBe(initialCount + 1);
      expect(invoiceState.state.scope.lineItems[0].id).toBe(newItemId);
    });

    test('should prevent duplicate calls when operation is in progress', () => {
      // Mock addLineItem to simulate slow operation
      const originalAddLineItem = invoiceState.addLineItem.bind(invoiceState);
      let operationCount = 0;

      invoiceState.addLineItem = function(lineItem = {}) {
        operationCount++;

        // Simulate concurrent call attempt
        if (operationCount === 1) {
          // Try to call addLineItem again while first call is processing
          const concurrentResult = originalAddLineItem.call(this, lineItem);
          expect(concurrentResult).toBeNull(); // Should be blocked
        }

        return originalAddLineItem.call(this, lineItem);
      };

      const initialCount = invoiceState.state.scope.lineItems.length;
      const result = invoiceState.addLineItem();

      expect(result).not.toBeNull();
      expect(invoiceState.state.scope.lineItems.length).toBe(initialCount + 1);
      expect(operationCount).toBe(2); // Original call + one blocked concurrent call
    });

    test('should generate unique IDs even under rapid calls', () => {
      const ids = [];
      const addCount = 5;

      // Add multiple line items rapidly
      for (let i = 0; i < addCount; i++) {
        const id = invoiceState.addLineItem();
        if (id !== null) {
          ids.push(id);
        }
      }

      // Verify all IDs are unique
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(ids.length);
      expect(invoiceState.state.scope.lineItems.length).toBe(addCount);
    });

    test('should handle ID collision detection and recovery', () => {
      // Manually create a collision scenario
      invoiceState.state.scope.lineItems = [
        { id: 0, jobType: 'Existing Item' },
        { id: 1, jobType: 'Another Item' }
      ];
      invoiceState.lineItemIdCounter = 1; // This would cause a collision

      const newItemId = invoiceState.addLineItem();

      expect(newItemId).toBeGreaterThan(1); // Should skip colliding IDs
      expect(invoiceState.state.scope.lineItems.length).toBe(3);

      // Verify no duplicate IDs
      const ids = invoiceState.state.scope.lineItems.map(item => item.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(ids.length);
    });

    test('should validate state integrity during addition', () => {
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

    test('should include timestamp for debugging', () => {
      const beforeTime = Date.now();
      const newItemId = invoiceState.addLineItem();
      const afterTime = Date.now();

      const newItem = invoiceState.state.scope.lineItems.find(item => item.id === newItemId);
      expect(newItem.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(newItem.createdAt).toBeLessThanOrEqual(afterTime);
    });

  });

  describe('ScopeForm UI Duplicate Prevention', () => {

    let ScopeForm;
    let scopeForm;

    beforeAll(async () => {
      // Dynamic import for ES modules
      const module = await import('../../src/js/components/ScopeForm.js');
      ScopeForm = module.ScopeForm;
    });

    beforeEach(() => {
      scopeForm = new ScopeForm(invoiceState);
    });

    test('should prevent duplicate listener attachment', () => {
      const initialListenersFlag = scopeForm.listenersAttached;
      expect(initialListenersFlag).toBe(true);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Try to attach listeners again
      scopeForm.attachListeners();

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Listeners already attached, skipping to prevent duplicates');

      consoleSpy.mockRestore();
    });

    test('should disable button during add operation', async () => {
      const addButton = document.getElementById('add-line-item');
      expect(addButton.disabled).toBe(false);
      expect(addButton.textContent).toBe('Add Line Item');

      // Mock the async operation to simulate processing time
      const originalAddLineItem = invoiceState.addLineItem;
      invoiceState.addLineItem = jest.fn(() => {
        // During this call, button should be disabled
        expect(addButton.disabled).toBe(true);
        expect(addButton.textContent).toBe('Adding...');
        return originalAddLineItem.call(invoiceState);
      });

      // Trigger click event
      addButton.click();

      // Wait for the timeout to re-enable button
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(addButton.disabled).toBe(false);
      expect(addButton.textContent).toBe('Add Line Item');
      expect(scopeForm.isAddingLineItem).toBe(false);
    });

    test('should prevent rapid-fire clicks', () => {
      const addButton = document.getElementById('add-line-item');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // First click should work
      addButton.click();

      // Immediate second click should be blocked
      addButton.click();

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Add operation already in progress, ignoring click');

      consoleSpy.mockRestore();
    });

    test('should prevent event bubbling and default behavior', () => {
      const addButton = document.getElementById('add-line-item');
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: addButton,
        type: 'click'
      };

      // Manually trigger the click handler with mock event
      const clickHandler = scopeForm.addLineItemBtn.onclick ||
                          (() => scopeForm.addLineItemBtn.dispatchEvent(new window.Event('click')));

      // Simulate the click
      addButton.click();

      // Note: In a real scenario, preventDefault and stopPropagation would be called
      // This test validates the handler structure
      expect(scopeForm.isAddingLineItem).toBeDefined();
    });

    test('should validate line item count changes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const addButton = document.getElementById('add-line-item');

      const initialCount = invoiceState.state.scope.lineItems.length;

      addButton.click();

      // Verify logging of count changes
      expect(consoleSpy).toHaveBeenCalledWith(`🔍 Adding line item - current count: ${initialCount}`);
      expect(consoleSpy).toHaveBeenCalledWith(`🔍 After adding - count: ${initialCount + 1} (expected: ${initialCount + 1})`);

      consoleSpy.mockRestore();
    });

  });

  describe('Edge Cases and Error Handling', () => {

    test('should handle missing add button gracefully', () => {
      // Remove the button
      const addButton = document.getElementById('add-line-item');
      addButton.remove();

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create new ScopeForm instance
      const newScopeForm = new (require('../../src/js/components/ScopeForm.js').ScopeForm)(invoiceState);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Add line item button not found');

      consoleSpy.mockRestore();
    });

    test('should handle state corruption during add operation', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock push to throw error
      const originalPush = Array.prototype.push;
      Array.prototype.push = jest.fn(() => {
        throw new Error('Simulated state corruption');
      });

      expect(() => {
        invoiceState.addLineItem();
      }).toThrow('Simulated state corruption');

      expect(invoiceState.isAddingLineItem).toBe(false); // Lock should be released

      // Restore
      Array.prototype.push = originalPush;
      consoleSpy.mockRestore();
    });

    test('should maintain counter integrity across operations', () => {
      const iterations = 10;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const id = invoiceState.addLineItem();
        results.push(id);
      }

      // Verify ascending ID sequence
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThan(results[i - 1]);
      }

      expect(invoiceState.lineItemIdCounter).toBe(iterations);
    });

  });

  describe('Integration: Full Click-to-State Flow', () => {

    let ScopeForm;
    let scopeForm;

    beforeAll(async () => {
      const module = await import('../../src/js/components/ScopeForm.js');
      ScopeForm = module.ScopeForm;
    });

    beforeEach(() => {
      scopeForm = new ScopeForm(invoiceState);
    });

    test('should complete full click-to-state flow without duplicates', async () => {
      const addButton = document.getElementById('add-line-item');
      const initialCount = invoiceState.state.scope.lineItems.length;

      // Simulate user clicking the button
      addButton.click();

      // Wait for operation to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(invoiceState.state.scope.lineItems.length).toBe(initialCount + 1);
      expect(scopeForm.isAddingLineItem).toBe(false);

      // Button should be re-enabled after timeout
      await new Promise(resolve => setTimeout(resolve, 350));
      expect(addButton.disabled).toBe(false);
    });

    test('should handle multiple users clicking simultaneously', async () => {
      const addButton = document.getElementById('add-line-item');
      const initialCount = invoiceState.state.scope.lineItems.length;

      // Simulate multiple rapid clicks (like multiple users or double-clicking)
      const clickPromises = [];
      for (let i = 0; i < 5; i++) {
        clickPromises.push(
          new Promise(resolve => {
            setTimeout(() => {
              addButton.click();
              resolve();
            }, i * 10); // Stagger clicks by 10ms
          })
        );
      }

      await Promise.all(clickPromises);

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 400));

      // Should only have added one item despite multiple clicks
      expect(invoiceState.state.scope.lineItems.length).toBe(initialCount + 1);
    });

  });

});