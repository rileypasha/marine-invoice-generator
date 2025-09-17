// Auto-formatting functions for input fields

/**
 * PHASE 2: Centralized formatters for consistent data-presentation separation
 * Ensures data model stores numeric values, presentation adds formatting
 */

// Centralized formatters for converting numeric values to display strings
export function formatWeight(value) {
  const num = parseFloat(value);
  return isNaN(num) || num === 0 ? '' : `${num} tons`;
}

export function formatBeam(value) {
  const num = parseFloat(value);
  return isNaN(num) || num === 0 ? '' : `${num} ft`;
}

// Centralized parsers for extracting numeric values from user input
export function parseNumber(input) {
  const str = String(input || '').trim();
  const cleaned = str.replace(/[^\d.-]/g, ''); // Remove all non-numeric except decimal and minus
  const num = parseFloat(cleaned);
  return isNaN(num) ? '' : cleaned; // Return string for data model consistency
}

// Get the raw numeric value without units for calculations
export function getRawValue(input) {
  if (input.dataset && input.dataset.rawValue !== undefined) {
    return input.dataset.rawValue;
  }
  return parseNumber(input.value);
}

export function initializeFormatters() {
  // Weight field - add "tons" suffix
  const weightInput = document.getElementById('vessel-weight');
  if (weightInput) {
    formatWithSuffix(weightInput, ' tons');
  }

  // Beam field - add "ft" suffix
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
  if (!input) return;

  // PHASE 3: Enhanced input component hardening for session restore

  // Store the raw value as a data attribute
  input.addEventListener('input', function() {
    // Ensure value is always a string
    const val = this.value != null ? String(this.value) : '';
    const rawValue = val.replace(suffix, '').trim();
    this.dataset.rawValue = rawValue;

    // Update wrapper class for CSS suffix display
    const wrapper = this.closest('.input-with-suffix');
    if (wrapper) {
      if (rawValue !== '') {
        wrapper.classList.add('has-value');
      } else {
        wrapper.classList.remove('has-value');
      }
    }

    // Trigger input event for other listeners
    const event = new Event('change', { bubbles: true });
    this.dispatchEvent(event);
  });

  input.addEventListener('focus', function() {
    // Remove suffix when editing - show numeric only
    const val = this.value != null ? String(this.value) : '';
    const value = val.replace(suffix, '').trim();
    this.value = value;

    // Remove wrapper class during editing
    const wrapper = this.closest('.input-with-suffix');
    if (wrapper) {
      wrapper.classList.remove('has-value');
    }
  });

  input.addEventListener('blur', function() {
    const val = this.value != null ? String(this.value) : '';
    const value = val.replace(suffix, '').trim();
    this.dataset.rawValue = value;

    // Update wrapper class and display suffix
    const wrapper = this.closest('.input-with-suffix');
    if (wrapper && value !== '') {
      wrapper.classList.add('has-value');
      if (!val.endsWith(suffix)) {
        this.value = value + suffix;
      }
    } else if (wrapper) {
      wrapper.classList.remove('has-value');
    }
  });

  // CRITICAL: Initial format for session restore and mount
  applyInitialFormat(input, suffix);
}

// Separate function for applying initial format - used for session restore
function applyInitialFormat(input, suffix) {
  if (!input) return;

  const val = input.value != null ? String(input.value) : '';
  const wrapper = input.closest('.input-with-suffix');

  if (val !== '') {
    const rawValue = val.replace(suffix, '').trim();
    input.dataset.rawValue = rawValue;

    // Always ensure proper display format
    if (rawValue !== '') {
      // Add suffix if not already present
      if (!val.endsWith(suffix)) {
        input.value = rawValue + suffix;
      }
      // Set wrapper class for CSS display
      if (wrapper) {
        wrapper.classList.add('has-value');
      }
    }
  } else {
    // Remove wrapper class for empty values
    if (wrapper) {
      wrapper.classList.remove('has-value');
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
  formatPhoneNumber,
  formatWeight,
  formatBeam,
  parseNumber,
  getRawValue,
  applyInitialFormat
};