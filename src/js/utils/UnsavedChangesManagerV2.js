/**
 * UnsavedChangesManagerV2 - First-Principles Dirty State Management
 *
 * Root Cause Fixes:
 * 1. Single-point baseline establishment (no race conditions)
 * 2. Canonical state comparison (no formatting false positives)
 * 3. Field-level change detection (precise section mapping)
 * 4. UI event hygiene (no mount-time onChange interference)
 * 5. Deterministic timing and sequencing
 *
 * Replaces: UnsavedChangesManager.js with hash-based comparison
 */

import { CanonicalInvoice } from './CanonicalInvoice.js';

export class UnsavedChangesManagerV2 {
  constructor(invoiceState, invoiceStorage) {
    this.invoiceState = invoiceState;
    this.invoiceStorage = invoiceStorage;

    // Canonical baseline management
    this.baselineCanonical = null;
    this.currentCanonical = null;
    this.hasUnsavedChanges = false;

    // Change tracking
    this.fieldChanges = [];
    this.changedSections = [];
    this.lastChangeTime = 0;

    // Event management
    this.listeners = [];
    this.debounceDelay = 300;
    this.debounceTimer = null;

    // UI event hygiene
    this.isInitializing = true;
    this.initializationTimer = null;

    // Session persistence
    this.sessionKey = 'marine_invoice_unsaved_changes_v2';

    // Initialize
    this.init();
  }

  /**
   * Initialize the change tracking system with proper sequencing
   */
  init() {
    console.log('🔍 Initializing UnsavedChangesManagerV2...');

    // Subscribe to state changes
    this.invoiceState.subscribe((state) => {
      this.handleStateChange(state);
    });

    // Set initialization period to block false onChange events
    this.setInitializationPeriod(1000); // 1 second for components to stabilize

    console.log('✅ UnsavedChangesManagerV2 initialized');
  }

  /**
   * Set initialization period to prevent false onChange events during mount
   */
  setInitializationPeriod(duration) {
    this.isInitializing = true;

    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
    }

