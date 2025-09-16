import { TaxCalculator, TaxValidator } from '../utils/taxCalculator.js';
import { MarkupValidator } from '../utils/markupValidator.js';

export class InvoiceState {
  constructor() {
    this.state = {
      vessel: {
        name: '',
        weight: '',
        beam: ''
      },
      customer: {
        customerName: '',
        customerEmail: '',
        customerPhone: ''
      },
      scope: {
        markupRate: '2.5',
        isTaxable: false,
        lineItems: []
      },
      // ✅ FIX: Add compatibility layer for legacy code that expects services.lineItems
      services: {
        lineItems: []
      },
      notes: {
        comments: []
      }
    };

    this.listeners = [];
    this.lineItemIdCounter = 0;
    this.currentInvoiceId = null; // Track invoice ID for edit mode
    this.isEditMode = false; // Track whether we're editing existing invoice

    // ✅ FIX: Prevent concurrent addLineItem operations
    this.isAddingLineItem = false;

    // Batched notification system to prevent UI freezes
    this.notificationQueue = new Set();
    this.isNotificationScheduled = false;

    // ✅ FIX: Initialize state normalization
    this.normalizeState();

    // Unsaved changes manager (will be set by app)
    this.unsavedChangesManager = null;
  }

  /**
   * ✅ FIX: Normalize state to ensure both services.lineItems and scope.lineItems exist
   * This provides backward compatibility for any legacy code that expects services.lineItems
   */
  normalizeState() {
    try {
      // Ensure services object exists
      if (!this.state.services) {
        this.state.services = { lineItems: [] };
      }

      // Ensure services.lineItems is an array
      if (!Array.isArray(this.state.services.lineItems)) {
        this.state.services.lineItems = [];
      }

      // Ensure scope object exists
      if (!this.state.scope) {
        this.state.scope = { markupRate: '2.5', isTaxable: false, lineItems: [] };
      }

      // Ensure scope.lineItems is an array
      if (!Array.isArray(this.state.scope.lineItems)) {
        this.state.scope.lineItems = [];
      }

      // ✅ CRITICAL: Keep services.lineItems synchronized with scope.lineItems
      // The primary source of truth remains scope.lineItems
      this.state.services.lineItems = this.state.scope.lineItems;

      console.log('✅ State normalized - services.lineItems synchronized with scope.lineItems');
    } catch (error) {
      console.error('❌ State normalization error:', error);
      // Fallback initialization
      this.state.services = { lineItems: [] };
      this.state.scope = { markupRate: '2.5', isTaxable: false, lineItems: [] };
    }
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      console.warn('⚠️ Invalid listener: must be a function');
      return () => {};
    }

