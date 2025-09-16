/**
 * IMMEDIATE FIX FOR UNSAVED CHANGES FALSE POSITIVE
 *
 * This script modifies the existing UnsavedChangesManager to fix the
 * false dirty state issue immediately.
 */

// Override the UnsavedChangesManager initialization to properly handle timing
if (window.app && window.app.unsavedChangesManager) {
  console.log('🚨 APPLYING IMMEDIATE FIX FOR UNSAVED CHANGES');

  const manager = window.app.unsavedChangesManager;

  // Store original methods
  const originalMarkAsSaved = manager.markAsSaved.bind(manager);
  const originalHandleStateChange = manager.handleStateChange.bind(manager);

  // Add a flag to prevent false positives during loading
  manager.isLoadingInvoice = false;

  // Override markAsSaved to be more robust
  manager.markAsSaved = function() {
    console.log('🔧 IMMEDIATE FIX: markAsSaved called');

    // Clear the loading flag
    this.isLoadingInvoice = false;

    // Get current state and ensure it's stable
    const currentState = this.invoiceState.getState();

    // Delay the baseline setting to ensure all components have updated
    setTimeout(() => {
      console.log('🔧 IMMEDIATE FIX: Setting baseline after delay');
      this.lastSavedState = this.normalizeStateForComparison(currentState);
      this.hasUnsavedChanges = false;
      this.currentChangeHash = this.calculateStateHash(currentState);

      // Notify listeners
      this.notifyListeners({
        hasUnsavedChanges: false,
        changeData: null
      });

      console.log('✅ IMMEDIATE FIX: Baseline set, isDirty = false');
    }, 500); // Give components time to settle
  };

  // Override handleStateChange to ignore changes during loading
  manager.handleStateChange = function(state) {
    if (this.isLoadingInvoice) {
      console.log('🔧 IMMEDIATE FIX: Ignoring state change during loading');
      return;
    }

    return originalHandleStateChange(state);
  };

  console.log('✅ IMMEDIATE FIX APPLIED');
}

// Override the sidebar loadInvoice method to set loading flag
if (window.app && window.app.sidebar) {
  console.log('🔧 PATCHING SIDEBAR LOAD INVOICE');

  const sidebar = window.app.sidebar;
  const originalLoadInvoice = sidebar.loadInvoice.bind(sidebar);

  sidebar.loadInvoice = async function(id) {
    console.log('🔧 IMMEDIATE FIX: Setting loading flag before invoice load');

    // Set loading flag to prevent false dirty detection
    if (window.app.unsavedChangesManager) {
      window.app.unsavedChangesManager.isLoadingInvoice = true;
    }

    try {
      await originalLoadInvoice(id);

      // Force clean state after loading
      setTimeout(() => {
        if (window.app.unsavedChangesManager) {
          console.log('🔧 IMMEDIATE FIX: Forcing markAsSaved after invoice load');
          window.app.unsavedChangesManager.markAsSaved();
        }
      }, 1000);

    } catch (error) {
      console.error('Error loading invoice:', error);
      // Clear loading flag on error
      if (window.app.unsavedChangesManager) {
        window.app.unsavedChangesManager.isLoadingInvoice = false;
      }
    }
  };

  console.log('✅ SIDEBAR PATCH APPLIED');
}

// Fix the smart-save error by switching to regular save endpoint
if (window.app && window.app.invoiceStorage) {
  console.log('🔧 PATCHING INVOICE STORAGE TO FIX 500 ERRORS');

  const storage = window.app.invoiceStorage;
  const originalUpdateInvoice = storage.updateInvoice.bind(storage);

  storage.updateInvoice = async function(invoiceData, id) {
    console.log('🔧 IMMEDIATE FIX: Using regular update instead of smart-save to avoid 500 errors');

    try {
      // Use the working V2 endpoint instead of smart-save
      const endpoint = `/api/v2/invoices/${id}`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: invoiceData.title || `Invoice ${new Date().toLocaleDateString()}`,
          data: invoiceData,
          status: 'saved'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ IMMEDIATE FIX: Invoice updated successfully via V2 endpoint');

      return result;

    } catch (error) {
      console.error('❌ IMMEDIATE FIX: Update failed, falling back to original method');
      return originalUpdateInvoice(invoiceData, id);
    }
  };

  console.log('✅ INVOICE STORAGE PATCH APPLIED');
}

console.log('🎉 ALL IMMEDIATE FIXES APPLIED - Try loading an invoice now!');