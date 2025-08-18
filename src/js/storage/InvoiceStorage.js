export class InvoiceStorage {
  constructor(userManager) {
    this.userManager = userManager;
    this.storageKey = 'marine_invoices';
    this.draftsKey = 'marine_drafts';
    this.autoSaveInterval = null;
    this.listeners = [];
    
    this.setupAutoSave();
  }
  
  // Subscribe to storage changes
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  notify() {
    this.listeners.forEach(listener => listener());
  }
  
  // Generate unique ID for invoices
  generateId() {
    return 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Save invoice (completed)
  saveInvoice(invoiceData, title = null) {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('Must be signed in to save invoices');
    }
    
    const invoice = {
      id: this.generateId(),
      userId: currentUser.id,
      title: title || this.generateTitle(invoiceData),
      status: 'completed',
      data: invoiceData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: this.extractMetadata(invoiceData)
    };
    
    const invoices = this.getAllInvoices();
    invoices.push(invoice);
    localStorage.setItem(this.storageKey, JSON.stringify(invoices));
    
    this.notify();
    return invoice.id;
  }
  
  // Save draft (auto-save or manual)
  saveDraft(invoiceData, title = null, draftId = null) {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      return null; // Silently fail for drafts if not signed in
    }
    
    const drafts = this.getAllDrafts();
    
    let draft;
    if (draftId) {
      // Update existing draft
      const index = drafts.findIndex(d => d.id === draftId);
      if (index !== -1) {
        draft = {
          ...drafts[index],
          title: title || drafts[index].title,
          data: invoiceData,
          updatedAt: new Date().toISOString(),
          metadata: this.extractMetadata(invoiceData)
        };
        drafts[index] = draft;
      }
    } else {
      // Create new draft
      draft = {
        id: this.generateId(),
        userId: currentUser.id,
        title: title || this.generateTitle(invoiceData, true),
        status: 'draft',
        data: invoiceData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: this.extractMetadata(invoiceData)
      };
      drafts.push(draft);
    }
    
    localStorage.setItem(this.draftsKey, JSON.stringify(drafts));
    this.notify();
    return draft.id;
  }
  
  // Load invoice/draft
  loadInvoice(id) {
    const invoices = this.getAllInvoices();
    const drafts = this.getAllDrafts();
    
    return invoices.find(inv => inv.id === id) || drafts.find(draft => draft.id === id);
  }
  
  // Delete invoice/draft
  deleteInvoice(id) {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) return false;
    
    // Check invoices
    let invoices = this.getAllInvoices();
    const invoiceIndex = invoices.findIndex(inv => inv.id === id && inv.userId === currentUser.id);
    if (invoiceIndex !== -1) {
      invoices.splice(invoiceIndex, 1);
      localStorage.setItem(this.storageKey, JSON.stringify(invoices));
      this.notify();
      return true;
    }
    
    // Check drafts
    let drafts = this.getAllDrafts();
    const draftIndex = drafts.findIndex(draft => draft.id === id && draft.userId === currentUser.id);
    if (draftIndex !== -1) {
      drafts.splice(draftIndex, 1);
      localStorage.setItem(this.draftsKey, JSON.stringify(drafts));
      this.notify();
      return true;
    }
    
    return false;
  }
  
  // Duplicate invoice/draft
  duplicateInvoice(id) {
    const original = this.loadInvoice(id);
    if (!original) return null;
    
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser || original.userId !== currentUser.id) return null;
    
    // Create duplicate as draft
    const duplicateData = JSON.parse(JSON.stringify(original.data));
    const title = `${original.title} (Copy)`;
    
    return this.saveDraft(duplicateData, title);
  }
  
  // Get all invoices for current user
  getUserInvoices() {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) return [];
    
    const invoices = this.getAllInvoices();
    return invoices
      .filter(inv => inv.userId === currentUser.id)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  
  // Get all drafts for current user
  getUserDrafts() {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) return [];
    
    const drafts = this.getAllDrafts();
    return drafts
      .filter(draft => draft.userId === currentUser.id)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  
  // Get recent items (invoices + drafts combined)
  getRecentItems(limit = 10) {
    const invoices = this.getUserInvoices();
    const drafts = this.getUserDrafts();
    
    const combined = [...invoices, ...drafts];
    combined.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return combined.slice(0, limit);
  }
  
  // Search invoices and drafts
  searchInvoices(query) {
    const invoices = this.getUserInvoices();
    const drafts = this.getUserDrafts();
    
    const combined = [...invoices, ...drafts];
    const searchTerm = query.toLowerCase();
    
    return combined.filter(item => 
      item.title.toLowerCase().includes(searchTerm) ||
      item.metadata.vesselName.toLowerCase().includes(searchTerm) ||
      item.metadata.customerName.toLowerCase().includes(searchTerm)
    );
  }
  
  // Auto-save functionality
  setupAutoSave() {
    // Clear existing interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Set up new interval (30 seconds)
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, 30000);
  }
  
  performAutoSave() {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser || !currentUser.preferences?.autoSave) return;
    
    // Get current invoice state from app
    if (window.app && window.app.state) {
      const currentState = window.app.state.getState();
      
      // Only auto-save if there's meaningful content
      if (this.hasContent(currentState)) {
        // Check if we have an existing auto-save draft
        const drafts = this.getUserDrafts();
        const autoSaveDraft = drafts.find(d => d.title.includes('Auto-saved'));
        
        if (autoSaveDraft) {
          this.saveDraft(currentState, autoSaveDraft.title, autoSaveDraft.id);
        } else {
          this.saveDraft(currentState, `Auto-saved ${new Date().toLocaleTimeString()}`);
        }
      }
    }
  }
  
  // Helper methods
  getAllInvoices() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  getAllDrafts() {
    try {
      const stored = localStorage.getItem(this.draftsKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  generateTitle(invoiceData, isDraft = false) {
    const vessel = invoiceData.vessel?.name || 'Unnamed Vessel';
    const customer = invoiceData.customer?.customerName || 'Unknown Customer';
    const prefix = isDraft ? 'Draft - ' : '';
    
    return `${prefix}${vessel} - ${customer}`;
  }
  
  extractMetadata(invoiceData) {
    return {
      vesselName: invoiceData.vessel?.name || '',
      customerName: invoiceData.customer?.customerName || '',
      customerEmail: invoiceData.customer?.customerEmail || '',
      lineItemCount: invoiceData.scope?.lineItems?.length || 0,
      totalAmount: this.calculateTotal(invoiceData)
    };
  }
  
  calculateTotal(invoiceData) {
    // Simple total calculation - this should match your actual calculation logic
    try {
      if (!invoiceData.scope?.lineItems) return 0;
      
      let total = 0;
      // Add up line items with markup, etc.
      // This is a simplified version - use your actual calculation logic
      return total;
    } catch {
      return 0;
    }
  }
  
  hasContent(invoiceData) {
    return !!(
      invoiceData.vessel?.name ||
      invoiceData.customer?.customerName ||
      (invoiceData.scope?.lineItems && invoiceData.scope.lineItems.length > 0)
    );
  }
  
  // Cleanup
  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}