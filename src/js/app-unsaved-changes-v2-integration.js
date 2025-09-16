/**
 * App.js Integration Changes for UnsavedChangesManagerV2
 *
 * This file contains the necessary changes to integrate the new canonical
 * dirty state management system. Replace the existing methods in app.js.
 *
 * Key Changes:
 * 1. Import UnsavedChangesManagerV2 instead of UnsavedChangesManager
 * 2. Use single-point baseline establishment
 * 3. Remove competing setTimeout calls
 * 4. Proper sequencing for load → normalize → baseline flow
 */

import { UnsavedChangesManagerV2 } from './utils/UnsavedChangesManagerV2.js';
import { updateToServerFixed, validateUpdatePayload, retryFailedSavesFixed } from './storage/InvoiceStorageFixed.js';

/**
 * REPLACE: initUnsavedChangesSystem method in InvoiceApp
 */
export function initUnsavedChangesSystemFixed() {
  console.log('🛡️ Initializing FIXED unsaved changes warning system...');

  try {
    // Create unsaved changes dialog
    this.unsavedChangesDialog = new UnsavedChangesDialog();

    // FIXED: Create V2 unsaved changes manager with canonical state comparison
    this.unsavedChangesManager = new UnsavedChangesManagerV2(this.state, this.invoiceStorage);

    // Create navigation protection
    this.navigationProtection = new NavigationProtection(this.unsavedChangesManager, this.unsavedChangesDialog);

    // Integrate with InvoiceState
    this.state.setUnsavedChangesManager(this.unsavedChangesManager);

    // Integrate with UserManager for logout protection
    this.userManager.setUnsavedChangesIntegration(this.unsavedChangesManager, this.unsavedChangesDialog);

    // Subscribe to unsaved changes for UI updates
    this.unsavedChangesManager.subscribe((changeData) => {
      this.updateUnsavedChangesUI(changeData);
    });

    // FIXED: Bind the updated smart-save methods to InvoiceStorage
    this.invoiceStorage.updateToServerFixed = updateToServerFixed.bind(this.invoiceStorage);
    this.invoiceStorage.validateUpdatePayload = validateUpdatePayload.bind(this.invoiceStorage);
    this.invoiceStorage.retryFailedSavesFixed = retryFailedSavesFixed.bind(this.invoiceStorage);

    console.log('✅ FIXED unsaved changes warning system initialized');
  } catch (error) {
    console.error('❌ Error initializing FIXED unsaved changes system:', error);
  }
}

/**
 * REPLACE: restoreEditSession method in InvoiceApp
 */
export async function restoreEditSessionFixed() {
  console.log('🔄 FIXED: Checking for previous edit session...');

  // First restore the edit state from session storage
  const restoredInvoiceId = this.state.restoreEditState();
  if (restoredInvoiceId) {
    console.log('📂 FIXED: Found previous edit session, attempting to restore invoice:', restoredInvoiceId);

    try {
      // Load the invoice data
      const invoice = await this.invoiceStorage.loadInvoice(restoredInvoiceId);
      if (invoice && invoice.data) {
        console.log('📄 FIXED: Loading invoice data for edit session');

        // Load the data into the invoice state
        this.state.loadInvoiceForEditing(invoice.data, restoredInvoiceId);

        // FIXED: Establish baseline AFTER invoice is fully loaded and components have stabilized
        setTimeout(() => {
          console.log('🔧 FIXED: Establishing baseline after invoice restore');

          // Get the final state after all loading is complete
          const finalState = this.state.getState();

          // SINGLE POINT: Establish baseline using canonical state engine
          if (this.unsavedChangesManager && this.unsavedChangesManager.establishBaseline) {
            this.unsavedChangesManager.establishBaseline(finalState);
            console.log('✅ FIXED: Canonical baseline established after invoice restore');
          }

        }, 500); // Increased delay to ensure all components are stable

      } else {
        console.warn('⚠️ Could not load invoice for restored session, clearing edit state');
        this.state.clearEditMode();
      }
    } catch (error) {
      console.error('❌ Error restoring edit session:', error);
      this.state.clearEditMode();
    }
  } else {
    console.log('🆕 FIXED: No previous edit session, starting fresh');

    // FIXED: For new invoices, establish baseline after components are ready
    setTimeout(() => {
      console.log('🔧 FIXED: Establishing baseline for new invoice');

      if (this.unsavedChangesManager && this.unsavedChangesManager.establishBaseline) {
        this.unsavedChangesManager.establishBaseline();
        console.log('✅ FIXED: Canonical baseline established for new invoice');
      }
    }, 500); // Consistent timing with restore case
  }
}

/**
 * REPLACE: saveInvoice method success handling in InvoiceApp
 */
