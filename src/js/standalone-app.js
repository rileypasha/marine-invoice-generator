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
  input.addEventListener('focus', function() {
    const value = this.value.replace(/[\$,]/g, '').trim();
    this.value = value;
  });

  input.addEventListener('blur', function() {
    const value = this.value.replace(/[\$,]/g, '').trim();
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
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
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

function calculateLineItemCost(lineItem) {
  if (lineItem.jobType === 'Agent Services') {
    return calculateLaborCost(lineItem.laborHours, lineItem.otHours);
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

// Add line item
function addLineItem() {
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
  const row = template.querySelector('.line-item-row');
  row.setAttribute('data-row', id);
  
  const jobTypeSelect = row.querySelector('.job-type-select');
  const itemTypeSelect = row.querySelector('.item-type-select');
  const manualCostInput = row.querySelector('.manual-cost-input');
  const laborHoursInput = row.querySelector('.labor-hours-input');
  const otHoursInput = row.querySelector('.ot-hours-input');
  const descriptionInput = row.querySelector('.description-input');
  const removeBtn = row.querySelector('.remove-line-item');
  
  // Attach listeners
  jobTypeSelect.addEventListener('change', (e) => {
    lineItem.jobType = e.target.value;
    
    if (e.target.value === 'Manual Entry') {
      itemTypeSelect.style.display = 'block';
      manualCostInput.style.display = 'block';
      laborHoursInput.style.display = 'none';
      otHoursInput.style.display = 'none';
    } else if (e.target.value === 'Agent Services') {
      itemTypeSelect.style.display = 'none';
      manualCostInput.style.display = 'none';
      laborHoursInput.style.display = 'block';
      otHoursInput.style.display = 'block';
    } else if (e.target.value) {
      itemTypeSelect.style.display = 'none';
      manualCostInput.style.display = 'block';
      laborHoursInput.style.display = 'none';
      otHoursInput.style.display = 'none';
    }
    updatePreview();
  });
  
  itemTypeSelect.addEventListener('change', (e) => {
    lineItem.itemType = e.target.value;
    updatePreview();
  });
  
  manualCostInput.addEventListener('input', (e) => {
    lineItem.manualCost = e.target.value;
    updatePreview();
  });
  
  laborHoursInput.addEventListener('input', (e) => {
    lineItem.laborHours = e.target.value;
    updatePreview();
  });
  
  otHoursInput.addEventListener('input', (e) => {
    lineItem.otHours = e.target.value;
    updatePreview();
  });
  
  descriptionInput.addEventListener('input', (e) => {
    lineItem.description = e.target.value;
    updatePreview();
  });
  
  removeBtn.addEventListener('click', () => {
    state.scope.lineItems = state.scope.lineItems.filter(i => i.id !== id);
    row.remove();
    updatePreview();
  });
  
  document.getElementById('line-items-list').appendChild(template);
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
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
  
  document.getElementById('taxable-no').addEventListener('change', () => {
    state.scope.isTaxable = false;
    updatePreview();
  });
  
  document.getElementById('taxable-yes').addEventListener('change', () => {
    state.scope.isTaxable = true;
    updatePreview();
  });
  
  document.getElementById('add-line-item').addEventListener('click', addLineItem);
  
  // Action buttons
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