import { EventEmitter } from '../utils/events.js';

export class Sidebar extends EventEmitter {
  constructor(invoiceStorage) {
    super();
    this.invoiceStorage = invoiceStorage;
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
    this.bindEvents();
    this.loadItems();
  }

  createSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) {
      console.error('Sidebar container not found');
      return;
    }

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

      <div class="sidebar-filters">
        <div class="filter-group">
          <input
            type="text"
            id="sidebar-search"
            placeholder="Search invoices..."
            class="search-input"
          >
        </div>

        <div class="filter-group">
          <label for="sidebar-status-filter">Status:</label>
          <select id="sidebar-status-filter" class="filter-select">
            <option value="all">All Status</option>
            <option value="saved">Saved</option>
            <option value="submitted">Submitted</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="sidebar-date-filter">Date:</label>
          <select id="sidebar-date-filter" class="filter-select">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      <div class="sidebar-controls">
        <button id="sidebar-sort-date" class="sort-btn active" data-sort="date">
          Sort by Date
          <span class="sort-indicator">↓</span>
        </button>
        <button id="sidebar-sort-name" class="sort-btn" data-sort="name">
          Sort by Name
          <span class="sort-indicator"></span>
        </button>
        <button id="sidebar-refresh" class="refresh-btn" title="Refresh list">
          ↻
        </button>
      </div>

      <div class="sidebar-content">
        <div id="sidebar-loading" class="loading-state">
          <div class="spinner"></div>
          <span>Loading invoices...</span>
        </div>
        <div id="sidebar-items" class="sidebar-items"></div>
        <div id="sidebar-empty" class="empty-state" style="display: none;">
          <p>No invoices found</p>
          <p class="empty-subtitle">Create your first invoice to get started</p>
        </div>
      </div>
    `;

    container.appendChild(this.element);
  }

  bindEvents() {
    // Search
    const searchInput = document.getElementById('sidebar-search');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.filters.search = e.target.value.toLowerCase();
          this.renderItems();
        }, 300);
      });
    }

    // Filters
    const statusFilter = document.getElementById('sidebar-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.renderItems();
      });
    }

    const dateFilter = document.getElementById('sidebar-date-filter');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        this.filters.date = e.target.value;
        this.renderItems();
      });
    }

    // Sort buttons
    const sortBtns = this.element.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.isSorting) return;
        this.toggleSort(e.target.closest('.sort-btn'));
      });
    });

    // Refresh button
    const refreshBtn = document.getElementById('sidebar-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadItems();
      });
    }

    // New invoice button
    const newBtn = document.getElementById('sidebar-new-invoice');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.createNewInvoice();
      });
    }

    // Listen for storage updates
    if (this.invoiceStorage) {
      this.invoiceStorage.subscribe(() => {
        if (!this.isUpdating) {
          this.loadItems();
        }
      });
    }

    // Item actions (using event delegation)
    this.element.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const id = e.target.dataset.id;

      if (!action || !id) return;

      e.preventDefault();
      e.stopPropagation();

      switch (action) {
        case 'load':
          this.loadInvoice(id);
          break;
        case 'duplicate':
          this.duplicateInvoice(id);
          break;
        case 'delete':
          this.deleteInvoice(id);
          break;
      }
    });
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
      if (window.app.vesselForm) {
        window.app.vesselForm.populate(invoice.data.vessel);
      }
      if (window.app.customerForm) {
        window.app.customerForm.populate(invoice.data.customer);
      }
      if (window.app.scopeForm) {
        window.app.scopeForm.populate(invoice.data.scope);
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
      return;
    }

    this.isUpdating = true;

    try {
      const invoices = this.invoiceStorage.getSavedItems();
      const drafts = this.invoiceStorage.getAllDrafts();

      this.items = [...invoices, ...drafts].sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      this.renderItems();
    } catch (error) {
      console.error('Error loading sidebar items:', error);
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
      this.element.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.querySelector('.sort-indicator').textContent = '';
      });

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

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.removeAllListeners();
  }
}