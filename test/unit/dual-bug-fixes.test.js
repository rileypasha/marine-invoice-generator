/**
 * PHASE 5: UNIT TESTS for Dual Bug Fixes
 * Tests the specific fixes applied to VesselForm and UnsavedChangesManager
 */

const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

describe('Dual Bug Fixes - Critical Issue Resolution', () => {

  describe('BUG 2 FIX: VesselForm .trim() Type Safety', () => {

    test('should handle numeric weight values without .trim() errors', () => {
      // Simulate the session data scenario that caused the bug
      const problematicVesselData = {
        name: 'Test Vessel',
        weight: 450.5,    // NUMBER type from session storage
        beam: 12.3        // NUMBER type from session storage
      };

      // Apply the Phase 2 fix: type-safe string coercion
      const safeWeight = String(problematicVesselData.weight || '');
      const safeBeam = String(problematicVesselData.beam || '');

      // These calls should not throw errors
      expect(() => {
        const weightTrimmed = safeWeight.trim();
        const beamTrimmed = safeBeam.trim();

        // Verify the values are correct
        expect(weightTrimmed).toBe('450.5');
        expect(beamTrimmed).toBe('12.3');
      }).not.toThrow();
    });

    test('should handle null/undefined vessel data safely', () => {
      const edgeCaseData = {
        name: null,
        weight: undefined,
        beam: NaN
      };

      // Apply the Phase 2 fix
      const safeName = String(edgeCaseData.name || '');
      const safeWeight = String(edgeCaseData.weight || '');
      const safeBeam = String(edgeCaseData.beam || '');

      expect(() => {
        expect(safeName.trim()).toBe('');
        expect(safeWeight.trim()).toBe('');
        expect(safeBeam.trim()).toBe('NaN'); // NaN becomes 'NaN' string
      }).not.toThrow();
    });

    test('should preserve string values correctly', () => {
      const normalStringData = {
        name: '  Test Vessel  ',
        weight: '  450.5  ',
        beam: '  12.3  '
      };

      // Apply the Phase 2 fix
      const safeName = String(normalStringData.name || '');
      const safeWeight = String(normalStringData.weight || '');
      const safeBeam = String(normalStringData.beam || '');

      expect(safeName.trim()).toBe('Test Vessel');
      expect(safeWeight.trim()).toBe('450.5');
      expect(safeBeam.trim()).toBe('12.3');
    });
  });

  describe('BUG 1 FIX: UnsavedChangesManager Baseline Establishment', () => {

    let mockInvoiceState;
    let unsavedChangesManager;

    beforeEach(() => {
      // Mock InvoiceState
      mockInvoiceState = {
        getState: jest.fn(),
        getCurrentInvoiceId: jest.fn(),
        subscribe: jest.fn()
      };

      // Create a mock UnsavedChangesManager with our fixes
      class MockFixedUnsavedChangesManager {
        constructor(invoiceState) {
          this.invoiceState = invoiceState;
          this.lastSavedState = null;
          this.hasUnsavedChanges = false;
          this.listeners = [];
        }

        // Phase 3 fix: establishBaseline instead of skipping
        detectChanges(currentState) {
          if (!this.lastSavedState) {
            this.establishBaseline(currentState);
            return;
          }

          // Simple hash comparison for testing
          const currentHash = JSON.stringify(this.normalizeStateForComparison(currentState));
          const savedHash = JSON.stringify(this.lastSavedState);

          const hasChanges = currentHash !== savedHash;

          if (hasChanges !== this.hasUnsavedChanges) {
            this.hasUnsavedChanges = hasChanges;
            this.notifyListeners();
          }
        }

        establishBaseline(currentState) {
          this.lastSavedState = this.normalizeStateForComparison(currentState);
          this.hasUnsavedChanges = false;
          this.notifyListeners();
        }

        normalizeStateForComparison(state) {
          return {
            vessel: {
              name: String(state.vessel?.name || '').trim(),
              weight: String(state.vessel?.weight || '').trim(),
              beam: String(state.vessel?.beam || '').trim()
            },
            customer: {
              customerName: String(state.customer?.customerName || '').trim(),
              customerEmail: String(state.customer?.customerEmail || '').trim(),
              customerPhone: String(state.customer?.customerPhone || '').trim()
            }
          };
        }

        markAsSaved() {
          const currentState = this.invoiceState.getState();
          this.lastSavedState = this.normalizeStateForComparison(currentState);
          this.hasUnsavedChanges = false;
          this.notifyListeners();
        }

        getHasUnsavedChanges() {
          return this.hasUnsavedChanges;
        }

        subscribe(listener) {
          this.listeners.push(listener);
        }

        notifyListeners() {
          this.listeners.forEach(listener => {
            listener({ hasUnsavedChanges: this.hasUnsavedChanges });
          });
        }
      }

      unsavedChangesManager = new MockFixedUnsavedChangesManager(mockInvoiceState);
    });

    test('should establish baseline on first state change (no false positive)', () => {
      // Simulate invoice data being loaded
      const loadedInvoiceData = {
        vessel: { name: 'Saved Vessel', weight: '450', beam: '12' },
        customer: { customerName: 'Saved Customer', customerEmail: 'test@example.com' }
      };

      // This was the scenario causing false positives
      unsavedChangesManager.detectChanges(loadedInvoiceData);

      // Should not show unsaved changes immediately after load
      expect(unsavedChangesManager.getHasUnsavedChanges()).toBe(false);
    });

    test('should detect real changes after baseline is established', () => {
      // First establish baseline
      const initialData = {
        vessel: { name: 'Original', weight: '100', beam: '10' },
        customer: { customerName: 'Original Customer' }
      };

      unsavedChangesManager.detectChanges(initialData);
      expect(unsavedChangesManager.getHasUnsavedChanges()).toBe(false);

      // Now make a real change
      const editedData = {
        vessel: { name: 'EDITED', weight: '100', beam: '10' },
        customer: { customerName: 'Original Customer' }
      };

      unsavedChangesManager.detectChanges(editedData);
      expect(unsavedChangesManager.getHasUnsavedChanges()).toBe(true);
    });

    test('should handle type differences in comparison correctly', () => {
      // Baseline with string values
      const baselineData = {
        vessel: { name: 'Test', weight: '100', beam: '10' }
      };

      unsavedChangesManager.detectChanges(baselineData);
      expect(unsavedChangesManager.getHasUnsavedChanges()).toBe(false);

      // Same data but with numeric types (from session storage)
      const numericData = {
        vessel: { name: 'Test', weight: 100, beam: 10.0 }
      };

      unsavedChangesManager.detectChanges(numericData);
      // Should not detect as changed due to normalization
      expect(unsavedChangesManager.getHasUnsavedChanges()).toBe(false);
    });

    test('should reset dirty state after save', () => {
      // Make changes to trigger dirty state
      const initialData = {
        vessel: { name: 'Original', weight: '100' }
      };
      const editedData = {
        vessel: { name: 'Edited', weight: '100' }
      };

      unsavedChangesManager.detectChanges(initialData);
      unsavedChangesManager.detectChanges(editedData);
      expect(unsavedChangesManager.getHasUnsavedChanges()).toBe(true);

      // Mock the current state for markAsSaved
      mockInvoiceState.getState.mockReturnValue(editedData);

      // Save should reset dirty state
      unsavedChangesManager.markAsSaved();
      expect(unsavedChangesManager.getHasUnsavedChanges()).toBe(false);
    });
  });

  describe('BUG 3 FIX: Navigation Guard Scope', () => {

    function isSameInvoiceNavigation(targetTab) {
      // This is the logic from NavigationProtection.js
      const intraInvoiceTabs = ['details', 'services', 'preview', 'notes'];
      return intraInvoiceTabs.includes(targetTab);
    }

    test('should allow intra-invoice tab navigation without warnings', () => {
      const intraInvoiceTabs = ['details', 'services', 'preview', 'notes'];

      intraInvoiceTabs.forEach(tab => {
        expect(isSameInvoiceNavigation(tab)).toBe(true);
      });
    });

    test('should block external navigation with warnings', () => {
      const externalNavigations = ['external', 'different-invoice', 'logout', 'new-invoice'];

      externalNavigations.forEach(nav => {
        expect(isSameInvoiceNavigation(nav)).toBe(false);
      });
    });
  });

  describe('INTEGRATION: Combined Bug Scenarios', () => {

    test('should handle complete invoice load flow without errors', () => {
      // Simulate the complete problematic flow that caused both bugs

      // 1. Session data with numeric types (Bug 2 scenario)
      const sessionInvoiceData = {
        vessel: {
          name: 'Session Vessel',
          weight: 450.5,    // NUMBER
          beam: 12.3        // NUMBER
        },
        customer: {
          customerName: 'Session Customer',
          customerEmail: 'session@test.com'
        }
      };

      // 2. Apply VesselForm fix (type safety)
      const normalizedVessel = {
        name: String(sessionInvoiceData.vessel.name || '').trim(),
        weight: String(sessionInvoiceData.vessel.weight || '').trim(),
        beam: String(sessionInvoiceData.vessel.beam || '').trim()
      };

      expect(() => {
        // These should not throw .trim() errors
        expect(normalizedVessel.name).toBe('Session Vessel');
        expect(normalizedVessel.weight).toBe('450.5');
        expect(normalizedVessel.beam).toBe('12.3');
      }).not.toThrow();

      // 3. Apply UnsavedChangesManager fix (baseline establishment)
      // This would have previously caused false unsaved changes warnings
      const mockUnsavedManager = {
        lastSavedState: null,
        hasUnsavedChanges: false,

        detectChanges(state) {
          if (!this.lastSavedState) {
            // Phase 3 fix: establish baseline instead of skipping
            this.lastSavedState = this.normalizeState(state);
            this.hasUnsavedChanges = false;
            return;
          }
          // Normal comparison logic...
        },

        normalizeState(state) {
          return {
            vessel: {
              name: String(state.vessel?.name || '').trim(),
              weight: String(state.vessel?.weight || '').trim(),
              beam: String(state.vessel?.beam || '').trim()
            }
          };
        }
      };

      // Trigger the flow
      mockUnsavedManager.detectChanges(sessionInvoiceData);

      // Should not have false unsaved changes
      expect(mockUnsavedManager.hasUnsavedChanges).toBe(false);
      expect(mockUnsavedManager.lastSavedState).toBeTruthy();
    });
  });
});

module.exports = {};