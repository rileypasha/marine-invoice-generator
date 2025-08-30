// Imports
import { Sidebar } from './components/Sidebar.js';
import { UserManager } from './auth/UserManager.js';
import { AuthModal } from './auth/AuthModal.js';
import { SettingsModal } from './settings/SettingsModal.js';
import { InvoiceStorage } from './storage/InvoiceStorage.js';
import { ThemeManager } from './settings/ThemeManager.js';

// Constants
const CONSTANTS = {
  LABOR_RATE: 80,
  OT_LABOR_RATE: 120,
  TAX_RATE: 0.0875,
  CLEARANCE_FEE_HIGH: 1250,
  CLEARANCE_FEE_LOW: 950,
  WEIGHT_THRESHOLD: 500
};

// Field Formatters
function initializeFieldFormatters() {
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

  // Phone number field
  const phoneInput = document.getElementById('customer-phone');
  if (phoneInput) {
    formatPhoneNumber(phoneInput);
  }

  // Clearance fee field
  const clearanceFeeInput = document.getElementById('clearance-fee');
  if (clearanceFeeInput) {
    formatCurrency(clearanceFeeInput);
  }
}

function formatWithSuffix(input, suffix) {
  let isEditing = false;

  // Add keydown event to prevent non-numeric input
  input.addEventListener('keydown', function(e) {
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        (e.keyCode === 90 && e.ctrlKey === true) ||
        // Allow: home, end, left, right, down, up
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }
    // Allow: decimal point, but only one
    if (e.keyCode === 190 || e.keyCode === 110) {
      const currentValue = isEditing ? this.value : this.value.replace(suffix, '').trim();
      if (currentValue.indexOf('.') !== -1) {
        e.preventDefault();
        return;
      }
      return;
    }
    // Ensure that it's a number and stop the keypress
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  });

  // Add paste event validation
  input.addEventListener('paste', function(e) {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    const numericValue = paste.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = numericValue.split('.');
    let cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;
    
    this.value = cleanValue;
  });

  input.addEventListener('focus', function() {
    isEditing = true;
    const value = this.value.replace(suffix, '').trim();
    this.value = value;
  });

  input.addEventListener('blur', function() {
    isEditing = false;
    const value = this.value.trim();
    if (value && !value.endsWith(suffix)) {
      this.value = value + suffix;
    }
  });
}

function formatCurrency(input) {
  input.addEventListener('input', function(e) {
    // Get the raw input value
    const rawValue = e.target.value;
    
    // Remove any non-digit characters except decimal point
    const cleanedValue = rawValue.replace(/[^\d.]/g, '');
    
    // Handle empty or invalid input
    if (!cleanedValue || cleanedValue === '.') {
      e.target.value = '';
      return;
    }
    
    // Ensure only one decimal point
    const parts = cleanedValue.split('.');
    if (parts.length > 2) {
      e.target.value = parts[0] + '.' + parts.slice(1).join('');
      return;
    }
    
    // Parse the number
    const num = parseFloat(cleanedValue);
    if (isNaN(num)) {
      e.target.value = '';
      return;
    }
    
    // Format with commas for thousands separator and dollar sign
    const formatted = '$' + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
    
    // Update the input display
    e.target.value = formatted;
    
    // Set cursor position to the end (after formatting)
    setTimeout(() => {
      if (e.target.setSelectionRange && e.target.type !== 'number') {
        e.target.setSelectionRange(e.target.value.length, e.target.value.length);
      }
    }, 0);
  });
}

function formatPhoneNumber(input) {
  input.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 10) {
      value = value.substr(0, 10);
    }
    
    if (value.length >= 6) {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length >= 3) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    }
    
    e.target.value = value;
  });
}

// State management
let state = {
  vessel: { name: '', weight: '', beam: '', customerType: '' },
  customer: { estimatorName: '', customerName: '', customerEmail: '', customerPhone: '' },
  scope: { markupRate: '2.5', isTaxable: false, lineItems: [] }
};

