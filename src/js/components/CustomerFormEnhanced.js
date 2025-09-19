import { CustomerSelector } from './CustomerSelector.js';
import { validateEmail, validatePhone } from '../state/validators.js';
import { formatPhoneNumber } from '../utils/formatters.js';
import { safeString } from '../utils/safeString.js';

/**
 * Enhanced CustomerForm with CustomerSelector integration
 * Provides both typeahead selection and manual input capabilities
 */
export class CustomerFormEnhanced {
  constructor(state) {
    this.state = state;
    this.customerSelector = null;
    this.initElements();
    this.attachListeners();
  }

  initElements() {
    // Get the customer form container
    const container = document.getElementById('customer-tab') || document.querySelector('.customer-form-container');

    if (!container) {
      console.error('❌ CustomerFormEnhanced: Customer container not found');
      return;
    }

    // Replace existing customer form with enhanced version
    this.replaceCustomerForm(container);
    this.initializeCustomerSelector();
  }

  replaceCustomerForm(container) {
    // Find existing customer fields or create new container
    let customerFieldsContainer = container.querySelector('.customer-fields');

    if (!customerFieldsContainer) {
      customerFieldsContainer = container;
    }

    // Create enhanced customer form HTML
    customerFieldsContainer.innerHTML = `
      <div class="customer-form-enhanced">
        <!-- Customer Selector Section -->
        <div class="customer-selector-section">
          <div id="invoice-customer-selector"></div>
        </div>

        <!-- Manual Entry Fallback -->
        <div class="manual-entry-section" id="manual-entry-section" style="display: none;">
          <div class="section-header">
            <h3>Manual Customer Entry</h3>
            <button type="button" class="btn btn--sm btn--outline" id="toggle-selector-btn">
              Use Customer Directory
            </button>
          </div>

          <div class="form-grid form-grid--2-col">
            <div class="form-group">
              <label for="customer-name" class="form-label">Customer Name</label>
              <input
                type="text"
                id="customer-name"
                class="form-input"
                placeholder="Enter customer name"
              />
            </div>

            <div class="form-group">
              <label for="customer-email" class="form-label">Email</label>
              <input
                type="email"
                id="customer-email"
                class="form-input"
                placeholder="customer@example.com"
              />
              <div class="email-error error-message"></div>
            </div>

            <div class="form-group">
              <label for="customer-phone" class="form-label">Phone</label>
              <input
                type="tel"
                id="customer-phone"
                class="form-input"
                placeholder="(555) 123-4567"
              />
            </div>

            <div class="form-group">
              <label for="customer-address" class="form-label">Address</label>
              <input
                type="text"
                id="customer-address"
                class="form-input"
                placeholder="123 Main St, City, State"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="customer-notes" class="form-label">Notes</label>
            <textarea
              id="customer-notes"
              class="form-textarea"
              placeholder="Additional customer notes..."
              rows="2"
            ></textarea>
          </div>
        </div>

        <!-- Customer Display Card -->
        <div class="customer-display-card" id="customer-display-card" style="display: none;">
          <div class="customer-card-header">
            <h3>Selected Customer</h3>
            <div class="customer-card-actions">
              <button type="button" class="btn btn--sm btn--ghost" id="edit-customer-btn" title="Edit Customer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button type="button" class="btn btn--sm btn--ghost" id="clear-customer-btn" title="Clear Selection">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="customer-card-content" id="customer-card-content">
            <!-- Customer details will be populated here -->
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="customer-quick-actions">
          <button type="button" class="btn btn--sm btn--outline" id="toggle-manual-entry-btn">
            Manual Entry
          </button>
          <button type="button" class="btn btn--sm btn--primary" id="open-customers-page-btn">
            Manage Customers
          </button>
        </div>
      </div>
    `;

    // Add styles
    this.addCustomerFormStyles();
  }

