/**
 * UnsavedChangesManager - Tracks unsaved changes in the invoice system
 *
 * Features:
 * - Debounced change detection
 * - State comparison and diffing
 * - Integration with InvoiceState and storage
 * - Event-based notifications
 * - Session persistence for browser refresh scenarios
 */

import { safeString, normalizeSessionData } from './safeString.js';

export class UnsavedChangesManager {
  constructor(invoiceState, invoiceStorage) {
    this.invoiceState = invoiceState;
    this.invoiceStorage = invoiceStorage;

    // State tracking
    this.lastSavedState = null;
    this.currentChangeHash = null;
    this.hasUnsavedChanges = false;

    // 🔧 PHASE 3 FIX: Add baseline establishment control
    this.baselineEstablished = false;
    this.invoiceLoaded = false;
    this.pendingBaselineData = null;

    // Debouncing
    this.debounceDelay = 300; // 300ms debounce
    this.debounceTimer = null;

    // Event handling
    this.listeners = [];
    this.eventQueue = new Set();
    this.isProcessingEvents = false;

    // Session persistence
    this.sessionKey = 'marine_invoice_unsaved_changes';
    this.backupKey = 'marine_invoice_backup_state';

    // Initialize
    this.init();
  }

  /**
   * Initialize the change tracking system
   */
  init() {
    console.log('🔍 Initializing UnsavedChangesManager...');

    // Subscribe to state changes
    this.invoiceState.subscribe((state) => {
      this.handleStateChange(state);
    });

    // Restore from session if needed
    this.restoreUnsavedState();

    // 🔧 PHASE 2 FIX: Don't mark as saved immediately - wait for invoice load
    // The markAsSaved() will be called after invoice data is properly loaded
    console.log('🔧 PHASE 2 FIX: Skipping initial markAsSaved - will be called after invoice load');

    console.log('✅ UnsavedChangesManager initialized');
  }

  /**
   * Handle state change with debouncing
   * @param {Object} state - Current invoice state
   */
  handleStateChange(state) {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Queue the change detection
    this.debounceTimer = setTimeout(() => {
      this.detectChanges(state);
    }, this.debounceDelay);

    // Backup state for crash recovery
    this.backupCurrentState(state);
  }

  /**
   * Detect changes between current and last saved state
   * @param {Object} currentState - Current invoice state
   */
  detectChanges(currentState) {
    // 🔧 PHASE 3 FIX: Don't detect changes until baseline is established
    if (!this.baselineEstablished) {
      console.log('🔧 PHASE 3 BASELINE: Skipping change detection - baseline not established');
      return;
    }

    if (!this.lastSavedState) {
      console.log('🔍 No baseline state available, cannot detect changes');
      return;
    }

    try {
      const currentHash = this.calculateStateHash(currentState);
      const baselineHash = this.calculateStateHash(this.lastSavedState);

      const hadChanges = this.hasUnsavedChanges;
      this.hasUnsavedChanges = currentHash !== baselineHash;

      // Log changes for debugging
      if (this.hasUnsavedChanges !== hadChanges) {
        console.log(`🔄 Change state updated: ${this.hasUnsavedChanges ? 'HAS CHANGES' : 'NO CHANGES'}`);
        console.log(`  - Current hash: ${currentHash}`);
        console.log(`  - Baseline hash: ${baselineHash}`);
      }

      // Store current change hash for optimization
      this.currentChangeHash = currentHash;

      // Persist to session storage
      this.persistUnsavedState(currentState);

      // Notify listeners about state change
      this.notifyListeners();

    } catch (error) {
      console.error('❌ Error detecting changes:', error);
    }
  }

  /**
   * Calculate a hash for state comparison
   * @param {Object} state - State to hash
   * @returns {string} Hash value
   */
  calculateStateHash(state) {
    try {
      const normalized = this.normalizeStateForComparison(state);
      return this.simpleHash(JSON.stringify(normalized));
    } catch (error) {
      console.error('❌ Error calculating state hash:', error);
      return '';
    }
  }

  /**
   * Simple hash function for state comparison
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Normalize state for consistent comparison
   * @param {Object} state - State to normalize
   * @returns {Object} Normalized state
   */
  normalizeStateForComparison(state) {
    try {
      // Create a deep copy and normalize it
      const normalized = JSON.parse(JSON.stringify(state || {}));

      // 🔧 PHASE 3 FIX: Implement canonical state normalization
      const canonicalState = this.canonicalizeState(normalized);

      return canonicalState;
    } catch (error) {
      console.error('❌ Error normalizing state:', error);
      return JSON.parse(JSON.stringify(state)); // Fallback to deep clone
    }
  }

