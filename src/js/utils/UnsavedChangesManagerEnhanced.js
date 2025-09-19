/**
 * UnsavedChangesManagerEnhanced - PHASE 3 STABILIZATION
 * Enhanced version with improved state management and defensive programming
 *
 * Features:
 * - Robust baseline establishment with retry logic
 * - Comprehensive state validation
 * - Enhanced error handling and recovery
 * - Performance optimizations
 * - Memory leak prevention
 */

import { safeString, normalizeSessionData } from './safeString.js';

export class UnsavedChangesManagerEnhanced {
  constructor(invoiceState, invoiceStorage) {
    this.invoiceState = invoiceState;
    this.invoiceStorage = invoiceStorage;

    // 🔧 PHASE 3 STABILIZATION: Enhanced state tracking
    this.lastSavedState = null;
    this.currentChangeHash = null;
    this.hasUnsavedChanges = false;

    // 🔧 PHASE 3 STABILIZATION: Enhanced baseline control
    this.baselineEstablished = false;
    this.invoiceLoaded = false;
    this.pendingBaselineData = null;
    this.baselineRetryAttempts = 0;
    this.baselineRetryTimer = null;

    // Debouncing with enhanced configuration
    this.debounceDelay = 300;
    this.debounceTimer = null;

    // Event handling with improved performance
    this.listeners = [];
    this.eventQueue = new Set();
    this.isProcessingEvents = false;
    this.maxListeners = 10; // Prevent memory leaks

    // Session persistence
    this.sessionKey = 'marine_invoice_unsaved_changes';
    this.backupKey = 'marine_invoice_backup_state';

    // Health monitoring
    this.healthCheckInterval = null;
    this.lastHealthCheck = null;

    // Initialize with enhanced error handling
    this.init();
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced initialization
   */
  init() {
    try {
      console.log('🔍 Initializing Enhanced UnsavedChangesManager...');

      // Subscribe to state changes with error handling
      if (this.invoiceState && typeof this.invoiceState.subscribe === 'function') {
        this.invoiceState.subscribe((state) => {
          this.handleStateChange(state);
        });
      } else {
        console.warn('⚠️ InvoiceState not available or invalid');
      }

      // Restore from session if needed
      this.restoreUnsavedState();

      // Setup health monitoring
      this.setupHealthMonitoring();

      console.log('✅ Enhanced UnsavedChangesManager initialized');
    } catch (error) {
      console.error('❌ Error initializing UnsavedChangesManager:', error);
    }
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Health monitoring setup
   */
  setupHealthMonitoring() {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Health check implementation
   */
  performHealthCheck() {
    try {
      this.lastHealthCheck = Date.now();

      // Check for stale pending baselines
      if (this.pendingBaselineData) {
        const age = Date.now() - this.pendingBaselineData.timestamp;
        if (age > 60000) { // 1 minute
          console.warn('⚠️ Stale pending baseline detected, clearing');
          this.pendingBaselineData = null;
        }
      }

      // Check listener count for memory leaks
      if (this.listeners.length > this.maxListeners) {
        console.warn(`⚠️ Too many listeners (${this.listeners.length}), potential memory leak`);
      }

      // Verify state consistency
      this.verifyStateConsistency();

    } catch (error) {
      console.error('❌ Health check error:', error);
    }
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: State consistency verification
   */
  verifyStateConsistency() {
    if (!this.invoiceState) return;

    try {
      const currentState = this.invoiceState.getState();
      if (this.baselineEstablished && this.lastSavedState) {
        const currentHash = this.calculateStateHash(currentState);
        const savedHash = this.calculateStateHash(this.lastSavedState);

        // Verify hash consistency
        if (this.currentChangeHash !== savedHash) {
          console.warn('⚠️ Baseline hash inconsistency detected, recalculating');
          this.currentChangeHash = savedHash;
        }
      }
    } catch (error) {
      console.error('❌ State consistency check error:', error);
    }
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced state change handling
   */
  handleStateChange(state) {
    if (!state) return;

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Queue the change detection with error handling
    this.debounceTimer = setTimeout(() => {
      try {
        this.detectChanges(state);
      } catch (error) {
        console.error('❌ Error in debounced change detection:', error);
      }
    }, this.debounceDelay);

    // Backup state for crash recovery
    this.backupCurrentState(state);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced change detection
   */
  detectChanges(currentState) {
    // Guard against detecting changes before baseline is established
    if (!this.baselineEstablished) {
      console.log('🔧 PHASE 3 BASELINE: Skipping change detection - baseline not established');

      // If we have a pending baseline and invoice is loaded, try to establish it
      if (this.invoiceLoaded && this.pendingBaselineData) {
        console.log('🔧 PHASE 3 BASELINE: Attempting to establish pending baseline');
        this.markAsSaved();
      }

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

      // Log changes for debugging (but not too frequently)
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
   * 🔧 PHASE 3 STABILIZATION: Enhanced baseline establishment
   */
  markAsSaved() {
    // Track when markAsSaved is called for debugging
    const stackTrace = new Error().stack?.split('\n').slice(1, 4).join(' | ') || 'unknown';
    console.log(`🔍 TRACE: markAsSaved called from: ${stackTrace}`);

    const currentState = this.invoiceState.getState();

    // Enhanced state validation
    const stateValidation = this.validateStateForBaseline(currentState);
    if (!stateValidation.valid) {
      console.log(`🔧 PHASE 3 BASELINE: Deferring markAsSaved - ${stateValidation.reason}`);

      // Store pending baseline data for later processing
      this.pendingBaselineData = {
        state: currentState,
        timestamp: Date.now(),
        reason: stateValidation.reason
      };

      // Schedule a retry if appropriate
      this.scheduleBaselineRetry();
      return;
    }

    // Establish baseline with enhanced validation
    this.establishBaseline(currentState, stateValidation.metadata);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Comprehensive state validation
   */
  validateStateForBaseline(state) {
    try {
      // Check if invoice loading is complete
      if (!this.invoiceLoaded) {
        return { valid: false, reason: 'Invoice not fully loaded' };
      }

      // Validate state structure
      if (!state || typeof state !== 'object') {
        return { valid: false, reason: 'Invalid state structure' };
      }

      // Check for meaningful content
      const contentCheck = this.analyzeStateContent(state);
      if (!contentCheck.hasContent) {
        return { valid: false, reason: 'State appears empty or invalid' };
      }

      // Additional validation checks
      const validationChecks = {
        hasValidVessel: this.validateVesselData(state.vessel),
        hasValidCustomer: this.validateCustomerData(state.customer),
        hasValidScope: this.validateScopeData(state.scope)
      };

      // Require at least one valid section
      const validSections = Object.values(validationChecks).filter(Boolean).length;
      if (validSections === 0) {
        return { valid: false, reason: 'No valid sections found' };
      }

      return {
        valid: true,
        metadata: {
          contentAnalysis: contentCheck,
          validationChecks,
          validSections
        }
      };

    } catch (error) {
      console.error('❌ Error validating state for baseline:', error);
      return { valid: false, reason: `Validation error: ${error.message}` };
    }
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Content analysis
   */
  analyzeStateContent(state) {
    const vessel = state.vessel || {};
    const customer = state.customer || {};
    const scope = state.scope || {};

    // Vessel content checks
    const vesselContent = {
      hasName: !!(vessel.name || vessel.vesselName),
      hasType: !!vessel.type,
      hasLocation: !!vessel.location,
      hasSpecs: !!(vessel.length || vessel.beam || vessel.weight)
    };

    // Customer content checks
    const customerContent = {
      hasName: !!customer.customerName,
      hasContact: !!(customer.email || customer.phone),
      hasAddress: !!customer.address
    };

    // Scope content checks
    const scopeContent = {
      hasLineItems: !!(scope.lineItems && scope.lineItems.length > 0),
      hasValidItems: !!(scope.lineItems && scope.lineItems.some(item =>
        item.description && (item.amount || item.quantity)
      ))
    };

    const hasContent = (
      Object.values(vesselContent).some(Boolean) ||
      Object.values(customerContent).some(Boolean) ||
      Object.values(scopeContent).some(Boolean)
    );

    return {
      hasContent,
      vessel: vesselContent,
      customer: customerContent,
      scope: scopeContent,
      score: this.calculateContentScore(vesselContent, customerContent, scopeContent)
    };
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Content score calculation
   */
  calculateContentScore(vessel, customer, scope) {
    const vesselScore = Object.values(vessel).filter(Boolean).length / Object.keys(vessel).length;
    const customerScore = Object.values(customer).filter(Boolean).length / Object.keys(customer).length;
    const scopeScore = Object.values(scope).filter(Boolean).length / Object.keys(scope).length;

    return Math.round(((vesselScore + customerScore + scopeScore) / 3) * 100);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Vessel validation
   */
  validateVesselData(vessel) {
    if (!vessel) return false;
    return !!(vessel.name || vessel.vesselName);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Customer validation
   */
  validateCustomerData(customer) {
    if (!customer) return false;
    return !!customer.customerName;
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Scope validation
   */
  validateScopeData(scope) {
    if (!scope) return false;
    return !!(scope.lineItems && scope.lineItems.length > 0);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Establish baseline with logging
   */
  establishBaseline(state, metadata) {
    this.lastSavedState = this.normalizeStateForComparison(state);
    this.hasUnsavedChanges = false;
    this.currentChangeHash = this.calculateStateHash(state);
    this.baselineEstablished = true;

    // Clear pending data since baseline is now established
    this.pendingBaselineData = null;

    // Enhanced logging
    console.log('🔧 PHASE 3 BASELINE: Baseline established successfully');
    console.log(`  - Invoice ID: ${this.invoiceState.getCurrentInvoiceId()}`);
    console.log(`  - Baseline hash: ${this.currentChangeHash}`);
    console.log(`  - Content score: ${metadata.contentAnalysis.score}%`);
    console.log(`  - Valid sections: ${metadata.validSections}`);
    console.log(`  - Vessel: ${metadata.validationChecks.hasValidVessel ? '✅' : '❌'}`);
    console.log(`  - Customer: ${metadata.validationChecks.hasValidCustomer ? '✅' : '❌'}`);
    console.log(`  - Scope: ${metadata.validationChecks.hasValidScope ? '✅' : '❌'}`);

    // Clear session persistence
    this.clearUnsavedState();

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Schedule retry with backoff
   */
  scheduleBaselineRetry() {
    if (this.baselineRetryTimer) {
      clearTimeout(this.baselineRetryTimer);
    }

    this.baselineRetryAttempts = (this.baselineRetryAttempts || 0) + 1;
    const maxAttempts = 5;

    if (this.baselineRetryAttempts >= maxAttempts) {
      console.warn('⚠️ Max baseline retry attempts reached, stopping retries');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.baselineRetryAttempts - 1), 10000);
    console.log(`🔄 Scheduling baseline retry ${this.baselineRetryAttempts}/${maxAttempts} in ${delay}ms`);

    this.baselineRetryTimer = setTimeout(() => {
      if (this.pendingBaselineData && !this.baselineEstablished) {
        console.log('🔄 Retrying baseline establishment...');
        this.markAsSaved();
      }
    }, delay);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced invoice loading handler
   */
  onInvoiceLoaded() {
    console.log('🔧 PHASE 3 BASELINE: Invoice loading complete');
    this.invoiceLoaded = true;
    this.baselineRetryAttempts = 0;

    // Clear any pending retry timer
    if (this.baselineRetryTimer) {
      clearTimeout(this.baselineRetryTimer);
      this.baselineRetryTimer = null;
    }

    // Process pending baseline data if available
    if (this.pendingBaselineData) {
      console.log('🔧 PHASE 3 BASELINE: Processing deferred baseline establishment');

      const age = Date.now() - this.pendingBaselineData.timestamp;
      if (age < 30000) {
        console.log('🔧 PHASE 3 BASELINE: Pending data is fresh, establishing baseline');
        this.markAsSaved();
      } else {
        console.warn('⚠️ Pending baseline data is stale, discarding');
        this.pendingBaselineData = null;
      }
    } else {
      console.log('🔧 PHASE 3 BASELINE: No pending data, establishing baseline with current state');
      this.markAsSaved();
    }
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced reset
   */
  resetForNewInvoice() {
    console.log('🔧 PHASE 3 BASELINE: Resetting for new invoice');

    // Clear all state
    this.baselineEstablished = false;
    this.invoiceLoaded = false;
    this.lastSavedState = null;
    this.hasUnsavedChanges = false;
    this.currentChangeHash = null;
    this.pendingBaselineData = null;
    this.baselineRetryAttempts = 0;

    // Clear timers
    if (this.baselineRetryTimer) {
      clearTimeout(this.baselineRetryTimer);
      this.baselineRetryTimer = null;
    }

    // Clear session data
    this.clearUnsavedState();

    // Notify listeners of reset
    this.notifyListeners();

    console.log('✅ UnsavedChangesManager reset complete');
  }

  // Continue with existing methods but enhanced...
  calculateStateHash(state) {
    try {
      const normalized = this.normalizeStateForComparison(state);
      return this.simpleHash(JSON.stringify(normalized));
    } catch (error) {
      console.error('❌ Error calculating state hash:', error);
      return '';
    }
  }

  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  normalizeStateForComparison(state) {
    try {
      const normalized = JSON.parse(JSON.stringify(state || {}));
      return this.canonicalizeState(normalized);
    } catch (error) {
      console.error('❌ Error normalizing state:', error);
      return JSON.parse(JSON.stringify(state));
    }
  }

  canonicalizeState(state) {
    if (!state || typeof state !== 'object') return state;

    const canonical = {};
    const sortedKeys = Object.keys(state).sort();

    for (const key of sortedKeys) {
      const value = state[key];

      if (value === null || value === undefined) {
        canonical[key] = null;
      } else if (Array.isArray(value)) {
        canonical[key] = value.map(item => this.canonicalizeState(item));
      } else if (typeof value === 'object') {
        canonical[key] = this.canonicalizeState(value);
      } else if (typeof value === 'string') {
        canonical[key] = value.trim();
      } else if (typeof value === 'number') {
        canonical[key] = Math.round(value * 100) / 100;
      } else {
        canonical[key] = value;
      }
    }

    return canonical;
  }

  // Public API methods
  getHasUnsavedChanges() {
    return this.hasUnsavedChanges;
  }

  getChangesSummary() {
    if (!this.hasUnsavedChanges || !this.lastSavedState) {
      return { hasChanges: false, changes: [] };
    }

    const currentState = this.invoiceState.getState();
    const changes = [];

    try {
      if (this.hasVesselChanges(currentState)) changes.push('Vessel details');
      if (this.hasCustomerChanges(currentState)) changes.push('Customer information');
      if (this.hasScopeChanges(currentState)) changes.push('Services and line items');
      if (this.hasNotesChanges(currentState)) changes.push('Notes and comments');

      return { hasChanges: changes.length > 0, changes };
    } catch (error) {
      console.error('❌ Error generating changes summary:', error);
      return { hasChanges: this.hasUnsavedChanges, changes: ['Unknown changes'] };
    }
  }

  // Change detection helpers
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

  hasScopeChanges(currentState) {
    const current = currentState.scope || {};
    const saved = this.lastSavedState.scope || {};

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

  hasNotesChanges(currentState) {
    const current = currentState.notes || {};
    const saved = this.lastSavedState.notes || {};

    return (
      current.workNotes !== saved.workNotes ||
      current.internalNotes !== saved.internalNotes
    );
  }

  // Session management
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
        this.clearUnsavedState();
      }
    } catch (error) {
      console.error('❌ Error persisting unsaved state:', error);
    }
  }

  restoreUnsavedState() {
    try {
      const stored = sessionStorage.getItem(this.sessionKey);
      if (stored) {
        const unsavedData = JSON.parse(stored);
        console.log('🔄 Restored unsaved changes from session:', unsavedData.timestamp);

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

  clearUnsavedState() {
    try {
      sessionStorage.removeItem(this.sessionKey);
      sessionStorage.removeItem(this.backupKey);
    } catch (error) {
      console.error('❌ Error clearing unsaved state:', error);
    }
  }

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

  // Listener management
  addListener(callback) {
    if (typeof callback === 'function' && this.listeners.length < this.maxListeners) {
      this.listeners.push(callback);
    } else if (this.listeners.length >= this.maxListeners) {
      console.warn('⚠️ Maximum listeners reached, rejecting new listener');
    }
  }

  subscribe(callback) {
    this.addListener(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

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

  // Debug and utility
  forceChangeDetection() {
    console.log('🔄 Forcing change detection...');
    const currentState = this.invoiceState.getState();
    this.detectChanges(currentState);
  }

  getDebugInfo() {
    return {
      // Core state
      hasUnsavedChanges: this.hasUnsavedChanges,
      baselineEstablished: this.baselineEstablished,
      invoiceLoaded: this.invoiceLoaded,

      // Hash information
      currentChangeHash: this.currentChangeHash,
      lastSavedStateExists: !!this.lastSavedState,

      // Listener information
      listenersCount: this.listeners.length,
      isProcessingEvents: this.isProcessingEvents,

      // Pending operations
      pendingBaseline: !!this.pendingBaselineData,
      pendingBaselineAge: this.pendingBaselineData ?
        Date.now() - this.pendingBaselineData.timestamp : null,
      baselineRetryAttempts: this.baselineRetryAttempts || 0,
      hasRetryTimer: !!this.baselineRetryTimer,

      // Timer status
      hasDebounceTimer: !!this.debounceTimer,
      lastHealthCheck: this.lastHealthCheck,

      // Content analysis if available
      contentAnalysis: this.lastSavedState ?
        this.analyzeStateContent(this.lastSavedState) : null
    };
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced cleanup
   */
  destroy() {
    console.log('🧹 Destroying Enhanced UnsavedChangesManager...');

    // Clear all timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.baselineRetryTimer) {
      clearTimeout(this.baselineRetryTimer);
      this.baselineRetryTimer = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear state
    this.baselineEstablished = false;
    this.invoiceLoaded = false;
    this.hasUnsavedChanges = false;
    this.lastSavedState = null;
    this.currentChangeHash = null;
    this.pendingBaselineData = null;
    this.baselineRetryAttempts = 0;

    // Clear listeners
    this.listeners = [];
    this.eventQueue.clear();

    // Clear session data
    this.clearUnsavedState();

    // Clear references
    this.invoiceState = null;
    this.invoiceStorage = null;

    console.log('✅ Enhanced UnsavedChangesManager destroyed completely');
  }
}