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
    this.customerLine2 = document.getElementById('customer-line2');
    this.customerCity = document.getElementById('customer-city');
    this.customerState = document.getElementById('customer-state');
    this.customerPostal = document.getElementById('customer-postal');
    this.customerCountry = document.getElementById('customer-country');
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

    // Update address fields with selected result
    if (this.customerCity) this.customerCity.value = result.city || '';
    if (this.customerState) this.customerState.value = result.state || '';
    if (this.customerPostal) this.customerPostal.value = result.postal_code || '';
    if (this.customerCountry) this.customerCountry.value = result.country || '';

    // Update state with all address fields
    this.state.updateCustomer({
      customerLine1: result.line1 || '',
      customerCity: result.city || '',
      customerState: result.state || '',
      customerPostal: result.postal_code || '',
      customerCountry: result.country || '',
      customerLat: result.lat,
      customerLon: result.lon
    });

    // Focus next field for better UX
    if (this.customerLine2) {
      this.customerLine2.focus();
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
    console.log('  - customerLine2:', this.customerLine2 ? '✅' : '❌');
    console.log('  - customerCity:', this.customerCity ? '✅' : '❌');
    console.log('  - customerState:', this.customerState ? '✅' : '❌');
    console.log('  - customerPostal:', this.customerPostal ? '✅' : '❌');
    console.log('  - customerCountry:', this.customerCountry ? '✅' : '❌');
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

    // Address field listeners
    if (this.customerLine2) {
      this.customerLine2.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerLine2: e.target.value });
      });
    }

    if (this.customerCity) {
      this.customerCity.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerCity: e.target.value });
      });
    }

    if (this.customerState) {
      this.customerState.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerState: e.target.value });
      });
    }

    if (this.customerPostal) {
      this.customerPostal.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerPostal: e.target.value });
      });
    }

    if (this.customerCountry) {
      this.customerCountry.addEventListener('input', (e) => {
        this.state.updateCustomer({ customerCountry: e.target.value });
      });
    }
  }
  
  populate(customerData) {
    console.log('🔄 CustomerForm: Populating data...', customerData);

    if (!this.customerName || !this.customerEmail || !this.customerPhone) {
      console.error('❌ CustomerForm: Cannot populate, some basic elements are missing');
      return;
    }

    // 🔧 PHASE 2 FIX: Normalize customer data to prevent type errors during session restore
    const normalizedData = {
      customerName: safeString(customerData.customerName),
      customerEmail: safeString(customerData.customerEmail),
      customerPhone: safeString(customerData.customerPhone),
      customerLine1: safeString(customerData.customerLine1 || customerData.customerAddress), // Backward compatibility
      customerLine2: safeString(customerData.customerLine2),
      customerCity: safeString(customerData.customerCity),
      customerState: safeString(customerData.customerState),
      customerPostal: safeString(customerData.customerPostal),
      customerCountry: safeString(customerData.customerCountry)
    };

    // Populate basic fields
    this.customerName.value = normalizedData.customerName;
    this.customerEmail.value = normalizedData.customerEmail;
    this.customerPhone.value = normalizedData.customerPhone;

    // Populate address autocomplete field
    if (this.addressAutocomplete && normalizedData.customerLine1) {
      this.addressAutocomplete.setValue(normalizedData.customerLine1);
    }

    // Populate address fields
    if (this.customerLine2) this.customerLine2.value = normalizedData.customerLine2;
    if (this.customerCity) this.customerCity.value = normalizedData.customerCity;
    if (this.customerState) this.customerState.value = normalizedData.customerState;
    if (this.customerPostal) this.customerPostal.value = normalizedData.customerPostal;
    if (this.customerCountry) this.customerCountry.value = normalizedData.customerCountry;
  }

  // Cleanup method for proper component lifecycle
  destroy() {
    if (this.addressAutocomplete) {
      this.addressAutocomplete.destroy();
    }
  }
}