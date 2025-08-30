import { CONSTANTS } from '../utils/constants.js';
import { validateNumber } from '../state/validators.js';
import { formatCurrencyInput, parseCurrencyInput } from '../utils/formatters.js';

export class ScopeForm {
  constructor(state) {
    this.state = state;
    this.initElements();
    this.attachListeners();
    
    // Subscribe to state changes to automatically update line items
    this.isUpdatingFromState = false; // Prevent infinite loops
    this.state.subscribe(() => {
      if (!this.isUpdatingFromState) {
        console.log('🔄 ScopeForm received state update, checking for line item changes...');
        this.updateLineItemsFromState();
      }
    });
  }
  
  // Validation functions
  validateLineItem(lineItem) {
    console.log('🔍 Validating line item:', lineItem);
    const errors = [];
    const card = document.querySelector(`[data-row="${lineItem.id}"]`);
    
    // Service Type is always required
    console.log('🔍 jobType value:', `"${lineItem.jobType}"`, 'Type:', typeof lineItem.jobType, 'Length:', lineItem.jobType ? lineItem.jobType.length : 'N/A');
    if (!lineItem.jobType || lineItem.jobType.trim() === '') {
      console.log('❌ No jobType found - adding error');
      errors.push('Service Type is required');
    } else {
      console.log('✅ jobType found:', lineItem.jobType);
    }
    
    // For Manual Entry, validate based on progressive disclosure
    if (lineItem.jobType === 'Manual Entry') {
      if (!lineItem.itemType) {
        errors.push('Item Type is required for Manual Entry');
      } else {
        // Only validate description if it's visible (after Item Type is selected)
        const descriptionField = card ? card.querySelector('.description-field') : null;
        const isDescriptionVisible = descriptionField && descriptionField.style.display !== 'none';
        
        if (isDescriptionVisible && !lineItem.description) {
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
      if (!lineItem.description) {
        errors.push('Description is required');
      }
      
      if (lineItem.jobType !== 'Agent Services') {
        // Non-Manual Entry services need cost (except Agent Services which uses hours)
        if (!lineItem.manualCost) {
          errors.push('Cost is required');
        }
      }
    }
    
    console.log('🚨 Validation errors for item:', errors);
    return errors;
  }
  
  validateAllLineItems() {
    const incompleteItems = [];
    const lineItems = this.state.scope ? this.state.scope.lineItems : [];
    
    lineItems.forEach((item, index) => {
      const errors = this.validateLineItem(item);
      if (errors.length > 0) {
        incompleteItems.push({ index: index + 1, errors });
      }
    });
    
    return incompleteItems;
  }
  
  updateValidationState() {
    const incompleteItems = this.validateAllLineItems();
    
    // Clear all existing validation states
    document.querySelectorAll('.form-input.error').forEach(input => {
      input.classList.remove('error');
    });
    document.querySelectorAll('.validation-message').forEach(msg => {
      msg.remove();
    });
    
    // Apply validation states to incomplete items
    const lineItems = this.state.scope ? this.state.scope.lineItems : [];
    lineItems.forEach((item, index) => {
      const errors = this.validateLineItem(item);
      const card = document.querySelector(`[data-row="${item.id}"]`);
      if (!card) return;
      
      if (errors.length > 0) {
        // Mark required fields as error
        if (!item.jobType) {
          const jobTypeSelect = card.querySelector('.job-type-select');
          jobTypeSelect.classList.add('error');
        }
        
        if (!item.description) {
          const descriptionInput = card.querySelector('.description-input');
          descriptionInput.classList.add('error');
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
    if (lineItems.length === 0) {
      // No line items - enable button so user can add first item
      this.addLineItemBtn.disabled = false;
      this.addLineItemBtn.title = '';
    } else if (incompleteItems.length > 0) {
      // Some items are incomplete - disable button
      this.addLineItemBtn.disabled = true;
      this.addLineItemBtn.title = `Complete Item ${incompleteItems[0].index} before adding new items`;
    } else {
      // All items are complete - enable button
      this.addLineItemBtn.disabled = false;
      this.addLineItemBtn.title = '';
    }
  }
  
  initElements() {
    this.markupRate = document.getElementById('markup-rate');
    this.taxableSelect = document.getElementById('taxable-select');
    this.addLineItemBtn = document.getElementById('add-line-item');
    this.lineItemsList = document.getElementById('line-items-list');
    this.lineItemTemplate = document.getElementById('line-item-template');
  }
  
  attachListeners() {
    this.markupRate.addEventListener('change', (e) => {
      this.state.updateScope({ markupRate: e.target.value });
    });
    
    this.taxableSelect.addEventListener('change', (e) => {
      this.state.updateScope({ isTaxable: e.target.value === 'yes' });
    });
    
    this.addLineItemBtn.addEventListener('click', () => {
      // Check if existing line items are complete
      const incompleteItems = this.validateAllLineItems();
      console.log('Incomplete items found:', incompleteItems);
      if (incompleteItems.length > 0) {
        alert(`Please complete Item ${incompleteItems[0].index} before adding a new line item.`);
        return;
      }
      
      const id = this.state.addLineItem();
      this.renderLineItem(id);
      this.updateValidationState();
    });
  }
  
  renderLineItem(id) {
    const template = this.lineItemTemplate.content.cloneNode(true);
    const card = template.querySelector('.line-item-card');
    card.setAttribute('data-row', id);
    
    // Set item number
    const itemNumberSpan = card.querySelector('.item-number');
    const currentItems = this.lineItemsList.children.length;
    itemNumberSpan.textContent = currentItems + 1;
    
    // Get all the elements
    const jobTypeSelect = card.querySelector('.job-type-select');
    jobTypeSelect.id = `job-type-${id}`;
    
    const itemTypeSelect = card.querySelector('.item-type-select');
    itemTypeSelect.id = `item-type-${id}`;
    
    const manualCostInput = card.querySelector('.manual-cost-input');
    manualCostInput.id = `manual-cost-${id}`;
    
    const laborHoursInput = card.querySelector('.labor-hours-input');
    laborHoursInput.id = `labor-hours-${id}`;
    
    const otHoursInput = card.querySelector('.ot-hours-input');
    otHoursInput.id = `ot-hours-${id}`;
    
    const descriptionInput = card.querySelector('.description-input');
    descriptionInput.id = `description-${id}`;
    
    // Get field groups for showing/hiding
    const manualEntryFields = card.querySelector('.manual-entry-fields');
    const manualCostField = card.querySelector('.manual-cost-field');
    const laborFields = card.querySelector('.labor-fields');
    
    // Get field groups for progressive disclosure
    const secondaryFields = card.querySelector('.secondary-fields');
    const descriptionField = card.querySelector('.description-field');
    
    const removeBtn = card.querySelector('.remove-line-item');
    
    // Attach listeners
    jobTypeSelect.addEventListener('change', (e) => {
      const jobType = e.target.value;
      this.state.updateLineItem(id, { jobType });
      
      // Show/hide relevant field groups with progressive disclosure
      if (jobType) {
        // Show secondary fields container when service type is selected
        secondaryFields.style.display = 'flex';
        
        if (jobType === 'Manual Entry') {
          // For Manual Entry, only show the Item Type dropdown initially
          // Hide description until Item Type is selected
          descriptionField.style.display = 'none';
          manualEntryFields.style.display = 'flex';
          manualCostField.style.display = 'none';
          laborFields.style.display = 'none';
        } else if (jobType === 'Agent Services') {
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
      this.updateValidationState();
    });
    
    itemTypeSelect.addEventListener('change', (e) => {
      const itemType = e.target.value;
      this.state.updateLineItem(id, { itemType });
      
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
      
      this.updateValidationState();
    });
    
    manualCostInput.addEventListener('input', (e) => {
      const rawValue = e.target.value;
      
      // Parse and format the currency input
      const cleanValue = parseCurrencyInput(rawValue);
      
      if (cleanValue === '' || validateNumber(cleanValue, 0)) {
        // Format the display value
        const formattedValue = cleanValue ? formatCurrencyInput(cleanValue) : '';
        
        // Update the input display
        e.target.value = formattedValue;
        
        // Store the raw numeric value in state
        this.state.updateLineItem(id, { manualCost: cleanValue });
        
        // Set cursor position to the end (after formatting)
        setTimeout(() => {
          if (e.target.setSelectionRange && e.target.type !== 'number') {
            e.target.setSelectionRange(e.target.value.length, e.target.value.length);
          }
        }, 0);
      } else {
        // Invalid input - revert to previous value
        const currentItem = this.state.getState().scope.lineItems.find(item => item.id === id);
        const previousValue = currentItem && currentItem.manualCost ? 
          formatCurrencyInput(currentItem.manualCost) : '';
        e.target.value = previousValue;
      }
      this.updateValidationState();
    });
    
    // Prevent non-numeric characters from being typed
    manualCostInput.addEventListener('keydown', (e) => {
      // Allow: backspace, delete, tab, escape, enter, decimal point
      if ([8, 9, 27, 13, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
          // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
          (e.keyCode === 65 && e.ctrlKey === true) ||
          (e.keyCode === 67 && e.ctrlKey === true) ||
          (e.keyCode === 86 && e.ctrlKey === true) ||
          (e.keyCode === 88 && e.ctrlKey === true) ||
          // Allow: home, end, left, right, down, up
          (e.keyCode >= 35 && e.keyCode <= 40)) {
        return;
      }
      // Ensure it's a number and stop the keypress if not
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
      }
    });
    
    laborHoursInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value === '' || validateNumber(value, 0)) {
        this.state.updateLineItem(id, { laborHours: value });
        
        // Auto-calculate labor cost: $80/hour regular + $120/hour OT
        // Use setTimeout to ensure state is updated first
        setTimeout(() => this.calculateLaborCost(id), 0);
      }
      // Add "hrs" suffix functionality
      const wrapper = e.target.closest('.input-with-suffix') || e.target.parentElement;
      if (e.target.value && !wrapper.classList.contains('has-value')) {
        wrapper.classList.add('input-with-suffix');
        wrapper.setAttribute('data-suffix', 'hrs');
        wrapper.classList.add('has-value');
      } else if (!e.target.value) {
        wrapper.classList.remove('has-value');
      }
      this.updateValidationState();
    });
    
    otHoursInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value === '' || validateNumber(value, 0)) {
        this.state.updateLineItem(id, { otHours: value });
        
        // Auto-calculate labor cost: $80/hour regular + $120/hour OT
        // Use setTimeout to ensure state is updated first
        setTimeout(() => this.calculateLaborCost(id), 0);
      }
      // Add "hrs" suffix functionality
      const wrapper = e.target.closest('.input-with-suffix') || e.target.parentElement;
      if (e.target.value && !wrapper.classList.contains('has-value')) {
        wrapper.classList.add('input-with-suffix');
        wrapper.setAttribute('data-suffix', 'hrs');
        wrapper.classList.add('has-value');
      } else if (!e.target.value) {
        wrapper.classList.remove('has-value');
      }
      this.updateValidationState();
    });
    
    descriptionInput.addEventListener('input', (e) => {
      this.state.updateLineItem(id, { description: e.target.value });
      
      // Update the item header with the description
      const itemDescriptionSpan = card.querySelector('.item-description');
      if (itemDescriptionSpan) {
        if (e.target.value.trim()) {
          itemDescriptionSpan.textContent = `: ${e.target.value}`;
        } else {
          itemDescriptionSpan.textContent = '';
        }
      }
      
      this.updateValidationState();
    });
    
    removeBtn.addEventListener('click', () => {
      this.state.removeLineItem(id);
      card.remove();
      this.updateValidationState();
    });
    
    this.lineItemsList.appendChild(template);
    
    // Update validation state after adding
    this.updateValidationState();
  }
  
  calculateLaborCost(id) {
    console.log('💰 calculateLaborCost called for ID:', id);
    console.log('🔍 State object:', this.state);
    const currentState = this.state.getState ? this.state.getState() : this.state;
    console.log('🔍 Current state:', currentState);
    const lineItems = currentState.scope ? currentState.scope.lineItems : [];
    console.log('📋 All line items:', lineItems);
    const item = lineItems.find(item => item.id === id);
    console.log('📋 Found item:', item);
    
    if (item && item.itemType === 'Labor') {
      const regularHours = parseFloat(item.laborHours) || 0;
      const otHours = parseFloat(item.otHours) || 0;
      console.log('⏱️ Hours - Regular:', regularHours, 'OT:', otHours);
      
      // Calculate cost: $80/hour regular + $120/hour OT (using constants from utils/constants.js)
      const LABOR_RATE = 80;
      const OT_LABOR_RATE = 120;
      const laborCost = (regularHours * LABOR_RATE) + (otHours * OT_LABOR_RATE);
      console.log('💵 Calculated labor cost:', laborCost);
      
      // Update the item with calculated cost
      this.state.updateLineItem(id, { manualCost: laborCost.toString() });
      console.log('✅ Updated item with cost:', laborCost.toString());
      
      // Update the visual input field with formatted currency
      const card = document.querySelector(`[data-row="${id}"]`);
      if (card) {
        const manualCostInput = card.querySelector('.manual-cost-input');
        if (manualCostInput && laborCost > 0) {
          manualCostInput.value = formatCurrencyInput(laborCost.toString());
        }
      }
    } else {
      console.log('❌ Item not found or not Labor type');
    }
  }
  
  clearLineItems() {
    this.lineItemsList.innerHTML = '';
  }
  
  // Update displayed line items to match the current state
  updateLineItemsFromState() {
    this.isUpdatingFromState = true; // Prevent recursive calls
    
    const currentState = this.state.getState();
    const stateLineItems = currentState.scope.lineItems || [];
    
    // Get currently displayed line items
    const displayedCards = Array.from(document.querySelectorAll('.line-item-card[data-row]'));
    const displayedIds = displayedCards.map(card => parseInt(card.getAttribute('data-row')));
    
    console.log('📋 State line items:', stateLineItems.map(item => ({ id: item.id, jobType: item.jobType })));
    console.log('📋 Displayed items:', displayedIds);
    
    // Add missing line items from state
    stateLineItems.forEach(item => {
      if (!displayedIds.includes(item.id)) {
        console.log('➕ Adding missing line item to display:', item.id, item.jobType);
        this.renderLineItem(item.id);
        
        // Populate the newly added line item with its data
        setTimeout(() => {
          const row = document.querySelector(`[data-row="${item.id}"]`);
          if (row) {
            console.log('📝 Populating newly added line item:', item.id);
            this.populateLineItem(row, item);
          }
        }, 10);
      }
    });
    
    // Remove line items that are no longer in state
    const stateIds = stateLineItems.map(item => item.id);
    displayedCards.forEach(card => {
      const displayedId = parseInt(card.getAttribute('data-row'));
      if (!stateIds.includes(displayedId)) {
        console.log('➖ Removing line item from display:', displayedId);
        card.remove();
      }
    });
    
    this.isUpdatingFromState = false; // Reset flag
  }
  
  // Helper method to populate a single line item
  populateLineItem(row, item) {
    const jobTypeSelect = row.querySelector('.job-type-select');
    const itemTypeSelect = row.querySelector('.item-type-select');
    
    // Set values first
    jobTypeSelect.value = item.jobType || '';
    itemTypeSelect.value = item.itemType || '';
    
    // Set other fields
    const costInput = row.querySelector('.manual-cost-input');
    if (item.manualCost) {
      costInput.value = formatCurrencyInput(item.manualCost);
    } else {
      costInput.value = '';
    }
    row.querySelector('.labor-hours-input').value = item.laborHours || '';
    row.querySelector('.ot-hours-input').value = item.otHours || '';
    row.querySelector('.description-input').value = item.description || '';
    
    // Trigger change events to set up field visibility
    // For clearance fees and other service types, this will show the cost field
    if (item.jobType) {
      jobTypeSelect.dispatchEvent(new Event('change'));
    }
    if (item.itemType && item.jobType === 'Manual Entry') {
      itemTypeSelect.dispatchEvent(new Event('change'));
    }
    
    // Update the item header with the description
    const itemDescriptionSpan = row.querySelector('.item-description');
    if (itemDescriptionSpan && item.description) {
      itemDescriptionSpan.textContent = `: ${item.description}`;
    }
  }
  
  populate(scopeData) {
    this.markupRate.value = scopeData.markupRate || '2.5';
    this.taxableSelect.value = scopeData.isTaxable ? 'yes' : 'no';
    
    this.clearLineItems();
    scopeData.lineItems.forEach(item => {
      this.renderLineItem(item.id);
      // Populate values after rendering
      setTimeout(() => {
        const row = document.querySelector(`[data-row="${item.id}"]`);
        if (row) {
          // Set values first, then trigger change events to ensure proper field visibility
          row.querySelector('.job-type-select').value = item.jobType || '';
          row.querySelector('.item-type-select').value = item.itemType || '';
          
          // Now trigger change events to set up field visibility - but only if we have values
          if (item.jobType) {
            row.querySelector('.job-type-select').dispatchEvent(new Event('change'));
          }
          if (item.itemType) {
            row.querySelector('.item-type-select').dispatchEvent(new Event('change'));
          }
          
          const costInput = row.querySelector('.manual-cost-input');
          if (item.manualCost) {
            costInput.value = formatCurrencyInput(item.manualCost);
          } else {
            costInput.value = '';
          }
          row.querySelector('.labor-hours-input').value = item.laborHours || '';
          row.querySelector('.ot-hours-input').value = item.otHours || '';
          row.querySelector('.description-input').value = item.description || '';
          
          // Update the item header with the description
          const itemDescriptionSpan = row.querySelector('.item-description');
          if (itemDescriptionSpan && item.description) {
            itemDescriptionSpan.textContent = `: ${item.description}`;
          }
        }
      }, 0);
    });
  }
}