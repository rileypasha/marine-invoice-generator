/**
 * NavigationProtection - Protects against navigation with unsaved changes
 *
 * Features:
 * - Browser navigation protection (back/forward, address bar, external links)
 * - Internal navigation protection (tab switching, sidebar)
 * - Page refresh/close protection
 * - Cross-browser compatibility
 * - Graceful degradation for unsupported features
 */

export class NavigationProtection {
  constructor(unsavedChangesManager, dialog) {
    this.unsavedChangesManager = unsavedChangesManager;
    this.dialog = dialog;

    // Navigation state
    this.isProtectionActive = false;
    this.pendingNavigation = null;
    this.navigationBlocked = false;

    // Browser API support detection
    this.supportsBeforeUnload = 'onbeforeunload' in window;
    this.supportsPopState = 'onpopstate' in window;

    // Event handlers (bound for proper cleanup)
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handlePopState = this.handlePopState.bind(this);
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleSidebarClick = this.handleSidebarClick.bind(this);
    this.handleLinkClick = this.handleLinkClick.bind(this);

    // Initialize protection
    this.init();
  }

  /**
   * Initialize navigation protection
   */
  init() {
    console.log('🛡️ Initializing NavigationProtection...');

    // Subscribe to unsaved changes
    this.unsavedChangesManager.subscribe((changeData) => {
      this.updateProtection(changeData.hasUnsavedChanges);
    });

    // Set up browser navigation protection
    this.setupBrowserProtection();

    // Set up internal navigation protection
    this.setupInternalProtection();

    console.log('✅ NavigationProtection initialized');
  }