export async function saveInvoiceFixed(isDraft = false) {
  try {
    const currentState = this.state.getState();

    // Validate state before saving
    if (!this.validateInvoiceState(currentState)) {
      await this.promptModal.showAlert('Error', 'Please fill in all required fields before saving.');
      return;
    }

    const saveBtn = document.getElementById('save-invoice');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    let id;
    const actionMessage = this.state.getIsEditMode() ? 'Invoice updated successfully!' : 'Invoice saved successfully!';

    if (this.state.getIsEditMode()) {
      // Update existing invoice
      const existingId = this.state.getCurrentInvoiceId();
      id = await this.invoiceStorage.updateExistingInvoice(existingId, currentState);
    } else {
      // Save new invoice
      id = await this.invoiceStorage.saveInvoice(currentState);
      this.state.setCurrentInvoiceId(id);
    }

    if (id) {
      // FIXED: Single point baseline establishment after successful save
      if (this.unsavedChangesManager && this.unsavedChangesManager.establishBaseline) {
        this.unsavedChangesManager.establishBaseline(currentState);
        console.log('✅ FIXED: Canonical baseline established after successful save');
      }

      await this.promptModal.showAlert('Success', actionMessage);
      this.sidebar.refreshInvoiceList();
    } else {
      await this.promptModal.showAlert('Error', 'Failed to save invoice');
    }

  } catch (error) {
    console.error('❌ Error saving invoice:', error);

    // Show user-friendly error message
    const errorMessage = error.message.includes('500')
      ? 'Server temporarily unavailable. Your changes are saved locally and will sync automatically.'
      : `Error saving invoice: ${error.message}`;

    await this.promptModal.showAlert('Error', errorMessage);
  } finally {
    // Re-enable save button
    const saveBtn = document.getElementById('save-invoice');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = this.state.getIsEditMode() ? 'Update Invoice' : 'Save Invoice';
    }
  }
}

/**
 * ENHANCED: updateUnsavedChangesUI method with better change summary
 */
export function updateUnsavedChangesUIFixed(changeData) {
  const { hasUnsavedChanges, changesSummary } = changeData;

  // Update save button appearance
  const saveBtn = document.getElementById('save-invoice');
  if (saveBtn) {
    if (hasUnsavedChanges) {
      saveBtn.classList.add('has-unsaved-changes');

      // Enhanced tooltip with specific changes
      const changedSections = changesSummary.sections || changesSummary.changes || [];
      if (changedSections.length > 0) {
        saveBtn.title = `${this.state.getIsEditMode() ? 'Update' : 'Save'} invoice (${changedSections.join(', ')} changed)`;
      } else {
        saveBtn.title = `${this.state.getIsEditMode() ? 'Update' : 'Save'} invoice (changes detected)`;
      }
    } else {
      saveBtn.classList.remove('has-unsaved-changes');
      saveBtn.title = this.state.getIsEditMode() ? 'Update invoice' : 'Save invoice';
    }
  }

  // Update any other UI indicators as needed
  const changesSummaryEl = document.getElementById('changes-summary');
  if (changesSummaryEl) {
    if (hasUnsavedChanges && changesSummary.sections) {
      changesSummaryEl.textContent = `Changed: ${changesSummary.sections.join(', ')}`;
      changesSummaryEl.style.display = 'block';
    } else {
      changesSummaryEl.style.display = 'none';
    }
  }
}

/**
 * HELPER: Validate invoice state before saving
 */
export function validateInvoiceState(state) {
  // Basic validation - can be enhanced as needed
  return state &&
         state.vessel &&
         state.customer &&
         state.scope &&
         Array.isArray(state.scope.lineItems);
}

/**
 * USAGE INSTRUCTIONS:
 *
 * 1. In app.js constructor, replace the line:
 *    this.initUnsavedChangesSystem();
 *    WITH:
 *    this.initUnsavedChangesSystemFixed();
 *
 * 2. Replace the restoreEditSession call:
 *    this.restoreEditSession();
 *    WITH:
 *    this.restoreEditSessionFixed();
 *
 * 3. Update the import statements at the top of app.js:
 *    ADD: import { UnsavedChangesManagerV2 } from './utils/UnsavedChangesManagerV2.js';
 *    REMOVE: import { UnsavedChangesManager } from './utils/UnsavedChangesManager.js';
 *
 * 4. Replace any existing saveInvoice method implementations with saveInvoiceFixed
 *
 * 5. Add the fixed methods to the InvoiceApp prototype:
 *    InvoiceApp.prototype.initUnsavedChangesSystemFixed = initUnsavedChangesSystemFixed;
 *    InvoiceApp.prototype.restoreEditSessionFixed = restoreEditSessionFixed;
 *    InvoiceApp.prototype.saveInvoiceFixed = saveInvoiceFixed;
 *    InvoiceApp.prototype.updateUnsavedChangesUIFixed = updateUnsavedChangesUIFixed;
 *    InvoiceApp.prototype.validateInvoiceState = validateInvoiceState;
 */