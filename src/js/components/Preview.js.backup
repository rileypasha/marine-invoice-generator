import { formatCurrency, formatPercentage, formatDate } from '../utils/formatters.js';
import { calculateLineItemCost, calculateTotals, calculateLineItemTotal, applyMarkup } from '../utils/calculations.js';
import { TaxCalculator } from '../utils/taxCalculator.js';

export class Preview {
  constructor(state, userManager) {
    console.log('👁️ Initializing Preview component...');
    this.state = state;
    this.userManager = userManager;
    this.initElements();
    
    console.log('📡 Subscribing to state changes...');
    this.state.subscribe(() => {
      console.log('👁️ Preview received state update, calling update()...');
      this.update();
    });
    
    console.log('🎨 Calling initial update...');
    this.update();
    console.log('✅ Preview component initialized successfully');
  }
  
  initElements() {
    // Date
    this.previewDate = document.getElementById('preview-date');
    
    // Vessel details
    this.vesselName = document.querySelector('.preview-vessel-name');
    this.vesselWeight = document.querySelector('.preview-vessel-weight');
    this.vesselBeam = document.querySelector('.preview-vessel-beam');
    
    // Customer details
    this.estimatorName = document.querySelector('.preview-estimator-name');
    this.customerName = document.querySelector('.preview-customer-name');
    this.customerEmail = document.querySelector('.preview-customer-email');
    this.customerPhone = document.querySelector('.preview-customer-phone');
    this.customerAddress = document.querySelector('.preview-customer-address');
    
    // Line items
    this.lineItemsContainer = document.getElementById('preview-line-items');
    
    // Totals
    this.subtotal = document.querySelector('.preview-subtotal');
    this.clearanceFee = document.querySelector('.preview-clearance-fee');
    this.taxRow = document.querySelector('.tax-row');
    this.taxAmount = document.querySelector('.tax-amount');
    this.total = document.querySelector('.preview-total strong');
    this.grossProfitAmount = document.querySelector('.gross-profit-amount');
    this.grossProfitPercent = document.querySelector('.gross-profit-percent');
  }
  
  update() {
    const state = this.state.getState();
    
    // Update date
    this.previewDate.textContent = formatDate();
    
    // Update vessel details
    this.vesselName.textContent = state.vessel.name || '-';
    this.vesselWeight.textContent = state.vessel.weight || '0';
    this.vesselBeam.textContent = state.vessel.beam || '0';
    
    // Update customer details
    const currentUser = this.userManager.getCurrentUser();
    this.estimatorName.textContent = currentUser ? currentUser.name : 'Marine Group Team';
    this.customerName.textContent = state.customer.customerName || '-';
    this.customerEmail.textContent = state.customer.customerEmail || '-';
    this.customerPhone.textContent = state.customer.customerPhone || '-';
    this.customerAddress.textContent = state.customer.customerAddress || '-';
    
    // Update line items
    this.updateLineItems(state.scope);
    
    // Calculate and update totals
    this.updateTotals(state);
  }
  
  updateLineItems(scope) {
    this.lineItemsContainer.innerHTML = '';
    
    // Add regular line items
    scope.lineItems.forEach(item => {
      if (!item.jobType || !item.description) return;
      
      const row = document.createElement('tr');
      row.className = 'line-item-row';
      row.setAttribute('data-row', item.id);
      
      const cost = calculateLineItemCost(item);
      
      // Calculate total using per-line markup configuration
      const totalWithMarkup = calculateLineItemTotal(item);
      
      // Calculate tax for this line item using per-line markup system
      const lineTax = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
      
      // Create service type display (show only itemType to avoid redundancy with Item column)
      let serviceTypeDisplay = item.itemType || item.jobType || 'Service';
      
      // For Manual Entry, always show the itemType
      if (item.jobType === 'Manual Entry') {
        serviceTypeDisplay = item.itemType || 'Service';
      }
      
      // Add labor hours info if it's a labor item or Agent Services
      let laborInfo = '';
      if ((item.itemType === 'Labor' || item.jobType === 'Agent Services') && (item.laborHours || item.otHours)) {
        const regularHours = item.laborHours || 0;
        const otHours = item.otHours || 0;
        if (regularHours > 0 && otHours > 0) {
          laborInfo = ` (${regularHours}hrs + ${otHours}hrs OT)`;
        } else if (regularHours > 0) {
          laborInfo = ` (${regularHours}hrs)`;
        } else if (otHours > 0) {
          laborInfo = ` (${otHours}hrs OT)`;
        }
      }
      
      // Calculate markup amount
      const markupAmount = totalWithMarkup - cost;
      
      // Calculate final total including tax (cost + markup + tax)
      const finalTotal = totalWithMarkup + lineTax;
      
      row.innerHTML = `
        <td>${item.description}${laborInfo}</td>
        <td>${serviceTypeDisplay}</td>
        <td class="cost-cell">${formatCurrency(cost)}</td>
        <td class="markup-cell">${formatCurrency(markupAmount)}</td>
        <td class="tax-cell">${formatCurrency(lineTax)}</td>
        <td class="total-with-markup">${formatCurrency(finalTotal)}</td>
      `;
      
      this.lineItemsContainer.appendChild(row);
    });
    
    // Clearance fee is now handled as a regular line item in the state
  }
  
  updateTotals(state) {
    // Calculate totals using per-line tax system
    let subtotal = 0;
    let totalTax = 0;
    let baseCost = 0;
    
    state.scope.lineItems.forEach(item => {
      const cost = calculateLineItemCost(item);
      baseCost += cost;
      
      // Calculate subtotal using per-line markup configuration
      const lineTotal = calculateLineItemTotal(item);
      subtotal += lineTotal;
      
      // Calculate tax per line item using per-line markup system
      const lineTax = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
      totalTax += lineTax;
    });
    
    this.subtotal.textContent = formatCurrency(subtotal);
    
    // Hide clearance fee row since it's now a line item
    const clearanceFeeRow = document.querySelector('.preview-clearance-fee');
    if (clearanceFeeRow) {
      const clearanceFeeRowElement = clearanceFeeRow.closest('.total-row');
      if (clearanceFeeRowElement) {
        clearanceFeeRowElement.style.display = 'none';
      }
    }
    
    // Update tax display using per-line tax totals
    const total = subtotal + totalTax;
    
    if (totalTax > 0) {
      this.taxRow.style.display = 'flex';
      this.taxAmount.textContent = formatCurrency(totalTax);
    } else {
      this.taxRow.style.display = 'none';
    }
    
    this.total.textContent = formatCurrency(total);
    
    // Calculate gross profit (markup portion only)
    const grossProfit = subtotal - baseCost;
    const grossProfitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;
    
    this.grossProfitAmount.textContent = formatCurrency(grossProfit);
    this.grossProfitPercent.textContent = formatPercentage(grossProfitPercent);
  }
}