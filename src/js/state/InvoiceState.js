import { TaxCalculator, TaxValidator } from '../utils/taxCalculator.js';
import { MarkupValidator } from '../utils/markupValidator.js';

export class InvoiceState {
  constructor() {
    this.state = {
      vessel: {
        name: '',
        weight: '',
        beam: ''
      },
      customer: {
        customerName: '',
        customerEmail: '',
        customerPhone: ''
      },
      scope: {
        markupRate: '2.5',
        isTaxable: false,
        lineItems: []
      },
      notes: {
        comments: []
      }
    };
    
    this.listeners = [];
    this.lineItemIdCounter = 0;
  }
  
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  notify() {
    console.log('🔔 Notifying listeners of state change. Current state:', this.state);
    console.log(`📊 Listeners count: ${this.listeners.length}`);
    this.listeners.forEach((listener, index) => {
      console.log(`  - Calling listener ${index}`);
      listener(this.state);
    });
  }
  
  updateVessel(updates) {
    console.log('🚢 Updating vessel state:', updates);
    const oldVessel = { ...this.state.vessel };
    this.state.vessel = { ...this.state.vessel, ...updates };
    console.log('  - Old vessel:', oldVessel);
    console.log('  - New vessel:', this.state.vessel);
    this.notify();
  }
  
  updateCustomer(updates) {
    console.log('👤 Updating customer state:', updates);
    const oldCustomer = { ...this.state.customer };
    this.state.customer = { ...this.state.customer, ...updates };
    console.log('  - Old customer:', oldCustomer);
    console.log('  - New customer:', this.state.customer);
    this.notify();
  }
  
  updateScope(updates) {
    console.log('📋 Updating scope state:', updates);
    const oldScope = { ...this.state.scope };
    this.state.scope = { ...this.state.scope, ...updates };
    console.log('  - Old scope:', oldScope);
    console.log('  - New scope:', this.state.scope);
    
    // Recalculate all taxes if markup rate changed
    if ('markupRate' in updates && updates.markupRate !== oldScope.markupRate) {
      console.log('💰 Markup rate changed, recalculating all taxes');
      this.recalculateAllTaxes();
    } else {
      this.notify();
    }
  }
  
  updateNotes(updates) {
    console.log('📝 Updating notes state:', updates);
    const oldNotes = { ...this.state.notes };
    this.state.notes = { ...this.state.notes, ...updates };
    console.log('  - Old notes:', oldNotes);
    console.log('  - New notes:', this.state.notes);
    this.notify();
  }
  
  addLineItem(lineItem = {}) {
    const defaultTaxConfig = TaxCalculator.getDefaultTaxConfig(lineItem.jobType);
    const defaultMarkupConfig = this.getDefaultMarkupConfig(lineItem.jobType);
    
    const newItem = {
      id: this.lineItemIdCounter++,
      jobType: '',
      itemType: '',
      manualCost: '',
      laborHours: '',
      otHours: '',
      description: '',
      ...defaultTaxConfig,
      ...defaultMarkupConfig,
      ...lineItem
    };
    
    // Calculate initial tax amount using per-line markup
    newItem.taxAmount = TaxCalculator.calculateLineTax(newItem, newItem.markupRate);
    
    this.state.scope.lineItems.push(newItem);
    this.notify();
    return newItem.id;
  }
  
  /**
   * Get default markup configuration for new line items
   * @param {string} jobType - Job type for context-specific defaults
   * @returns {Object} Default markup configuration
   */
  getDefaultMarkupConfig(jobType = null) {
    // Check if this job type should be markup exempt
    if (jobType === 'Agent Services' || 
        (jobType === 'Manual Entry') || // Will be refined based on itemType
        jobType === 'Clearance Fee') {
      return {
        markupType: 'exempt',
        markupRate: '0',
        isMarkupExempt: true
      };
    }
    
    // Default to current global markup rate for backward compatibility
    return {
      markupType: 'preset',
      markupRate: this.state.scope.markupRate || '2.5',
      isMarkupExempt: false
    };
  }
  
