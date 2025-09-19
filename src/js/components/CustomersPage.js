/**
 * CustomersPage - Complete customer directory management interface
 * Provides CRUD operations, search, pagination, and CSV import
 */
export class CustomersPage {
  constructor(options = {}) {
    this.options = {
      containerId: 'customers-page',
      pageSize: 25,
      ...options
    };

    this.customers = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalCustomers = 0;
    this.searchQuery = '';
    this.sortField = 'display_name';
    this.sortDirection = 'asc';
    this.isLoading = false;

    this.container = null;
    this.editingCustomer = null;

    this.init();
  }

  init() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      console.error(`CustomersPage: Container '${this.options.containerId}' not found`);
      return;
    }

    this.render();
    this.bindEvents();
    this.loadCustomers();
  }

  render() {
    this.container.innerHTML = `
      <div class="customers-page">
        <!-- Header -->
        <div class="customers-page__header">
          <div class="customers-page__title">
            <h1>Customer Directory</h1>
            <p class="customers-page__subtitle">Manage your customer database</p>
          </div>
          <div class="customers-page__actions">
            <button type="button" class="btn btn--outline" id="import-customers-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Import CSV
            </button>
            <button type="button" class="btn btn--primary" id="add-customer-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              Add Customer
            </button>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="customers-page__filters">
          <div class="search-bar">
            <div class="search-bar__input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search customers by name, email, or phone..."
                id="customers-search"
                class="search-input"
              />
            </div>
            <button type="button" class="btn btn--outline btn--sm" id="clear-search-btn">
              Clear
            </button>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="customers-page__stats">
          <div class="stat">
            <span class="stat__value" id="total-customers">-</span>
            <span class="stat__label">Total Customers</span>
          </div>
          <div class="stat">
            <span class="stat__value" id="active-customers">-</span>
            <span class="stat__label">Active</span>
          </div>
          <div class="stat">
            <span class="stat__value" id="this-month-customers">-</span>
            <span class="stat__label">Added This Month</span>
          </div>
        </div>

        <!-- Table -->
        <div class="customers-page__table">
          <div class="table-container">
            <table class="customers-table">
              <thead>
                <tr>
                  <th>
                    <button class="sort-btn" data-field="display_name">
                      Customer Name
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 14l5-5 5 5"/>
                      </svg>
                    </button>
                  </th>
                  <th>Contact Information</th>
                  <th>Address</th>
                  <th>
                    <button class="sort-btn" data-field="created_at">
                      Created
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 14l5-5 5 5"/>
                      </svg>
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="customers-table-body">
                <!-- Table rows will be inserted here -->
              </tbody>
            </table>
          </div>

          <!-- Loading State -->
          <div class="loading-state" id="customers-loading" style="display: none;">
            <div class="loading-spinner"></div>
            <p>Loading customers...</p>
          </div>

          <!-- Empty State -->
          <div class="empty-state" id="customers-empty" style="display: none;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <h3>No customers found</h3>
            <p>Get started by adding your first customer or importing from CSV.</p>
            <button type="button" class="btn btn--primary" onclick="document.getElementById('add-customer-btn').click()">
              Add Customer
            </button>
          </div>
        </div>

        <!-- Pagination -->
        <div class="customers-page__pagination" id="customers-pagination">
          <!-- Pagination will be rendered here -->
        </div>
      </div>

      <!-- Customer Modal -->
      <div class="modal" id="customer-modal" style="display: none;">
        <div class="modal__backdrop"></div>
        <div class="modal__content">
          <div class="modal__header">
            <h2 id="customer-modal-title">Add Customer</h2>
            <button type="button" class="modal__close" id="close-customer-modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal__body">
            <form id="customer-form" class="customer-form">
              <div class="form-grid form-grid--2-col">
                <div class="form-group">
                  <label for="customer-display-name" class="form-label">Customer Name *</label>
                  <input
                    type="text"
                    id="customer-display-name"
                    name="display_name"
                    class="form-input"
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="customer-legal-name" class="form-label">Legal Name</label>
                  <input
                    type="text"
                    id="customer-legal-name"
                    name="legal_name"
                    class="form-input"
                    placeholder="Legal business name"
                  />
                </div>

                <div class="form-group">
                  <label for="customer-email" class="form-label">Email</label>
                  <input
                    type="email"
                    id="customer-email"
                    name="email"
                    class="form-input"
                    placeholder="customer@example.com"
                  />
                </div>

                <div class="form-group">
                  <label for="customer-phone" class="form-label">Phone</label>
                  <input
                    type="tel"
                    id="customer-phone"
                    name="phone"
                    class="form-input"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div class="form-group">
                  <label for="customer-tax-id" class="form-label">Tax ID</label>
                  <input
                    type="text"
                    id="customer-tax-id"
                    name="tax_id"
                    class="form-input"
                    placeholder="EIN or Tax ID"
                  />
                </div>

                <div class="form-group">
                  <label for="customer-country" class="form-label">Country</label>
                  <select id="customer-country" name="country" class="form-select">
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="customer-address-1" class="form-label">Address Line 1</label>
                <input
                  type="text"
                  id="customer-address-1"
                  name="address_line1"
                  class="form-input"
                  placeholder="123 Main Street"
                />
              </div>

              <div class="form-group">
                <label for="customer-address-2" class="form-label">Address Line 2</label>
                <input
                  type="text"
                  id="customer-address-2"
                  name="address_line2"
                  class="form-input"
                  placeholder="Suite, Apt, Floor (optional)"
                />
              </div>

              <div class="form-grid form-grid--3-col">
                <div class="form-group">
                  <label for="customer-city" class="form-label">City</label>
                  <input
                    type="text"
                    id="customer-city"
                    name="city"
                    class="form-input"
                    placeholder="City"
                  />
                </div>

                <div class="form-group">
                  <label for="customer-state" class="form-label">State/Province</label>
                  <input
                    type="text"
                    id="customer-state"
                    name="state"
                    class="form-input"
                    placeholder="State"
                  />
                </div>

                <div class="form-group">
                  <label for="customer-postal-code" class="form-label">Postal Code</label>
                  <input
                    type="text"
                    id="customer-postal-code"
                    name="postal_code"
                    class="form-input"
                    placeholder="12345"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="customer-notes" class="form-label">Notes</label>
                <textarea
                  id="customer-notes"
                  name="notes"
                  class="form-textarea"
                  placeholder="Additional notes about this customer..."
                  rows="3"
                ></textarea>
              </div>
            </form>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--outline" id="cancel-customer-btn">Cancel</button>
            <button type="button" class="btn btn--primary" id="save-customer-btn">Save Customer</button>
          </div>
        </div>
      </div>

      <!-- Import Modal -->
      <div class="modal" id="import-modal" style="display: none;">
        <div class="modal__backdrop"></div>
        <div class="modal__content modal__content--lg">
          <div class="modal__header">
            <h2>Import Customers from CSV</h2>
            <button type="button" class="modal__close" id="close-import-modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal__body">
            <div id="import-content">
              <!-- Import content will be dynamically rendered -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Add customer button
    document.getElementById('add-customer-btn').addEventListener('click', () => {
      this.showCustomerModal();
    });

    // Import customers button
    document.getElementById('import-customers-btn').addEventListener('click', () => {
      this.showImportModal();
    });

    // Search input
    const searchInput = document.getElementById('customers-search');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchQuery = e.target.value;
        this.currentPage = 1;
        this.loadCustomers();
      }, 300);
    });

    // Clear search
    document.getElementById('clear-search-btn').addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      this.currentPage = 1;
      this.loadCustomers();
    });

    // Sort buttons
    this.container.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const field = e.currentTarget.dataset.field;
        if (this.sortField === field) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = field;
          this.sortDirection = 'asc';
        }
        this.updateSortUI();
        this.loadCustomers();
      });
    });

    // Modal events
    this.bindModalEvents();
  }

  bindModalEvents() {
    // Customer modal
    document.getElementById('close-customer-modal').addEventListener('click', () => {
      this.hideCustomerModal();
    });

    document.getElementById('cancel-customer-btn').addEventListener('click', () => {
      this.hideCustomerModal();
    });

    document.getElementById('save-customer-btn').addEventListener('click', () => {
      this.saveCustomer();
    });

    // Import modal
    document.getElementById('close-import-modal').addEventListener('click', () => {
      this.hideImportModal();
    });

    // Click outside to close modals
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal__backdrop')) {
        this.hideCustomerModal();
        this.hideImportModal();
      }
    });

    // Phone formatting
    document.getElementById('customer-phone').addEventListener('input', (e) => {
      const cleaned = e.target.value.replace(/\\D/g, '');
      const limited = cleaned.slice(0, 10);
      const formatted = this.formatPhoneNumber(limited);
      e.target.value = formatted;
    });
  }

  async loadCustomers() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading(true);

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.options.pageSize,
        active: true
      });

      if (this.searchQuery) {
        params.set('search', this.searchQuery);
      }

      const response = await fetch(`/api/customers?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to load customers: ${response.status}`);
      }

      const data = await response.json();

      this.customers = data.customers || [];
      this.totalCustomers = data.pagination?.total || 0;
      this.totalPages = data.pagination?.pages || 1;

      this.renderTable();
      this.renderPagination();
      this.updateStats();

    } catch (error) {
      console.error('Failed to load customers:', error);
      this.showError('Failed to load customers. Please try again.');
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  showLoading(show) {
    const loadingEl = document.getElementById('customers-loading');
    const tableEl = this.container.querySelector('.table-container');
    const emptyEl = document.getElementById('customers-empty');

    if (show) {
      loadingEl.style.display = 'flex';
      tableEl.style.display = 'none';
      emptyEl.style.display = 'none';
    } else {
      loadingEl.style.display = 'none';
      if (this.customers.length === 0) {
        tableEl.style.display = 'none';
        emptyEl.style.display = 'flex';
      } else {
        tableEl.style.display = 'block';
        emptyEl.style.display = 'none';
      }
    }
  }

  renderTable() {
    const tbody = document.getElementById('customers-table-body');

    if (this.customers.length === 0) {
      tbody.innerHTML = '';
      return;
    }

    tbody.innerHTML = this.customers.map(customer => `
      <tr>
        <td>
          <div class="customer-cell">
            <div class="customer-name">${this.escapeHtml(customer.display_name)}</div>
            ${customer.legal_name ? `<div class="customer-legal">${this.escapeHtml(customer.legal_name)}</div>` : ''}
          </div>
        </td>
        <td>
          <div class="contact-cell">
            ${customer.email ? `<div class="contact-email">${this.escapeHtml(customer.email)}</div>` : ''}
            ${customer.phone ? `<div class="contact-phone">${this.escapeHtml(customer.phone)}</div>` : ''}
          </div>
        </td>
        <td>
          <div class="address-cell">
            ${this.formatAddress(customer)}
          </div>
        </td>
        <td>
          <div class="date-cell">
            ${this.formatDate(customer.created_at)}
          </div>
        </td>
        <td>
          <div class="actions-cell">
            <button type="button" class="btn btn--ghost btn--sm" onclick="customersPage.editCustomer('${customer.id}')" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button type="button" class="btn btn--ghost btn--sm" onclick="customersPage.deleteCustomer('${customer.id}')" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderPagination() {
    const container = document.getElementById('customers-pagination');

    if (this.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let pages = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    container.innerHTML = `
      <div class="pagination">
        <button
          class="pagination__btn"
          onclick="customersPage.goToPage(${this.currentPage - 1})"
          ${this.currentPage === 1 ? 'disabled' : ''}
        >
          Previous
        </button>

        ${pages.map(page => `
          <button
            class="pagination__btn ${page === this.currentPage ? 'pagination__btn--active' : ''}"
            onclick="customersPage.goToPage(${page})"
          >
            ${page}
          </button>
        `).join('')}

        <button
          class="pagination__btn"
          onclick="customersPage.goToPage(${this.currentPage + 1})"
          ${this.currentPage === this.totalPages ? 'disabled' : ''}
        >
          Next
        </button>
      </div>

      <div class="pagination__info">
        Showing ${(this.currentPage - 1) * this.options.pageSize + 1} to ${Math.min(this.currentPage * this.options.pageSize, this.totalCustomers)} of ${this.totalCustomers} customers
      </div>
    `;
  }

  updateStats() {
    document.getElementById('total-customers').textContent = this.totalCustomers;
    document.getElementById('active-customers').textContent = this.customers.filter(c => c.is_active).length;

    // Calculate this month's customers
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const thisMonthCount = this.customers.filter(c =>
      new Date(c.created_at) >= thisMonth
    ).length;
    document.getElementById('this-month-customers').textContent = thisMonthCount;
  }

  updateSortUI() {
    this.container.querySelectorAll('.sort-btn').forEach(btn => {
      const field = btn.dataset.field;
      const svg = btn.querySelector('svg');

      if (field === this.sortField) {
        btn.classList.add('sort-btn--active');
        svg.style.transform = this.sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)';
      } else {
        btn.classList.remove('sort-btn--active');
        svg.style.transform = 'rotate(0deg)';
      }
    });
  }

  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;

    this.currentPage = page;
    this.loadCustomers();
  }

  showCustomerModal(customer = null) {
    this.editingCustomer = customer;

    const modal = document.getElementById('customer-modal');
    const title = document.getElementById('customer-modal-title');
    const form = document.getElementById('customer-form');

    title.textContent = customer ? 'Edit Customer' : 'Add Customer';

    if (customer) {
      this.populateCustomerForm(customer);
    } else {
      form.reset();
    }

    modal.style.display = 'flex';
    document.getElementById('customer-display-name').focus();
  }

  hideCustomerModal() {
    document.getElementById('customer-modal').style.display = 'none';
    this.editingCustomer = null;
  }

  populateCustomerForm(customer) {
    const form = document.getElementById('customer-form');
    const fields = [
      'display_name', 'legal_name', 'email', 'phone', 'tax_id',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code',
      'country', 'notes'
    ];

    fields.forEach(field => {
      const input = form.querySelector(`[name="${field}"]`);
      if (input && customer[field] !== undefined) {
        input.value = customer[field] || '';
      }
    });
  }

  async saveCustomer() {
    try {
      const form = document.getElementById('customer-form');
      const formData = new FormData(form);
      const customerData = Object.fromEntries(formData);

      // Clean up empty strings
      Object.keys(customerData).forEach(key => {
        if (customerData[key] === '') {
          customerData[key] = null;
        }
      });

      const url = this.editingCustomer
        ? `/api/customers/${this.editingCustomer.id}`
        : '/api/customers';

      const method = this.editingCustomer ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save customer');
      }

      this.hideCustomerModal();
      this.loadCustomers();
      this.showSuccess(this.editingCustomer ? 'Customer updated successfully' : 'Customer created successfully');

    } catch (error) {
      console.error('Failed to save customer:', error);
      this.showError(error.message);
    }
  }

  async editCustomer(id) {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load customer');
      }

      const customer = await response.json();
      this.showCustomerModal(customer);

    } catch (error) {
      console.error('Failed to load customer:', error);
      this.showError('Failed to load customer details');
    }
  }

  async deleteCustomer(id) {
    if (!confirm('Are you sure you want to deactivate this customer? This action can be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete customer');
      }

      this.loadCustomers();
      this.showSuccess('Customer deactivated successfully');

    } catch (error) {
      console.error('Failed to delete customer:', error);
      this.showError(error.message);
    }
  }

  showImportModal() {
    const modal = document.getElementById('import-modal');
    modal.style.display = 'flex';
    this.renderImportContent();
  }

  hideImportModal() {
    document.getElementById('import-modal').style.display = 'none';
  }

  renderImportContent() {
    const container = document.getElementById('import-content');
    container.innerHTML = `
      <div class="import-steps">
        <div class="import-step import-step--active" id="import-step-1">
          <h3>Step 1: Download Template</h3>
          <p>Download our CSV template to ensure your data is formatted correctly.</p>
          <button type="button" class="btn btn--outline" id="download-template-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Template
          </button>
        </div>

        <div class="import-step" id="import-step-2">
          <h3>Step 2: Upload CSV File</h3>
          <p>Upload your CSV file with customer data. We'll validate it before importing.</p>
          <div class="file-upload">
            <input type="file" id="csv-file-input" accept=".csv" style="display: none;" />
            <button type="button" class="btn btn--primary" onclick="document.getElementById('csv-file-input').click()">
              Choose CSV File
            </button>
            <div id="file-info" class="file-info" style="display: none;"></div>
          </div>
        </div>

        <div class="import-step" id="import-step-3" style="display: none;">
          <h3>Step 3: Review & Import</h3>
          <div id="import-preview"></div>
        </div>
      </div>
    `;

    this.bindImportEvents();
  }

  bindImportEvents() {
    // Download template
    document.getElementById('download-template-btn').addEventListener('click', () => {
      window.open('/api/customers/export/template', '_blank');
    });

    // File input
    document.getElementById('csv-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleCSVUpload(file);
      }
    });
  }

  async handleCSVUpload(file) {
    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch('/api/customers/import/validate', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to validate CSV file');
      }

      const result = await response.json();
      this.showImportPreview(result);

    } catch (error) {
      console.error('CSV upload failed:', error);
      this.showError('Failed to process CSV file. Please check the format and try again.');
    }
  }

  showImportPreview(result) {
    const step3 = document.getElementById('import-step-3');
    const preview = document.getElementById('import-preview');

    step3.style.display = 'block';

    preview.innerHTML = `
      <div class="import-results">
        <div class="import-stats">
          <div class="stat">
            <span class="stat__value ${result.stats.valid_customers > 0 ? 'stat__value--success' : ''}">${result.stats.valid_customers}</span>
            <span class="stat__label">Valid Customers</span>
          </div>
          <div class="stat">
            <span class="stat__value ${result.stats.error_count > 0 ? 'stat__value--error' : ''}">${result.stats.error_count}</span>
            <span class="stat__label">Errors</span>
          </div>
          <div class="stat">
            <span class="stat__value ${result.stats.duplicate_count > 0 ? 'stat__value--warning' : ''}">${result.stats.duplicate_count}</span>
            <span class="stat__label">Duplicates</span>
          </div>
        </div>

        ${result.errors.length > 0 ? `
          <div class="import-errors">
            <h4>Errors Found</h4>
            <ul>
              ${result.errors.map(error => `<li>Row ${error.row}: ${error.message}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${result.duplicates.length > 0 ? `
          <div class="import-duplicates">
            <h4>Duplicates Found</h4>
            <ul>
              ${result.duplicates.map(dup => `<li>Row ${dup.row}: ${dup.display_name} (${dup.message})</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="import-actions">
          ${result.valid ? `
            <button type="button" class="btn btn--primary" onclick="customersPage.commitImport(${JSON.stringify(result.customers).replace(/"/g, '&quot;')})">
              Import ${result.stats.valid_customers} Customers
            </button>
          ` : `
            <p class="import-error">Please fix the errors above before importing.</p>
          `}
          <button type="button" class="btn btn--outline" onclick="customersPage.hideImportModal()">
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  async commitImport(customers) {
    try {
      const response = await fetch('/api/customers/import/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ customers })
      });

      if (!response.ok) {
        throw new Error('Failed to import customers');
      }

      const result = await response.json();

      this.hideImportModal();
      this.loadCustomers();
      this.showSuccess(`Successfully imported ${result.imported} customers`);

    } catch (error) {
      console.error('Import failed:', error);
      this.showError('Failed to import customers. Please try again.');
    }
  }

  // Utility methods
  formatAddress(customer) {
    const parts = [
      customer.address_line1,
      customer.city,
      customer.state,
      customer.postal_code
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : '-';
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  }

  formatPhoneNumber(phoneNumber) {
    if (phoneNumber.length <= 3) return phoneNumber;
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast--show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Make it globally available for onclick handlers
window.customersPage = null;