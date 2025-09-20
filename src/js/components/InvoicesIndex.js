/**
 * InvoicesIndex - Invoice directory page component
 * Displays saved invoices in a table format with search, filtering, and actions
 */

export class InvoicesIndex {
  constructor() {
    this.invoices = [];
    this.filteredInvoices = [];
    this.searchTerm = '';
    this.sortColumn = 'updatedAt';
    this.sortDirection = 'desc';
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.isLoading = false;

    this.container = null;
    this.init();
  }

  async init() {
    console.log('🚀 Initializing InvoicesIndex...');

    try {
      // Find container element
      this.container = document.getElementById('invoices-page');
      if (!this.container) {
        throw new Error('Container element #invoices-page not found');
      }

      // Render initial structure
      this.render();

      // Bind events
      this.bindEvents();

      // Load invoices
      await this.loadInvoices();

      console.log('✅ InvoicesIndex initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing InvoicesIndex:', error);
      this.renderError(error.message);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="invoices-page-container">
        <div class="invoices-page__header">
          <div class="invoices-page__title">
            <h1>Invoices</h1>
            <p class="invoices-page__subtitle">Manage and view all your saved invoices</p>
          </div>
          <div class="invoices-page__actions">
            <button class="new-invoice-button" id="new-invoice-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14m-7-7h14"/>
              </svg>
              New Invoice
            </button>
          </div>
        </div>

        <div class="invoices-page__filters">
          <div class="search-bar">
            <div class="search-bar__input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                class="search-input"
                id="search-input"
                placeholder="Search invoices by title, customer, or vessel..."
                value="${this.searchTerm}"
              />
            </div>
          </div>
        </div>

        <div class="invoices-page__stats" id="stats-section">
          <div class="stat">
            <div class="stat__value" id="total-count">-</div>
            <div class="stat__label">Total Invoices</div>
          </div>
          <div class="stat">
            <div class="stat__value stat__value--success" id="saved-count">-</div>
            <div class="stat__label">Saved</div>
          </div>
          <div class="stat">
            <div class="stat__value stat__value--warning" id="draft-count">-</div>
            <div class="stat__label">Drafts</div>
          </div>
          <div class="stat">
            <div class="stat__value stat__value--error" id="submitted-count">-</div>
            <div class="stat__label">Submitted</div>
          </div>
        </div>

        <div class="invoices-page__table">
          <div class="table-container">
            <table class="invoices-table">
              <thead>
                <tr>
                  <th>
                    <button class="sort-btn ${this.sortColumn === 'title' ? 'sort-btn--active' : ''}" data-column="title">
                      Invoice Title
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 10l5-5 5 5M7 14l5 5 5-5"/>
                      </svg>
                    </button>
                  </th>
                  <th>Customer</th>
                  <th>Vessel</th>
                  <th>
                    <button class="sort-btn ${this.sortColumn === 'total' ? 'sort-btn--active' : ''}" data-column="total">
                      Amount
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 10l5-5 5 5M7 14l5 5 5-5"/>
                      </svg>
                    </button>
                  </th>
                  <th>Status</th>
                  <th>
                    <button class="sort-btn ${this.sortColumn === 'updatedAt' ? 'sort-btn--active' : ''}" data-column="updatedAt">
                      Updated
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 10l5-5 5 5M7 14l5 5 5-5"/>
                      </svg>
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="invoices-tbody">
                <!-- Invoices will be rendered here -->
              </tbody>
            </table>
          </div>
        </div>

        <div class="invoices-page__pagination" id="pagination-section">
          <div class="pagination__info" id="pagination-info">
            Showing 0 of 0 invoices
          </div>
          <div class="pagination" id="pagination-controls">
            <!-- Pagination controls will be rendered here -->
          </div>
        </div>

        <!-- Loading state -->
        <div class="loading-state" id="loading-state" style="display: none;">
          <div class="loading-spinner"></div>
          <p>Loading invoices...</p>
        </div>

        <!-- Empty state -->
        <div class="empty-state" id="empty-state" style="display: none;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <h3>No invoices found</h3>
          <p>Get started by creating your first invoice</p>
          <button class="btn btn--primary" id="empty-new-invoice-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14m-7-7h14"/>
            </svg>
            Create First Invoice
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // New invoice button
    const newInvoiceBtn = document.getElementById('new-invoice-btn');
    const emptyNewInvoiceBtn = document.getElementById('empty-new-invoice-btn');

    if (newInvoiceBtn) {
      newInvoiceBtn.addEventListener('click', () => this.createNewInvoice());
    }

    if (emptyNewInvoiceBtn) {
      emptyNewInvoiceBtn.addEventListener('click', () => this.createNewInvoice());
    }

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchTerm = e.target.value.toLowerCase();
          this.filterInvoices();
          this.renderInvoicesTable();
        }, 300);
      });
    }

    // Sort buttons
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.sort-btn')) {
        const sortBtn = e.target.closest('.sort-btn');
        const column = sortBtn.dataset.column;
        this.handleSort(column);
      }
    });

    // Invoice actions
    this.container.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const invoiceId = actionBtn.dataset.id;
        this.handleInvoiceAction(action, invoiceId);
      }
    });

    // Invoice row clicks (for editing)
    this.container.addEventListener('click', (e) => {
      const invoiceRow = e.target.closest('.invoice-row');
      if (invoiceRow && !e.target.closest('.action-btn')) {
        const invoiceId = invoiceRow.dataset.id;
        this.editInvoice(invoiceId);
      }
    });
  }

  async loadInvoices() {
    this.showLoading(true);

    try {
      // Get invoices from storage
      const invoices = await this.fetchInvoices();
      this.invoices = invoices;
      this.filterInvoices();
      this.updateStats();
      this.renderInvoicesTable();
      this.renderPagination();

      // Show appropriate content
      if (this.invoices.length === 0) {
        this.showEmptyState();
      } else {
        this.showTable();
      }

    } catch (error) {
      console.error('❌ Error loading invoices:', error);
      this.renderError('Failed to load invoices');
    } finally {
      this.showLoading(false);
    }
  }

  async fetchInvoices() {
    try {
      // Fetch from server API first
      console.log('🔄 Fetching invoices from server...');
      const response = await fetch('/api/invoices/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const serverInvoices = await response.json();
        console.log(`✅ Fetched ${serverInvoices.length} invoices from server`);

        // Store in localStorage for offline access
        try {
          localStorage.setItem('marine_invoices', JSON.stringify(serverInvoices));
        } catch (storageError) {
          console.warn('Failed to save invoices to localStorage:', storageError);
        }

        return serverInvoices;
      } else {
        console.warn('Server request failed, trying localStorage...');
      }
    } catch (error) {
      console.warn('Failed to fetch from server, trying localStorage:', error);
    }

    // Fallback to local storage if server request fails
    try {
      const stored = localStorage.getItem('marine_invoices');
      if (stored) {
        const localInvoices = JSON.parse(stored) || [];
        console.log(`📱 Using ${localInvoices.length} invoices from localStorage`);
        return localInvoices;
      }
    } catch (error) {
      console.warn('Failed to parse stored invoices:', error);
    }

    // Return empty array if everything fails
    console.log('📭 No invoices found');
    return [];
  }

  filterInvoices() {
    this.filteredInvoices = this.invoices.filter(invoice => {
      if (!this.searchTerm) return true;

      const searchText = this.searchTerm.toLowerCase();
      return (
        invoice.title?.toLowerCase().includes(searchText) ||
        invoice.data?.customer?.customerName?.toLowerCase().includes(searchText) ||
        invoice.data?.vessel?.name?.toLowerCase().includes(searchText) ||
        invoice.data?.vessel?.vesselName?.toLowerCase().includes(searchText)
      );
    });

    // Apply sorting
    this.sortInvoices();
  }

  sortInvoices() {
    this.filteredInvoices.sort((a, b) => {
      let aValue = a[this.sortColumn];
      let bValue = b[this.sortColumn];

      // Handle nested properties
      if (this.sortColumn === 'customer') {
        aValue = a.data?.customer?.customerName || '';
        bValue = b.data?.customer?.customerName || '';
      } else if (this.sortColumn === 'vessel') {
        aValue = a.data?.vessel?.name || a.data?.vessel?.vesselName || '';
        bValue = b.data?.vessel?.name || b.data?.vessel?.vesselName || '';
      }

      // Handle dates
      if (this.sortColumn === 'updatedAt' || this.sortColumn === 'createdAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // Handle numbers
      if (this.sortColumn === 'total') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }

      // Compare values
      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  handleSort(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc';
    }

    this.filterInvoices();
    this.renderInvoicesTable();
    this.updateSortButtons();
  }

  updateSortButtons() {
    const sortBtns = this.container.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
      btn.classList.remove('sort-btn--active');
      if (btn.dataset.column === this.sortColumn) {
        btn.classList.add('sort-btn--active');
      }
    });
  }

  updateStats() {
    const totalCount = this.invoices.length;
    const savedCount = this.invoices.filter(inv => inv.status === 'saved').length;
    const draftCount = this.invoices.filter(inv => inv.status === 'draft').length;
    const submittedCount = this.invoices.filter(inv => inv.status === 'submitted').length;

    document.getElementById('total-count').textContent = totalCount;
    document.getElementById('saved-count').textContent = savedCount;
    document.getElementById('draft-count').textContent = draftCount;
    document.getElementById('submitted-count').textContent = submittedCount;
  }

  renderInvoicesTable() {
    const tbody = document.getElementById('invoices-tbody');
    if (!tbody) return;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageInvoices = this.filteredInvoices.slice(startIndex, endIndex);

    tbody.innerHTML = pageInvoices.map(invoice => this.createInvoiceRow(invoice)).join('');
  }

  createInvoiceRow(invoice) {
    const date = new Date(invoice.updatedAt || invoice.createdAt).toLocaleDateString();
    const customerName = invoice.data?.customer?.customerName || 'No customer';
    const vesselName = invoice.data?.vessel?.name || invoice.data?.vessel?.vesselName || 'No vessel';
    const total = invoice.total ? `$${invoice.total.toFixed(2)}` : '$0.00';
    const statusClass = this.getStatusClass(invoice.status);

    return `
      <tr class="invoice-row" data-id="${invoice.id}">
        <td class="invoice-title-cell">
          <div class="invoice-title">${this.escapeHtml(invoice.title)}</div>
          <div class="invoice-id">#${invoice.id}</div>
        </td>
        <td class="customer-cell">${this.escapeHtml(customerName)}</td>
        <td class="vessel-cell">${this.escapeHtml(vesselName)}</td>
        <td class="amount-cell">${total}</td>
        <td class="status-cell">
          <span class="status-badge ${statusClass}">${invoice.status}</span>
        </td>
        <td class="date-cell">${date}</td>
        <td class="actions-cell">
          <div class="invoice-actions">
            <button class="action-btn" data-action="edit" data-id="${invoice.id}" title="Edit invoice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="action-btn" data-action="duplicate" data-id="${invoice.id}" title="Duplicate invoice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button class="action-btn action-btn--danger" data-action="delete" data-id="${invoice.id}" title="Delete invoice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  getStatusClass(status) {
    switch (status) {
      case 'saved': return 'status-badge--saved';
      case 'submitted': return 'status-badge--submitted';
      case 'draft': return 'status-badge--draft';
      default: return 'status-badge--draft';
    }
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredInvoices.length / this.itemsPerPage);
    const paginationInfo = document.getElementById('pagination-info');
    const paginationControls = document.getElementById('pagination-controls');

    if (paginationInfo) {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
      const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredInvoices.length);
      paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${this.filteredInvoices.length} invoices`;
    }

    if (paginationControls && totalPages > 1) {
      let paginationHTML = '';

      // Previous button
      paginationHTML += `
        <button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.invoicesIndex.goToPage(${this.currentPage - 1})">
          ‹
        </button>
      `;

      // Page numbers
      for (let i = 1; i <= totalPages; i++) {
        if (i === this.currentPage) {
          paginationHTML += `<button class="pagination__btn pagination__btn--active">${i}</button>`;
        } else {
          paginationHTML += `<button class="pagination__btn" onclick="window.invoicesIndex.goToPage(${i})">${i}</button>`;
        }
      }

      // Next button
      paginationHTML += `
        <button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.invoicesIndex.goToPage(${this.currentPage + 1})">
          ›
        </button>
      `;

      paginationControls.innerHTML = paginationHTML;
    } else if (paginationControls) {
      paginationControls.innerHTML = '';
    }
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredInvoices.length / this.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.renderInvoicesTable();
      this.renderPagination();
    }
  }

  showLoading(show) {
    const loadingState = document.getElementById('loading-state');
    const tableSection = this.container.querySelector('.invoices-page__table');
    const statsSection = document.getElementById('stats-section');
    const emptyState = document.getElementById('empty-state');

    if (show) {
      if (loadingState) loadingState.style.display = 'flex';
      if (tableSection) tableSection.style.display = 'none';
      if (statsSection) statsSection.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
    } else {
      if (loadingState) loadingState.style.display = 'none';
    }
  }

  showEmptyState() {
    const emptyState = document.getElementById('empty-state');
    const tableSection = this.container.querySelector('.invoices-page__table');
    const statsSection = document.getElementById('stats-section');

    if (emptyState) emptyState.style.display = 'flex';
    if (tableSection) tableSection.style.display = 'none';
    if (statsSection) statsSection.style.display = 'none';
  }

  showTable() {
    const emptyState = document.getElementById('empty-state');
    const tableSection = this.container.querySelector('.invoices-page__table');
    const statsSection = document.getElementById('stats-section');

    if (emptyState) emptyState.style.display = 'none';
    if (tableSection) tableSection.style.display = 'block';
    if (statsSection) statsSection.style.display = 'flex';
  }

  renderError(message) {
    this.container.innerHTML = `
      <div class="invoices-page-container">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h3>Error Loading Invoices</h3>
          <p>${message}</p>
          <button class="btn btn--primary" onclick="window.location.reload()">
            Retry
          </button>
        </div>
      </div>
    `;
  }

  // Action handlers
  createNewInvoice() {
    console.log('🚀 Creating new invoice...');
    window.location.href = '/app';
  }

  editInvoice(invoiceId) {
    console.log('✏️ Editing invoice:', invoiceId);
    // Navigate to app with the invoice ID for editing
    window.location.href = `/app?edit=${invoiceId}`;
  }

  handleInvoiceAction(action, invoiceId) {
    console.log(`🔧 Invoice action: ${action} for invoice ${invoiceId}`);

    switch (action) {
      case 'edit':
        this.editInvoice(invoiceId);
        break;
      case 'duplicate':
        this.duplicateInvoice(invoiceId);
        break;
      case 'delete':
        this.deleteInvoice(invoiceId);
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  duplicateInvoice(invoiceId) {
    const invoice = this.invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      // Create a copy with a new ID and updated title
      const duplicate = {
        ...invoice,
        id: this.generateId(),
        title: `${invoice.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft'
      };

      // Save to storage
      this.invoices.push(duplicate);
      this.saveInvoicesToStorage();

      // Refresh display
      this.loadInvoices();

      this.showToast('Invoice duplicated successfully', 'success');
    }
  }

  deleteInvoice(invoiceId) {
    const invoice = this.invoices.find(inv => inv.id === invoiceId);
    if (invoice && confirm(`Are you sure you want to delete "${invoice.title}"?`)) {
      // Remove from array
      this.invoices = this.invoices.filter(inv => inv.id !== invoiceId);
      this.saveInvoicesToStorage();

      // Refresh display
      this.loadInvoices();

      this.showToast('Invoice deleted successfully', 'success');
    }
  }

  saveInvoicesToStorage() {
    try {
      localStorage.setItem('marine_invoices', JSON.stringify(this.invoices));
    } catch (error) {
      console.error('Failed to save invoices to storage:', error);
    }
  }

  generateId() {
    return 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type} toast--show`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('toast--show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Make instance available globally for pagination
window.invoicesIndex = null;