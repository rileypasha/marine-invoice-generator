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
    this.notify();
  }
  
  addLineItem(lineItem = {}) {
    const newItem = {
      id: this.lineItemIdCounter++,
      jobType: '',
      itemType: '',
      manualCost: '',
      laborHours: '',
      otHours: '',
      description: '',
      ...lineItem
    };
    
    this.state.scope.lineItems.push(newItem);
    this.notify();
    return newItem.id;
  }
  
  updateLineItem(id, updates) {
    const index = this.state.scope.lineItems.findIndex(item => item.id === id);
    if (index !== -1) {
      this.state.scope.lineItems[index] = {
        ...this.state.scope.lineItems[index],
        ...updates
      };
      this.notify();
    }
  }
  
  removeLineItem(id) {
    this.state.scope.lineItems = this.state.scope.lineItems.filter(
      item => item.id !== id
    );
    this.notify();
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