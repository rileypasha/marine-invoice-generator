/**
 * Compatibility wrapper for InvoiceState that uses React Context under the hood
 * This allows legacy components to continue using the InvoiceState API while
 * benefiting from React Context for state management
 */

import { TaxCalculator, TaxValidator } from '../../js/utils/taxCalculator.js';
import { MarkupValidator } from '../../js/utils/markupValidator.js';

export class InvoiceStateCompat {
  constructor(reactStateRef, reactActionsRef) {
    this.reactStateRef = reactStateRef;
    this.reactActionsRef = reactActionsRef;
    this.listeners = [];
    this.unsavedChangesManager = null;

    // Initialize listener system for backwards compatibility
    this.initListenerSystem();

    console.log('✅ InvoiceStateCompat initialized with React Context backend');
  }

  initListenerSystem() {
    // Subscribe to React Context changes and notify legacy listeners
    this.unsubscribe = this.reactActionsRef.current.subscribe((newState) => {
      this.notifyListeners(newState);
    });
  }

  notifyListeners(state) {
    this.listeners.forEach((listener, index) => {
      try {
        listener(state);
      } catch (error) {
        console.error(`❌ Listener ${index} error:`, error);
      }
    });
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
    // Notification is handled automatically by React Context
    // This method exists for API compatibility
  }

  updateVessel(updates) {
    this.reactActionsRef.current.updateVessel(updates);
  }

  updateCustomer(updates) {
    this.reactActionsRef.current.updateCustomer(updates);
  }

  updateScope(updates) {
    this.reactActionsRef.current.updateScope(updates);
  }

  updateNotes(updates) {
    this.reactActionsRef.current.updateNotes(updates);
  }

  addLineItem(lineItem = {}) {
    return this.reactActionsRef.current.addLineItem(lineItem);
  }

  updateLineItem(id, updates) {
    this.reactActionsRef.current.updateLineItem(id, updates);
  }

  removeLineItem(id) {
    this.reactActionsRef.current.removeLineItem(id);
  }

  recalculateLineTax(id) {
    const state = this.reactStateRef.current;
    const item = state.scope.lineItems.find(item => item.id === id);
    if (item) {
      const taxAmount = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
      this.reactActionsRef.current.updateLineItem(id, { taxAmount });
      console.log(`💰 Recalculated tax for item ${id}: ${taxAmount} (markup: ${item.markupRate}%)`);
    }
  }

  recalculateAllTaxes() {
    this.reactActionsRef.current.recalculateAllTaxes();
  }

  getTotalTax() {
    return this.reactActionsRef.current.getTotalTax();
  }

  setCurrentInvoiceId(invoiceId) {
    this.reactActionsRef.current.setCurrentInvoiceId(invoiceId);
    this.updateEditModeUI();
  }

  getCurrentInvoiceId() {
    return this.reactActionsRef.current.getCurrentInvoiceId();
  }

  getIsEditMode() {
    return this.reactActionsRef.current.getIsEditMode();
  }

  loadInvoiceForEditing(invoiceData, invoiceId) {
    this.reactActionsRef.current.loadInvoiceForEditing(invoiceData, invoiceId);
    this.updateEditModeUI();
  }

  clearEditMode() {
    this.reactActionsRef.current.clearEditMode();
    this.updateEditModeUI();
  }

  restoreEditState() {
    const storedEditId = sessionStorage.getItem('marine_invoice_edit_id');
    const storedTimestamp = sessionStorage.getItem('marine_invoice_edit_timestamp');

    if (storedEditId && storedTimestamp) {
      const sessionAge = Date.now() - parseInt(storedTimestamp);
      const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge < maxSessionAge) {
        console.log('🔄 Restoring edit state for invoice:', storedEditId);
        this.reactActionsRef.current.setCurrentInvoiceId(storedEditId);
        this.updateEditModeUI();
        return storedEditId;
      } else {
        console.log('⚠️ Edit session expired, clearing stored state');
        this.clearEditMode();
      }
    }

