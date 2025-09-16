/**
 * Unit tests for UnsavedChangesManager
 */

import { UnsavedChangesManager } from '../../src/js/utils/UnsavedChangesManager.js';

// Mock dependencies
const mockInvoiceState = {
  getState: jest.fn(),
  subscribe: jest.fn()
};

const mockInvoiceStorage = {
  // Mock storage methods as needed
};

describe('UnsavedChangesManager', () => {
  let unsavedChangesManager;
  let stateListener;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Capture the listener function passed to state.subscribe
    mockInvoiceState.subscribe.mockImplementation((listener) => {
      stateListener = listener;
      return () => {}; // Return unsubscribe function
    });

    // Create a fresh instance
    unsavedChangesManager = new UnsavedChangesManager(mockInvoiceState, mockInvoiceStorage);
  });

  afterEach(() => {
    if (unsavedChangesManager) {
      unsavedChangesManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct default state', () => {
      expect(unsavedChangesManager.hasUnsavedChanges).toBe(false);
      expect(unsavedChangesManager.lastSavedState).toBe(null);
      expect(unsavedChangesManager.currentChangeHash).toBe(null);
    });

    test('should subscribe to invoice state changes', () => {
      expect(mockInvoiceState.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should set up debouncing system', () => {
      expect(unsavedChangesManager.debounceDelay).toBe(300);
      expect(unsavedChangesManager.debounceTimer).toBe(null);
    });
  });

  describe('State Hashing', () => {
    test('should calculate consistent hash for same state', () => {
      const state = {
        vessel: { name: 'Test Vessel', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const hash1 = unsavedChangesManager.calculateStateHash(state);
      const hash2 = unsavedChangesManager.calculateStateHash(state);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    test('should calculate different hash for different states', () => {
      const state1 = {
        vessel: { name: 'Test Vessel 1', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const state2 = {
        vessel: { name: 'Test Vessel 2', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const hash1 = unsavedChangesManager.calculateStateHash(state1);
      const hash2 = unsavedChangesManager.calculateStateHash(state2);

      expect(hash1).not.toBe(hash2);
    });

    test('should handle malformed state gracefully', () => {
      const malformedState = null;
      const hash = unsavedChangesManager.calculateStateHash(malformedState);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('Change Detection', () => {
    test('should not detect changes when no saved state exists', () => {
      const state = {
        vessel: { name: 'Test Vessel', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      unsavedChangesManager.detectChanges(state);

      expect(unsavedChangesManager.hasUnsavedChanges).toBe(false);
    });

    test('should detect changes when state differs from saved state', () => {
      const savedState = {
        vessel: { name: 'Original Vessel', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const changedState = {
        vessel: { name: 'Modified Vessel', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      // Set saved state
      unsavedChangesManager.lastSavedState = savedState;

      // Detect changes
      unsavedChangesManager.detectChanges(changedState);

      expect(unsavedChangesManager.hasUnsavedChanges).toBe(true);
    });

    test('should not detect changes when state is identical to saved state', () => {
      const state = {
        vessel: { name: 'Test Vessel', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      // Set saved state
      unsavedChangesManager.lastSavedState = JSON.parse(JSON.stringify(state));

      // Detect changes
      unsavedChangesManager.detectChanges(state);

      expect(unsavedChangesManager.hasUnsavedChanges).toBe(false);
    });
  });

  describe('Debounced State Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should debounce state changes', () => {
      const state = {
        vessel: { name: 'Test Vessel', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const detectChangesSpy = jest.spyOn(unsavedChangesManager, 'detectChanges');

      // Trigger multiple state changes rapidly
      stateListener(state);
      stateListener(state);
      stateListener(state);

      // Changes should not be detected immediately
      expect(detectChangesSpy).not.toHaveBeenCalled();

      // Fast-forward time past debounce delay
      jest.advanceTimersByTime(300);

      // Changes should be detected only once after debounce
      expect(detectChangesSpy).toHaveBeenCalledTimes(1);
      expect(detectChangesSpy).toHaveBeenCalledWith(state);

      detectChangesSpy.mockRestore();
    });
  });

  describe('Changes Summary', () => {
    test('should return correct changes summary when no changes exist', () => {
      const summary = unsavedChangesManager.getChangesSummary();

      expect(summary.hasChanges).toBe(false);
      expect(summary.changes).toEqual([]);
    });

    test('should detect vessel changes', () => {
      const savedState = {
        vessel: { name: 'Original', weight: '100', beam: '20' },
        customer: { customerName: 'Test', customerEmail: 'test@example.com', customerPhone: '123' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const changedState = {
        vessel: { name: 'Modified', weight: '100', beam: '20' },
        customer: { customerName: 'Test', customerEmail: 'test@example.com', customerPhone: '123' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      unsavedChangesManager.lastSavedState = savedState;
      unsavedChangesManager.hasUnsavedChanges = true;

      const summary = unsavedChangesManager.getChangesSummary();

      expect(summary.hasChanges).toBe(true);
      expect(summary.changes).toContain('Vessel details');
    });

    test('should detect customer changes', () => {
      const savedState = {
        vessel: { name: 'Test', weight: '100', beam: '20' },
        customer: { customerName: 'Original', customerEmail: 'test@example.com', customerPhone: '123' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const changedState = {
        vessel: { name: 'Test', weight: '100', beam: '20' },
        customer: { customerName: 'Modified', customerEmail: 'test@example.com', customerPhone: '123' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      unsavedChangesManager.lastSavedState = savedState;
      unsavedChangesManager.hasUnsavedChanges = true;

      const summary = unsavedChangesManager.getChangesSummary();

      expect(summary.hasChanges).toBe(true);
      expect(summary.changes).toContain('Customer information');
    });

    test('should detect line item changes', () => {
      const savedState = {
        vessel: { name: 'Test', weight: '100', beam: '20' },
        customer: { customerName: 'Test', customerEmail: 'test@example.com', customerPhone: '123' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      const changedState = {
        vessel: { name: 'Test', weight: '100', beam: '20' },
        customer: { customerName: 'Test', customerEmail: 'test@example.com', customerPhone: '123' },
        scope: {
          markupRate: '2.5',
          isTaxable: false,
          lineItems: [{ id: 1, jobType: 'Manual Entry', manualCost: '100' }]
        },
        notes: { comments: [] }
      };

      unsavedChangesManager.lastSavedState = savedState;
      unsavedChangesManager.hasUnsavedChanges = true;

      const summary = unsavedChangesManager.getChangesSummary();

      expect(summary.hasChanges).toBe(true);
      expect(summary.changes).toContain('Service line items');
    });
  });

  describe('Listener Management', () => {
    test('should allow subscribing to changes', () => {
      const listener = jest.fn();
      const unsubscribe = unsavedChangesManager.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
      expect(listener).toHaveBeenCalledWith({
        hasUnsavedChanges: false,
        changesSummary: { hasChanges: false, changes: [] }
      });
    });

    test('should notify listeners of changes', () => {
      const listener = jest.fn();
      unsavedChangesManager.subscribe(listener);

      // Clear the initial call
      listener.mockClear();

      // Trigger notification
      unsavedChangesManager.hasUnsavedChanges = true;
      unsavedChangesManager.notifyListeners();

      expect(listener).toHaveBeenCalledWith({
        hasUnsavedChanges: true,
        changesSummary: expect.any(Object)
      });
    });

    test('should allow unsubscribing from changes', () => {
      const listener = jest.fn();
      const unsubscribe = unsavedChangesManager.subscribe(listener);

      // Clear the initial call
      listener.mockClear();

      // Unsubscribe
      unsubscribe();

      // Trigger notification
      unsavedChangesManager.notifyListeners();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Mark as Saved', () => {
    test('should mark current state as saved', () => {
      const state = {
        vessel: { name: 'Test Vessel', weight: '100', beam: '20' },
        customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
        scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
        notes: { comments: [] }
      };

      mockInvoiceState.getState.mockReturnValue(state);

      unsavedChangesManager.markAsSaved();

      expect(unsavedChangesManager.hasUnsavedChanges).toBe(false);
      expect(unsavedChangesManager.lastSavedState).toEqual(state);
      expect(unsavedChangesManager.currentChangeHash).toBeTruthy();
    });
  });

  describe('Session Persistence', () => {
    beforeEach(() => {
      // Mock sessionStorage
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn()
        },
        writable: true
      });
    });

    test('should persist unsaved state to session storage', () => {
      unsavedChangesManager.hasUnsavedChanges = true;
      unsavedChangesManager.currentChangeHash = 'test-hash';

      unsavedChangesManager.persistUnsavedState();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'marine_invoice_unsaved_changes',
        expect.stringContaining('true')
      );
    });

    test('should clear unsaved state from session storage', () => {
      unsavedChangesManager.clearUnsavedState();

      expect(sessionStorage.removeItem).toHaveBeenCalledWith('marine_invoice_unsaved_changes');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('marine_invoice_backup_state');
    });
  });

  describe('Cleanup', () => {
    test('should clean up resources properly', () => {
      const listener = jest.fn();
      unsavedChangesManager.subscribe(listener);

      unsavedChangesManager.cleanup();

      expect(unsavedChangesManager.listeners).toEqual([]);
      expect(unsavedChangesManager.hasUnsavedChanges).toBe(false);
      expect(unsavedChangesManager.lastSavedState).toBe(null);
    });
  });
});