  updateLineItem(id, updates) {
    const index = this.state.scope.lineItems.findIndex(item => item.id === id);
    if (index !== -1) {
      try {
        // Validate tax-related updates
        if ('taxRate' in updates) {
          TaxValidator.validateTaxRate(updates.taxRate);
        }
        
        if ('taxStatus' in updates) {
          if (!TaxValidator.validateTaxStatus(updates.taxStatus)) {
            console.warn('Invalid tax status:', updates.taxStatus);
            updates.taxStatus = 'taxable'; // Default to safe value
          }
        }
        
        // Validate markup-related updates
        if ('markupRate' in updates && updates.markupType === 'custom') {
          const validation = MarkupValidator.validateCustomMarkup(updates.markupRate);
          if (!validation.isValid) {
            throw new Error(`Invalid markup rate: ${validation.errors.join(', ')}`);
          }
          updates.markupRate = String(validation.sanitizedValue);
        }
        
        // Handle markup exemption logic for specific job types
        if ('jobType' in updates || 'itemType' in updates) {
          const item = this.state.scope.lineItems[index];
          const newJobType = updates.jobType || item.jobType;
          const newItemType = updates.itemType || item.itemType;
          
          // Auto-exempt certain combinations
          if (newJobType === 'Agent Services' || 
              newJobType === 'Clearance Fee' ||
              (newJobType === 'Manual Entry' && newItemType === 'Labor')) {
            updates.isMarkupExempt = true;
            updates.markupType = 'exempt';
            updates.markupRate = '0';
          }
        }
        
        // Apply updates
        this.state.scope.lineItems[index] = {
          ...this.state.scope.lineItems[index],
          ...updates
        };
        
        // Recalculate tax if tax-related fields or cost fields changed
        if ('taxStatus' in updates || 'taxRate' in updates || 
            'manualCost' in updates || 'laborHours' in updates || 'otHours' in updates ||
            'markupRate' in updates || 'markupType' in updates || 'isMarkupExempt' in updates) {
          this.recalculateLineTax(id);
        }
        
        this.notify();
      } catch (error) {
        console.error('Error updating line item:', error);
        // Revert to safe defaults for tax fields
        if ('taxRate' in updates) {
          updates.taxRate = 0.0875; // Default to standard rate
        }
        if ('taxStatus' in updates) {
          updates.taxStatus = 'taxable'; // Default to taxable
        }
        // Revert to safe defaults for markup fields
        if ('markupRate' in updates) {
          updates.markupRate = '2.5'; // Default to standard rate
          updates.markupType = 'preset';
        }
        
        // Apply safe updates
        this.state.scope.lineItems[index] = {
          ...this.state.scope.lineItems[index],
          ...updates
        };
        this.recalculateLineTax(id);
        this.notify();
        
        // Re-throw for UI error handling
        throw error;
      }
    }
  }
  
  removeLineItem(id) {
    this.state.scope.lineItems = this.state.scope.lineItems.filter(
      item => item.id !== id
    );
    this.notify();
  }
  
  /**
   * Recalculate tax amount for a specific line item
   * @param {number} id - Line item ID
   */
  recalculateLineTax(id) {
    const item = this.state.scope.lineItems.find(item => item.id === id);
    if (item) {
      // Use per-line markup rate for tax calculation
      item.taxAmount = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
      console.log(`💰 Recalculated tax for item ${id}: ${item.taxAmount} (markup: ${item.markupRate}%)`);
    }
  }
  
  /**
   * Recalculate tax amounts for all line items
   * (useful when markup rate changes)
   */
  recalculateAllTaxes() {
    console.log('💰 Recalculating taxes for all line items...');
    this.state.scope.lineItems.forEach(item => {
      // Use per-line markup rate for tax calculation
      item.taxAmount = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
    });
    this.notify();
  }
  
  /**
   * Get total tax amount for all line items
   * @returns {number} Total tax amount
   */
  getTotalTax() {
    return TaxCalculator.calculateTotalTax(this.state.scope.lineItems, this.state.scope.markupRate);
  }
  
  /**
   * Migrate legacy invoice data to include per-line tax configuration
   */
  migrateLegacyTaxData() {
    console.log('🔄 Migrating legacy tax data...');
    const scopeIsTaxable = this.state.scope.isTaxable;
    
    this.state.scope.lineItems = this.state.scope.lineItems.map(item => {
      return TaxCalculator.migrateLineItemTax(item, scopeIsTaxable);
    });
    
    // Recalculate all tax amounts after migration
    this.recalculateAllTaxes();
    console.log('✅ Legacy tax data migration complete');
  }
  
  getState() {
    return this.state;
  }
  
  reset() {
    this.state = {
      vessel: {
        name: '',
        weight: '',
        beam: ''
      },
      customer: {
        customerName: '',
        customerEmail: '',
        customerPhone: ''
      },
      scope: {
        markupRate: '2.5',
        isTaxable: false,
        lineItems: []
      },
      notes: {
        comments: []
      }
    };
    this.lineItemIdCounter = 0;
    this.notify();
  }
}