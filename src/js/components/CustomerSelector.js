import { TypeaheadCombobox } from './TypeaheadCombobox.js';

/**
 * CustomerSelector - Enhanced customer selection with typeahead and autofill
 * Integrates with customer directory API for search and selection
 */
export class CustomerSelector {
  constructor(options) {
    this.options = {
      containerId: null,
      onSelect: null,
      onError: null,
      allowCreate: true,
      ...options
    };

    this.combobox = null;
    this.selectedCustomer = null;
    this.container = null;
    this.fieldsContainer = null;

    this.init();
  }

  init() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      console.error(`CustomerSelector: Container '${this.options.containerId}' not found`);
      return;
    }

    this.createElements();
    this.initializeCombobox();
  }

  createElements() {
    this.container.innerHTML = `
      <div class="customer-selector">
        <div class="customer-selector__search">
          <label for="${this.options.containerId}-combobox" class="form-label">
            Customer
            <span class="form-label__helper">Search existing customers or create new</span>
          </label>
          <div id="${this.options.containerId}-combobox" class="customer-combobox"></div>
        </div>

        <div class="customer-selector__fields" id="${this.options.containerId}-fields">
          <div class="form-grid form-grid--2-col">
            <div class="form-group">
              <label for="${this.options.containerId}-name" class="form-label">Customer Name</label>
              <input
                type="text"
                id="${this.options.containerId}-name"
                class="form-input"
                placeholder="Enter customer name"
                required
              />
            </div>

            <div class="form-group">
              <label for="${this.options.containerId}-email" class="form-label">Email</label>
              <input
                type="email"
                id="${this.options.containerId}-email"
                class="form-input"
                placeholder="customer@example.com"
              />
            </div>

            <div class="form-group">
              <label for="${this.options.containerId}-phone" class="form-label">Phone</label>
              <input
                type="tel"
                id="${this.options.containerId}-phone"
                class="form-input"
                placeholder="(555) 123-4567"
              />
            </div>

            <div class="form-group">
              <label for="${this.options.containerId}-address" class="form-label">Address</label>
              <input
                type="text"
                id="${this.options.containerId}-address"
                class="form-input"
                placeholder="123 Main St, City, State"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="${this.options.containerId}-notes" class="form-label">Notes</label>
            <textarea
              id="${this.options.containerId}-notes"
              class="form-textarea"
              placeholder="Additional customer notes..."
              rows="2"
            ></textarea>
          </div>

          <div class="customer-selector__actions">
            <button
              type="button"
              id="${this.options.containerId}-clear"
              class="btn btn--outline btn--sm"
            >
              Clear Selection
            </button>
            <button
              type="button"
              id="${this.options.containerId}-create"
              class="btn btn--primary btn--sm"
              style="display: none;"
            >
              Create Customer
            </button>
          </div>
        </div>
      </div>
    `;

    this.fieldsContainer = this.container.querySelector('.customer-selector__fields');
    this.bindFieldEvents();
  }

  bindFieldEvents() {
    // Get form elements
    this.nameInput = document.getElementById(`${this.options.containerId}-name`);
    this.emailInput = document.getElementById(`${this.options.containerId}-email`);
    this.phoneInput = document.getElementById(`${this.options.containerId}-phone`);
    this.addressInput = document.getElementById(`${this.options.containerId}-address`);
    this.notesInput = document.getElementById(`${this.options.containerId}-notes`);
    this.clearButton = document.getElementById(`${this.options.containerId}-clear`);
    this.createButton = document.getElementById(`${this.options.containerId}-create`);

    // Clear button
    this.clearButton.addEventListener('click', () => {
      this.clearSelection();
    });

    // Create button
    this.createButton.addEventListener('click', () => {
      this.createCustomer();
    });

    // Form input changes
    [this.nameInput, this.emailInput, this.phoneInput, this.addressInput, this.notesInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          this.handleFieldChange();
        });
      }
    });

    // Phone formatting
    if (this.phoneInput) {
      this.phoneInput.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/\\D/g, '');
        const limited = cleaned.slice(0, 10);
        const formatted = this.formatPhoneNumber(limited);
        e.target.value = formatted;
      });
    }
  }

  initializeCombobox() {
    this.combobox = new TypeaheadCombobox({
      containerId: `${this.options.containerId}-combobox`,
      apiEndpoint: '/api/customers/search',
      placeholder: 'Search customers by name, email, or phone...',
      allowCreate: this.options.allowCreate,
      createLabel: 'Create customer',
      formatItem: (customer) => this.formatCustomerOption(customer),
      onSelect: (customer) => this.handleCustomerSelect(customer),
      onError: (error) => {
        console.error('Customer search error:', error);
        if (this.options.onError) {
          this.options.onError(error);
        }
      }
    });
  }

  formatCustomerOption(customer) {
    return `
      <div class="customer-info">
        <div class="customer-name">${this.escapeHtml(customer.display_name)}</div>
        <div class="customer-details">
          ${customer.email ? `<span class="customer-email">${this.escapeHtml(customer.email)}</span>` : ''}
          ${customer.phone ? `<span class="customer-phone">${this.escapeHtml(customer.phone)}</span>` : ''}
        </div>
        ${customer.address_line1 ? `<div class="customer-address">${this.escapeHtml(customer.address_line1)}${customer.city ? ', ' + this.escapeHtml(customer.city) : ''}${customer.state ? ', ' + this.escapeHtml(customer.state) : ''}</div>` : ''}
      </div>
    `;
  }

  handleCustomerSelect(customer) {
    if (customer._isNew) {
      // Handle "create new" selection
      this.selectedCustomer = null;
      this.nameInput.value = customer.display_name;
      this.showCreateButton(true);
      this.combobox.setValue(customer.display_name);
    } else {
      // Handle existing customer selection
      this.selectedCustomer = customer;
      this.populateFields(customer);
      this.showCreateButton(false);
      this.combobox.setValue(customer.display_name);
    }

    if (this.options.onSelect) {
      this.options.onSelect(customer);
    }
  }

  populateFields(customer) {
    if (this.nameInput) this.nameInput.value = customer.display_name || '';
    if (this.emailInput) this.emailInput.value = customer.email || '';
    if (this.phoneInput) this.phoneInput.value = customer.phone || '';
    if (this.notesInput) this.notesInput.value = customer.notes || '';

    // Combine address fields
    if (this.addressInput) {
      const addressParts = [
        customer.address_line1,
        customer.address_line2,
        customer.city,
        customer.state,
        customer.postal_code
      ].filter(Boolean);
      this.addressInput.value = addressParts.join(', ');
    }
  }

  handleFieldChange() {
    // Show create button if we have a name but no selected customer
    const hasName = this.nameInput && this.nameInput.value.trim();
    const noSelection = !this.selectedCustomer;
    this.showCreateButton(hasName && noSelection);
  }

  showCreateButton(show) {
    if (this.createButton) {
      this.createButton.style.display = show ? 'inline-flex' : 'none';
    }
  }

  async createCustomer() {
    try {
      const customerData = this.getCustomerData();

      // Validate required fields
      if (!customerData.display_name?.trim()) {
        throw new Error('Customer name is required');
      }

      // Call API to create customer
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create customer');
      }

      const newCustomer = await response.json();

      // Update selection state
      this.selectedCustomer = newCustomer;
      this.showCreateButton(false);

      // Show success message
      this.showMessage('Customer created successfully', 'success');

      if (this.options.onSelect) {
        this.options.onSelect(newCustomer);
      }

    } catch (error) {
      console.error('Failed to create customer:', error);
      this.showMessage(error.message, 'error');

      if (this.options.onError) {
        this.options.onError(error);
      }
    }
  }

  clearSelection() {
    this.selectedCustomer = null;

    // Clear all fields
    if (this.nameInput) this.nameInput.value = '';
    if (this.emailInput) this.emailInput.value = '';
    if (this.phoneInput) this.phoneInput.value = '';
    if (this.addressInput) this.addressInput.value = '';
    if (this.notesInput) this.notesInput.value = '';

    // Clear combobox
    if (this.combobox) {
      this.combobox.clear();
    }

    this.showCreateButton(false);

    if (this.options.onSelect) {
      this.options.onSelect(null);
    }
  }

  getCustomerData() {
    return {
      display_name: this.nameInput?.value?.trim() || '',
      email: this.emailInput?.value?.trim() || null,
      phone: this.phoneInput?.value?.trim() || null,
      notes: this.notesInput?.value?.trim() || null,
      // Parse address (simplified - could be enhanced with proper parsing)
      address_line1: this.addressInput?.value?.trim() || null
    };
  }

  // Public API methods
  getSelectedCustomer() {
    return this.selectedCustomer;
  }

  setCustomer(customer) {
    if (customer) {
      this.selectedCustomer = customer;
      this.populateFields(customer);
      this.combobox.setValue(customer.display_name);
      this.showCreateButton(false);
    } else {
      this.clearSelection();
    }
  }

  // Utility methods
  formatPhoneNumber(phoneNumber) {
    if (phoneNumber.length <= 3) return phoneNumber;
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showMessage(message, type = 'info') {
    // Create or update message element
    let messageEl = this.container.querySelector('.customer-selector__message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'customer-selector__message';
      this.container.appendChild(messageEl);
    }

    messageEl.textContent = message;
    messageEl.className = `customer-selector__message customer-selector__message--${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (messageEl && messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }

  destroy() {
    if (this.combobox) {
      this.combobox.destroy();
    }
  }
}