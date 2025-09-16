import { validateEmail, validatePhone } from '../state/validators.js';
import { formatPhoneNumber } from '../utils/formatters.js';
import { safeString } from '../utils/safeString.js';

export class CustomerForm {
  constructor(state) {
    this.state = state;
    this.initElements();
    this.attachListeners();
  }
  
  initElements() {
    this.customerName = document.getElementById('customer-name');
    this.customerEmail = document.getElementById('customer-email');
    this.customerPhone = document.getElementById('customer-phone');
    this.customerAddress = document.getElementById('customer-address');
    this.emailError = document.querySelector('.email-error');
  }
  
  attachListeners() {
    console.log('🔗 CustomerForm: Attaching event listeners...');
    console.log('  - customerName:', this.customerName ? '✅' : '❌');
    console.log('  - customerEmail:', this.customerEmail ? '✅' : '❌');
    console.log('  - customerPhone:', this.customerPhone ? '✅' : '❌');
    console.log('  - customerAddress:', this.customerAddress ? '✅' : '❌');
    console.log('  - emailError:', this.emailError ? '✅' : '❌');
    
    if (!this.customerName || !this.customerEmail || !this.customerPhone || !this.customerAddress) {
      console.error('❌ CustomerForm: Cannot attach listeners, some elements are missing');
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
    
    this.customerAddress.addEventListener('input', (e) => {
      this.state.updateCustomer({ customerAddress: e.target.value });
    });
  }
  
  populate(customerData) {
    console.log('🔄 CustomerForm: Populating data...', customerData);

    if (!this.customerName || !this.customerEmail || !this.customerPhone || !this.customerAddress) {
      console.error('❌ CustomerForm: Cannot populate, some elements are missing');
      return;
    }

    // 🔧 PHASE 2 FIX: Normalize customer data to prevent type errors during session restore
    const normalizedData = {
      customerName: safeString(customerData.customerName),
      customerEmail: safeString(customerData.customerEmail),
      customerPhone: safeString(customerData.customerPhone),
      customerAddress: safeString(customerData.customerAddress)
    };

    this.customerName.value = normalizedData.customerName;
    this.customerEmail.value = normalizedData.customerEmail;
    this.customerPhone.value = normalizedData.customerPhone;
    this.customerAddress.value = normalizedData.customerAddress;
  }
}