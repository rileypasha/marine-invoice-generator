import { CONSTANTS } from '../utils/constants.js';
import { validateNumber } from '../state/validators.js';

export class ScopeForm {
  constructor(state) {
    this.state = state;
    this.initElements();
    this.attachListeners();
  }
  
  initElements() {
    this.markupRate = document.getElementById('markup-rate');
    this.taxableNo = document.getElementById('taxable-no');
    this.taxableYes = document.getElementById('taxable-yes');
    this.addLineItemBtn = document.getElementById('add-line-item');
    this.lineItemsList = document.getElementById('line-items-list');
    this.lineItemTemplate = document.getElementById('line-item-template');
  }
  
  attachListeners() {
    this.markupRate.addEventListener('change', (e) => {
      this.state.updateScope({ markupRate: e.target.value });
    });
    
    this.taxableNo.addEventListener('change', () => {
      this.state.updateScope({ isTaxable: false });
    });
    
    this.taxableYes.addEventListener('change', () => {
      this.state.updateScope({ isTaxable: true });
    });
    
    this.addLineItemBtn.addEventListener('click', () => {
      const id = this.state.addLineItem();
      this.renderLineItem(id);
    });
  }
  
  renderLineItem(id) {
    const template = this.lineItemTemplate.content.cloneNode(true);
    const row = template.querySelector('.line-item-row');
    row.setAttribute('data-row', id);
    
    const jobTypeSelect = row.querySelector('.job-type-select');
    jobTypeSelect.id = `job-type-${id}`;
    
    const itemTypeSelect = row.querySelector('.item-type-select');
    itemTypeSelect.id = `item-type-${id}`;
    
    const manualCostInput = row.querySelector('.manual-cost-input');
    manualCostInput.id = `manual-cost-${id}`;
    
    const laborHoursInput = row.querySelector('.labor-hours-input');
    laborHoursInput.id = `labor-hours-${id}`;
    
    const otHoursInput = row.querySelector('.ot-hours-input');
    otHoursInput.id = `ot-hours-${id}`;
    
    const descriptionInput = row.querySelector('.description-input');
    descriptionInput.id = `description-${id}`;
    
    const removeBtn = row.querySelector('.remove-line-item');
    
    // Attach listeners
    jobTypeSelect.addEventListener('change', (e) => {
      const jobType = e.target.value;
      this.state.updateLineItem(id, { jobType });
      
      // Show/hide relevant fields
      if (jobType === CONSTANTS.JOB_TYPES.MANUAL_ENTRY) {
        itemTypeSelect.style.display = 'block';
        manualCostInput.style.display = 'block';
        laborHoursInput.style.display = 'none';
        otHoursInput.style.display = 'none';
      } else if (jobType === CONSTANTS.JOB_TYPES.AGENT_SERVICES) {
        itemTypeSelect.style.display = 'none';
        manualCostInput.style.display = 'none';
        laborHoursInput.style.display = 'block';
        otHoursInput.style.display = 'block';
      } else if (jobType) {
        itemTypeSelect.style.display = 'none';
        manualCostInput.style.display = 'block';
        laborHoursInput.style.display = 'none';
        otHoursInput.style.display = 'none';
      }
    });
    
    itemTypeSelect.addEventListener('change', (e) => {
      this.state.updateLineItem(id, { itemType: e.target.value });
    });
    
    manualCostInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value === '' || validateNumber(value, 0)) {
        this.state.updateLineItem(id, { manualCost: value });
      }
    });
    
    laborHoursInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value === '' || validateNumber(value, 0)) {
        this.state.updateLineItem(id, { laborHours: value });
      }
    });
    
    otHoursInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value === '' || validateNumber(value, 0)) {
        this.state.updateLineItem(id, { otHours: value });
      }
    });
    
    descriptionInput.addEventListener('input', (e) => {
      this.state.updateLineItem(id, { description: e.target.value });
    });
    
    removeBtn.addEventListener('click', () => {
      this.state.removeLineItem(id);
      row.remove();
    });
    
    this.lineItemsList.appendChild(template);
  }
  
  clearLineItems() {
    this.lineItemsList.innerHTML = '';
  }
  
  populate(scopeData) {
    this.markupRate.value = scopeData.markupRate || '2.5';
    if (scopeData.isTaxable) {
      this.taxableYes.checked = true;
    } else {
      this.taxableNo.checked = true;
    }
    
    this.clearLineItems();
    scopeData.lineItems.forEach(item => {
      this.renderLineItem(item.id);
      // Populate values after rendering
      setTimeout(() => {
        const row = document.querySelector(`[data-row="${item.id}"]`);
        if (row) {
          row.querySelector('.job-type-select').value = item.jobType;
          row.querySelector('.job-type-select').dispatchEvent(new Event('change'));
          row.querySelector('.item-type-select').value = item.itemType;
          row.querySelector('.manual-cost-input').value = item.manualCost;
          row.querySelector('.labor-hours-input').value = item.laborHours;
          row.querySelector('.ot-hours-input').value = item.otHours;
          row.querySelector('.description-input').value = item.description;
        }
      }, 0);
    });
  }
}