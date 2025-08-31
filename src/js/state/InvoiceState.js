import { TaxCalculator, TaxValidator } from '../utils/taxCalculator.js';

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
  
  addLineItem(lineItem = {}) {
    const defaultTaxConfig = TaxCalculator.getDefaultTaxConfig();
    
    const newItem = {
      id: this.lineItemIdCounter++,
      jobType: '',
      itemType: '',
      manualCost: '',
      laborHours: '',
      otHours: '',
      description: '',
      ...defaultTaxConfig,
      ...lineItem
    };
    
    // Calculate initial tax amount
    newItem.taxAmount = TaxCalculator.calculateLineTax(newItem, this.state.scope.markupRate);
    
    this.state.scope.lineItems.push(newItem);
    this.notify();
    return newItem.id;
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
        
        // Apply updates
        this.state.scope.lineItems[index] = {
          ...this.state.scope.lineItems[index],
          ...updates
        };
        
        // Recalculate tax if tax-related fields or cost fields changed
        if ('taxStatus' in updates || 'taxRate' in updates || 
            'manualCost' in updates || 'laborHours' in updates || 'otHours' in updates) {
          this.recalculateLineTax(id);
        }
        
        this.notify();
      } catch (error) {
        console.error('Error updating line item tax:', error);
        // Revert to safe defaults for tax fields
        if ('taxRate' in updates) {
          updates.taxRate = 0.0875; // Default to standard rate
        }
        if ('taxStatus' in updates) {
          updates.taxStatus = 'taxable'; // Default to taxable
        }
        
        // Apply safe updates
        this.state.scope.lineItems[index] = {
          ...this.state.scope.lineItems[index],
          ...updates
        };
        this.recalculateLineTax(id);
        this.notify();
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
      item.taxAmount = TaxCalculator.calculateLineTax(item, this.state.scope.markupRate);
      console.log(`💰 Recalculated tax for item ${id}: ${item.taxAmount}`);
    }
  }
  
  /**
   * Recalculate tax amounts for all line items
   * (useful when markup rate changes)
   */
  recalculateAllTaxes() {
    console.log('💰 Recalculating taxes for all line items...');
    this.state.scope.lineItems.forEach(item => {
      item.taxAmount = TaxCalculator.calculateLineTax(item, this.state.scope.markupRate);
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
      }
    };
    this.lineItemIdCounter = 0;
    this.notify();
  }
}