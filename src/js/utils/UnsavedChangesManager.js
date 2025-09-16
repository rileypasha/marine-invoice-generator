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

export class UnsavedChangesManager {
  constructor(invoiceState, invoiceStorage) {
    this.invoiceState = invoiceState;
    this.invoiceStorage = invoiceStorage;

    // State tracking
    this.lastSavedState = null;
    this.currentChangeHash = null;
    this.hasUnsavedChanges = false;

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

    // Set initial saved state
    this.markAsSaved();

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
    try {
      // Skip if no saved state yet (initial load)
      if (!this.lastSavedState) {
        console.log('🔍 No saved state yet, skipping change detection');
        return;
      }

      // Calculate change hash for efficient comparison
      const currentHash = this.calculateStateHash(currentState);
      const savedHash = this.calculateStateHash(this.lastSavedState);

      // Check if state has changed
      const hasChanges = currentHash !== savedHash;

      // Update tracking if state changed
      if (hasChanges !== this.hasUnsavedChanges) {
        this.hasUnsavedChanges = hasChanges;
        this.currentChangeHash = currentHash;

        console.log(`🔄 Unsaved changes detected: ${hasChanges}`);
        console.log(`  - Current hash: ${currentHash}`);
        console.log(`  - Saved hash: ${savedHash}`);

        // Persist unsaved state
        this.persistUnsavedState();

        // Notify listeners
        this.notifyListeners();
      }

    } catch (error) {
      console.error('❌ Error detecting changes:', error);
    }
  }

  /**
   * Calculate a hash of the state for efficient comparison
   * @param {Object} state - Invoice state
   * @returns {string} State hash
   */
  calculateStateHash(state) {
    try {
      // Create a normalized version of the state for comparison
      const normalizedState = {
        vessel: {
          name: state.vessel?.name || '',
          weight: state.vessel?.weight || '',
          beam: state.vessel?.beam || ''
        },
        customer: {
          customerName: state.customer?.customerName || '',
          customerEmail: state.customer?.customerEmail || '',
          customerPhone: state.customer?.customerPhone || ''
        },
        scope: {
          markupRate: state.scope?.markupRate || '2.5',
          isTaxable: state.scope?.isTaxable || false,
          lineItems: (state.scope?.lineItems || []).map(item => ({
            id: item.id,
            jobType: item.jobType || '',
            itemType: item.itemType || '',
            manualCost: item.manualCost || '',
            laborHours: item.laborHours || '',
            otHours: item.otHours || '',
            description: item.description || '',
            taxStatus: item.taxStatus || 'taxable',
            markupType: item.markupType || 'preset',
            markupRate: item.markupRate || '2.5'
          }))
        },
        notes: {
          comments: (state.notes?.comments || []).map(comment => ({
            id: comment.id,
            text: comment.text || '',
            author: comment.author || '',
            timestamp: comment.timestamp
          }))
        }
      };

      // Convert to JSON and hash
      const stateJson = JSON.stringify(normalizedState);
      return this.simpleHash(stateJson);

    } catch (error) {
      console.error('❌ Error calculating state hash:', error);
      return Date.now().toString(); // Fallback hash
    }
  }

  /**
   * Simple hash function for state comparison
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString();
  }

  /**
   * Mark current state as saved
   */
  markAsSaved() {
    const currentState = this.invoiceState.getState();
    this.lastSavedState = JSON.parse(JSON.stringify(currentState));
    this.hasUnsavedChanges = false;
    this.currentChangeHash = this.calculateStateHash(currentState);

    // Clear session persistence
    this.clearUnsavedState();

    // Notify listeners
    this.notifyListeners();

    console.log('✅ State marked as saved');
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

      // Check line items changes
      if (this.hasLineItemsChanges(currentState)) {
        changes.push('Service line items');
      }

      // Check notes changes
      if (this.hasNotesChanges(currentState)) {
        changes.push('Comments');
      }

    } catch (error) {
      console.error('❌ Error getting changes summary:', error);
      changes.push('Invoice data');
    }