    return null;
  }

  updateEditModeUI() {
    const isEditMode = this.getIsEditMode();

    // Update save button text
    const saveBtn = document.getElementById('save-invoice');
    if (saveBtn) {
      if (isEditMode) {
        saveBtn.textContent = 'Update Invoice';
        saveBtn.title = 'Update existing invoice';
        saveBtn.classList.add('edit-mode');
      } else {
        saveBtn.textContent = 'Save Invoice';
        saveBtn.title = 'Save new invoice';
        saveBtn.classList.remove('edit-mode');
      }
    }

    // Update page title
    this.updatePageTitle();
  }

  updatePageTitle() {
    const originalTitle = 'Marine Group - Invoice Generator';
    const isEditMode = this.getIsEditMode();

    if (isEditMode) {
      document.title = '✏️ Editing Invoice - Marine Group';
    } else {
      document.title = originalTitle;
    }
  }

  getState() {
    return this.reactStateRef.current;
  }

  reset() {
    this.reactActionsRef.current.reset();
  }

  // Legacy tax migration methods
  migrateLegacyTaxData() {
    console.log('🔄 Migrating legacy tax data...');
    const state = this.reactStateRef.current;
    const scopeIsTaxable = state.scope.isTaxable;

    state.scope.lineItems.forEach(item => {
      const migratedItem = TaxCalculator.migrateLineItemTax(item, scopeIsTaxable);
      if (JSON.stringify(migratedItem) !== JSON.stringify(item)) {
        this.reactActionsRef.current.updateLineItem(item.id, migratedItem);
      }
    });

    this.recalculateAllTaxes();
    console.log('✅ Legacy tax data migration complete');
  }

  // Default markup configuration
  getDefaultMarkupConfig(jobType = null) {
    const state = this.reactStateRef.current;
    if (jobType === 'Agent Services' ||
        (jobType === 'Manual Entry') ||
        jobType === 'Clearance Fee') {
      return {
        markupType: 'exempt',
        markupRate: '0',
        isMarkupExempt: true
      };
    }

    return {
      markupType: 'preset',
      markupRate: state.scope.markupRate || '2.5',
      isMarkupExempt: false
    };
  }

  // Unsaved changes integration
  setUnsavedChangesManager(unsavedChangesManager) {
    this.unsavedChangesManager = unsavedChangesManager;
    console.log('✅ UnsavedChangesManager integrated with InvoiceStateCompat');
  }

  markAsSaved() {
    this.reactActionsRef.current.markAsSaved();
    if (this.unsavedChangesManager) {
      this.unsavedChangesManager.markAsSaved();
    }
  }

  hasUnsavedChanges() {
    if (this.unsavedChangesManager) {
      return this.unsavedChangesManager.getHasUnsavedChanges();
    }
    return this.reactActionsRef.current.hasUnsavedChanges();
  }

  getUnsavedChangesSummary() {
    if (this.unsavedChangesManager) {
      return this.unsavedChangesManager.getChangesSummary();
    }
    return { hasChanges: this.hasUnsavedChanges(), changes: [] };
  }

  cleanup() {
    console.log('🧹 Cleaning up InvoiceStateCompat: removing all listeners');

    // Clean up unsaved changes manager
    if (this.unsavedChangesManager) {
      this.unsavedChangesManager.cleanup();
      this.unsavedChangesManager = null;
    }

    // Clean up listeners
    const listenerCount = this.listeners.length;
    this.listeners = [];
    console.log(`📉 Removed ${listenerCount} listeners`);

    // Unsubscribe from React Context
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    // Clear session storage
    sessionStorage.removeItem('marine_invoice_edit_id');
    sessionStorage.removeItem('marine_invoice_edit_timestamp');

    console.log('✅ InvoiceStateCompat cleanup complete');
  }

  // State normalization for backwards compatibility
  normalizeState() {
    // This is handled automatically by React Context reducer
    // Method exists for API compatibility
  }
}