  /**
   * Update protection state based on unsaved changes
   * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
   */
  updateProtection(hasUnsavedChanges) {
    if (hasUnsavedChanges !== this.isProtectionActive) {
      this.isProtectionActive = hasUnsavedChanges;

      if (this.isProtectionActive) {
        this.enableProtection();
      } else {
        this.disableProtection();
      }

      console.log(`🛡️ Navigation protection ${this.isProtectionActive ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Enable all navigation protection
   */
  enableProtection() {
    // Browser navigation protection
    if (this.supportsBeforeUnload) {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    if (this.supportsPopState) {
      window.addEventListener('popstate', this.handlePopState);
    }

    // Internal navigation protection
    document.addEventListener('click', this.handleTabClick, true);
    document.addEventListener('click', this.handleSidebarClick, true);
    document.addEventListener('click', this.handleLinkClick, true);
  }

  /**
   * Disable all navigation protection
   */
  disableProtection() {
    // Browser navigation protection
    if (this.supportsBeforeUnload) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    if (this.supportsPopState) {
      window.removeEventListener('popstate', this.handlePopState);
    }

    // Internal navigation protection
    document.removeEventListener('click', this.handleTabClick, true);
    document.removeEventListener('click', this.handleSidebarClick, true);
    document.removeEventListener('click', this.handleLinkClick, true);
  }

  /**
   * Set up browser navigation protection
   */
  setupBrowserProtection() {
    // Note: Modern browsers heavily restrict beforeunload customization
    // We can only show a generic browser dialog, not our custom dialog
    console.log('🌐 Setting up browser navigation protection');
    console.log(`  - beforeunload support: ${this.supportsBeforeUnload}`);
    console.log(`  - popstate support: ${this.supportsPopState}`);
  }

  /**
   * Set up internal navigation protection
   */
  setupInternalProtection() {
    console.log('🏠 Setting up internal navigation protection');

    // Override history methods to detect programmatic navigation
    this.overrideHistoryMethods();
  }

  /**
   * Override history methods to detect programmatic navigation
   */
  overrideHistoryMethods() {
    // Store original methods
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const originalBack = history.back;
    const originalForward = history.forward;
    const originalGo = history.go;

    // Override pushState
    history.pushState = (...args) => {
      if (this.isProtectionActive && !this.navigationBlocked) {
        this.handleProgrammaticNavigation('pushState', () => {
          originalPushState.apply(history, args);
        });
      } else {
        originalPushState.apply(history, args);
      }
    };

    // Override replaceState
    history.replaceState = (...args) => {
      if (this.isProtectionActive && !this.navigationBlocked) {
        this.handleProgrammaticNavigation('replaceState', () => {
          originalReplaceState.apply(history, args);
        });
      } else {
        originalReplaceState.apply(history, args);
      }
    };

    // Override back
    history.back = () => {
      if (this.isProtectionActive && !this.navigationBlocked) {
        this.handleProgrammaticNavigation('back', () => {
          originalBack.call(history);
        });
      } else {
        originalBack.call(history);
      }
    };

    // Override forward
    history.forward = () => {
      if (this.isProtectionActive && !this.navigationBlocked) {
        this.handleProgrammaticNavigation('forward', () => {
          originalForward.call(history);
        });
      } else {
        originalForward.call(history);
      }
    };

    // Override go
    history.go = (...args) => {
      if (this.isProtectionActive && !this.navigationBlocked) {
        this.handleProgrammaticNavigation('go', () => {
          originalGo.apply(history, args);
        });
      } else {
        originalGo.apply(history, args);
      }
    };
  }

  /**
   * Handle browser beforeunload event
   * @param {BeforeUnloadEvent} e - Event object
   */
  handleBeforeUnload(e) {
    if (!this.isProtectionActive) return;

    // Modern browsers ignore custom messages and show generic dialog
    // We set returnValue and return value for cross-browser compatibility
    e.preventDefault();
    e.returnValue = '';
    return '';
  }

  /**
   * Handle browser popstate event (back/forward navigation)
   * @param {PopStateEvent} e - Event object
   */
  handlePopState(e) {
    if (!this.isProtectionActive) return;

    console.log('🔙 Popstate event detected with unsaved changes');

    // For popstate, we can't prevent the navigation easily
    // Instead, we show our dialog and handle the result
    this.handleBrowserNavigation(e);
  }

  /**
   * Handle tab navigation clicks
   * @param {MouseEvent} e - Click event
   */
  handleTabClick(e) {
    if (!this.isProtectionActive) return;

    const tabButton = e.target.closest('.tab-button');
    if (tabButton && !tabButton.classList.contains('active')) {
      e.preventDefault();
      e.stopImmediatePropagation();

      console.log('🔄 Tab navigation blocked due to unsaved changes');

      this.showNavigationWarning({
        type: 'navigation',
        title: 'Switch Tab?',
        message: 'You have unsaved changes. What would you like to do?',
        onSave: async () => {
          await this.saveAndProceed(() => {
            tabButton.click();
          });
        },
        onDiscard: () => {
          this.discardAndProceed(() => {
            tabButton.click();
          });
        }
      });
    }
  }

  /**
   * Handle sidebar navigation clicks
   * @param {MouseEvent} e - Click event
   */
  handleSidebarClick(e) {
    if (!this.isProtectionActive) return;

    // Check for new invoice button
    if (e.target.closest('.new-invoice-btn')) {
      e.preventDefault();
      e.stopImmediatePropagation();

      console.log('🆕 New invoice navigation blocked due to unsaved changes');

      this.showNavigationWarning({
        type: 'navigation',
        title: 'Create New Invoice?',
        message: 'You have unsaved changes. What would you like to do before creating a new invoice?',
        onSave: async () => {
          await this.saveAndProceed(() => {
            // Call the original new invoice function
            if (window.app && window.app.createNewInvoice) {
              window.app.createNewInvoice();
            }
          });
        },
        onDiscard: () => {
          this.discardAndProceed(() => {
            if (window.app && window.app.createNewInvoice) {
              window.app.createNewInvoice();
            }
          });
        }
      });
      return;
    }

    // Check for invoice loading
    const invoiceItem = e.target.closest('.invoice-item');
    const loadAction = e.target.closest('[data-action="load"]');

    if (invoiceItem && loadAction) {
      e.preventDefault();
      e.stopImmediatePropagation();

      console.log('📂 Invoice load navigation blocked due to unsaved changes');

      const invoiceId = invoiceItem.dataset.id;
      this.showNavigationWarning({
        type: 'navigation',
        title: 'Load Invoice?',
        message: 'You have unsaved changes. What would you like to do before loading another invoice?',
        onSave: async () => {
          await this.saveAndProceed(() => {
            this.loadInvoice(invoiceId);
          });
        },
        onDiscard: () => {
          this.discardAndProceed(() => {
            this.loadInvoice(invoiceId);
          });
        }
      });
    }
  }

  /**
   * Handle external link clicks
   * @param {MouseEvent} e - Click event
   */
  handleLinkClick(e) {
    if (!this.isProtectionActive) return;

    const link = e.target.closest('a[href]');
    if (link && link.href && !link.href.startsWith(window.location.origin)) {
      e.preventDefault();
      e.stopImmediatePropagation();

      console.log('🔗 External link navigation blocked due to unsaved changes');

      this.showNavigationWarning({
        type: 'navigation',
        title: 'Leave Page?',
        message: 'You have unsaved changes. What would you like to do before leaving?',
        onSave: async () => {
          await this.saveAndProceed(() => {
            window.open(link.href, link.target || '_self');
          });
        },
        onDiscard: () => {
          this.discardAndProceed(() => {
            window.open(link.href, link.target || '_self');
          });
        }
      });
    }
  }

  /**
   * Handle programmatic navigation attempts
   * @param {string} method - Navigation method used
   * @param {Function} originalNavigation - Original navigation function
   */
  async handleProgrammaticNavigation(method, originalNavigation) {
    console.log(`📱 Programmatic navigation (${method}) blocked due to unsaved changes`);

    const action = await this.showNavigationWarning({
      type: 'navigation',
      title: 'Navigate Away?',
      message: 'You have unsaved changes. What would you like to do?'
    });

    if (action === 'save') {
      await this.saveAndProceed(originalNavigation);
    } else if (action === 'discard') {
      this.discardAndProceed(originalNavigation);
    }
    // If cancelled, do nothing (navigation is blocked)
  }

  /**
   * Handle browser navigation (back/forward)
   * @param {PopStateEvent} e - Popstate event
   */
  async handleBrowserNavigation(e) {
    console.log('🌐 Browser navigation detected with unsaved changes');

    // Push current state back to prevent navigation
    const currentUrl = window.location.href;
    history.pushState(null, '', currentUrl);

    const action = await this.showNavigationWarning({
      type: 'navigation',
      title: 'Leave Page?',
      message: 'You have unsaved changes. What would you like to do?'
    });

    if (action === 'save') {
      await this.saveAndProceed(() => {
        history.back();
      });
    } else if (action === 'discard') {
      this.discardAndProceed(() => {
        history.back();
      });
    }
    // If cancelled, stay on current page (already pushed state back)
  }

  /**
   * Show navigation warning dialog
   * @param {Object} options - Dialog options
   * @returns {Promise<string>} Action taken
   */
  async showNavigationWarning(options = {}) {
    const changesSummary = this.unsavedChangesManager.getChangesSummary();

    const dialogOptions = {
      type: 'navigation',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes that will be lost.',
      changes: changesSummary.changes,
      showSave: true,
      showDiscard: true,
      saveText: 'Save & Continue',
      discardText: 'Discard Changes',
      cancelText: 'Cancel',
      ...options
    };

    const action = await this.dialog.show(dialogOptions);

    // Handle the specific callback functions if provided
    if (action === 'save' && options.onSave) {
      await options.onSave();
      return action;
    } else if (action === 'discard' && options.onDiscard) {
      options.onDiscard();
      return action;
    }

    return action;
  }

  /**
   * Save changes and proceed with navigation
   * @param {Function} proceedCallback - Function to call after saving
   */
  async saveAndProceed(proceedCallback) {
    try {
      this.dialog.showSaveInProgress();

      // Save the invoice
      if (window.app && window.app.saveInvoice) {
        await window.app.saveInvoice();
      }

      this.dialog.hideSaveInProgress();

      // Temporarily disable protection
      this.navigationBlocked = true;

      // Proceed with navigation
      if (typeof proceedCallback === 'function') {
        proceedCallback();
      }

      // Re-enable protection after a delay
      setTimeout(() => {
        this.navigationBlocked = false;
      }, 100);

    } catch (error) {
      console.error('❌ Error saving before navigation:', error);
      this.dialog.hideSaveInProgress();
      this.dialog.announceMessage('Save failed. Please try again.');
    }
  }

  /**
   * Discard changes and proceed with navigation
   * @param {Function} proceedCallback - Function to call after discarding
   */
  discardAndProceed(proceedCallback) {
    // Mark as saved to disable protection
    this.unsavedChangesManager.markAsSaved();

    // Temporarily disable protection
    this.navigationBlocked = true;

    // Proceed with navigation
    if (typeof proceedCallback === 'function') {
      proceedCallback();
    }

    // Re-enable protection after a delay
    setTimeout(() => {
      this.navigationBlocked = false;
    }, 100);
  }

  /**
   * Load an invoice (helper for sidebar navigation)
   * @param {string} invoiceId - Invoice ID to load
   */
  async loadInvoice(invoiceId) {
    if (window.app && window.app.sidebar && window.app.sidebar.loadInvoice) {
      await window.app.sidebar.loadInvoice(invoiceId);
    }
  }

  /**
   * Temporarily disable protection for programmatic navigation
   * @param {Function} navigationFunction - Function that performs navigation
   */
  async bypassProtection(navigationFunction) {
    const wasActive = this.isProtectionActive;
    this.isProtectionActive = false;
    this.disableProtection();

    try {
      await navigationFunction();
    } finally {
      this.isProtectionActive = wasActive;
      if (wasActive) {
        this.enableProtection();
      }
    }
  }

  /**
   * Clean up navigation protection
   */
  cleanup() {
    console.log('🧹 Cleaning up NavigationProtection...');

    // Disable all protection
    this.disableProtection();

    // Reset state
    this.isProtectionActive = false;
    this.pendingNavigation = null;
    this.navigationBlocked = false;

    console.log('✅ NavigationProtection cleanup complete');
  }
}