    this.initializationTimer = setTimeout(() => {
      this.isInitializing = false;
      console.log('🔧 Initialization period ended - onChange events now tracked');
    }, duration);
  }

  /**
   * Handle state change with proper debouncing and hygiene
   */
  handleStateChange(state) {
    // Block changes during initialization to prevent mount-time false positives
    if (this.isInitializing) {
      console.log('🔧 Blocking state change during initialization period');
      return;
    }

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce change detection
    this.debounceTimer = setTimeout(() => {
      this.detectChanges(state);
    }, this.debounceDelay);
  }

  /**
   * Detect changes using canonical state comparison
   */
  detectChanges(currentState) {
    try {
      const stackTrace = new Error().stack?.split('\n').slice(1, 3).join(' | ') || 'unknown';
      console.log(`🔍 CANONICAL TRACE: detectChanges called from: ${stackTrace}`);

      // If no baseline exists, this is the first state - skip detection
      if (!this.baselineCanonical) {
        console.log('🔧 No baseline established yet - waiting for explicit baseline');
        return;
      }

      // Create canonical representation of current state
      this.currentCanonical = CanonicalInvoice.fromState(currentState);

      // Get field-level changes
      this.fieldChanges = this.currentCanonical.diff(this.baselineCanonical);
      this.changedSections = this.currentCanonical.getChangedSections(this.fieldChanges);

      // Determine if there are meaningful changes
      const hasChanges = this.fieldChanges.length > 0;

      // Update state if changed
      if (hasChanges !== this.hasUnsavedChanges) {
        console.log(`🔄 CANONICAL CHANGE: isDirty state change: ${this.hasUnsavedChanges} → ${hasChanges}`);
        console.log(`  - Field changes: ${this.fieldChanges.join(', ')}`);
        console.log(`  - Changed sections: ${this.changedSections.join(', ')}`);

        this.hasUnsavedChanges = hasChanges;
        this.lastChangeTime = Date.now();

        // Persist state
        this.persistUnsavedState();

        // Notify listeners
        this.notifyListeners();
      }

    } catch (error) {
      console.error('❌ Error in canonical change detection:', error);
    }
  }

  /**
   * Establish baseline from current state (single point of truth)
   * This should be called ONLY after invoice data is fully loaded and UI is stable
   */
  establishBaseline(invoiceState = null) {
    const currentState = invoiceState || this.invoiceState.getState();
    const stackTrace = new Error().stack?.split('\n').slice(1, 3).join(' | ') || 'unknown';

    console.log('🔧 CANONICAL BASELINE: Establishing baseline from current state');
    console.log(`  - Called from: ${stackTrace}`);

    try {
      // Create canonical baseline
      this.baselineCanonical = CanonicalInvoice.fromState(currentState);
      this.currentCanonical = this.baselineCanonical;

      // Reset change tracking
      this.hasUnsavedChanges = false;
      this.fieldChanges = [];
      this.changedSections = [];
      this.lastChangeTime = Date.now();

      // Debug log
      this.baselineCanonical.debug('BASELINE');
      console.log(`  - Baseline hash: ${this.baselineCanonical.getHash()}`);

      // Clear session persistence
      this.clearUnsavedState();

      // End initialization period if baseline is set explicitly
      if (this.isInitializing) {
        this.isInitializing = false;
        if (this.initializationTimer) {
          clearTimeout(this.initializationTimer);
        }
        console.log('🔧 Initialization ended due to explicit baseline');
      }

      // Notify listeners of clean state
      this.notifyListeners();

      console.log('✅ CANONICAL BASELINE: Baseline established successfully');
    } catch (error) {
      console.error('❌ Error establishing canonical baseline:', error);
    }
  }

  /**
   * Mark current state as saved (convenience method)
   */
  markAsSaved() {
    const stackTrace = new Error().stack?.split('\n').slice(1, 3).join(' | ') || 'unknown';
    console.log(`🔍 CANONICAL TRACE: markAsSaved called from: ${stackTrace}`);

    this.establishBaseline();
  }

  /**
   * Get current unsaved changes status
   */
  getHasUnsavedChanges() {
    return this.hasUnsavedChanges;
  }

  /**
   * Get detailed changes summary with field paths and sections
   */
  getChangesSummary() {
    return {
      hasChanges: this.hasUnsavedChanges,
      changes: this.changedSections, // For UI compatibility
      fieldChanges: this.fieldChanges,
      sections: this.changedSections,
      lastChangeTime: this.lastChangeTime
    };
  }

  /**
   * Force a check for unsaved changes
   */
  forceCheck() {
    if (this.isInitializing) {
      console.log('🔧 Skipping force check during initialization');
      return;
    }

    const currentState = this.invoiceState.getState();
    this.detectChanges(currentState);
  }

  /**
   * Subscribe to unsaved changes notifications
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      console.warn('⚠️ Invalid listener: must be a function');
      return () => {};
    }

    this.listeners.push(listener);

    // Immediately call with current state
    listener({
      hasUnsavedChanges: this.hasUnsavedChanges,
      changesSummary: this.getChangesSummary()
    });

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    const changeData = {
      hasUnsavedChanges: this.hasUnsavedChanges,
      changesSummary: this.getChangesSummary()
    };

    this.listeners.forEach((listener, index) => {
      try {
        listener(changeData);
      } catch (error) {
        console.error(`❌ Listener ${index} error:`, error);
      }
    });

    // Update page indicators
    this.updatePageIndicators();
  }

  /**
   * Update page title to indicate unsaved changes
   */
  updatePageIndicators() {
    try {
      const baseTitle = 'Marine Group - Invoice Generator';

      if (this.hasUnsavedChanges) {
        document.title = '● ' + baseTitle; // Add bullet indicator
      } else {
        document.title = baseTitle;
      }
    } catch (error) {
      console.error('❌ Error updating page indicators:', error);
    }
  }

  /**
   * Persist unsaved state to session storage
   */
  persistUnsavedState() {
    try {
      const unsavedData = {
        hasChanges: this.hasUnsavedChanges,
        fieldChanges: this.fieldChanges,
        sections: this.changedSections,
        timestamp: Date.now()
      };

      sessionStorage.setItem(this.sessionKey, JSON.stringify(unsavedData));
    } catch (error) {
      console.error('❌ Error persisting unsaved state:', error);
    }
  }

  /**
   * Clear unsaved state from session storage
   */
  clearUnsavedState() {
    try {
      sessionStorage.removeItem(this.sessionKey);
    } catch (error) {
      console.error('❌ Error clearing unsaved state:', error);
    }
  }

  /**
   * Debug current state for troubleshooting
   */
  debug(label = 'UnsavedChangesManagerV2') {
    console.log(`🔍 ${label} DEBUG:`, {
      hasUnsavedChanges: this.hasUnsavedChanges,
      fieldChanges: this.fieldChanges,
      changedSections: this.changedSections,
      isInitializing: this.isInitializing,
      hasBaseline: !!this.baselineCanonical,
      lastChangeTime: new Date(this.lastChangeTime).toISOString()
    });

    if (this.baselineCanonical) {
      this.baselineCanonical.debug('BASELINE');
    }

    if (this.currentCanonical) {
      this.currentCanonical.debug('CURRENT');
    }
  }

  /**
   * Reset to initial state
   */
  reset() {
    console.log('🔄 Resetting UnsavedChangesManagerV2');

    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
    }

    // Reset state
    this.baselineCanonical = null;
    this.currentCanonical = null;
    this.hasUnsavedChanges = false;
    this.fieldChanges = [];
    this.changedSections = [];
    this.lastChangeTime = 0;

    // Reset initialization state
    this.isInitializing = true;
    this.setInitializationPeriod(1000);

    // Clear session data
    this.clearUnsavedState();

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Clean up the manager
   */
  cleanup() {
    console.log('🧹 Cleaning up UnsavedChangesManagerV2...');

    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.initializationTimer) {
      clearTimeout(this.initializationTimer);
    }

    // Clear listeners
    this.listeners = [];

    // Clear session data
    this.clearUnsavedState();

    // Reset state
    this.baselineCanonical = null;
    this.currentCanonical = null;
    this.hasUnsavedChanges = false;
    this.fieldChanges = [];
    this.changedSections = [];

    console.log('✅ UnsavedChangesManagerV2 cleanup complete');
  }
}