  addCustomerFormStyles() {
    // Check if styles already added
    if (document.getElementById('customer-form-enhanced-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'customer-form-enhanced-styles';
    style.textContent = `
      .customer-form-enhanced {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .customer-selector-section {
        background: rgb(39, 39, 42);
        border: 1px solid rgb(63, 63, 70);
        border-radius: 0.75rem;
        padding: 1.5rem;
      }

      .manual-entry-section {
        background: rgb(39, 39, 42);
        border: 1px solid rgb(63, 63, 70);
        border-radius: 0.75rem;
        padding: 1.5rem;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid rgb(63, 63, 70);
      }

      .section-header h3 {
        color: rgb(244, 244, 245);
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0;
      }

      .customer-display-card {
        background: rgb(24, 24, 27);
        border: 1px solid rgb(99, 102, 241);
        border-radius: 0.75rem;
        padding: 1.5rem;
      }

      .customer-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .customer-card-header h3 {
        color: rgb(244, 244, 245);
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }

      .customer-card-actions {
        display: flex;
        gap: 0.5rem;
      }

      .customer-card-content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .customer-card-field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .customer-card-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: rgb(161, 161, 170);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .customer-card-value {
        color: rgb(244, 244, 245);
        font-size: 0.875rem;
      }

      .customer-card-value--email {
        color: rgb(99, 102, 241);
      }

      .customer-card-value--phone {
        color: rgb(34, 197, 94);
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
      }

      .customer-quick-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        padding-top: 1rem;
        border-top: 1px solid rgb(63, 63, 70);
      }

      .form-grid--2-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .form-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: rgb(244, 244, 245);
      }

      .form-input,
      .form-textarea {
        padding: 0.75rem;
        background: rgb(39, 39, 42);
        border: 1px solid rgb(63, 63, 70);
        border-radius: 0.5rem;
        color: rgb(244, 244, 245);
        font-size: 0.875rem;
        transition: all 0.2s ease-in-out;
        outline: none;
      }

      .form-input:focus,
      .form-textarea:focus {
        border-color: rgb(99, 102, 241);
        box-shadow: 0 0 0 3px rgb(99, 102, 241, 0.1);
        background: rgb(24, 24, 27);
      }

      .form-input::placeholder,
      .form-textarea::placeholder {
        color: rgb(113, 113, 122);
      }

      .form-textarea {
        resize: vertical;
        min-height: 4rem;
      }

      .error-message {
        font-size: 0.75rem;
        color: rgb(239, 68, 68);
        margin-top: 0.25rem;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        border-radius: 0.375rem;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        text-decoration: none;
        outline: none;
        justify-content: center;
      }

      .btn--sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
      }

      .btn--primary {
        background: rgb(99, 102, 241);
        color: white;
        border-color: rgb(99, 102, 241);
      }

      .btn--primary:hover {
        background: rgb(79, 70, 229);
        border-color: rgb(79, 70, 229);
      }

      .btn--outline {
        background: transparent;
        color: rgb(244, 244, 245);
        border-color: rgb(63, 63, 70);
      }

      .btn--outline:hover {
        background: rgb(63, 63, 70);
      }

      .btn--ghost {
        background: transparent;
        color: rgb(161, 161, 170);
        border-color: transparent;
      }

      .btn--ghost:hover {
        background: rgb(63, 63, 70);
        color: rgb(244, 244, 245);
      }

      @media (max-width: 768px) {
        .form-grid--2-col {
          grid-template-columns: 1fr;
        }

        .customer-card-content {
          grid-template-columns: 1fr;
        }

        .section-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .customer-card-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .customer-quick-actions {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(style);
  }

  initializeCustomerSelector() {
    // Initialize the customer selector component
    this.customerSelector = new CustomerSelector({
      containerId: 'invoice-customer-selector',
      allowCreate: true,
      onSelect: (customer) => this.handleCustomerSelection(customer),
      onError: (error) => {
        console.error('Customer selector error:', error);
        this.showError('Customer selection failed. Please try again.');
      }
    });
  }

  attachListeners() {
    // Get form elements
    this.getFormElements();

    // Manual entry toggle
    const toggleManualBtn = document.getElementById('toggle-manual-entry-btn');
    if (toggleManualBtn) {
      toggleManualBtn.addEventListener('click', () => {
        this.toggleManualEntry();
      });
    }

    // Toggle back to selector
    const toggleSelectorBtn = document.getElementById('toggle-selector-btn');
    if (toggleSelectorBtn) {
      toggleSelectorBtn.addEventListener('click', () => {
        this.toggleSelector();
      });
    }

    // Customer card actions
    const clearBtn = document.getElementById('clear-customer-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearCustomerSelection();
      });
    }

    const editBtn = document.getElementById('edit-customer-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.editSelectedCustomer();
      });
    }

    // Open customers page
    const openCustomersBtn = document.getElementById('open-customers-page-btn');
    if (openCustomersBtn) {
      openCustomersBtn.addEventListener('click', () => {
        window.open('/customers', '_blank');
      });
    }

    // Manual form listeners
    this.attachManualFormListeners();
  }

  getFormElements() {
    this.customerName = document.getElementById('customer-name');
    this.customerEmail = document.getElementById('customer-email');
    this.customerPhone = document.getElementById('customer-phone');
    this.customerAddress = document.getElementById('customer-address');
    this.customerNotes = document.getElementById('customer-notes');
    this.emailError = document.querySelector('.email-error');
  }

  attachManualFormListeners() {
    // Name input
    if (this.customerName) {
      this.customerName.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerName: e.target.value });
      });
    }

    // Email input with validation
    if (this.customerEmail) {
      this.customerEmail.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerEmail: e.target.value });
      });

      this.customerEmail.addEventListener('blur', (e) => {
        const email = e.target.value;
        if (email && !validateEmail(email)) {
          if (this.emailError) {
            this.emailError.textContent = 'Please enter a valid email address';
          }
        } else {
          if (this.emailError) {
            this.emailError.textContent = '';
          }
        }
      });
    }

    // Phone input with formatting
    if (this.customerPhone) {
      this.customerPhone.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/\\D/g, '');
        const limited = cleaned.slice(0, 10);
        const formatted = formatPhoneNumber(limited);
        e.target.value = formatted;
        this.state.updateCustomer({ customerPhone: formatted });
      });
    }

    // Address input
    if (this.customerAddress) {
      this.customerAddress.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerAddress: e.target.value });
      });
    }

    // Notes input
    if (this.customerNotes) {
      this.customerNotes.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerNotes: e.target.value });
      });
    }
  }

  handleCustomerSelection(customer) {
    if (!customer) {
      this.clearCustomerSelection();
      return;
    }

    if (customer._isNew) {
      // Handle new customer creation
      this.showMessage('Customer will be created when invoice is saved', 'info');
    }

    // Update invoice state with customer data
    const customerData = {
      customerId: customer.id || null,
      customerName: customer.display_name || customer.name,
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      customerAddress: this.formatCustomerAddress(customer),
      customerNotes: customer.notes || ''
    };

    this.state.updateCustomer(customerData);

    // Show customer display card
    this.showCustomerCard(customer);

    // Hide manual entry
    this.hideManualEntry();
  }

  formatCustomerAddress(customer) {
    const parts = [
      customer.address_line1,
      customer.address_line2,
      customer.city,
      customer.state,
      customer.postal_code
    ].filter(Boolean);

    return parts.join(', ');
  }

  showCustomerCard(customer) {
    const card = document.getElementById('customer-display-card');
    const content = document.getElementById('customer-card-content');

    if (!card || !content) return;

    content.innerHTML = `
      <div class="customer-card-field">
        <div class="customer-card-label">Name</div>
        <div class="customer-card-value">${this.escapeHtml(customer.display_name || customer.name || '')}</div>
      </div>
      ${customer.email ? `
        <div class="customer-card-field">
          <div class="customer-card-label">Email</div>
          <div class="customer-card-value customer-card-value--email">${this.escapeHtml(customer.email)}</div>
        </div>
      ` : ''}
      ${customer.phone ? `
        <div class="customer-card-field">
          <div class="customer-card-label">Phone</div>
          <div class="customer-card-value customer-card-value--phone">${this.escapeHtml(customer.phone)}</div>
        </div>
      ` : ''}
      ${this.formatCustomerAddress(customer) ? `
        <div class="customer-card-field">
          <div class="customer-card-label">Address</div>
          <div class="customer-card-value">${this.escapeHtml(this.formatCustomerAddress(customer))}</div>
        </div>
      ` : ''}
      ${customer.notes ? `
        <div class="customer-card-field">
          <div class="customer-card-label">Notes</div>
          <div class="customer-card-value">${this.escapeHtml(customer.notes)}</div>
        </div>
      ` : ''}
    `;

    card.style.display = 'block';
  }

  hideCustomerCard() {
    const card = document.getElementById('customer-display-card');
    if (card) {
      card.style.display = 'none';
    }
  }

  toggleManualEntry() {
    const manualSection = document.getElementById('manual-entry-section');
    const selectorSection = document.querySelector('.customer-selector-section');

    if (manualSection && selectorSection) {
      manualSection.style.display = 'block';
      selectorSection.style.display = 'none';
      this.hideCustomerCard();

      // Focus on name field
      if (this.customerName) {
        this.customerName.focus();
      }
    }
  }

  toggleSelector() {
    const manualSection = document.getElementById('manual-entry-section');
    const selectorSection = document.querySelector('.customer-selector-section');

    if (manualSection && selectorSection) {
      manualSection.style.display = 'none';
      selectorSection.style.display = 'block';

      // Focus on selector
      if (this.customerSelector) {
        this.customerSelector.combobox.focus();
      }
    }
  }

  hideManualEntry() {
    const manualSection = document.getElementById('manual-entry-section');
    if (manualSection) {
      manualSection.style.display = 'none';
    }
  }

  clearCustomerSelection() {
    // Clear state
    this.state.updateCustomer({
      customerId: null,
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      customerNotes: ''
    });

    // Clear selector
    if (this.customerSelector) {
      this.customerSelector.clearSelection();
    }

    // Hide customer card
    this.hideCustomerCard();

    // Clear manual form
    this.clearManualForm();
  }

  clearManualForm() {
    if (this.customerName) this.customerName.value = '';
    if (this.customerEmail) this.customerEmail.value = '';
    if (this.customerPhone) this.customerPhone.value = '';
    if (this.customerAddress) this.customerAddress.value = '';
    if (this.customerNotes) this.customerNotes.value = '';
    if (this.emailError) this.emailError.textContent = '';
  }

  editSelectedCustomer() {
    const selectedCustomer = this.customerSelector?.getSelectedCustomer();
    if (selectedCustomer && selectedCustomer.id) {
      // Open customers page with edit mode
      const editUrl = `/customers?edit=${selectedCustomer.id}`;
      window.open(editUrl, '_blank');
    }
  }

  populate(customerData) {
    console.log('🔄 CustomerFormEnhanced: Populating data...', customerData);

    if (!customerData) {
      this.clearCustomerSelection();
      return;
    }

    // Normalize customer data
    const normalizedData = {
      customerId: safeString(customerData.customerId),
      customerName: safeString(customerData.customerName),
      customerEmail: safeString(customerData.customerEmail),
      customerPhone: safeString(customerData.customerPhone),
      customerAddress: safeString(customerData.customerAddress),
      customerNotes: safeString(customerData.customerNotes)
    };

    // If we have a customer ID, try to load the full customer
    if (normalizedData.customerId) {
      this.loadCustomerById(normalizedData.customerId);
    } else if (normalizedData.customerName) {
      // Show manual form with existing data
      this.toggleManualEntry();
      this.populateManualForm(normalizedData);
    }
  }

  populateManualForm(data) {
    if (this.customerName) this.customerName.value = data.customerName;
    if (this.customerEmail) this.customerEmail.value = data.customerEmail;
    if (this.customerPhone) this.customerPhone.value = data.customerPhone;
    if (this.customerAddress) this.customerAddress.value = data.customerAddress;
    if (this.customerNotes) this.customerNotes.value = data.customerNotes;
  }

  async loadCustomerById(customerId) {
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const customer = await response.json();
        this.customerSelector.setCustomer(customer);
        this.handleCustomerSelection(customer);
      } else {
        // Customer not found, fall back to manual form
        console.warn('Customer not found, falling back to manual entry');
        this.toggleManualEntry();
      }
    } catch (error) {
      console.error('Failed to load customer:', error);
      this.toggleManualEntry();
    }
  }

  // Utility methods
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showMessage(message, type = 'info') {
    // Simple message display (could be enhanced with a toast system)
    console.log(`${type.toUpperCase()}: ${message}`);
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  // Cleanup method
  destroy() {
    if (this.customerSelector) {
      this.customerSelector.destroy();
    }

    // Remove styles
    const styles = document.getElementById('customer-form-enhanced-styles');
    if (styles) {
      styles.remove();
    }
  }
}