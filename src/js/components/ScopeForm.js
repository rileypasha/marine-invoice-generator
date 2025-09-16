import { CONSTANTS } from '../utils/constants.js';
import { validateNumber } from '../state/validators.js';
import { formatCurrencyInput, parseCurrencyInput } from '../utils/formatters.js';
import { MarkupValidator } from '../utils/markupValidator.js';

// Debounce utility to prevent excessive function calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export class ScopeForm {
  constructor(state) {
    this.state = state;

    // ✅ FIX: Prevent duplicate handler attachments with flag
    this.listenersAttached = false;

    // ✅ FIX: Single-flight operation protection
    this.isAddingLineItem = false;

    this.initElements();
    this.attachListeners();

    // Performance optimization: debounced functions to prevent excessive updates
    this.debouncedStateUpdate = debounce((id, updates) => {
      this.state.updateLineItem(id, updates);
    }, 300); // 300ms delay to batch rapid keystrokes

    this.debouncedValidation = debounce(() => {
      this.updateValidationState();
    }, 250); // Slightly faster validation for better UX

    // Track active typing to prevent auto-save conflicts
    this.isActivelyTyping = false;
    this.typingTimeout = null;

    // Subscribe to state changes to automatically update line items
    this.isUpdatingFromState = false; // Prevent infinite loops
    this.state.subscribe(() => {
      if (!this.isUpdatingFromState) {
        console.log('🔄 ScopeForm received state update, checking for line item changes...');
        this.updateLineItemsFromState();
        this.updateValidationState();
      }
    });
  }

  // Helper method to track active typing and prevent auto-save conflicts
  markActiveTyping() {
    this.isActivelyTyping = true;
    clearTimeout(this.typingTimeout);

    // Clear typing flag after 2 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.isActivelyTyping = false;
    }, 2000);
  }

  // Expose typing status for auto-save collision prevention
  getIsActivelyTyping() {
    return this.isActivelyTyping;
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

    // ✅ FIX: Defensive state access for validation
    const stateObj = this.state.getState ? this.state.getState() : this.state;
    const lineItems = stateObj.scope?.lineItems || stateObj.services?.lineItems || [];

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
    // ✅ FIX: Defensive state access for validation state updates
    const stateObj = this.state.getState ? this.state.getState() : this.state;
    const lineItems = stateObj.scope?.lineItems || stateObj.services?.lineItems || [];
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
    // Only look for elements that actually exist in the HTML
    this.addLineItemBtn = document.getElementById('add-line-item');
    this.lineItemsList = document.getElementById('line-items-list');
    this.lineItemTemplate = document.getElementById('line-item-template');

    // These elements don't exist in the current HTML, so don't look for them
    // this.markupRate = document.getElementById('markup-rate');
    // this.taxableSelect = document.getElementById('taxable-select');

    console.log('🔍 ScopeForm DOM elements:');
    console.log('  - addLineItemBtn:', this.addLineItemBtn ? '✅' : '❌');
    console.log('  - lineItemsList:', this.lineItemsList ? '✅' : '❌');
    console.log('  - lineItemTemplate:', this.lineItemTemplate ? '✅' : '❌');
  }

  attachListeners() {
    console.log('🔗 ScopeForm: Attaching event listeners...');

    // ✅ FIX: Prevent duplicate listener attachment
    if (this.listenersAttached) {
      console.log('⚠️ Listeners already attached, skipping to prevent duplicates');
      return;
    }

    // Skip markup rate and taxable select - these elements don't exist in current HTML
    // The markup and tax logic is now handled per line item in the line item template

    if (this.addLineItemBtn) {
      // ✅ FIX: Remove any existing listeners first (defensive programming)
      const clonedButton = this.addLineItemBtn.cloneNode(true);
      this.addLineItemBtn.parentNode.replaceChild(clonedButton, this.addLineItemBtn);
      this.addLineItemBtn = clonedButton;

      this.addLineItemBtn.addEventListener('click', async (event) => {
        // ✅ FIX: Prevent duplicate clicks and event bubbling
        event.preventDefault();
        event.stopPropagation();

        // ✅ FIX: Single-flight operation protection
        if (this.isAddingLineItem) {
          console.log('⚠️ Add operation already in progress, ignoring click');
          return;
        }

        this.isAddingLineItem = true;

        try {
          // ✅ FIX: Temporarily disable button to prevent rapid-fire clicks
          this.addLineItemBtn.disabled = true;
          this.addLineItemBtn.textContent = 'Adding...';

          // Check if existing line items are complete
          const incompleteItems = this.validateAllLineItems();
          console.log('Incomplete items found:', incompleteItems);
          if (incompleteItems.length > 0) {
            alert(`Please complete Item ${incompleteItems[0].index} before adding a new line item.`);
            return;
          }

          // ✅ FIX: Defensive state access with normalization check
          const stateObj = this.state.getState ? this.state.getState() : this.state;

          // Ensure state structure exists before accessing
          if (!stateObj.scope) {
            console.warn('⚠️ State scope missing, initializing...');
            stateObj.scope = { lineItems: [] };
          }
          if (!Array.isArray(stateObj.scope.lineItems)) {
            console.warn('⚠️ State scope.lineItems missing, initializing...');
            stateObj.scope.lineItems = [];
          }

          // Track line items before adding
          const beforeCount = stateObj.scope.lineItems.length;
          console.log(`🔍 Adding line item - current count: ${beforeCount}`);

          // Just add to state - the subscription will handle rendering automatically
          const newItemId = this.state.addLineItem();
          console.log(`✅ Line item added with ID: ${newItemId}`);

          // Verify the addition was successful with defensive access
          const updatedStateObj = this.state.getState ? this.state.getState() : this.state;
          const afterCount = updatedStateObj.scope?.lineItems?.length || 0;
          console.log(`🔍 After adding - count: ${afterCount} (expected: ${beforeCount + 1})`);

          if (afterCount !== beforeCount + 1) {
            console.error(`❌ Unexpected line item count change: ${beforeCount} → ${afterCount}`);
          }

          // updateValidationState will be called by the state subscription

        } catch (error) {
          console.error('❌ Error adding line item:', error);
        } finally {
          // ✅ FIX: Re-enable button with delay to prevent accidental rapid clicks
          setTimeout(() => {
            this.addLineItemBtn.disabled = false;
            this.addLineItemBtn.textContent = 'Add Line Item';
            this.isAddingLineItem = false;
          }, 300); // 300ms delay to prevent accidental rapid clicks
        }
      });

      console.log('✅ Add line item button listener attached with duplicate protection');
    } else {
      console.warn('⚠️ Add line item button not found');
    }

    // ✅ FIX: Mark listeners as attached
    this.listenersAttached = true;
  }

  /**
   * ✅ CRITICAL FIX: Configure field visibility BEFORE setting values
   * This prevents progressive disclosure logic from clearing populated values
   */
  configureFieldVisibility(row, item) {
    console.log('🔧 Configuring field visibility for item:', item);

    const secondaryFields = row.querySelector('.secondary-fields');
    const descriptionField = row.querySelector('.description-field');
    const manualEntryFields = row.querySelector('.manual-entry-fields');
    const manualCostField = row.querySelector('.manual-cost-field');
    const laborFields = row.querySelector('.labor-fields');

    // Start with all secondary fields hidden
    secondaryFields.style.display = 'none';
    descriptionField.style.display = 'none';
    manualEntryFields.style.display = 'none';
    manualCostField.style.display = 'none';
    laborFields.style.display = 'none';

    if (item.jobType) {
      // Show secondary fields container when service type is selected
      secondaryFields.style.display = 'flex';

      if (item.jobType === 'Manual Entry') {
        // For Manual Entry, show the Item Type dropdown initially
        manualEntryFields.style.display = 'flex';

        if (item.itemType) {
          // Show description when Item Type is selected
          descriptionField.style.display = 'flex';

          if (item.itemType === 'Labor') {
            // Show hours fields for Labor
            laborFields.style.display = 'grid';
          } else {
            // Show cost field for other item types
            manualCostField.style.display = 'flex';
          }
        }
      } else if (item.jobType === 'Agent Services') {
        // For Agent Services, show description and hours fields
        descriptionField.style.display = 'flex';
        laborFields.style.display = 'grid';
      } else {
        // Other service types (Pilotage, Car Rental, etc.) - show description and cost
        descriptionField.style.display = 'flex';
        manualCostField.style.display = 'flex';
      }
    }

    console.log('✅ Field visibility configured');
  }

  renderLineItem(id) {
    try {
      const template = this.lineItemTemplate.content.cloneNode(true);
      const card = template.querySelector('.line-item-card');

      // ✅ FIX: Set proper unique identifiers and keys
      card.setAttribute('data-row', id);
      card.setAttribute('data-key', `line-item-${id}-${Date.now()}`);

      // ✅ FIX: Pre-configure element before DOM insertion
      this.preConfigureLineItem(card, id);

      // ✅ FIX: Insert into DOM first
      this.lineItemsList.appendChild(template);

      // ✅ FIX: Use double requestAnimationFrame for better DOM readiness and add fallback
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            this.attachLineItemListeners(card, id);
            this.updateValidationState();

            // Additional validation: ensure job type select is properly accessible
            const jobTypeSelect = card.querySelector('.job-type-select');
            if (!jobTypeSelect) {
              console.error('❌ Service type dropdown not found after render, retrying...');
              // Fallback: try again after a short delay
              setTimeout(() => {
                const retryCard = document.querySelector(`[data-row="${id}"]`);
                if (retryCard) {
                  this.attachLineItemListeners(retryCard, id);
                }
              }, 100);
            }
          } catch (error) {
            console.error('❌ Error in post-render setup:', error);
          }
        });
      });

      console.log(`✅ Line item ${id} rendered successfully`);
    } catch (error) {
      console.error('❌ Error rendering line item:', error);
      // Remove partially created element if it exists
      const partialElement = document.querySelector(`[data-row="${id}"]`);
      if (partialElement) {
        partialElement.remove();
      }
    }
  }

  /**
   * ✅ FIX: Pre-configure line item before DOM insertion
   */
  preConfigureLineItem(card, id) {
    // Set unique IDs for all inputs
    const elements = {
      jobTypeSelect: card.querySelector('.job-type-select'),
      itemTypeSelect: card.querySelector('.item-type-select'),
      manualCostInput: card.querySelector('.manual-cost-input'),
      laborHoursInput: card.querySelector('.labor-hours-input'),
      otHoursInput: card.querySelector('.ot-hours-input'),
      descriptionInput: card.querySelector('.description-input')
    };

    Object.entries(elements).forEach(([key, element]) => {
      if (element) {
        element.id = `${key}-${id}`;
      }
    });

    // Set item number
    const itemNumberSpan = card.querySelector('.item-number');
    const currentItems = this.lineItemsList.children.length;
    itemNumberSpan.textContent = currentItems + 1;
  }

  /**
   * ✅ FIX: Error-wrapped event listener attachment
   */
  attachLineItemListeners(card, id) {
    const elements = {
      jobTypeSelect: card.querySelector('.job-type-select'),
      itemTypeSelect: card.querySelector('.item-type-select'),
      manualCostInput: card.querySelector('.manual-cost-input'),
      laborHoursInput: card.querySelector('.labor-hours-input'),
      otHoursInput: card.querySelector('.ot-hours-input'),
      descriptionInput: card.querySelector('.description-input'),
      removeBtn: card.querySelector('.remove-line-item')
    };

    // Get field groups for showing/hiding
    const manualEntryFields = card.querySelector('.manual-entry-fields');
    const manualCostField = card.querySelector('.manual-cost-field');
    const laborFields = card.querySelector('.labor-fields');
    const secondaryFields = card.querySelector('.secondary-fields');
    const descriptionField = card.querySelector('.description-field');

    // ✅ FIX: Error-wrapped job type change handler
    if (elements.jobTypeSelect) {
      elements.jobTypeSelect.addEventListener('change', (e) => {
        try {
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
        } catch (error) {
          console.error('❌ JobType change error:', error);
        }
      });
    }

    // ✅ FIX: Error-wrapped item type change handler
    if (elements.itemTypeSelect) {
      elements.itemTypeSelect.addEventListener('change', (e) => {
        try {
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
        } catch (error) {
          console.error('❌ ItemType change error:', error);
        }
      });
    }

    // ✅ FIX: Error-wrapped cost input handler
    if (elements.manualCostInput) {
      elements.manualCostInput.addEventListener('input', (e) => {
        try {
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
        } catch (error) {
          console.error('❌ Manual cost input error:', error);
        }
      });

      // Prevent non-numeric characters from being typed
      elements.manualCostInput.addEventListener('keydown', (e) => {
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
    }

    // ✅ FIX: Error-wrapped labor hours handlers
    if (elements.laborHoursInput) {
      elements.laborHoursInput.addEventListener('input', (e) => {
        try {
          const value = e.target.value;

          // Mark active typing to prevent auto-save conflicts
          this.markActiveTyping();

          if (value === '' || validateNumber(value, 0)) {
            // Use debounced state update to prevent excessive calls
            this.debouncedStateUpdate(id, { laborHours: value });

            // Auto-calculate labor cost: $80/hour regular + $120/hour OT
            // Debounce this calculation as well to prevent excessive calls
            debounce(() => this.calculateLaborCost(id), 400)();
          }

          // Add "hrs" suffix functionality (immediate for UX)
          const wrapper = e.target.closest('.input-with-suffix') || e.target.parentElement;
          if (e.target.value && !wrapper.classList.contains('has-value')) {
            wrapper.classList.add('input-with-suffix');
            wrapper.setAttribute('data-suffix', 'hrs');
            wrapper.classList.add('has-value');
          } else if (!e.target.value) {
            wrapper.classList.remove('has-value');
          }

          // Use debounced validation to prevent excessive DOM manipulation
          this.debouncedValidation();
        } catch (error) {
          console.error('❌ Labor hours input error:', error);
        }
      });
    }

    if (elements.otHoursInput) {
      elements.otHoursInput.addEventListener('input', (e) => {
        try {
          const value = e.target.value;

          // Mark active typing to prevent auto-save conflicts
          this.markActiveTyping();

          if (value === '' || validateNumber(value, 0)) {
            // Use debounced state update to prevent excessive calls
            this.debouncedStateUpdate(id, { otHours: value });

            // Auto-calculate labor cost: $80/hour regular + $120/hour OT
            // Debounce this calculation as well to prevent excessive calls
            debounce(() => this.calculateLaborCost(id), 400)();
          }

          // Add "hrs" suffix functionality (immediate for UX)
          const wrapper = e.target.closest('.input-with-suffix') || e.target.parentElement;
          if (e.target.value && !wrapper.classList.contains('has-value')) {
            wrapper.classList.add('input-with-suffix');
            wrapper.setAttribute('data-suffix', 'hrs');
            wrapper.classList.add('has-value');
          } else if (!e.target.value) {
            wrapper.classList.remove('has-value');
          }

          // Use debounced validation to prevent excessive DOM manipulation
          this.debouncedValidation();
        } catch (error) {
          console.error('❌ OT hours input error:', error);
        }
      });
    }

    // ✅ FIX: Error-wrapped description handler
    if (elements.descriptionInput) {
      elements.descriptionInput.addEventListener('input', (e) => {
        try {
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
        } catch (error) {
          console.error('❌ Description input error:', error);
        }
      });
    }

    // Tax configuration event listeners
    const taxStatusSelect = card.querySelector('.tax-status-select');
    const taxRateField = card.querySelector('.tax-rate-field');
    const taxRateInput = card.querySelector('.tax-rate-input');

    // Tax status change handler
    if (taxStatusSelect) {
      taxStatusSelect.addEventListener('change', (e) => {
        try {
          const taxStatus = e.target.value;
          console.log(`💰 Tax status changed for item ${id}:`, taxStatus);

          // Update line item with new tax status
          const updates = { taxStatus };

          // Set appropriate tax rate based on status
          if (taxStatus === 'taxable') {
            updates.taxRate = 0.0875; // 8.75%
            if (taxRateInput) taxRateInput.value = '8.75';
          } else if (taxStatus === 'non-taxable' || taxStatus === 'exempt') {
            updates.taxRate = 0;
            if (taxRateInput) taxRateInput.value = '0';
          }

          this.state.updateLineItem(id, updates);

          // Show/hide tax rate field for future custom rates enhancement
          if (taxStatus === 'custom' && taxRateField) {
            taxRateField.style.display = 'block';
          } else if (taxRateField) {
            taxRateField.style.display = 'none';
          }

          this.updateValidationState();
        } catch (error) {
          console.error('❌ Tax status change error:', error);
        }
      });
    }

    // Tax rate change handler (for future custom rates)
    if (taxRateInput) {
      taxRateInput.addEventListener('input', (e) => {
        try {
          const taxRatePercent = parseFloat(e.target.value) || 0;
          const taxRate = taxRatePercent / 100; // Convert percentage to decimal

          console.log(`💰 Tax rate changed for item ${id}: ${taxRatePercent}% (${taxRate})`);

          if (taxRatePercent >= 0 && taxRatePercent <= 100) {
            this.state.updateLineItem(id, { taxRate });
          }

          this.updateValidationState();
        } catch (error) {
          console.error('❌ Tax rate input error:', error);
        }
      });
    }

    // Markup configuration event listeners
    const markupTypeSelect = card.querySelector('.markup-type-select');
    const customMarkupField = card.querySelector('.custom-markup-field');
    const customMarkupInput = card.querySelector('.custom-markup-input');
    const markupError = card.querySelector('.markup-error');

    // Markup type change handler
    if (markupTypeSelect) {
      markupTypeSelect.addEventListener('change', (e) => {
        try {
          const selectValue = e.target.value;
          console.log(`📈 Markup type changed for item ${id}:`, selectValue);

          // Parse markup configuration
          const markupConfig = MarkupValidator.parseMarkupType(selectValue);

          // Show/hide custom markup field
          if (selectValue === 'custom' && customMarkupField) {
            customMarkupField.style.display = 'block';
            // Focus the custom input
            setTimeout(() => customMarkupInput && customMarkupInput.focus(), 100);
          } else if (customMarkupField) {
            customMarkupField.style.display = 'none';
            this.clearMarkupError(id);
          }

          // Update line item with markup configuration
          this.state.updateLineItem(id, markupConfig);
          this.updateValidationState();
        } catch (error) {
          console.error('❌ Markup type change error:', error);
        }
      });
    }

    // Custom markup input handlers
    if (customMarkupInput) {
      customMarkupInput.addEventListener('input', (e) => {
        try {
          const value = e.target.value;
          console.log(`📈 Custom markup input for item ${id}:`, value);

          // Real-time validation feedback (but don't update state yet)
          const validation = MarkupValidator.validateCustomMarkup(value);
          if (!validation.isValid && value.trim() !== '') {
            this.showMarkupError(id, validation.errors[0]);
          } else {
            this.clearMarkupError(id);
          }
        } catch (error) {
          console.error('❌ Custom markup input error:', error);
        }
      });

      customMarkupInput.addEventListener('blur', (e) => {
        try {
          const value = e.target.value;
          console.log(`📈 Custom markup blur for item ${id}:`, value);

          if (value.trim() === '') {
            // Empty value, set to 0
            e.target.value = '0.00';
            this.state.updateLineItem(id, { markupRate: '0' });
            this.clearMarkupError(id);
          } else {
            // Validate and apply custom markup
            this.validateAndApplyCustomMarkup(value, id);
          }

          this.updateValidationState();
        } catch (error) {
          console.error('❌ Custom markup blur error:', error);
        }
      });

      // Enter key handler for custom markup
      customMarkupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur(); // Trigger blur validation
        }
      });
    }

    // ✅ FIX: Error-wrapped remove button
    if (elements.removeBtn) {
      elements.removeBtn.addEventListener('click', () => {
        try {
          this.state.removeLineItem(id);
          card.remove();
          this.updateValidationState();
        } catch (error) {
          console.error('❌ Remove line item error:', error);
        }
      });
    }
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

    // ✅ FIX: Defensive state access with fallback to services.lineItems
    const currentState = this.state.getState();
    const stateLineItems = currentState.scope?.lineItems || currentState.services?.lineItems || [];

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

  /**
   * ✅ CRITICAL FIX: Configure field visibility BEFORE setting values
   * This prevents progressive disclosure logic from clearing populated values
   */
  populateLineItem(row, item) {
    console.log('📝 Populating line item with data:', item);

    // ✅ FIX: Configure field visibility FIRST, then set values
    this.configureFieldVisibility(row, item);

    const jobTypeSelect = row.querySelector('.job-type-select');
    const itemTypeSelect = row.querySelector('.item-type-select');

    // Now safely set values after visibility is configured
    if (jobTypeSelect) {
      jobTypeSelect.value = item.jobType || '';
    }
    if (itemTypeSelect) {
      itemTypeSelect.value = item.itemType || '';
    }

    // Set other fields
    const costInput = row.querySelector('.manual-cost-input');
    if (costInput) {
      if (item.manualCost) {
        costInput.value = formatCurrencyInput(item.manualCost);
      } else {
        costInput.value = '';
      }
    }

    const laborHoursInput = row.querySelector('.labor-hours-input');
    if (laborHoursInput) {
      laborHoursInput.value = item.laborHours || '';
    }

    const otHoursInput = row.querySelector('.ot-hours-input');
    if (otHoursInput) {
      otHoursInput.value = item.otHours || '';
    }

    const descriptionInput = row.querySelector('.description-input');
    if (descriptionInput) {
      descriptionInput.value = item.description || '';
    }

    // Set tax configuration fields
    const taxStatusSelect = row.querySelector('.tax-status-select');
    const taxRateInput = row.querySelector('.tax-rate-input');

    if (taxStatusSelect) {
      taxStatusSelect.value = item.taxStatus || 'taxable';
    }

    if (taxRateInput) {
      const taxRatePercent = ((item.taxRate || 0.0875) * 100).toFixed(2);
      taxRateInput.value = taxRatePercent;
    }

    // Set markup configuration fields
    const markupTypeSelect = row.querySelector('.markup-type-select');
    const customMarkupField = row.querySelector('.custom-markup-field');
    const customMarkupInput = row.querySelector('.custom-markup-input');

    if (markupTypeSelect) {
      const selectValue = MarkupValidator.getSelectValue(item);
      markupTypeSelect.value = selectValue;

      // Show/hide custom markup field based on type
      if (selectValue === 'custom' && customMarkupField) {
        customMarkupField.style.display = 'block';
        if (customMarkupInput && item.markupRate) {
          customMarkupInput.value = parseFloat(item.markupRate).toFixed(2);
        }
      } else if (customMarkupField) {
        customMarkupField.style.display = 'none';
      }
    }

    // ✅ FIX: NO MORE CHANGE EVENTS - visibility is already configured
    // The old approach of triggering change events after setting values
    // was causing the progressive disclosure logic to clear the values

    // Update the item header with the description
    const itemDescriptionSpan = row.querySelector('.item-description');
    if (itemDescriptionSpan && item.description) {
      itemDescriptionSpan.textContent = `: ${item.description}`;
    }

    console.log('✅ Line item populated successfully without triggering change events');
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

  /**
   * Show markup validation error for a line item
   * @param {number} lineItemId - Line item ID
   * @param {string} message - Error message to display
   */
  showMarkupError(lineItemId, message) {
    const card = document.querySelector(`[data-row="${lineItemId}"]`);
    if (!card) return;

    const errorElement = card.querySelector('.markup-error');
    const input = card.querySelector('.custom-markup-input');

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }

    if (input) {
      input.classList.add('error');
    }

    // Auto-clear after 5 seconds
    setTimeout(() => this.clearMarkupError(lineItemId), 5000);
  }

  /**
   * Clear markup validation error for a line item
   * @param {number} lineItemId - Line item ID
   */
  clearMarkupError(lineItemId) {
    const card = document.querySelector(`[data-row="${lineItemId}"]`);
    if (!card) return;

    const errorElement = card.querySelector('.markup-error');
    const input = card.querySelector('.custom-markup-input');

    if (errorElement) {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    }

    if (input) {
      input.classList.remove('error');
    }
  }

  /**
   * Validate and apply custom markup value
   * @param {string} value - Custom markup value to validate
   * @param {number} lineItemId - Line item ID
   */
  validateAndApplyCustomMarkup(value, lineItemId) {
    try {
      const validation = MarkupValidator.validateCustomMarkup(value);

      if (validation.isValid) {
        // Format and apply the validated value
        const formattedValue = validation.sanitizedValue.toFixed(2);
        const input = document.querySelector(`[data-row="${lineItemId}"] .custom-markup-input`);
        if (input) {
          input.value = formattedValue;
        }

        // Update state with the sanitized value
        this.state.updateLineItem(lineItemId, {
          markupRate: String(validation.sanitizedValue),
          markupType: 'custom'
        });

        this.clearMarkupError(lineItemId);
        console.log(`📈 Applied custom markup for item ${lineItemId}: ${validation.sanitizedValue}%`);
      } else {
        // Show validation error
        this.showMarkupError(lineItemId, validation.errors[0]);
        console.warn(`📈 Invalid custom markup for item ${lineItemId}:`, validation.errors);
      }
    } catch (error) {
      // Handle any unexpected errors from state update
      console.error('Error applying custom markup:', error);
      this.showMarkupError(lineItemId, 'Error updating markup. Please try again.');
    }
  }
}