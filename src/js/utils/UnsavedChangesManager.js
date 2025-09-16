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
    try {
      // 🔧 PHASE 3 FIX: Establish baseline if none exists yet
      if (!this.lastSavedState) {
        console.log('🔧 PHASE 3 FIX: No baseline yet, establishing from current state');
        this.establishBaseline(currentState);
        return;
      }

      // 🔍 PHASE 1 INSTRUMENTATION: Add detailed state tracking
      const stackTrace = new Error().stack?.split('\n').slice(1, 4).join(' | ') || 'unknown';
      console.log(`🔍 TRACE: detectChanges called from: ${stackTrace}`);

      // Calculate change hash for efficient comparison
      const currentHash = this.calculateStateHash(currentState);
      const savedHash = this.calculateStateHash(this.lastSavedState);

      // Check if state has changed
      const hasChanges = currentHash !== savedHash;

      // 🔍 PHASE 1 INSTRUMENTATION: Detailed change analysis
      if (hasChanges !== this.hasUnsavedChanges) {
        console.log(`🔄 PHASE 1 TRACE: isDirty state change: ${this.hasUnsavedChanges} → ${hasChanges}`);
        console.log(`  - Current hash: ${currentHash}`);
        console.log(`  - Saved hash: ${savedHash}`);

        // Deep diff analysis to identify what changed
        if (hasChanges) {
          this.logDetailedDiff(currentState, this.lastSavedState);
        }

        this.hasUnsavedChanges = hasChanges;
        this.currentChangeHash = currentHash;

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
   * 🔍 PHASE 1 INSTRUMENTATION: Log detailed differences between states
   * @param {Object} currentState - Current state
   * @param {Object} savedState - Last saved state
   */
  logDetailedDiff(currentState, savedState) {
    try {
      console.log('🔍 PHASE 1 DETAILED DIFF ANALYSIS:');

      // Vessel changes
      if (this.hasVesselChanges(currentState)) {
        const current = currentState.vessel || {};
        const saved = savedState.vessel || {};
        console.log('  📊 VESSEL CHANGES:');
        if (current.name !== saved.name) console.log(`    - name: "${saved.name}" → "${current.name}"`);
        if (current.weight !== saved.weight) console.log(`    - weight: "${saved.weight}" → "${current.weight}"`);
        if (current.beam !== saved.beam) console.log(`    - beam: "${saved.beam}" → "${current.beam}"`);
      }

      // Customer changes
      if (this.hasCustomerChanges(currentState)) {
        const current = currentState.customer || {};
        const saved = savedState.customer || {};
        console.log('  👤 CUSTOMER CHANGES:');
        if (current.customerName !== saved.customerName) console.log(`    - name: "${saved.customerName}" → "${current.customerName}"`);
        if (current.customerEmail !== saved.customerEmail) console.log(`    - email: "${saved.customerEmail}" → "${current.customerEmail}"`);
        if (current.customerPhone !== saved.customerPhone) console.log(`    - phone: "${saved.customerPhone}" → "${current.customerPhone}"`);
      }

      // Line items changes
      if (this.hasLineItemsChanges(currentState)) {
        const currentItems = currentState.scope?.lineItems || [];
        const savedItems = savedState.scope?.lineItems || [];
        console.log('  📋 LINE ITEMS CHANGES:');
        console.log(`    - count: ${savedItems.length} → ${currentItems.length}`);

        // Check each item for changes
        const maxLength = Math.max(currentItems.length, savedItems.length);
        for (let i = 0; i < maxLength; i++) {
          const current = currentItems[i] || {};
          const saved = savedItems[i] || {};

          if (!saved.id && current.id) {
            console.log(`    - item ${i}: ADDED (${current.jobType})`);
          } else if (saved.id && !current.id) {
            console.log(`    - item ${i}: REMOVED (${saved.jobType})`);
          } else if (current.id && saved.id) {
            const fields = ['jobType', 'itemType', 'manualCost', 'laborHours', 'otHours', 'description'];
            fields.forEach(field => {
              if (current[field] !== saved[field]) {
                console.log(`    - item ${i}.${field}: "${saved[field]}" → "${current[field]}"`);
              }
            });
          }
        }
      }

      // Notes changes
      if (this.hasNotesChanges(currentState)) {
        const currentComments = currentState.notes?.comments || [];
        const savedComments = savedState.notes?.comments || [];
        console.log('  💬 NOTES CHANGES:');
        console.log(`    - comments count: ${savedComments.length} → ${currentComments.length}`);
      }

    } catch (error) {
      console.error('❌ Error in detailed diff logging:', error);
    }
  }

  /**
   * 🔧 PHASE 3 FIX: Establish baseline from current state without triggering unsaved changes
   * @param {Object} currentState - State to use as baseline
   */
  establishBaseline(currentState) {
    console.log('🔧 PHASE 3 BASELINE: Establishing baseline from current state');
    this.lastSavedState = this.normalizeStateForComparison(currentState);
    this.hasUnsavedChanges = false;
    this.currentChangeHash = this.calculateStateHash(currentState);

    console.log(`  - Baseline hash: ${this.currentChangeHash}`);
    console.log(`  - Vessel name: "${currentState.vessel?.name || ''}"`);
    console.log(`  - Customer name: "${currentState.customer?.customerName || ''}"`);
    console.log(`  - Line items count: ${currentState.scope?.lineItems?.length || 0}`);

    // Clear session persistence since we have a fresh baseline
    this.clearUnsavedState();

    // Notify listeners of clean state
    this.notifyListeners();
  }

  /**
   * Normalize state for consistent comparison (handles type safety)
   * @param {Object} state - Raw state data
   * @returns {Object} Normalized state data
   */
  normalizeStateForComparison(state) {
    try {
      // 🔧 PHASE 2 FIX: Use safe string utilities to prevent .trim() errors
      return {
        vessel: {
          name: safeString(state.vessel?.name),
          weight: safeString(state.vessel?.weight),
          beam: safeString(state.vessel?.beam)
        },
        customer: {
          customerName: safeString(state.customer?.customerName),
          customerEmail: safeString(state.customer?.customerEmail),
          customerPhone: safeString(state.customer?.customerPhone)
        },
        scope: {
          markupRate: safeString(state.scope?.markupRate, '2.5'),
          isTaxable: Boolean(state.scope?.isTaxable),
          lineItems: (state.scope?.lineItems || []).map(item => ({
            id: item.id,
            jobType: safeString(item.jobType),
            itemType: safeString(item.itemType),
            manualCost: safeString(item.manualCost),
            laborHours: safeString(item.laborHours),
            otHours: safeString(item.otHours),
            description: safeString(item.description),
            taxStatus: safeString(item.taxStatus, 'taxable'),
            markupType: safeString(item.markupType, 'preset'),
            markupRate: safeString(item.markupRate, '2.5')
          }))
        },
        notes: {
          comments: (state.notes?.comments || []).map(comment => ({
            id: comment.id,
            text: safeString(comment.text),
            author: safeString(comment.author),
            timestamp: comment.timestamp
          }))
        }
      };
    } catch (error) {
      console.error('❌ Error normalizing state:', error);
      return JSON.parse(JSON.stringify(state)); // Fallback to deep clone
    }
  }

  /**
   * Mark current state as saved
   */
  markAsSaved() {
    // 🔍 PHASE 1 INSTRUMENTATION: Track when markAsSaved is called
    const stackTrace = new Error().stack?.split('\n').slice(1, 4).join(' | ') || 'unknown';
    console.log(`🔍 TRACE: markAsSaved called from: ${stackTrace}`);

    const currentState = this.invoiceState.getState();
    this.lastSavedState = this.normalizeStateForComparison(currentState);
    this.hasUnsavedChanges = false;
    this.currentChangeHash = this.calculateStateHash(currentState);

    // 🔍 PHASE 1 INSTRUMENTATION: Log state snapshot
    console.log('🔍 PHASE 1 BASELINE: State marked as saved');
    console.log(`  - Invoice ID: ${this.invoiceState.getCurrentInvoiceId()}`);
    console.log(`  - Baseline hash: ${this.currentChangeHash}`);
    console.log(`  - Vessel name: "${currentState.vessel?.name || ''}"`);
    console.log(`  - Customer name: "${currentState.customer?.customerName || ''}"`);
    console.log(`  - Line items count: ${currentState.scope?.lineItems?.length || 0}`);

    // Clear session persistence
    this.clearUnsavedState();

    // Notify listeners
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