/**
 * CustomersPage - Complete customer directory management interface
 * Provides CRUD operations, search, pagination, and CSV import
 */
export class CustomersPage {
  constructor(options = {}) {
    this.options = {
      containerId: 'customers-page',
      pageSize: 25,
      maxRetries: 3,
      retryDelay: 1000,
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

    // 🔧 PHASE 3 STABILIZATION: Enhanced state management
    this.isMounted = false;
    this.isDestroyed = false;
    this.eventListeners = new Map();
    this.timers = new Set();
    this.retryCount = 0;
    this.lastError = null;

    // 🛡️ DEFENSIVE: Validate environment before initialization
    this.validateEnvironment().then(isValid => {
      if (isValid && !this.isDestroyed) {
        this.init();
      }
    }).catch(error => {
      console.error('❌ Environment validation failed:', error);
      this.handleCriticalError(error);
    });
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Validate environment before initialization
   */
  async validateEnvironment() {
    try {
      // Check DOM readiness
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // Check authentication state
      const authState = this.validateAuthenticationState();
      if (!authState.valid) {
        console.warn('⚠️ Authentication state invalid:', authState.reason);
        // Don't fail initialization - let auth system handle it
      }

      // Check required APIs
      const apiCheck = await this.validateApiAvailability();
      if (!apiCheck.available) {
        console.warn('⚠️ API availability limited:', apiCheck.reason);
        // Continue with degraded functionality
      }

      return true;
    } catch (error) {
      console.error('❌ Environment validation error:', error);
      return false;
    }
  }

  /**
   * 🛡️ DEFENSIVE: Validate authentication state
   */
  validateAuthenticationState() {
    const storedUser = localStorage.getItem('marine_invoice_user');
    const storedSession = localStorage.getItem('marine_invoice_session');

    if (!storedUser || !storedSession) {
      return { valid: false, reason: 'No stored authentication' };
    }

    try {
      const user = JSON.parse(storedUser);
      const session = JSON.parse(storedSession);

      // Check session expiry
      const now = Date.now();
      const sessionAge = now - session.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge > maxAge) {
        return { valid: false, reason: 'Session expired' };
      }

      if (!user.id || !user.email) {
        return { valid: false, reason: 'Invalid user data' };
      }

      return { valid: true, user, session };
    } catch (error) {
      return { valid: false, reason: 'Invalid stored data' };
    }
  }

  /**
   * 🛡️ DEFENSIVE: Check API availability
   */
  async validateApiAvailability() {
    try {
      const response = await fetch('/api/customers?limit=1', {
        method: 'HEAD',
        credentials: 'include'
      });

      return {
        available: response.ok,
        status: response.status,
        reason: response.ok ? 'API available' : `API returned ${response.status}`
      };
    } catch (error) {
      return {
        available: false,
        reason: `Network error: ${error.message}`
      };
    }
  }

  init() {
    if (this.isDestroyed) {
      console.warn('⚠️ Attempted to initialize destroyed CustomersPage');
      return;
    }

    // 🛡️ DEFENSIVE: Multiple container resolution attempts
    this.container = this.findContainer();
    if (!this.container) {
      console.error(`❌ CustomersPage: Container '${this.options.containerId}' not found`);
      this.handleContainerError();
      return;
    }

    try {
      console.log('🔧 PHASE 3: Initializing CustomersPage...');

      this.render();
      this.bindEvents();
      this.isMounted = true;

      // 🔧 STABILIZATION: Load data with retry logic
      this.loadCustomersWithRetry();

      console.log('✅ CustomersPage initialized successfully');
    } catch (error) {
      console.error('❌ Error during CustomersPage initialization:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * 🛡️ DEFENSIVE: Multiple container resolution strategies
   */
  findContainer() {
    // Try primary ID
    let container = document.getElementById(this.options.containerId);
    if (container) return container;

    // Try with small delay in case DOM is still loading
    return new Promise(resolve => {
      const maxAttempts = 10;
      let attempts = 0;

      const tryFind = () => {
        attempts++;
        container = document.getElementById(this.options.containerId);

        if (container) {
          resolve(container);
        } else if (attempts < maxAttempts) {
          setTimeout(tryFind, 100);
        } else {
          resolve(null);
        }
      };

      tryFind();
    });
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

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced event binding with cleanup tracking
   */
  bindEvents() {
    try {
      // 🛡️ DEFENSIVE: Bind events with error handling and cleanup tracking
      this.bindEventSafely('add-customer-btn', 'click', () => {
        this.showCustomerModal();
      });

      this.bindEventSafely('import-customers-btn', 'click', () => {
        this.showImportModal();
      });

      // Search input with enhanced debouncing
      const searchInput = document.getElementById('customers-search');
      if (searchInput) {
        let searchTimeout;
        const searchHandler = (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            if (!this.isDestroyed) {
              this.searchQuery = e.target.value;
              this.currentPage = 1;
              this.loadCustomersWithRetry();
            }
          }, 300);

          // Track timeout for cleanup
          this.timers.add(searchTimeout);
        };

        searchInput.addEventListener('input', searchHandler);
        this.eventListeners.set('customers-search', { element: searchInput, event: 'input', handler: searchHandler });
      }

      this.bindEventSafely('clear-search-btn', 'click', () => {
        const searchInput = document.getElementById('customers-search');
        if (searchInput) {
          searchInput.value = '';
          this.searchQuery = '';
          this.currentPage = 1;
          this.loadCustomersWithRetry();
        }
      });

      // Sort buttons with defensive checks
      const sortButtons = this.container?.querySelectorAll('.sort-btn') || [];
      sortButtons.forEach((btn, index) => {
        const sortHandler = (e) => {
          if (this.isDestroyed) return;

          const field = e.currentTarget.dataset.field;
          if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortField = field;
            this.sortDirection = 'asc';
          }
          this.updateSortUI();
          this.loadCustomersWithRetry();
        };

        btn.addEventListener('click', sortHandler);
        this.eventListeners.set(`sort-btn-${index}`, { element: btn, event: 'click', handler: sortHandler });
      });

      // Modal events
      this.bindModalEvents();

      console.log('✅ Events bound successfully');
    } catch (error) {
      console.error('❌ Error binding events:', error);
      this.handleEventBindingError(error);
    }
  }

  /**
   * 🛡️ DEFENSIVE: Safe event binding with automatic cleanup tracking
   */
  bindEventSafely(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`⚠️ Element '${elementId}' not found for event binding`);
      return;
    }

    const safeHandler = (...args) => {
      if (this.isDestroyed) return;
      try {
        handler(...args);
      } catch (error) {
        console.error(`❌ Error in event handler for ${elementId}:`, error);
      }
    };

    element.addEventListener(eventType, safeHandler);
    this.eventListeners.set(elementId, { element, event: eventType, handler: safeHandler });
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

  /**
   * 🔧 PHASE 3 STABILIZATION: Load customers with retry logic
   */
  async loadCustomersWithRetry() {
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        await this.loadCustomers();
        this.retryCount = 0; // Reset on success
        return;
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);

        if (attempt === this.options.maxRetries) {
          this.handleLoadFailure(error);
          break;
        }

        // Exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }
    }
  }

  async loadCustomers() {
    if (this.isLoading || this.isDestroyed) return;

    this.isLoading = true;
    this.showLoading(true);
    this.lastError = null;

    try {
      // 🛡️ DEFENSIVE: Validate state before API call
      if (!this.validateLoadConditions()) {
        throw new Error('Invalid load conditions');
      }

      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.options.pageSize,
        active: true
      });

      if (this.searchQuery) {
        params.set('search', this.searchQuery);
      }

      // 🔧 STABILIZATION: Enhanced fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`/api/customers?${params}`, {
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 🛡️ DEFENSIVE: Validate response data
      this.validateResponseData(data);

      this.customers = data.customers || [];
      this.totalCustomers = data.pagination?.total || 0;
      this.totalPages = data.pagination?.pages || 1;

      // 🔧 STABILIZATION: Idempotent rendering
      if (!this.isDestroyed) {
        this.renderTable();
        this.renderPagination();
        this.updateStats();
      }

    } catch (error) {
      this.lastError = error;
      console.error('❌ Failed to load customers:', error);

      if (error.name === 'AbortError') {
        this.showError('Request timed out. Please try again.');
      } else if (error.message.includes('401')) {
        this.handleAuthenticationError();
      } else {
        this.showError(`Failed to load customers: ${error.message}`);
      }
    } finally {
      this.isLoading = false;
      if (!this.isDestroyed) {
        this.showLoading(false);
      }
    }
  }

  /**
   * 🛡️ DEFENSIVE: Validate conditions before loading
   */
  validateLoadConditions() {
    if (!this.container) {
      console.error('❌ No container available for loading');
      return false;
    }

    if (!this.isMounted) {
      console.warn('⚠️ Component not mounted, skipping load');
      return false;
    }

    return true;
  }

  /**
   * 🛡️ DEFENSIVE: Validate API response data
   */
  validateResponseData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response data format');
    }

    if (!Array.isArray(data.customers)) {
      console.warn('⚠️ customers array missing or invalid, using empty array');
      data.customers = [];
    }

    if (!data.pagination || typeof data.pagination !== 'object') {
      console.warn('⚠️ pagination data missing, using defaults');
      data.pagination = { total: 0, pages: 1 };
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
    if (this.isDestroyed) return;

    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    const showTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        toast.classList.add('toast--show');
      }
    }, 10);

    const hideTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        toast.classList.remove('toast--show');
        const removeTimer = setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
        this.timers.add(removeTimer);
      }
    }, 3000);

    this.timers.add(showTimer);
    this.timers.add(hideTimer);
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Error handling and recovery methods
   */
  handleContainerError() {
    console.error('🔧 CONTAINER ERROR: CustomersPage container not found');

    // Try to recover by creating a minimal container
    const fallbackContainer = document.createElement('div');
    fallbackContainer.id = this.options.containerId;
    fallbackContainer.innerHTML = `
      <div class="error-state">
        <h2>Error Loading Customers</h2>
        <p>The customers page container could not be found.</p>
        <button onclick="window.location.reload()">Reload Page</button>
      </div>
    `;

    document.body.appendChild(fallbackContainer);
    this.container = fallbackContainer;
  }

  handleInitializationError(error) {
    console.error('🔧 INIT ERROR:', error);
    this.lastError = error;

    if (this.container) {
      this.container.innerHTML = `
        <div class="error-state">
          <h2>Initialization Error</h2>
          <p>Failed to initialize the customers page: ${error.message}</p>
          <button onclick="window.location.reload()">Reload Page</button>
        </div>
      `;
    }
  }

  handleLoadFailure(error) {
    console.error('🔧 LOAD FAILURE:', error);
    this.lastError = error;

    // Show error state with retry option
    if (this.container) {
      const errorContainer = this.container.querySelector('.customers-page') || this.container;
      errorContainer.innerHTML = `
        <div class="error-state">
          <h2>Failed to Load Customers</h2>
          <p>Could not load customer data after ${this.options.maxRetries} attempts.</p>
          <p>Error: ${error.message}</p>
          <button onclick="customersPage?.retryLoad()" class="btn btn--primary">Try Again</button>
          <button onclick="window.location.reload()" class="btn btn--outline">Reload Page</button>
        </div>
      `;
    }
  }

  handleAuthenticationError() {
    console.error('🔧 AUTH ERROR: Authentication required');

    // Redirect to login or show auth modal
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/?auth=required';
    }
  }

  handleEventBindingError(error) {
    console.error('🔧 EVENT ERROR:', error);
    // Continue with limited functionality
    this.showError('Some interactive features may not work properly.');
  }

  handleCriticalError(error) {
    console.error('🔧 CRITICAL ERROR:', error);

    // Show minimal error page
    const errorHTML = `
      <div class="critical-error">
        <h1>System Error</h1>
        <p>A critical error occurred while loading the customers page.</p>
        <p>Please refresh the page or contact support if the problem persists.</p>
        <button onclick="window.location.reload()">Reload Page</button>
      </div>
    `;

    if (this.container) {
      this.container.innerHTML = errorHTML;
    } else {
      document.body.innerHTML = errorHTML;
    }
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Recovery and utility methods
   */
  async retryLoad() {
    console.log('🔄 Manual retry requested');
    this.retryCount = 0;
    await this.loadCustomersWithRetry();
  }

  async delay(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      this.timers.add(timer);
    });
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Enhanced cleanup and memory management
   */
  destroy() {
    console.log('🧹 Destroying CustomersPage...');

    this.isDestroyed = true;
    this.isMounted = false;

    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(event, handler);
      }
    });
    this.eventListeners.clear();

    // Clear references
    this.container = null;
    this.customers = [];
    this.editingCustomer = null;
    this.lastError = null;

    console.log('✅ CustomersPage destroyed');
  }

  /**
   * 🔧 PHASE 3 STABILIZATION: Health check and diagnostics
   */
  getHealthStatus() {
    return {
      isHealthy: !this.isDestroyed && this.isMounted && !!this.container,
      isMounted: this.isMounted,
      isDestroyed: this.isDestroyed,
      hasContainer: !!this.container,
      isLoading: this.isLoading,
      lastError: this.lastError?.message || null,
      retryCount: this.retryCount,
      customersCount: this.customers.length,
      eventListenersCount: this.eventListeners.size,
      timersCount: this.timers.size
    };
  }
}

// Make it globally available for onclick handlers
window.customersPage = null;

// 🔧 PHASE 3 STABILIZATION: Enhanced global error handling
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (window.customersPage && typeof window.customersPage.handleCriticalError === 'function') {
      window.customersPage.handleCriticalError(event.error);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('🔧 Unhandled promise rejection in CustomersPage:', event.reason);
    if (window.customersPage && typeof window.customersPage.handleCriticalError === 'function') {
      window.customersPage.handleCriticalError(new Error(event.reason));
    }
  });
}