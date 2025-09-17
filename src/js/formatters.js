// Auto-formatting functions for input fields

export function initializeFormatters() {
  // Weight field - add "tons" suffix
  const weightInput = document.getElementById('vessel-weight');
  if (weightInput) {
    formatWithSuffix(weightInput, ' tons');
  }

  // Length field - add "ft" suffix
  const beamInput = document.getElementById('vessel-beam');
  if (beamInput) {
    formatWithSuffix(beamInput, ' ft');
  }

  // Currency fields - add "$" prefix and format
  const currencyFields = [
    'labor-rate',
    'ot-rate',
    'material-cost',
    'subcontractor-cost',
    'clearance-fee'
  ];
  
  currencyFields.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      formatCurrency(input);
    }
  });

  // Phone number field
  const phoneInput = document.getElementById('customer-phone');
  if (phoneInput) {
    formatPhoneNumber(phoneInput);
  }

  // Percentage fields
  const markupSelect = document.querySelector('select[id*="markup"], .markup-select');
  if (markupSelect) {
    // Already a select, but we can format the display
    markupSelect.addEventListener('change', function() {
      // The select already shows percentages
    });
  }

  // Handle dynamic line items
  observeDynamicFields();
}

function formatWithSuffix(input, suffix) {
  // Store the raw value as a data attribute
  input.addEventListener('input', function() {
    // Ensure value is always a string
    const val = this.value != null ? String(this.value) : '';
    const rawValue = val.replace(suffix, '').trim();
    this.dataset.rawValue = rawValue;
    
    // Trigger input event for other listeners
    const event = new Event('change', { bubbles: true });
    this.dispatchEvent(event);
  });

  input.addEventListener('focus', function() {
    // Remove suffix when editing
    const val = this.value != null ? String(this.value) : '';
    const value = val.replace(suffix, '').trim();
    this.value = value;
  });

  input.addEventListener('blur', function() {
    const val = this.value != null ? String(this.value) : '';
    const value = val.replace(suffix, '').trim();
    this.dataset.rawValue = value;
    if (value && !val.endsWith(suffix)) {
      this.value = value + suffix;
    }
  });

  // Initial format if there's a value
  if (input.value != null && input.value !== '') {
    const val = String(input.value);
    if (!val.endsWith(suffix)) {
      const rawValue = val.replace(suffix, '').trim();
      input.dataset.rawValue = rawValue;
      input.value = rawValue + suffix;
    }
  }
}

function formatCurrency(input) {
  let isEditing = false;

  input.addEventListener('focus', function() {
    isEditing = true;
    // Remove formatting when editing
    const val = this.value != null ? String(this.value) : '';
    const value = val.replace(/[\$,]/g, '').trim();
    this.value = value;
  });

  input.addEventListener('blur', function() {
    isEditing = false;
    const val = this.value != null ? String(this.value) : '';
    const value = val.replace(/[\$,]/g, '').trim();
    if (value) {
      const number = parseFloat(value);
      if (!isNaN(number)) {
        this.value = '$' + number.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
    }
  });

  // Initial format if there's a value
  const val = input.value != null ? String(input.value) : '';
  const initialValue = val.replace(/[\$,]/g, '').trim();
  if (initialValue) {
    const number = parseFloat(initialValue);
    if (!isNaN(number)) {
      input.value = '$' + number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
  }
}

function formatPhoneNumber(input) {
  input.addEventListener('input', function(e) {
    // Remove all non-numeric characters
    const targetValue = e.target.value != null ? String(e.target.value) : '';
    let value = targetValue.replace(/\D/g, '');
    
    // Limit to 10 digits
    if (value.length > 10) {
      value = value.substr(0, 10);
    }
    
    // Format as (XXX) XXX-XXXX
    if (value.length >= 6) {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length >= 3) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    }
    
    e.target.value = value;
  });

  input.addEventListener('blur', function() {
    // Clean up incomplete phone numbers
    const val = this.value != null ? String(this.value) : '';
    const digits = val.replace(/\D/g, '');
    if (digits.length === 10) {
      this.value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 0) {
      this.value = '';
    }
  });
}

// Observer for dynamic line items
function observeDynamicFields() {
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) { // Element node
          // Format currency inputs in line items
          const costInputs = node.querySelectorAll('.manual-cost-input');
          costInputs.forEach(input => formatCurrency(input));
          
          // Format hour inputs with "hrs" suffix
          const hourInputs = node.querySelectorAll('.labor-hours-input, .ot-hours-input');
          hourInputs.forEach(input => formatWithSuffix(input, ' hrs'));
        }
      });
    });
  });

  // Observe the line items container
  const container = document.querySelector('.line-items-container');
  if (container) {
    observer.observe(container, {
      childList: true,
      subtree: true
    });
  }
}

// Export for use in other modules
export default {
  initializeFormatters,
  formatWithSuffix,
  formatCurrency,
  formatPhoneNumber
};