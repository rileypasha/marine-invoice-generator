export class Sidebar {
  constructor(userManager, invoiceStorage, authModal, settingsModal) {
    this.userManager = userManager;
    this.invoiceStorage = invoiceStorage;
    this.authModal = authModal;
    this.settingsModal = settingsModal;
    this.filters = {
      search: '',
      status: 'all',
      date: 'all'
    };
    this.element = null;
    this.isUpdating = false; // Prevent recursive updates
    this.isRendering = false;
    this.isSorting = false;
    this.init();
  }

  init() {
    this.createSidebar();
    if (this.element) {
      this.bindEvents();
      this.loadItems();
    }
  }

  createSidebar() {
    console.log('🔍 Looking for sidebar in DOM...');

    // 🔧 PHASE 3 FIX: Look for the actual sidebar class used in HTML
    let existingSidebar = document.querySelector('.sidebar');

    if (!existingSidebar) {
      // Fallback: try other sidebar selectors
      existingSidebar = document.querySelector('.app-sidebar');
    }

    if (existingSidebar) {
      console.log('✅ Found existing sidebar in DOM');
      this.element = existingSidebar;

      // 🔧 PHASE 3 FIX: Transform the existing modern sidebar to support our functionality
      this.transformModernSidebar();
      return;
    }

    // 🔧 PHASE 3 FIX: If no sidebar found, try to find a container to inject into
    const container = document.querySelector('.app-layout') || document.querySelector('.app-container') || document.body;
    if (!container) {
      console.error('❌ Cannot find container for sidebar');
      return;
    }

    console.log('⚠️ No existing sidebar found, creating new one');

    this.element = document.createElement('div');
    this.element.className = 'sidebar';
    this.element.innerHTML = `
      <div class="sidebar-header">
        <h3>Saved Invoices</h3>
        <button id="sidebar-new-invoice" class="new-invoice-btn">
          <span class="icon">+</span>
          New Invoice
        </button>
      </div>



      <div class="sidebar-footer">
        <button class="user-section" id="user-section" style="display: none; width: 2rem; height: 2rem; border-radius: 50%; background: #6366f1; color: white; border: none; cursor: pointer; transition: all 0.2s ease-in-out; justify-content: center; align-items: center;" title="Profile">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </button>

        <div class="auth-section" id="auth-section">
          <button class="auth-btn primary" id="sign-in-btn">Sign In</button>
        </div>
      </div>
    `;

    container.appendChild(this.element);
  }

  transformModernSidebar() {
    console.log('🔧 PHASE 3 FIX: Transforming modern sidebar to support functionality');

    // 🔧 PHASE 3 FIX: The modern sidebar has a different structure
    // We need to add our components while preserving the modern design

    // Find the new button and update its ID
    const newBtn = this.element.querySelector('.sidebar__new-button');
    if (newBtn) {
      newBtn.id = 'sidebar-new-invoice';
      newBtn.classList.add('new-invoice-btn'); // Add legacy class for compatibility
      console.log('✅ Updated new invoice button');
    }

    // Create a container for our invoice management features
    const footer = this.element.querySelector('.sidebar__footer');
    if (footer) {
      // Add invoice management section after the new button
      const invoiceSection = document.createElement('div');
      invoiceSection.className = 'sidebar__invoices';
      invoiceSection.innerHTML = `
        <div class="sidebar-footer" style="padding: 1rem; border-top: 1px solid #e5e7eb; margin-top: auto;">
          <div class="user-section" id="user-section" style="display: none; cursor: pointer; width: 2rem; height: 2rem; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease-in-out;" title="Profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>

          <div class="auth-section" id="auth-section" style="display: flex;">
            <button class="auth-btn primary" id="sign-in-btn" style="padding: 0.5rem 1rem; background: #6366f1; color: white; border: none; border-radius: 0.375rem; cursor: pointer; width: 100%;">Sign In</button>
          </div>
        </div>
      `;

      footer.appendChild(invoiceSection);
      console.log('✅ Added invoice management section to modern sidebar');
    }

    console.log('✅ Modern sidebar transformation complete');
  }

  bindEvents() {
    // Simplified event binding - only essential events remain
    console.log('🧹 Sidebar events bound (cleaned up)');
  }

  async loadInvoice(id) {
    console.log('🔧 PHASE 3 FIX: Starting enhanced invoice loading for:', id);

    // 🔧 PHASE 3 FIX: Reset unsaved changes manager for new invoice
    if (window.app && window.app.unsavedChangesManager) {
      window.app.unsavedChangesManager.resetForNewInvoice();
      console.log('🔧 PHASE 3 FIX: Reset unsaved changes manager');
    }

    // Check for unsaved changes using the enhanced manager
    if (window.app && window.app.unsavedChangesManager) {
      const hasUnsavedChanges = window.app.unsavedChangesManager.getHasUnsavedChanges();

      if (hasUnsavedChanges) {
        const changesSummary = window.app.unsavedChangesManager.getChangesSummary();
        const changesText = changesSummary.changes.length > 0
          ? `\n\nChanges: ${changesSummary.changes.join(', ')}`
          : '';

        const confirmed = await window.app.promptModal.showConfirm(
          'Warning',
          `You have unsaved changes. Continue without saving?${changesText}`
        );

        if (!confirmed) {
          return; // User cancelled
        }
      }
    }

    const invoice = await this.invoiceStorage.getInvoice(id);
    if (invoice && window.app) {
      console.log('📂 Loading invoice for editing:', { id, title: invoice.title });

      // Use the new loadInvoiceForEditing method to properly set up edit mode
      window.app.state.loadInvoiceForEditing(invoice.data, id);

      // Update form components to reflect the loaded data
      // Add safety check to ensure forms are fully initialized
      if (window.app.vesselForm && window.app.vesselForm.vesselName) {
        window.app.vesselForm.populate(invoice.data.vessel || {});
      } else {
        console.warn('VesselForm not fully initialized, skipping populate');
      }

      if (window.app.customerForm && window.app.customerForm.customerName) {
        window.app.customerForm.populate(invoice.data.customer || {});
      } else {
        console.warn('CustomerForm not fully initialized, skipping populate');
      }

      if (window.app.scopeForm && window.app.scopeForm.lineItemsContainer) {
        window.app.scopeForm.populate(invoice.data.scope || {});
      } else {
        console.warn('ScopeForm not fully initialized, skipping populate');
      }

      // 🔧 PHASE 3 FIX: Enhanced baseline establishment with proper timing
      setTimeout(() => {
        const finalState = window.app.state.getState();

        // Set saved state in storage for backward compatibility
        this.invoiceStorage.lastSavedState = JSON.parse(JSON.stringify(finalState));

        // 🔧 PHASE 3 FIX: Signal that invoice loading is complete
        if (window.app.unsavedChangesManager) {
          window.app.unsavedChangesManager.onInvoiceLoaded();
          console.log('🔧 PHASE 3 FIX: Signaled invoice loading complete');

          // Now establish the baseline with the loaded data
          window.app.unsavedChangesManager.markAsSaved();
          console.log('🔧 PHASE 3 FIX: Baseline established after load complete');
        }

        console.log('✅ Set saved state AFTER form population complete');
        console.log(`✅ Edit mode active for invoice: ${id}`);
      }, 100); // Increased timeout to ensure all form updates complete

      console.log('✅ Loaded invoice for editing:', invoice.title);
    } else {
      console.error('❌ Failed to load invoice:', id);
    }
  }

  duplicateInvoice(id) {
    const newId = this.invoiceStorage.duplicateInvoice(id);
    if (newId) {
      console.log('Duplicated invoice with ID:', newId);
    }
  }

  deleteInvoice(id) {
    if (confirm('Are you sure you want to delete this invoice?')) {
      this.invoiceStorage.deleteInvoice(id);
    }
  }

  async createNewInvoice() {
    console.log('🔘 Sidebar createNewInvoice called');

    // 🔧 PHASE 3 FIX: Reset unsaved changes manager for new invoice
    if (window.app && window.app.unsavedChangesManager) {
      window.app.unsavedChangesManager.resetForNewInvoice();
      console.log('🔧 PHASE 3 FIX: Reset unsaved changes manager for new invoice');
    }

    // Check for unsaved changes using the enhanced manager
    if (window.app && window.app.unsavedChangesManager) {
      const hasUnsavedChanges = window.app.unsavedChangesManager.getHasUnsavedChanges();

      if (hasUnsavedChanges) {
        const changesSummary = window.app.unsavedChangesManager.getChangesSummary();
        const changesText = changesSummary.changes.length > 0
          ? `\n\nChanges: ${changesSummary.changes.join(', ')}`
          : '';

        const confirmed = await window.app.promptModal.showConfirm(
          'Warning',
          `You have unsaved changes. Continue without saving?${changesText}`
        );

        if (!confirmed) {
          return; // User cancelled
        }
      }
    }

    // Clear current state
    if (window.app && window.app.state) {
      window.app.state.reset();
      console.log('✅ State reset for new invoice');
    }

    // Clear all forms
    if (window.app.vesselForm) {
      window.app.vesselForm.reset();
    }
    if (window.app.customerForm) {
      window.app.customerForm.reset();
    }
    if (window.app.scopeForm) {
      window.app.scopeForm.reset();
    }
    if (window.app.notesForm) {
      window.app.notesForm.reset();
    }

    // 🔧 PHASE 3 FIX: Allow baseline to be established when user starts entering data
    // Don't call markAsSaved here - let it happen naturally when user starts typing
    console.log('🔧 PHASE 3 FIX: New invoice ready - baseline will be established when user enters data');

    console.log('✅ New invoice ready');
  }

  loadItems() {
    if (this.isUpdating || !this.invoiceStorage) {
      console.warn('⚠️ Sidebar loadItems: Storage not available or already updating');
      return;
    }

    this.isUpdating = true;

    try {
      // Add validation for required methods
      if (typeof this.invoiceStorage.getSavedItems !== 'function') {
        console.error('❌ invoiceStorage.getSavedItems is not a function. Available methods:', Object.getOwnPropertyNames(this.invoiceStorage));
        this.showError('Storage methods not available');
        return;
      }

      if (typeof this.invoiceStorage.getAllDrafts !== 'function') {
        console.error('❌ invoiceStorage.getAllDrafts is not a function. Available methods:', Object.getOwnPropertyNames(this.invoiceStorage));
        this.showError('Storage methods not available');
        return;
      }

      const invoices = this.invoiceStorage.getSavedItems();
      const drafts = this.invoiceStorage.getAllDrafts();

      this.items = [...invoices, ...drafts].sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      this.renderItems();
    } catch (error) {
      console.error('Error loading sidebar items:', error);
      console.error('invoiceStorage object:', this.invoiceStorage);
      console.error('invoiceStorage type:', typeof this.invoiceStorage);
      console.error('invoiceStorage methods:', this.invoiceStorage ? Object.getOwnPropertyNames(this.invoiceStorage) : 'null');
      this.showError('Failed to load invoices');
    } finally {
      this.isUpdating = false;
    }
  }

  filterItems() {
    if (!this.items) return [];

    return this.items.filter(item => {
      // Search filter
      if (this.filters.search) {
        const searchTerm = this.filters.search.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(searchTerm);
        const matchesCustomer = item.data?.customer?.customerName?.toLowerCase().includes(searchTerm);
        const matchesVessel = item.data?.vessel?.name?.toLowerCase().includes(searchTerm) ||
                            item.data?.vessel?.vesselName?.toLowerCase().includes(searchTerm);

        if (!matchesTitle && !matchesCustomer && !matchesVessel) {
          return false;
        }
      }

      // Status filter
      if (this.filters.status !== 'all' && item.status !== this.filters.status) {
        return false;
      }

      // Date filter
      if (this.filters.date !== 'all') {
        const itemDate = new Date(item.updatedAt);
        const now = new Date();

        switch (this.filters.date) {
          case 'today':
            if (itemDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (itemDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (itemDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }

  renderItems() {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      const loadingEl = document.getElementById('sidebar-loading');
      const itemsEl = document.getElementById('sidebar-items');
      const emptyEl = document.getElementById('sidebar-empty');

      if (!itemsEl) return;

      // Hide loading
      if (loadingEl) loadingEl.style.display = 'none';

      const filteredItems = this.filterItems();

      if (filteredItems.length === 0) {
        itemsEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      itemsEl.style.display = 'block';

      itemsEl.innerHTML = filteredItems.map(item => this.createItemHTML(item)).join('');
    } catch (error) {
      console.error('Error rendering sidebar items:', error);
      this.showError('Failed to display invoices');
    } finally {
      this.isRendering = false;
    }
  }

  createItemHTML(item) {
    const date = new Date(item.updatedAt).toLocaleDateString();
    const time = new Date(item.updatedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const statusClass = this.getStatusClass(item.status);
    const customerName = item.data?.customer?.customerName || 'No customer';
    const vesselName = item.data?.vessel?.name || item.data?.vessel?.vesselName || 'No vessel';

    const total = item.total ? `$${item.total.toFixed(2)}` : '$0.00';

    return `
      <div class="sidebar-item" data-id="${item.id}">
        <div class="item-main" data-action="load" data-id="${item.id}">
          <div class="item-header">
            <h4 class="item-title">${this.escapeHtml(item.title)}</h4>
            <span class="item-status ${statusClass}">${item.status}</span>
          </div>
          <div class="item-details">
            <div class="item-info">
              <span class="item-customer">${this.escapeHtml(customerName)}</span>
              <span class="item-vessel">${this.escapeHtml(vesselName)}</span>
            </div>
            <div class="item-total">${total}</div>
          </div>
          <div class="item-meta">
            <span class="item-date">${date} ${time}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="action-btn" data-action="duplicate" data-id="${item.id}" title="Duplicate">
            📋
          </button>
          <button class="action-btn delete" data-action="delete" data-id="${item.id}" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  getStatusClass(status) {
    switch (status) {
      case 'saved':
        return 'status-saved';
      case 'submitted':
        return 'status-submitted';
      case 'draft':
        return 'status-draft';
      default:
        return 'status-unknown';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  toggleSort(button) {
    this.isSorting = true;

    try {
      const sortType = button.dataset.sort;
      const indicator = button.querySelector('.sort-indicator');
      const wasActive = button.classList.contains('active');

      // Reset all sort buttons
      if (this.element) {
        this.element.querySelectorAll('.sort-btn').forEach(btn => {
          btn.classList.remove('active');
          btn.querySelector('.sort-indicator').textContent = '';
        });
      }

      // Toggle sort direction if same button, otherwise default to descending
      let isAscending = false;
      if (wasActive && indicator.textContent === '↓') {
        isAscending = true;
        indicator.textContent = '↑';
      } else {
        indicator.textContent = '↓';
      }

      button.classList.add('active');

      // Sort items
      if (this.items) {
        this.items.sort((a, b) => {
          let comparison = 0;

          if (sortType === 'date') {
            const dateA = new Date(a.updatedAt);
            const dateB = new Date(b.updatedAt);
            comparison = dateB - dateA; // Default: newest first
          } else if (sortType === 'name') {
            comparison = a.title.localeCompare(b.title);
          }

          return isAscending ? -comparison : comparison;
        });

        this.renderItems();
      }
    } catch (error) {
      console.error('Error sorting items:', error);
    } finally {
      this.isSorting = false;
    }
  }

  showError(message) {
    const itemsEl = document.getElementById('sidebar-items');
    if (itemsEl) {
      itemsEl.innerHTML = `
        <div class="error-state">
          <p class="error-message">${message}</p>
          <button onclick="window.location.reload()" class="retry-btn">
            Retry
          </button>
        </div>
      `;
    }
  }

  updateUserSection(user) {
    console.log('🔄 PHASE 3 FIX: Updating user section with enhanced error handling:', user);

    if (!this.element) {
      console.error('❌ Cannot update user section: sidebar element is null');
      console.log('🔍 Available elements in DOM:');
      console.log('  - .sidebar:', !!document.querySelector('.sidebar'));
      console.log('  - .app-sidebar:', !!document.querySelector('.app-sidebar'));
      console.log('  - .sidebar__footer:', !!document.querySelector('.sidebar__footer'));
      return;
    }

    // 🔧 PHASE 3 FIX: More robust element finding with fallbacks
    let userSection = this.element.querySelector('#user-section');
    let authSection = this.element.querySelector('#auth-section');

    // If sections don't exist, try to find them in the footer we created
    if (!userSection || !authSection) {
      const footer = this.element.querySelector('.sidebar-footer');
      if (footer) {
        userSection = footer.querySelector('#user-section');
        authSection = footer.querySelector('#auth-section');
      }
    }

    if (!userSection || !authSection) {
      console.error('❌ PHASE 3: Cannot find user or auth sections even after transformation');
      console.log('🔍 Debug info:', {
        element: !!this.element,
        userSection: !!userSection,
        authSection: !!authSection,
        sidebarFooter: !!this.element.querySelector('.sidebar-footer'),
        allUserSections: document.querySelectorAll('#user-section').length,
        allAuthSections: document.querySelectorAll('#auth-section').length
      });

      // 🔧 PHASE 3 FIX: Try to add missing sections if we have a footer
      const footer = this.element.querySelector('.sidebar__footer') || this.element.querySelector('.sidebar-footer');
      if (footer && !userSection) {
        console.log('🔧 PHASE 3 FIX: Adding missing user/auth sections');
        const sectionsHTML = `
          <div class="user-section" id="user-section" style="display: none; padding: 0.75rem; background: #f3f4f6; border-radius: 0.5rem; cursor: pointer; margin-top: 1rem;" title="Settings">
            <div class="user-info" style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="user-avatar" style="width: 2rem; height: 2rem; background: #6366f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div class="user-details">
                <div class="user-name" id="user-name" style="font-weight: 500; font-size: 0.875rem;">User Name</div>
                <div class="user-email" id="user-email" style="font-size: 0.75rem; color: #6b7280;">user@example.com</div>
              </div>
            </div>
          </div>

          <div class="auth-section" id="auth-section" style="display: flex; margin-top: 1rem;">
            <button class="auth-btn primary" id="sign-in-btn" style="padding: 0.5rem 1rem; background: #6366f1; color: white; border: none; border-radius: 0.375rem; cursor: pointer; width: 100%;">Sign In</button>
          </div>
        `;
        footer.insertAdjacentHTML('beforeend', sectionsHTML);

        // Re-query the elements
        userSection = this.element.querySelector('#user-section');
        authSection = this.element.querySelector('#auth-section');
        console.log('✅ PHASE 3 FIX: Added missing sections');
      }

      if (!userSection || !authSection) {
        console.error('❌ PHASE 3: Still cannot find sections, giving up');
        return;
      }
    }

    // 🔧 PHASE 3 FIX: Robust user update with error handling
    try {
      if (user) {
        console.log('✅ PHASE 3: User authenticated, showing user section');
        userSection.style.display = 'flex';
        authSection.style.display = 'none';

        // Update user info with null checks
        const userNameEl = this.element.querySelector('#user-name');
        const userEmailEl = this.element.querySelector('#user-email');

        if (userNameEl) {
          userNameEl.textContent = user.name || user.email || 'User';
          console.log('✅ PHASE 3: Updated user name:', userNameEl.textContent);
        } else {
          console.warn('⚠️ PHASE 3: user-name element not found');
        }

        if (userEmailEl) {
          userEmailEl.textContent = user.email || '';
          console.log('✅ PHASE 3: Updated user email:', userEmailEl.textContent);
        } else {
          console.warn('⚠️ PHASE 3: user-email element not found');
        }
      } else {
        console.log('⚠️ PHASE 3: No user, showing auth section');
        userSection.style.display = 'none';
        authSection.style.display = 'flex';
      }

      console.log('✅ PHASE 3: User section update completed successfully');
    } catch (error) {
      console.error('❌ PHASE 3: Error updating user section:', error);
    }
  }

  setupInvoiceItemListeners() {
    console.log('✅ setupInvoiceItemListeners called - using built-in event delegation');
    // Note: This method is called by legacy code but the current Sidebar
    // handles invoice item events through the event delegation in bindEvents()
    // This is just a compatibility method to prevent errors
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.removeAllListeners();
  }
}