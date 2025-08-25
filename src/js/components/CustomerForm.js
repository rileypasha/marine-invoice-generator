import { validateEmail, validatePhone } from '../state/validators.js';
import { formatPhoneNumber } from '../utils/formatters.js';

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
    this.emailError = document.querySelector('.email-error');
  }
  
  attachListeners() {
    this.customerName.addEventListener('input', (e) => {
      this.state.updateCustomer({ customerName: e.target.value });
    });
    
    this.customerEmail.addEventListener('input', (e) => {
      this.state.updateCustomer({ customerEmail: e.target.value });
    });
    
    this.customerEmail.addEventListener('blur', (e) => {
      const email = e.target.value;
      if (email && !validateEmail(email)) {
        this.emailError.textContent = 'Please enter a valid email address';
      } else {
        this.emailError.textContent = '';
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
  }
  
  populate(customerData) {
    this.customerName.value = customerData.customerName || '';
    this.customerEmail.value = customerData.customerEmail || '';
    this.customerPhone.value = customerData.customerPhone || '';
  }
}