    return {
      hasChanges: this.hasUnsavedChanges,
      changes: changes.length > 0 ? changes : ['Invoice data']
    };
  }

  /**
   * Check if vessel data has changed
   */
  hasVesselChanges(currentState) {
    const current = currentState.vessel || {};
    const saved = this.lastSavedState.vessel || {};

    return current.name !== saved.name ||
           current.weight !== saved.weight ||
           current.beam !== saved.beam;
  }

  /**
   * Check if customer data has changed
   */
  hasCustomerChanges(currentState) {
    const current = currentState.customer || {};
    const saved = this.lastSavedState.customer || {};

    return current.customerName !== saved.customerName ||
           current.customerEmail !== saved.customerEmail ||
           current.customerPhone !== saved.customerPhone;
  }

  /**
   * Check if line items have changed
   */
  hasLineItemsChanges(currentState) {
    const currentItems = currentState.scope?.lineItems || [];
    const savedItems = this.lastSavedState.scope?.lineItems || [];

    if (currentItems.length !== savedItems.length) {
      return true;
    }

    // Compare each line item
    for (let i = 0; i < currentItems.length; i++) {
      const current = currentItems[i];
      const saved = savedItems[i];

      if (!saved ||
          current.id !== saved.id ||
          current.jobType !== saved.jobType ||
          current.itemType !== saved.itemType ||
          current.manualCost !== saved.manualCost ||
          current.laborHours !== saved.laborHours ||
          current.otHours !== saved.otHours ||
          current.description !== saved.description) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if notes have changed
   */
  hasNotesChanges(currentState) {
    const currentComments = currentState.notes?.comments || [];
    const savedComments = this.lastSavedState.notes?.comments || [];

    if (currentComments.length !== savedComments.length) {
      return true;
    }

    // Compare each comment
    for (let i = 0; i < currentComments.length; i++) {
      const current = currentComments[i];
      const saved = savedComments[i];

      if (!saved ||
          current.id !== saved.id ||
          current.text !== saved.text ||
          current.author !== saved.author) {
        return true;
      }
    }

    return false;
  }

  /**
   * Persist unsaved state to session storage
   */
  persistUnsavedState() {
    try {
      const unsavedData = {
        hasChanges: this.hasUnsavedChanges,
        changeHash: this.currentChangeHash,
        timestamp: Date.now()
      };

      sessionStorage.setItem(this.sessionKey, JSON.stringify(unsavedData));
    } catch (error) {
      console.error('❌ Error persisting unsaved state:', error);
    }
  }

  /**
   * Backup current state for crash recovery
   */
  backupCurrentState(state) {
    try {
      const backup = {
        state: state,
        timestamp: Date.now(),
        invoiceId: this.invoiceState.getCurrentInvoiceId()
      };

      sessionStorage.setItem(this.backupKey, JSON.stringify(backup));
    } catch (error) {
      console.error('❌ Error backing up state:', error);
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

        // Check if the unsaved data is still valid (within 1 hour)
        const maxAge = 60 * 60 * 1000; // 1 hour
        if (Date.now() - unsavedData.timestamp < maxAge) {
          this.hasUnsavedChanges = unsavedData.hasChanges;
          this.currentChangeHash = unsavedData.changeHash;

          console.log('🔄 Restored unsaved changes state from session');
        } else {
          this.clearUnsavedState();
        }
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
   * Subscribe to unsaved changes notifications
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
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

    // Update page visibility indicators
    this.updatePageIndicators();
  }

  /**
   * Update page title and favicon to indicate unsaved changes
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
   * Force a check for unsaved changes
   */
  forceCheck() {
    const currentState = this.invoiceState.getState();
    this.detectChanges(currentState);
  }

  /**
   * Clean up the manager
   */
  cleanup() {
    console.log('🧹 Cleaning up UnsavedChangesManager...');

    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Clear listeners
    this.listeners = [];

    // Clear session data
    this.clearUnsavedState();

    // Reset state
    this.hasUnsavedChanges = false;
    this.lastSavedState = null;
    this.currentChangeHash = null;

    console.log('✅ UnsavedChangesManager cleanup complete');
  }
}