import { formatCurrency, formatPercentage, formatDate } from '../utils/formatters.js';
import { calculateLineItemCost, calculateTotals, applyMarkup } from '../utils/calculations.js';

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
    
    // Update line items
    this.updateLineItems(state.scope);
    
    // Calculate and update totals
    this.updateTotals(state);
  }
  
  updateLineItems(scope) {
    this.lineItemsContainer.innerHTML = '';
    
    scope.lineItems.forEach(item => {
      if (!item.jobType || !item.description) return;
      
      const row = document.createElement('tr');
      row.className = 'line-item-row';
      row.setAttribute('data-row', item.id);
      
      const cost = calculateLineItemCost(item);
      const totalWithMarkup = applyMarkup(cost, scope.markupRate);
      
      row.innerHTML = `
        <td>${item.description}</td>
        <td>${item.jobType}${item.itemType ? ` - ${item.itemType}` : ''}</td>
        <td class="cost-cell">${formatCurrency(cost)}</td>
        <td class="total-with-markup">${formatCurrency(totalWithMarkup)}</td>
        <td>
          <span class="trash-icon" data-id="${item.id}" style="cursor: pointer;">🗑️</span>
        </td>
      `;
      
      // Add trash icon listener
      const trashIcon = row.querySelector('.trash-icon');
      trashIcon.addEventListener('click', () => {
        this.state.removeLineItem(item.id);
      });
      
      this.lineItemsContainer.appendChild(row);
    });
  }
  
  updateTotals(state) {
    const totals = calculateTotals(
      state.scope.lineItems,
      state.scope.markupRate,
      state.scope.isTaxable,
      state.vessel.weight
    );
    
    this.subtotal.textContent = formatCurrency(totals.subtotal);
    this.clearanceFee.textContent = formatCurrency(totals.clearanceFee);
    
    if (state.scope.isTaxable) {
      this.taxRow.style.display = 'flex';
      this.taxAmount.textContent = formatCurrency(totals.tax);
    } else {
      this.taxRow.style.display = 'none';
    }
    
    this.total.textContent = formatCurrency(totals.total);
    this.grossProfitAmount.textContent = formatCurrency(totals.grossProfit);
    this.grossProfitPercent.textContent = formatPercentage(totals.grossProfitPercent);
  }
}