  /**
   * 🔧 PHASE 3 FIX: Canonicalize state for consistent hashing
   * @param {Object} state - State to canonicalize
   * @returns {Object} Canonicalized state
   */
  canonicalizeState(state) {
    if (!state || typeof state !== 'object') return state;

    const canonical = {};

    // Process keys in sorted order for consistency
    const sortedKeys = Object.keys(state).sort();

    for (const key of sortedKeys) {
      const value = state[key];

      if (value === null || value === undefined) {
        // Normalize null/undefined to consistent value
        canonical[key] = null;
      } else if (Array.isArray(value)) {
        // Canonicalize arrays
        canonical[key] = value.map(item => this.canonicalizeState(item));
      } else if (typeof value === 'object') {
        // Recursively canonicalize objects
        canonical[key] = this.canonicalizeState(value);
      } else if (typeof value === 'string') {
        // Normalize strings (trim whitespace)
        canonical[key] = value.trim();
      } else if (typeof value === 'number') {
        // Normalize numbers (handle floating point precision)
        canonical[key] = Math.round(value * 100) / 100;
      } else {
        // Keep other types as-is
        canonical[key] = value;
      }
    }

    return canonical;
  }

  /**
   * 🔧 PHASE 3 FIX: Mark current state as saved with enhanced guards
   */
  markAsSaved() {
    // 🔍 PHASE 1 INSTRUMENTATION: Track when markAsSaved is called
    const stackTrace = new Error().stack?.split('\n').slice(1, 4).join(' | ') || 'unknown';
    console.log(`🔍 TRACE: markAsSaved called from: ${stackTrace}`);

    const currentState = this.invoiceState.getState();

    // 🔧 PHASE 3 FIX: Guard against premature baseline establishment
    if (!this.invoiceLoaded) {
      console.log('🔧 PHASE 3 BASELINE: Deferring markAsSaved - invoice not fully loaded');
      this.pendingBaselineData = currentState;
      return;
    }

    // 🔧 PHASE 3 FIX: Validate state has meaningful content before establishing baseline
    const hasVessel = currentState.vessel && (currentState.vessel.name || currentState.vessel.vesselName);
    const hasCustomer = currentState.customer && currentState.customer.customerName;
    const hasLineItems = currentState.scope && currentState.scope.lineItems && currentState.scope.lineItems.length > 0;

    if (!hasVessel && !hasCustomer && !hasLineItems) {
      console.log('🔧 PHASE 3 BASELINE: Deferring markAsSaved - state appears empty');
      return;
    }

    this.lastSavedState = this.normalizeStateForComparison(currentState);
    this.hasUnsavedChanges = false;
    this.currentChangeHash = this.calculateStateHash(currentState);
    this.baselineEstablished = true;

    // 🔍 PHASE 1 INSTRUMENTATION: Log state snapshot
    console.log('🔧 PHASE 3 BASELINE: State marked as saved with content validation');
    console.log(`  - Invoice ID: ${this.invoiceState.getCurrentInvoiceId()}`);
    console.log(`  - Baseline hash: ${this.currentChangeHash}`);
    console.log(`  - Vessel name: "${currentState.vessel?.name || currentState.vessel?.vesselName || ''}"`);
    console.log(`  - Customer name: "${currentState.customer?.customerName || ''}"`);
    console.log(`  - Line items count: ${currentState.scope?.lineItems?.length || 0}`);
    console.log(`  - Has vessel: ${hasVessel}, Has customer: ${hasCustomer}, Has line items: ${hasLineItems}`);

    // Clear session persistence
    this.clearUnsavedState();

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * 🔧 PHASE 3 FIX: Signal that invoice has finished loading
   */
  onInvoiceLoaded() {
    console.log('🔧 PHASE 3 BASELINE: Invoice loading complete');
    this.invoiceLoaded = true;

    // If we have pending baseline data, establish it now
    if (this.pendingBaselineData) {
      console.log('🔧 PHASE 3 BASELINE: Establishing deferred baseline');
      this.markAsSaved();
      this.pendingBaselineData = null;
    }
  }

  /**
   * 🔧 PHASE 3 FIX: Reset for new invoice
   */
  resetForNewInvoice() {
    console.log('🔧 PHASE 3 BASELINE: Resetting for new invoice');
    this.baselineEstablished = false;
    this.invoiceLoaded = false;
    this.lastSavedState = null;
    this.hasUnsavedChanges = false;
    this.currentChangeHash = null;
    this.pendingBaselineData = null;
    this.clearUnsavedState();
    this.notifyListeners();
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean} True if there are unsaved changes
   */
  getHasUnsavedChanges() {
    return this.hasUnsavedChanges;
  }

  /**
   * Get a summary of what has changed
   * @returns {Object} Change summary
   */
  getChangesSummary() {
    if (!this.hasUnsavedChanges || !this.lastSavedState) {
      return { hasChanges: false, changes: [] };
    }

    const currentState = this.invoiceState.getState();
    const changes = [];

    try {
      // Check vessel changes
      if (this.hasVesselChanges(currentState)) {
        changes.push('Vessel details');
      }

      // Check customer changes
      if (this.hasCustomerChanges(currentState)) {
        changes.push('Customer information');
      }

      // Check scope changes
      if (this.hasScopeChanges(currentState)) {
        changes.push('Services and line items');
      }

      // Check notes changes
      if (this.hasNotesChanges(currentState)) {
        changes.push('Notes and comments');
      }

      return {
        hasChanges: changes.length > 0,
        changes: changes
      };

    } catch (error) {
      console.error('❌ Error generating changes summary:', error);
      return { hasChanges: this.hasUnsavedChanges, changes: ['Unknown changes'] };
    }
  }

  /**
   * Check for vessel changes
   */
  hasVesselChanges(currentState) {
    const current = currentState.vessel || {};
    const saved = this.lastSavedState.vessel || {};

    return (
      current.name !== saved.name ||
      current.vesselName !== saved.vesselName ||
      current.type !== saved.type ||
      current.length !== saved.length ||
      current.location !== saved.location
    );
  }

  /**
   * Check for customer changes
   */
  hasCustomerChanges(currentState) {
    const current = currentState.customer || {};
    const saved = this.lastSavedState.customer || {};

    return (
      current.customerName !== saved.customerName ||
      current.email !== saved.email ||
      current.phone !== saved.phone ||
      current.address !== saved.address
    );
  }

  /**
   * Check for scope changes
   */
  hasScopeChanges(currentState) {
    const current = currentState.scope || {};
    const saved = this.lastSavedState.scope || {};

    // Check line items
    const currentItems = current.lineItems || [];
    const savedItems = saved.lineItems || [];

    if (currentItems.length !== savedItems.length) return true;

    for (let i = 0; i < currentItems.length; i++) {
      const currentItem = currentItems[i];
      const savedItem = savedItems[i];

      if (
        currentItem.description !== savedItem.description ||
        currentItem.amount !== savedItem.amount ||
        currentItem.tax !== savedItem.tax
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for notes changes
   */
  hasNotesChanges(currentState) {
    const current = currentState.notes || {};
    const saved = this.lastSavedState.notes || {};

    return (
      current.workNotes !== saved.workNotes ||
      current.internalNotes !== saved.internalNotes
    );
  }

  /**
   * Persist unsaved state to session storage
   * @param {Object} state - Current state to persist
   */
  persistUnsavedState(state) {
    try {
      if (this.hasUnsavedChanges) {
        const unsavedData = {
          state: state,
          timestamp: new Date().toISOString(),
          hasChanges: this.hasUnsavedChanges,
          changeHash: this.currentChangeHash
        };

        sessionStorage.setItem(this.sessionKey, JSON.stringify(unsavedData));
      } else {
        // Clear if no changes
        this.clearUnsavedState();
      }
    } catch (error) {
      console.error('❌ Error persisting unsaved state:', error);
    }
  }

  /**
   * Restore unsaved state from session storage
   */
  restoreUnsavedState() {
    try {
      const stored = sessionStorage.getItem(this.sessionKey);
      if (stored) {
        const unsavedData = JSON.parse(stored);
        console.log('🔄 Restored unsaved changes from session:', unsavedData.timestamp);

        // Restore the state to the invoice system
        if (unsavedData.state && this.invoiceState.setState) {
          this.invoiceState.setState(unsavedData.state);
        }

        this.hasUnsavedChanges = unsavedData.hasChanges || false;
        this.currentChangeHash = unsavedData.changeHash;

        this.notifyListeners();
      }
    } catch (error) {
      console.error('❌ Error restoring unsaved state:', error);
      this.clearUnsavedState();
    }
  }

  /**
   * Clear unsaved state from session storage
   */
  clearUnsavedState() {
    try {
      sessionStorage.removeItem(this.sessionKey);
      sessionStorage.removeItem(this.backupKey);
    } catch (error) {
      console.error('❌ Error clearing unsaved state:', error);
    }
  }

  /**
   * Backup current state for crash recovery
   * @param {Object} state - State to backup
   */
  backupCurrentState(state) {
    try {
      const backupData = {
        state: state,
        timestamp: new Date().toISOString()
      };

      sessionStorage.setItem(this.backupKey, JSON.stringify(backupData));
    } catch (error) {
      // Silently fail backup to avoid interference
    }
  }

  /**
   * Add change listener
   * @param {Function} callback - Listener callback
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Remove change listener
   * @param {Function} callback - Listener callback to remove
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    if (this.isProcessingEvents) return;

    this.isProcessingEvents = true;

    try {
      this.listeners.forEach(callback => {
        try {
          callback({
            hasUnsavedChanges: this.hasUnsavedChanges,
            changesSummary: this.getChangesSummary()
          });
        } catch (error) {
          console.error('❌ Error in unsaved changes listener:', error);
        }
      });
    } finally {
      this.isProcessingEvents = false;
    }
  }

  /**
   * Force change detection (useful for debugging)
   */
  forceChangeDetection() {
    console.log('🔄 Forcing change detection...');
    const currentState = this.invoiceState.getState();
    this.detectChanges(currentState);
  }

  /**
   * Get debug information
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    return {
      hasUnsavedChanges: this.hasUnsavedChanges,
      baselineEstablished: this.baselineEstablished,
      invoiceLoaded: this.invoiceLoaded,
      currentChangeHash: this.currentChangeHash,
      lastSavedStateExists: !!this.lastSavedState,
      listenersCount: this.listeners.length,
      pendingBaseline: !!this.pendingBaselineData
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.listeners = [];
    this.clearUnsavedState();

    console.log('✅ UnsavedChangesManager destroyed');
  }
}