let lineItemIdCounter = 0;

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

function formatPhoneNumber(phone) {
  // Ensure phone is a string
  const phoneString = phone != null ? String(phone) : '';
  const cleaned = phoneString.replace(/\D/g, '');
  
  if (cleaned.length === 0) {
    return '';
  } else if (cleaned.length <= 3) {
    return `(${cleaned}`;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  } else if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // If more than 10 digits, truncate
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function parseNumber(value) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Calculation functions
function calculateClearanceFee(weight) {
  const weightNum = parseNumber(weight);
  return weightNum > CONSTANTS.WEIGHT_THRESHOLD 
    ? CONSTANTS.CLEARANCE_FEE_HIGH 
    : CONSTANTS.CLEARANCE_FEE_LOW;
}

function calculateLaborCost(regularHours, otHours) {
  const regular = parseNumber(regularHours) * CONSTANTS.LABOR_RATE;
  const overtime = parseNumber(otHours) * CONSTANTS.OT_LABOR_RATE;
  return regular + overtime;
}

function applyMarkup(cost, markupRate) {
  const rate = parseNumber(markupRate) / 100;
  return cost * (1 + rate);
}

function calculateLaborCost(lineItem) {
  if (lineItem.itemType === 'Labor') {
    const regularHours = parseFloat(lineItem.laborHours) || 0;
    const otHours = parseFloat(lineItem.otHours) || 0;
    
    // Calculate cost using constants: $80/hour regular + $120/hour OT
    const laborCost = (regularHours * CONSTANTS.LABOR_RATE) + (otHours * CONSTANTS.OT_LABOR_RATE);
    
    // Update the line item's manual cost with calculated value
    lineItem.manualCost = laborCost.toString();
    
    // Update the visual input field with formatted currency
    const card = document.querySelector(`[data-row="${lineItem.id}"]`);
    if (card) {
      const manualCostInput = card.querySelector('.manual-cost-input');
      if (manualCostInput && laborCost > 0) {
        const formattedValue = '$' + new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(laborCost);
        manualCostInput.value = formattedValue;
      }
    }
  }
}

function calculateLineItemCost(lineItem) {
  if (lineItem.jobType === 'Agent Services') {
    const regular = parseNumber(lineItem.laborHours) * CONSTANTS.LABOR_RATE;
    const overtime = parseNumber(lineItem.otHours) * CONSTANTS.OT_LABOR_RATE;
    return regular + overtime;
  }
  return parseNumber(lineItem.manualCost);
}

function calculateTotals() {
  let baseCost = 0;
  let subtotal = 0;
  
  state.scope.lineItems.forEach(item => {
    const cost = calculateLineItemCost(item);
    baseCost += cost;
    subtotal += applyMarkup(cost, state.scope.markupRate);
  });
  
  const clearanceFee = calculateClearanceFee(state.vessel.weight);
  subtotal += clearanceFee;
  baseCost += clearanceFee;
  
  const tax = state.scope.isTaxable ? subtotal * CONSTANTS.TAX_RATE : 0;
  const total = subtotal + tax;
  const grossProfit = subtotal - baseCost;
  const grossProfitPercent = total > 0 ? (grossProfit / total) * 100 : 0;
  
  return { baseCost, subtotal, clearanceFee, tax, total, grossProfit, grossProfitPercent };
}

// Update preview
function updatePreview() {
  // Update date
  document.getElementById('preview-date').textContent = formatDate();
  
  // Update vessel details
  document.querySelector('.preview-vessel-name').textContent = state.vessel.name || '-';
  document.querySelector('.preview-vessel-weight').textContent = state.vessel.weight || '0';
  document.querySelector('.preview-vessel-beam').textContent = state.vessel.beam || '0';
  document.querySelector('.preview-customer-type').textContent = state.vessel.customerType || '-';
  
  // Update customer details
  document.querySelector('.preview-estimator-name').textContent = state.customer.estimatorName || '-';
  document.querySelector('.preview-customer-name').textContent = state.customer.customerName || '-';
  document.querySelector('.preview-customer-email').textContent = state.customer.customerEmail || '-';
  document.querySelector('.preview-customer-phone').textContent = state.customer.customerPhone || '-';
  
  // Update line items
  const lineItemsContainer = document.getElementById('preview-line-items');
  lineItemsContainer.innerHTML = '';
  
  state.scope.lineItems.forEach(item => {
    if (!item.jobType || !item.description) return;
    
    const row = document.createElement('tr');
    row.className = 'line-item-row';
    row.setAttribute('data-row', item.id);
    
    const cost = calculateLineItemCost(item);
    const totalWithMarkup = applyMarkup(cost, state.scope.markupRate);
    
    row.innerHTML = `
      <td>${item.description}</td>
      <td>${item.jobType}${item.itemType ? ` - ${item.itemType}` : ''}</td>
      <td class="cost-cell">${formatCurrency(cost)}</td>
      <td class="total-with-markup">${formatCurrency(totalWithMarkup)}</td>
      <td><span class="trash-icon" data-id="${item.id}" style="cursor: pointer;">🗑️</span></td>
    `;
    
    // Add trash icon listener
    const trashIcon = row.querySelector('.trash-icon');
    trashIcon.addEventListener('click', () => {
      state.scope.lineItems = state.scope.lineItems.filter(i => i.id !== item.id);
      const inputRow = document.querySelector(`[data-row="${item.id}"]`);
      if (inputRow) inputRow.remove();
      updatePreview();
    });
    
    lineItemsContainer.appendChild(row);
  });
  
  // Update totals
  const totals = calculateTotals();
  document.querySelector('.preview-subtotal').textContent = formatCurrency(totals.subtotal);
  document.querySelector('.preview-clearance-fee').textContent = formatCurrency(totals.clearanceFee);
  
  const taxRow = document.querySelector('.tax-row');
  if (state.scope.isTaxable) {
    taxRow.style.display = 'flex';
    document.querySelector('.tax-amount').textContent = formatCurrency(totals.tax);
  } else {
    taxRow.style.display = 'none';
  }
  
  document.querySelector('.preview-total strong').textContent = formatCurrency(totals.total);
  document.querySelector('.gross-profit-amount').textContent = formatCurrency(totals.grossProfit);
  document.querySelector('.gross-profit-percent').textContent = formatPercentage(totals.grossProfitPercent);
}

// Validation functions
function validateLineItem(lineItem) {
  console.log('🔍 Validating line item:', lineItem.id, lineItem);
  const errors = [];
  const card = document.querySelector(`[data-row="${lineItem.id}"]`);
  console.log('📋 Found card:', card);
  
  // Service Type is always required
  if (!lineItem.jobType) {
    errors.push('Service Type is required');
  }
  
  // For Manual Entry, validate based on progressive disclosure
  if (lineItem.jobType === 'Manual Entry') {
    console.log('📝 Manual Entry validation for item', lineItem.id);
    if (!lineItem.itemType) {
      errors.push('Item Type is required for Manual Entry');
    } else {
      // Only validate description if it's visible (after Item Type is selected)
      const descriptionField = card ? card.querySelector('.description-field') : null;
      const isDescriptionVisible = descriptionField && descriptionField.style.display !== 'none';
      console.log('👁️ Description field visible:', isDescriptionVisible, 'Description value:', lineItem.description);
      
      const trimmedDescription = lineItem.description ? lineItem.description.trim() : '';
      if (isDescriptionVisible && !trimmedDescription) {
        console.log('❌ Description is visible but empty - adding error');
        errors.push('Description is required');
      }
      
      if (lineItem.itemType === 'Labor') {
        // Labor requires at least regular hours or OT hours
        if (!lineItem.laborHours && !lineItem.otHours) {
          errors.push('Hours are required for Labor items');
        }
      } else {
        // Other item types require cost
        if (!lineItem.manualCost) {
          errors.push('Cost is required');
        }
      }
    }
  } else if (lineItem.jobType) {
    // For non-Manual Entry services, description is required immediately when service type is selected
    const trimmedDescription = lineItem.description ? lineItem.description.trim() : '';
    if (!trimmedDescription) {
      errors.push('Description is required');
    }
    
    if (lineItem.jobType !== 'Agent Services') {
      // Non-Manual Entry services need cost (except Agent Services which uses hours)
      if (!lineItem.manualCost) {
        errors.push('Cost is required');
      }
    }
  }
  
  console.log('🚨 Validation errors for item', lineItem.id, ':', errors);
  return errors;
}

function validateAllLineItems() {
  const incompleteItems = [];
  
  state.scope.lineItems.forEach((item, index) => {
    const errors = validateLineItem(item);
    if (errors.length > 0) {
      incompleteItems.push({ index: index + 1, errors });
    }
  });
  
  return incompleteItems;
}

function updateValidationState() {
  console.log('🔄 Running validation state update...');
  const incompleteItems = validateAllLineItems();
  const addButton = document.getElementById('add-line-item');
  console.log('🔢 Incomplete items found:', incompleteItems.length);
  
  // Clear all existing validation states
  document.querySelectorAll('.form-input.error').forEach(input => {
    input.classList.remove('error');
  });
  document.querySelectorAll('.validation-message').forEach(msg => {
    msg.remove();
  });
  
  // Apply validation states to incomplete items
  state.scope.lineItems.forEach((item, index) => {
    const errors = validateLineItem(item);
    const card = document.querySelector(`[data-row="${item.id}"]`);
    if (!card) return;
    
    if (errors.length > 0) {
      // Mark required fields as error
      if (!item.jobType) {
        const jobTypeSelect = card.querySelector('.job-type-select');
        jobTypeSelect.classList.add('error');
      }
      
      // Check if description field is visible before marking as error
      const descriptionField = card.querySelector('.description-field');
      const isDescriptionVisible = descriptionField && descriptionField.style.display !== 'none';
      const trimmedDescription = item.description ? item.description.trim() : '';
      if (isDescriptionVisible && !trimmedDescription) {
        const descriptionInput = card.querySelector('.description-input');
        descriptionInput.classList.add('error');
        console.log('🔴 Marked description field as error for item', item.id);
      }
      
      // For Manual Entry items
      if (item.jobType === 'Manual Entry') {
        if (!item.itemType) {
          const itemTypeSelect = card.querySelector('.item-type-select');
          itemTypeSelect.classList.add('error');
        } else if (item.itemType === 'Labor') {
          if (!item.laborHours && !item.otHours) {
            card.querySelector('.labor-hours-input').classList.add('error');
            card.querySelector('.ot-hours-input').classList.add('error');
          }
        } else if (!item.manualCost) {
          card.querySelector('.manual-cost-input').classList.add('error');
        }
      } else if (item.jobType && item.jobType !== 'Agent Services' && !item.manualCost) {
        const manualCostInput = card.querySelector('.manual-cost-input');
        if (manualCostInput) manualCostInput.classList.add('error');
      }
    }
  });
  
  // Button logic: Enable if no line items exist OR all line items are complete
  if (state.scope.lineItems.length === 0) {
    // No line items - enable button so user can add first item
    addButton.disabled = false;
    addButton.title = '';
    console.log('✅ Button enabled - no line items');
  } else if (incompleteItems.length > 0) {
    // Some items are incomplete - disable button
    addButton.disabled = true;
    addButton.title = `Complete Item ${incompleteItems[0].index} before adding new items`;
    console.log('🚫 Button disabled - incomplete items:', incompleteItems.length);
  } else {
    // All items are complete - enable button
    addButton.disabled = false;
    addButton.title = '';
    console.log('✅ Button enabled - all items complete');
  }
}

// Add line item
function addLineItem() {
  console.log('➕ Add Line Item button clicked');
  
  // Check if existing line items are complete
  for (let i = 0; i < state.scope.lineItems.length; i++) {
    const item = state.scope.lineItems[i];
    console.log(`Checking item ${i + 1}:`, item);
    
    // Service Type is always required
    if (!item.jobType || item.jobType.trim() === '') {
      alert(`Please select a Service Type for Item ${i + 1} before adding a new line item.`);
      return;
    }
    
    // For Manual Entry, check if Item Type is selected
    if (item.jobType === 'Manual Entry') {
      if (!item.itemType || item.itemType.trim() === '') {
        alert(`Please select an Item Type for Item ${i + 1} before adding a new line item.`);
        return;
      }
      
      // Check if description is required (visible)
      const card = document.querySelector(`[data-row="${item.id}"]`);
      if (card) {
        const descriptionField = card.querySelector('.description-field');
        const isDescriptionVisible = descriptionField && descriptionField.style.display !== 'none';
        
        if (isDescriptionVisible) {
          const trimmedDescription = item.description ? item.description.trim() : '';
          if (!trimmedDescription) {
            alert(`Please enter a Description for Item ${i + 1} before adding a new line item.`);
            return;
          }
        }
      }
      
      // Check item type specific requirements
      if (item.itemType === 'Labor') {
        if ((!item.laborHours || item.laborHours.trim() === '') && 
            (!item.otHours || item.otHours.trim() === '')) {
          alert(`Please enter Hours for Item ${i + 1} before adding a new line item.`);
          return;
        }
      } else if (item.itemType && item.itemType !== '') {
        if (!item.manualCost || item.manualCost.trim() === '') {
          alert(`Please enter a Cost for Item ${i + 1} before adding a new line item.`);
          return;
        }
      }
    } else if (item.jobType && item.jobType !== '') {
      // Non-Manual Entry services
      const trimmedDescription = item.description ? item.description.trim() : '';
      if (!trimmedDescription) {
        alert(`Please enter a Description for Item ${i + 1} before adding a new line item.`);
        return;
      }
      
      if (item.jobType !== 'Agent Services') {
        if (!item.manualCost || item.manualCost.trim() === '') {
          alert(`Please enter a Cost for Item ${i + 1} before adding a new line item.`);
          return;
        }
      }
    }
  }
  
  console.log('✅ All validation passed, proceeding to add new line item');
  
  const id = lineItemIdCounter++;
  const lineItem = {
    id,
    jobType: '',
    itemType: '',
    manualCost: '',
    laborHours: '',
    otHours: '',
    description: ''
  };
  
  state.scope.lineItems.push(lineItem);
  
  const template = document.getElementById('line-item-template').content.cloneNode(true);
  const card = template.querySelector('.line-item-card');
  card.setAttribute('data-row', id);
  
  // Set item number
  const itemNumberSpan = card.querySelector('.item-number');
  const currentItems = document.getElementById('line-items-list').children.length;
  itemNumberSpan.textContent = currentItems + 1;
  
  const jobTypeSelect = card.querySelector('.job-type-select');
  const itemTypeSelect = card.querySelector('.item-type-select');
  const manualCostInput = card.querySelector('.manual-cost-input');
  const laborHoursInput = card.querySelector('.labor-hours-input');
  const otHoursInput = card.querySelector('.ot-hours-input');
  const descriptionInput = card.querySelector('.description-input');
  const removeBtn = card.querySelector('.remove-line-item');
  
  // Get field groups for showing/hiding
  const manualEntryFields = card.querySelector('.manual-entry-fields');
  const manualCostField = card.querySelector('.manual-cost-field');
  const laborFields = card.querySelector('.labor-fields');
  
  // Get field groups for progressive disclosure
  const secondaryFields = card.querySelector('.secondary-fields');
  const descriptionField = card.querySelector('.description-field');
  
  // Attach listeners
  jobTypeSelect.addEventListener('change', (e) => {
    lineItem.jobType = e.target.value;
    
    if (e.target.value) {
      // Show secondary fields container when service type is selected
      secondaryFields.style.display = 'flex';
      
      if (e.target.value === 'Manual Entry') {
        // For Manual Entry, only show the Item Type dropdown initially
        // Hide description until Item Type is selected
        descriptionField.style.display = 'none';
        manualEntryFields.style.display = 'flex';
        manualCostField.style.display = 'none';
        laborFields.style.display = 'none';
      } else if (e.target.value === 'Agent Services') {
        // For Agent Services, show description and hours fields
        descriptionField.style.display = 'flex';
        manualEntryFields.style.display = 'none';
        manualCostField.style.display = 'none';
        laborFields.style.display = 'grid';
      } else {
        // Other service types (Pilotage, Car Rental, etc.) - show description and cost
        descriptionField.style.display = 'flex';
        manualEntryFields.style.display = 'none';
        manualCostField.style.display = 'flex';
        laborFields.style.display = 'none';
      }
    } else {
      // Hide description and secondary fields when no service type selected
      descriptionField.style.display = 'none';
      secondaryFields.style.display = 'none';
      manualEntryFields.style.display = 'none';
      manualCostField.style.display = 'none';
      laborFields.style.display = 'none';
    }
    updatePreview();
    updateValidationState();
  });
  
  itemTypeSelect.addEventListener('change', (e) => {
    const itemType = e.target.value;
    lineItem.itemType = itemType;
    
    if (itemType) {
      // Show description field when item type is selected
      descriptionField.style.display = 'flex';
      
      // Show hours fields for Labor, cost field for other item types
      if (itemType === 'Labor') {
        manualCostField.style.display = 'none';
        laborFields.style.display = 'grid';
      } else {
        manualCostField.style.display = 'flex';
        laborFields.style.display = 'none';
      }
    } else {
      // Hide description and cost/hours fields when no item type selected
      descriptionField.style.display = 'none';
      manualCostField.style.display = 'none';
      laborFields.style.display = 'none';
    }
    
    updatePreview();
    updateValidationState();
  });
  
  // Apply currency formatting to manual cost input
  formatCurrency(manualCostInput);
  
  manualCostInput.addEventListener('input', (e) => {
    // Store the clean numeric value (without $ and commas) in the data model
    const cleanValue = e.target.value.replace(/[$,]/g, '');
    lineItem.manualCost = cleanValue;
    updatePreview();
    updateValidationState();
  });
  
  laborHoursInput.addEventListener('input', (e) => {
    lineItem.laborHours = e.target.value;
    
    // Auto-calculate labor cost: $80/hour regular + $120/hour OT
    calculateLaborCost(lineItem);
    
    // Add "hrs" suffix functionality
    const wrapper = e.target.closest('.input-with-suffix') || e.target.parentElement;
    if (e.target.value && !wrapper.classList.contains('has-value')) {
      wrapper.classList.add('input-with-suffix');
      wrapper.setAttribute('data-suffix', 'hrs');
      wrapper.classList.add('has-value');
    } else if (!e.target.value) {
      wrapper.classList.remove('has-value');
    }
    updatePreview();
    updateValidationState();
  });
  
  otHoursInput.addEventListener('input', (e) => {
    lineItem.otHours = e.target.value;
    
    // Auto-calculate labor cost: $80/hour regular + $120/hour OT
    calculateLaborCost(lineItem);
    
    // Add "hrs" suffix functionality
    const wrapper = e.target.closest('.input-with-suffix') || e.target.parentElement;
    if (e.target.value && !wrapper.classList.contains('has-value')) {
      wrapper.classList.add('input-with-suffix');
      wrapper.setAttribute('data-suffix', 'hrs');
      wrapper.classList.add('has-value');
    } else if (!e.target.value) {
      wrapper.classList.remove('has-value');
    }
    updatePreview();
    updateValidationState();
  });
  
  descriptionInput.addEventListener('input', (e) => {
    lineItem.description = e.target.value;
    
    // Update the item header with the description
    const itemDescriptionSpan = card.querySelector('.item-description');
    if (itemDescriptionSpan) {
      if (e.target.value.trim()) {
        itemDescriptionSpan.textContent = `: ${e.target.value}`;
      } else {
        itemDescriptionSpan.textContent = '';
      }
    }
    
    updatePreview();
    updateValidationState();
  });
  
  removeBtn.addEventListener('click', () => {
    state.scope.lineItems = state.scope.lineItems.filter(i => i.id !== id);
    card.remove();
    updatePreview();
    updateValidationState();
  });
  
  document.getElementById('line-items-list').appendChild(template);
  
  // Update validation state after adding
  updateValidationState();
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOMContentLoaded - Starting initialization');
  
  try {
    // Initialize sidebar dependencies in correct order (matching app.js)
    console.log('📦 Creating UserManager...');
    const userManager = new UserManager();
    console.log('✅ UserManager created');
    
    console.log('📦 Creating InvoiceStorage...');
    const invoiceStorage = new InvoiceStorage();
    console.log('✅ InvoiceStorage created');
    
    console.log('📦 Creating ThemeManager...');
    const themeManager = new ThemeManager();
    console.log('✅ ThemeManager created');
    
    console.log('📦 Creating AuthModal...');
    const authModal = new AuthModal(userManager);
    console.log('✅ AuthModal created');
    
    console.log('📦 Creating SettingsModal...');
    const settingsModal = new SettingsModal(userManager, themeManager);
    console.log('✅ SettingsModal created');
    
    // Initialize sidebar (must be after other components)
    console.log('🏗️ Creating Sidebar...');
    const sidebar = new Sidebar(userManager, invoiceStorage, authModal, settingsModal);
    console.log('✅ Sidebar created successfully');
    
    console.log('🔗 Setting up sidebar listeners...');
    sidebar.setupInvoiceItemListeners();
    console.log('✅ Sidebar listeners set up');
    
    console.log('🎯 Checking if sidebar was added to DOM...');
    const sidebarElement = document.querySelector('.app-sidebar');
    console.log('🔍 Sidebar element found:', !!sidebarElement);
    if (sidebarElement) {
      console.log('📏 Sidebar dimensions:', {
        width: sidebarElement.offsetWidth,
        height: sidebarElement.offsetHeight,
        visible: sidebarElement.style.display !== 'none'
      });
    }
    
  } catch (error) {
    console.error('💥 INITIALIZATION FAILED:', error);
    console.error('Stack trace:', error.stack);
  }
  
  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      tabPanels.forEach(panel => {
        const section = panel.getAttribute('data-section');
        if (section === targetTab) {
          panel.classList.add('visible');
        } else {
          panel.classList.remove('visible');
        }
      });
    });
  });
  
  // Vessel form
  document.getElementById('vessel-name').addEventListener('input', (e) => {
    state.vessel.name = e.target.value;
    updatePreview();
  });
  
  document.getElementById('vessel-weight').addEventListener('input', (e) => {
    state.vessel.weight = e.target.value;
    updatePreview();
  });
  
  document.getElementById('vessel-beam').addEventListener('input', (e) => {
    state.vessel.beam = e.target.value;
    updatePreview();
  });
  
  document.getElementById('customer-type').addEventListener('change', (e) => {
    state.vessel.customerType = e.target.value;
    updatePreview();
  });
  
  // Customer form
  document.getElementById('estimator-name').addEventListener('input', (e) => {
    state.customer.estimatorName = e.target.value;
    updatePreview();
  });
  
  document.getElementById('customer-name').addEventListener('input', (e) => {
    state.customer.customerName = e.target.value;
    updatePreview();
  });
  
  document.getElementById('customer-email').addEventListener('input', (e) => {
    state.customer.customerEmail = e.target.value;
    updatePreview();
  });
  
  document.getElementById('customer-email').addEventListener('blur', (e) => {
    const email = e.target.value;
    const errorEl = document.querySelector('.email-error');
    if (email && !validateEmail(email)) {
      errorEl.textContent = 'Please enter a valid email address';
    } else {
      errorEl.textContent = '';
    }
  });
  
  document.getElementById('customer-phone').addEventListener('input', (e) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      const formatted = formatPhoneNumber(cleaned);
      e.target.value = formatted;
      state.customer.customerPhone = formatted;
      updatePreview();
    }
  });
  
  // Scope form
  document.getElementById('markup-rate').addEventListener('change', (e) => {
    state.scope.markupRate = e.target.value;
    updatePreview();
  });
  
  document.getElementById('taxable-select').addEventListener('change', (e) => {
    state.scope.isTaxable = e.target.value === 'yes';
    updatePreview();
  });
  
  document.getElementById('add-line-item').addEventListener('click', addLineItem);
  
  // Action buttons
  document.getElementById('save-invoice').addEventListener('click', () => {
    const title = prompt('Enter a name for this invoice:');
    if (title === null) return; // User cancelled
    
    const finalTitle = title.trim() || 'Untitled Invoice';
    console.log('Save invoice functionality not implemented in standalone mode');
    alert('Save functionality requires user authentication. Please use the full application.');
  });
  
  document.getElementById('save-draft').addEventListener('click', () => {
    const title = prompt('Enter a name for this draft:');
    if (title === null) return; // User cancelled
    
    const finalTitle = title.trim() || 'Untitled Draft';
    console.log('Save draft functionality not implemented in standalone mode');
    alert('Save functionality requires user authentication. Please use the full application.');
  });
  
  document.getElementById('print-invoice').addEventListener('click', () => {
    window.print();
  });
  
  document.getElementById('compose-email').addEventListener('click', () => {
    const subject = encodeURIComponent(`Invoice Request - ${state.vessel.name || 'Marine Services'}`);
    const body = encodeURIComponent(`Invoice request details...`);
    window.open(`mailto:${state.customer.customerEmail}?subject=${subject}&body=${body}`);
  });
  
  document.getElementById('generate-pdf').addEventListener('click', async () => {
    try {
      // Check if libraries are loaded
      if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        alert('PDF libraries are still loading. Please try again in a moment.');
        return;
      }
      
      const invoice = document.querySelector('.invoice-preview');
      
      // Show loading state
      const button = document.getElementById('generate-pdf');
      const originalText = button.textContent;
      button.textContent = 'Generating...';
      button.disabled = true;
      
      // Create canvas from HTML using global html2canvas
      const canvas = await html2canvas(invoice, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      // Calculate dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      // Create PDF using global jsPDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;
      
      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save PDF
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`marine-invoice-${date}.pdf`);
      
      // Reset button
      button.textContent = originalText;
      button.disabled = false;
      
      // Show success message
      alert('PDF generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
      
      // Reset button on error
      const button = document.getElementById('generate-pdf');
      button.textContent = 'Generate PDF';
      button.disabled = false;
    }
  });
  
  // Initial preview update
  updatePreview();
  
  // Initialize validation state (button should be enabled when no line items exist)
  updateValidationState();
  
  // Initialize field formatters - temporarily disabled
  // initializeFieldFormatters();
  
  // Make addLineItem available for testing
  window.addLineItem = function(item) {
    addLineItem();
    const lastIndex = state.scope.lineItems.length - 1;
    if (item && lastIndex >= 0) {
      Object.assign(state.scope.lineItems[lastIndex], item);
      updatePreview();
    }
  };
});