    this.listeners.push(listener);
    console.log(`📈 Subscribed listener. Total listeners: ${this.listeners.length}`);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
      console.log(`📉 Unsubscribed listener. Total listeners: ${this.listeners.length}`);
    };
  }

  notify() {
    // ✅ FIX: Ensure state is normalized before notification
    this.normalizeState();

    // ✅ CRITICAL FIX: Deep clone state to prevent reference corruption
    try {
      const stateSnapshot = JSON.parse(JSON.stringify(this.state));
      this.notificationQueue.add(stateSnapshot);
    } catch (error) {
      console.error('❌ State serialization error during notify:', error);
      // Fallback to direct notification with original state
      this.notificationQueue.add(this.state);
    }

    // Schedule batch processing if not already scheduled
    if (!this.isNotificationScheduled) {
      this.isNotificationScheduled = true;

      // Use requestAnimationFrame for optimal DOM update timing
      requestAnimationFrame(() => {
        this.flushNotifications();
      });
    }
  }

  flushNotifications() {
    if (this.notificationQueue.size === 0) {
      this.isNotificationScheduled = false;
      return;
    }

    console.log(`🔔 Batched notification: ${this.notificationQueue.size} state changes queued`);
    console.log(`📊 Listeners count: ${this.listeners.length}`);

    // ✅ FIX: Get the latest state snapshot (now immutable)
    const latestState = Array.from(this.notificationQueue).pop();

    // ✅ FIX: Error-wrapped listener calls to prevent corruption propagation
    this.listeners.forEach((listener, index) => {
      try {
        console.log(`  - Calling listener ${index} with batched update`);
        listener(latestState); // Now safe from corruption
      } catch (error) {
        console.error(`❌ Listener ${index} error:`, error);
        // Continue processing other listeners
      }
    });

    // Clear the queue and reset scheduling flag
    this.notificationQueue.clear();
    this.isNotificationScheduled = false;
  }

  updateVessel(updates) {
    console.log('🚢 Updating vessel state:', updates);
    const oldVessel = { ...this.state.vessel };
    this.state.vessel = { ...this.state.vessel, ...updates };
    console.log('  - Old vessel:', oldVessel);
    console.log('  - New vessel:', this.state.vessel);
    this.notify();
  }

  updateCustomer(updates) {
    console.log('👤 Updating customer state:', updates);
    const oldCustomer = { ...this.state.customer };
    this.state.customer = { ...this.state.customer, ...updates };
    console.log('  - Old customer:', oldCustomer);
    console.log('  - New customer:', this.state.customer);
    this.notify();
  }

  updateScope(updates) {
    console.log('📋 Updating scope state:', updates);
    const oldScope = { ...this.state.scope };
    this.state.scope = { ...this.state.scope, ...updates };
    console.log('  - Old scope:', oldScope);
    console.log('  - New scope:', this.state.scope);

    // Recalculate all taxes if markup rate changed
    if ('markupRate' in updates && updates.markupRate !== oldScope.markupRate) {
      console.log('💰 Markup rate changed, recalculating all taxes');
      this.recalculateAllTaxes();
    } else {
      this.notify();
    }
  }

  updateNotes(updates) {
    console.log('📝 Updating notes state:', updates);
    const oldNotes = { ...this.state.notes };
    this.state.notes = { ...this.state.notes, ...updates };
    console.log('  - Old notes:', oldNotes);
    console.log('  - New notes:', this.state.notes);
    this.notify();
  }

  addLineItem(lineItem = {}) {
    // ✅ FIX: Prevent concurrent addLineItem operations
    if (this.isAddingLineItem) {
      console.warn('⚠️ addLineItem operation already in progress, ignoring duplicate call');
      return null;
    }

    this.isAddingLineItem = true;

    try {
      console.log('🔍 Starting addLineItem operation...');

      const defaultTaxConfig = TaxCalculator.getDefaultTaxConfig(lineItem.jobType);
      const defaultMarkupConfig = this.getDefaultMarkupConfig(lineItem.jobType);

      // ✅ FIX: Enhanced atomic ID generation to prevent conflicts
      const currentTimestamp = Date.now();
      let newItemId = this.lineItemIdCounter++;

      // ✅ FIX: Add uniqueness validation
      const existingIds = this.state.scope.lineItems ? this.state.scope.lineItems.map(item => item.id) : [];
      if (existingIds.includes(newItemId)) {
        console.error(`❌ ID collision detected: ${newItemId} already exists`);
        // Recovery: find the next safe ID
        while (existingIds.includes(this.lineItemIdCounter)) {
          this.lineItemIdCounter++;
        }
        newItemId = this.lineItemIdCounter++;
        console.log(`🔧 Using safe ID: ${newItemId}`);
      }

      const newItem = {
        id: newItemId,
        jobType: '',
        itemType: '',
        manualCost: '',
        laborHours: '',
        otHours: '',
        description: '',
        createdAt: currentTimestamp, // Add timestamp for debugging
        ...defaultTaxConfig,
        ...defaultMarkupConfig,
        ...lineItem
      };

      // Calculate initial tax amount using per-line markup
      newItem.taxAmount = TaxCalculator.calculateLineTax(newItem, newItem.markupRate);

      // ✅ FIX: Validate state integrity before adding
      if (!Array.isArray(this.state.scope.lineItems)) {
        console.warn('⚠️ LineItems array corrupted, reinitializing');
        this.state.scope.lineItems = [];
      }

      // ✅ FIX: Atomic state update with validation
      const beforeCount = this.state.scope.lineItems.length;
      this.state.scope.lineItems.push(newItem);
      const afterCount = this.state.scope.lineItems.length;

      // Verify the addition was successful
      if (afterCount !== beforeCount + 1) {
        console.error(`❌ State corruption detected: expected ${beforeCount + 1}, got ${afterCount}`);
        throw new Error('Line item addition failed: state corruption');
      }

      console.log(`✅ Added line item with ID: ${newItemId} (${beforeCount} → ${afterCount})`, newItem);

      // ✅ FIX: Synchronize services.lineItems after adding to scope.lineItems
      this.normalizeState();

      this.notify();
      return newItemId;

    } catch (error) {
      console.error('❌ Error in addLineItem:', error);
      throw error;
    } finally {
      // ✅ FIX: Always release the lock
      this.isAddingLineItem = false;
    }
  }

  /**
   * Get default markup configuration for new line items
   * @param {string} jobType - Job type for context-specific defaults
   * @returns {Object} Default markup configuration
   */
  getDefaultMarkupConfig(jobType = null) {
    // Check if this job type should be markup exempt
    if (jobType === 'Agent Services' ||
        (jobType === 'Manual Entry') || // Will be refined based on itemType
        jobType === 'Clearance Fee') {
      return {
        markupType: 'exempt',
        markupRate: '0',
        isMarkupExempt: true
      };
    }

    // Default to current global markup rate for backward compatibility
    return {
      markupType: 'preset',
      markupRate: this.state.scope.markupRate || '2.5',
      isMarkupExempt: false
    };
  }

  updateLineItem(id, updates) {
    const index = this.state.scope.lineItems.findIndex(item => item.id === id);
    if (index !== -1) {
      try {
        // Validate tax-related updates
        if ('taxRate' in updates) {
          TaxValidator.validateTaxRate(updates.taxRate);
        }

        if ('taxStatus' in updates) {
          if (!TaxValidator.validateTaxStatus(updates.taxStatus)) {
            console.warn('Invalid tax status:', updates.taxStatus);
            updates.taxStatus = 'taxable'; // Default to safe value
          }
        }

        // Validate markup-related updates
        if ('markupRate' in updates && updates.markupType === 'custom') {
          const validation = MarkupValidator.validateCustomMarkup(updates.markupRate);
          if (!validation.isValid) {
            throw new Error(`Invalid markup rate: ${validation.errors.join(', ')}`);
          }
          updates.markupRate = String(validation.sanitizedValue);
        }

        // Handle markup exemption logic for specific job types
        if ('jobType' in updates || 'itemType' in updates) {
          const item = this.state.scope.lineItems[index];
          const newJobType = updates.jobType || item.jobType;
          const newItemType = updates.itemType || item.itemType;

          // Auto-exempt certain combinations
          if (newJobType === 'Agent Services' ||
              newJobType === 'Clearance Fee' ||
              (newJobType === 'Manual Entry' && newItemType === 'Labor')) {
            updates.isMarkupExempt = true;
            updates.markupType = 'exempt';
            updates.markupRate = '0';
          }
        }

        // ✅ FIX: Safer state update with validation
        const currentItem = this.state.scope.lineItems[index];
        if (!currentItem) {
          console.error('❌ Line item disappeared during update:', id);
          return;
        }

        // Apply updates
        this.state.scope.lineItems[index] = {
          ...currentItem,
          ...updates
        };

        // Recalculate tax if tax-related fields or cost fields changed
        if ('taxStatus' in updates || 'taxRate' in updates ||
            'manualCost' in updates || 'laborHours' in updates || 'otHours' in updates ||
            'markupRate' in updates || 'markupType' in updates || 'isMarkupExempt' in updates) {
          this.recalculateLineTax(id);
        }

        // ✅ FIX: Synchronize services.lineItems after updating scope.lineItems
        this.normalizeState();

        this.notify();
      } catch (error) {
        console.error('Error updating line item:', error);
        // Revert to safe defaults for tax fields
        if ('taxRate' in updates) {
          updates.taxRate = 0.0875; // Default to standard rate
        }
        if ('taxStatus' in updates) {
          updates.taxStatus = 'taxable'; // Default to taxable
        }
        // Revert to safe defaults for markup fields
        if ('markupRate' in updates) {
          updates.markupRate = '2.5'; // Default to standard rate
          updates.markupType = 'preset';
        }

        // Apply safe updates
        this.state.scope.lineItems[index] = {
          ...this.state.scope.lineItems[index],
          ...updates
        };
        this.recalculateLineTax(id);

        // ✅ FIX: Synchronize services.lineItems after error recovery
        this.normalizeState();

        this.notify();

        // Re-throw for UI error handling
        throw error;
      }
    } else {
      console.warn(`⚠️ Attempted to update non-existent line item with ID: ${id}`);
    }
  }

  removeLineItem(id) {
    const initialLength = this.state.scope.lineItems.length;
    this.state.scope.lineItems = this.state.scope.lineItems.filter(
      item => item.id !== id
    );

    const removedCount = initialLength - this.state.scope.lineItems.length;
    console.log(`🗑️ Removed ${removedCount} line item(s) with ID: ${id}`);

    // ✅ FIX: Synchronize services.lineItems after removing from scope.lineItems
    this.normalizeState();

    this.notify();
  }

  /**
   * Recalculate tax amount for a specific line item
   * @param {number} id - Line item ID
   */
  recalculateLineTax(id) {
    const item = this.state.scope.lineItems.find(item => item.id === id);
    if (item) {
      // Use per-line markup rate for tax calculation
      item.taxAmount = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
      console.log(`💰 Recalculated tax for item ${id}: ${item.taxAmount} (markup: ${item.markupRate}%)`);
    }
  }

  /**
   * Recalculate tax amounts for all line items
   * (useful when markup rate changes)
   */
  recalculateAllTaxes() {
    console.log('💰 Recalculating taxes for all line items...');
    this.state.scope.lineItems.forEach(item => {
      // Use per-line markup rate for tax calculation
      item.taxAmount = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
    });
    this.notify();
  }

  /**
   * Get total tax amount for all line items
   * @returns {number} Total tax amount
   */
  getTotalTax() {
    return TaxCalculator.calculateTotalTax(this.state.scope.lineItems, this.state.scope.markupRate);
  }

  /**
   * Migrate legacy invoice data to include per-line tax configuration
   */
  migrateLegacyTaxData() {
    console.log('🔄 Migrating legacy tax data...');
    const scopeIsTaxable = this.state.scope.isTaxable;

    this.state.scope.lineItems = this.state.scope.lineItems.map(item => {
      return TaxCalculator.migrateLineItemTax(item, scopeIsTaxable);
    });

    // Recalculate all tax amounts after migration
    this.recalculateAllTaxes();
    console.log('✅ Legacy tax data migration complete');
  }

  /**
   * Set the current invoice ID for edit mode
   * @param {string} invoiceId - The invoice ID being edited
   */
  setCurrentInvoiceId(invoiceId) {
    console.log('📝 Setting current invoice ID for edit mode:', invoiceId);
    this.currentInvoiceId = invoiceId;
    this.isEditMode = !!invoiceId;
    console.log(`  - Edit mode: ${this.isEditMode}`);

    // Persist edit state across page reloads
    if (invoiceId) {
      sessionStorage.setItem('marine_invoice_edit_id', invoiceId);
      sessionStorage.setItem('marine_invoice_edit_timestamp', Date.now().toString());
    } else {
      sessionStorage.removeItem('marine_invoice_edit_id');
      sessionStorage.removeItem('marine_invoice_edit_timestamp');
    }

    // Update UI to reflect edit mode
    this.updateEditModeUI();
  }

  /**
   * Get the current invoice ID
   * @returns {string|null} Current invoice ID or null if creating new
   */
  getCurrentInvoiceId() {
    return this.currentInvoiceId;
  }

  /**
   * Check if currently in edit mode
   * @returns {boolean} True if editing existing invoice
   */
  getIsEditMode() {
    return this.isEditMode;
  }

  /**
   * Load existing invoice data into state for editing
   * @param {Object} invoiceData - The invoice data to load
   * @param {string} invoiceId - The invoice ID
   */
  loadInvoiceForEditing(invoiceData, invoiceId) {
    console.log('📂 Loading invoice for editing:', { invoiceId, data: invoiceData });

    // Set edit mode
    this.setCurrentInvoiceId(invoiceId);

    // Load the invoice data into state
    if (invoiceData.vessel) {
      this.state.vessel = { ...this.state.vessel, ...invoiceData.vessel };
    }

    if (invoiceData.customer) {
      this.state.customer = { ...this.state.customer, ...invoiceData.customer };
    }

    if (invoiceData.scope) {
      this.state.scope = { ...this.state.scope, ...invoiceData.scope };

      // Set line item ID counter to avoid ID conflicts
      if (invoiceData.scope.lineItems && invoiceData.scope.lineItems.length > 0) {
        const maxId = Math.max(...invoiceData.scope.lineItems.map(item => item.id || 0));
        this.lineItemIdCounter = maxId + 1;
      }
    }

    if (invoiceData.notes) {
      this.state.notes = { ...this.state.notes, ...invoiceData.notes };
    }

    // Migrate legacy tax data if needed
    this.migrateLegacyTaxData();

    // ✅ FIX: Normalize state after loading invoice (ensures services.lineItems exists)
    this.normalizeState();

    console.log('✅ Invoice loaded for editing. Current state:', this.state);
    this.notify();
  }

  /**
   * Clear edit mode and return to create mode
   */
  clearEditMode() {
    console.log('🆕 Clearing edit mode, returning to create mode');
    this.currentInvoiceId = null;
    this.isEditMode = false;

    // Clear session storage
    sessionStorage.removeItem('marine_invoice_edit_id');
    sessionStorage.removeItem('marine_invoice_edit_timestamp');

    // Update UI to reflect create mode
    this.updateEditModeUI();
  }

  /**
   * Restore edit state from session storage (called on app initialization)
   * @returns {string|null} Restored invoice ID or null if none found
   */
  restoreEditState() {
    const storedEditId = sessionStorage.getItem('marine_invoice_edit_id');
    const storedTimestamp = sessionStorage.getItem('marine_invoice_edit_timestamp');

    if (storedEditId && storedTimestamp) {
      // Check if the edit session is still valid (within 24 hours)
      const sessionAge = Date.now() - parseInt(storedTimestamp);
      const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge < maxSessionAge) {
        console.log('🔄 Restoring edit state for invoice:', storedEditId);
        this.currentInvoiceId = storedEditId;
        this.isEditMode = true;
        this.updateEditModeUI();
        return storedEditId;
      } else {
        console.log('⚠️ Edit session expired, clearing stored state');
        this.clearEditMode();
      }
    }

    return null;
  }

  /**
   * Update UI elements to reflect current edit mode
   */
  updateEditModeUI() {
    // Update save button text
    const saveBtn = document.getElementById('save-invoice');
    if (saveBtn) {
      if (this.isEditMode) {
        saveBtn.textContent = 'Update Invoice';
        saveBtn.title = 'Update existing invoice';
        saveBtn.classList.add('edit-mode');
      } else {
        saveBtn.textContent = 'Save Invoice';
        saveBtn.title = 'Save new invoice';
        saveBtn.classList.remove('edit-mode');
      }
    }

    // Update or create edit mode indicator
    this.updateEditModeIndicator();

    // Update page title if needed
    this.updatePageTitle();
  }

  /**
   * Update edit mode state (banner removed, preserving business logic)
   */
  updateEditModeIndicator() {
    const existingIndicator = document.querySelector('.edit-mode-indicator');

    // Remove any existing indicator (banner functionality removed)
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Note: isEditMode state is preserved for save/update business logic
    // The save button text and behavior are still controlled by isEditMode
    // Only the visual banner has been removed per requirements
  }

  /**
   * Update page title to reflect edit mode
   */
  updatePageTitle() {
    const originalTitle = 'Marine Group - Invoice Generator';

    if (this.isEditMode) {
      document.title = '✏️ Editing Invoice - Marine Group';
    } else {
      document.title = originalTitle;
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = {
      vessel: {
        name: '',
        weight: '',
        beam: ''
      },
      customer: {
        customerName: '',
        customerEmail: '',
        customerPhone: ''
      },
      scope: {
        markupRate: '2.5',
        isTaxable: false,
        lineItems: []
      },
      // ✅ FIX: Include services object in reset
      services: {
        lineItems: []
      },
      notes: {
        comments: []
      }
    };
    this.lineItemIdCounter = 0;
    this.clearEditMode(); // Clear edit mode when resetting

    // ✅ FIX: Normalize state after reset
    this.normalizeState();

    this.notify();
  }

  /**
   * Set up unsaved changes manager
   * @param {Object} unsavedChangesManager - UnsavedChangesManager instance
   */
  setUnsavedChangesManager(unsavedChangesManager) {
    this.unsavedChangesManager = unsavedChangesManager;
    console.log('✅ UnsavedChangesManager integrated with InvoiceState');
  }

  /**
   * Mark the current state as saved (integrates with unsaved changes manager)
   */
  markAsSaved() {
    if (this.unsavedChangesManager) {
      this.unsavedChangesManager.markAsSaved();
    }
  }

  /**
   * Check if there are unsaved changes (integrates with unsaved changes manager)
   * @returns {boolean} True if there are unsaved changes
   */
  hasUnsavedChanges() {
    if (this.unsavedChangesManager) {
      return this.unsavedChangesManager.getHasUnsavedChanges();
    }
    return false;
  }

  /**
   * Get a summary of unsaved changes
   * @returns {Object} Changes summary
   */
  getUnsavedChangesSummary() {
    if (this.unsavedChangesManager) {
      return this.unsavedChangesManager.getChangesSummary();
    }
    return { hasChanges: false, changes: [] };
  }

  /**
   * Clean up all listeners and pending notifications to prevent memory leaks
   * Call this when the InvoiceState instance is no longer needed
   */
  cleanup() {
    console.log('🧹 Cleaning up InvoiceState: removing all listeners and clearing queue');

    // Clean up unsaved changes manager
    if (this.unsavedChangesManager) {
      this.unsavedChangesManager.cleanup();
      this.unsavedChangesManager = null;
    }

    // Clear all listeners
    const listenerCount = this.listeners.length;
    this.listeners = [];
    console.log(`📉 Removed ${listenerCount} listeners`);

    // Clear notification queue
    const queueSize = this.notificationQueue.size;
    this.notificationQueue.clear();
    this.isNotificationScheduled = false;
    console.log(`🗑️ Cleared ${queueSize} queued notifications`);

    // Clear session storage
    sessionStorage.removeItem('marine_invoice_edit_id');
    sessionStorage.removeItem('marine_invoice_edit_timestamp');

    console.log('✅ InvoiceState cleanup complete');
  }
}