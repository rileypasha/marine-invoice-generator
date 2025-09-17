import { validateEmail, validatePhone } from '../state/validators.js';
import { formatPhoneNumber } from '../utils/formatters.js';
import { safeString } from '../utils/safeString.js';
import { AddressAutocomplete } from './AddressAutocomplete.js';

export class CustomerForm {
  constructor(state) {
    this.state = state;
    this.addressAutocomplete = null;
    this.initElements();
    this.attachListeners();
  }
  
  initElements() {
    this.customerName = document.getElementById('customer-name');
    this.customerEmail = document.getElementById('customer-email');
    this.customerPhone = document.getElementById('customer-phone');
    // Removed multiple address fields - only using single address field now
    this.emailError = document.querySelector('.email-error');

    // Initialize address autocomplete
    this.initAddressAutocomplete();
  }

  initAddressAutocomplete() {
    try {
      this.addressAutocomplete = new AddressAutocomplete({
        containerId: 'customer-address-autocomplete',
        placeholder: 'Start typing address...',
        onSelect: (result) => this.handleAddressSelection(result),
        onError: (error) => {
          console.error('Address autocomplete error:', error);
          // Show user-friendly error message
          this.showAddressError('Address lookup temporarily unavailable');
        }
      });
    } catch (error) {
      console.error('Failed to initialize address autocomplete:', error);
      this.showAddressError('Address autocomplete not available');
    }
  }

  handleAddressSelection(result) {
    console.log('🏠 CustomerForm: Address selected:', result);

    // Address autocomplete now only fills the single address field

    // Update state with single address field
    this.state.updateCustomer({
      customerAddress: result.line1 || ''
    });

    // Focus customer name for better UX
    if (this.customerName) {
      this.customerName.focus();
    }
  }

  showAddressError(message) {
    // Create or update error message display
    let errorEl = document.getElementById('address-autocomplete-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'address-autocomplete-error';
      errorEl.className = 'error-message';
      errorEl.style.color = '#dc2626';
      errorEl.style.fontSize = '0.875rem';
      errorEl.style.marginTop = '0.25rem';

      const container = document.getElementById('customer-address-autocomplete');
      if (container && container.parentNode) {
        container.parentNode.insertBefore(errorEl, container.nextSibling);
      }
    }
    errorEl.textContent = message;

    // Clear error after 5 seconds
    setTimeout(() => {
      if (errorEl && errorEl.parentNode) {
        errorEl.parentNode.removeChild(errorEl);
      }
    }, 5000);
  }

  attachListeners() {
    console.log('🔗 CustomerForm: Attaching event listeners...');
    console.log('  - customerName:', this.customerName ? '✅' : '❌');
    console.log('  - customerEmail:', this.customerEmail ? '✅' : '❌');
    console.log('  - customerPhone:', this.customerPhone ? '✅' : '❌');
    // Removed multiple address field logging
    console.log('  - addressAutocomplete:', this.addressAutocomplete ? '✅' : '❌');
    console.log('  - emailError:', this.emailError ? '✅' : '❌');

    if (!this.customerName || !this.customerEmail || !this.customerPhone) {
      console.error('❌ CustomerForm: Cannot attach listeners, some basic elements are missing');
      return;
    }
    
    this.customerName.addEventListener('input', (e) => {
      this.state.updateCustomer({ customerName: e.target.value });
    });
    
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
    
    this.customerPhone.addEventListener('input', (e) => {
      const cleaned = e.target.value.replace(/\D/g, '');
      // Limit to 10 digits max
      const limited = cleaned.slice(0, 10);
      const formatted = formatPhoneNumber(limited);
      e.target.value = formatted;
      this.state.updateCustomer({ customerPhone: formatted });
    });

    // Removed multiple address field listeners - using single address field now
  }
  
  populate(customerData) {
    console.log('🔄 CustomerForm: Populating data...', customerData);

    if (!this.customerName || !this.customerEmail || !this.customerPhone) {
      console.error('❌ CustomerForm: Cannot populate, some basic elements are missing');
      return;
    }

    // Normalize customer data to prevent type errors during session restore
    const normalizedData = {
      customerName: safeString(customerData.customerName),
      customerEmail: safeString(customerData.customerEmail),
      customerPhone: safeString(customerData.customerPhone),
      customerAddress: safeString(customerData.customerAddress || customerData.customerLine1) // Backward compatibility
    };

    // Populate basic fields
    this.customerName.value = normalizedData.customerName;
    this.customerEmail.value = normalizedData.customerEmail;
    this.customerPhone.value = normalizedData.customerPhone;

    // Populate address autocomplete field
    if (this.addressAutocomplete && normalizedData.customerAddress) {
      this.addressAutocomplete.setValue(normalizedData.customerAddress);
    }
  }

  // Cleanup method for proper component lifecycle
  destroy() {
    if (this.addressAutocomplete) {
      this.addressAutocomplete.destroy();
    }
  }
}