export class InvoiceStorage {
  constructor(userManager) {
    this.userManager = userManager;
    this.storageKey = 'marine_invoices';
    this.draftsKey = 'marine_drafts';
    this.autoSaveInterval = null;
    this.listeners = [];
    this.isPerformingAutoSave = false; // Prevent concurrent auto-saves
    this.serverInvoiceMap = new Map(); // Map local IDs to server IDs
    
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
  
  // Save invoice (completed) - Now saves to both localStorage and server
  async saveInvoice(invoiceData, title = null) {
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
    
    // Save to localStorage first
    const invoices = this.getAllInvoices();
    invoices.push(invoice);
    localStorage.setItem(this.storageKey, JSON.stringify(invoices));
    
    // Save to server
    try {
      const serverInvoice = await this.saveToServer(invoice);
      if (serverInvoice && serverInvoice.id) {
        // Map local ID to server ID
        this.serverInvoiceMap.set(invoice.id, serverInvoice.id);
        invoice.serverId = serverInvoice.id;
        
        // Update localStorage with server ID
        const updatedInvoices = this.getAllInvoices();
        const index = updatedInvoices.findIndex(inv => inv.id === invoice.id);
        if (index !== -1) {
          updatedInvoices[index].serverId = serverInvoice.id;
          localStorage.setItem(this.storageKey, JSON.stringify(updatedInvoices));
        }
      }
    } catch (error) {
      console.error('Failed to save invoice to server:', error);
      // Invoice is still saved locally
    }
    
    this.notify();
    return invoice.id;
  }
  
  // Save invoice to server with comprehensive logging
  async saveToServer(invoice) {
    const requestId = `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📤 [${requestId}] Starting server save...`);
    
    try {
      const requestBody = {
        title: invoice.title,
        data: invoice.data,
        metadata: invoice.metadata
      };
      
      console.log(`📋 [${requestId}] Request body:`, JSON.stringify(requestBody, null, 2));
      console.log(`👤 [${requestId}] Current user:`, this.userManager.getCurrentUser());
      
      const response = await fetch('/api/v1/invoice/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify(requestBody)
      });
      
      console.log(`📨 [${requestId}] Response status:`, response.status);
      console.log(`📨 [${requestId}] Response headers:`, [...response.headers.entries()]);
      
      const responseText = await response.text();
      console.log(`📨 [${requestId}] Response body:`, responseText);
      
      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
          requestId
        };
        console.error(`❌ [${requestId}] Server error:`, errorDetails);
        
        // Add to failed saves queue
        this.queueFailedSave(invoice, errorDetails);
        
        throw new Error(`Server error: ${response.status} - ${responseText}`);
      }
      
      const result = JSON.parse(responseText);
      console.log(`✅ [${requestId}] Save successful! Invoice ID:`, result.invoice?.id);
      
      return result.invoice;
    } catch (error) {
      console.error(`🔥 [${requestId}] Server save failed:`, error);
      console.error(`🔥 [${requestId}] Error stack:`, error.stack);
      
      // Add to failed saves queue
      this.queueFailedSave(invoice, { error: error.message, requestId });
      
      throw error;
    }
  }
  
  // Queue failed saves for retry
  queueFailedSave(invoice, errorDetails) {
    const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');
    failedSaves.push({
      invoice,
      errorDetails,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
    localStorage.setItem('failedSaves', JSON.stringify(failedSaves));
    console.log('📦 Queued failed save for retry. Total queued:', failedSaves.length);
  }
  
  // Retry failed saves
  async retryFailedSaves() {
    const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');
    if (failedSaves.length === 0) return;
    
    console.log(`🔄 Retrying ${failedSaves.length} failed saves...`);
    const stillFailed = [];
    
    for (const failedSave of failedSaves) {
      try {
        failedSave.retryCount++;
        const result = await this.saveToServer(failedSave.invoice);
        console.log(`✅ Retry successful for invoice:`, failedSave.invoice.title);
      } catch (error) {
        if (failedSave.retryCount < 3) {
          stillFailed.push(failedSave);
        } else {
          console.error(`❌ Giving up on invoice after 3 retries:`, failedSave.invoice.title);
        }
      }
    }
    
    localStorage.setItem('failedSaves', JSON.stringify(stillFailed));
    return { retried: failedSaves.length, stillFailed: stillFailed.length };
  }
  
  // Save draft (auto-save or manual) - Also saves to server
  async saveDraft(invoiceData, title = null, draftId = null) {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      return null; // Silently fail for drafts if not signed in
    }
    
    const drafts = this.getAllDrafts();
    
    let draft;
    let serverId = null;
    
    if (draftId) {
      // Update existing draft
      const index = drafts.findIndex(d => d.id === draftId);
      if (index !== -1) {
        serverId = drafts[index].serverId; // Preserve server ID
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
    
    // Save to localStorage first
    localStorage.setItem(this.draftsKey, JSON.stringify(drafts));
    
    // Save to server (non-blocking)
    this.saveDraftToServer(draft, serverId).then(serverInvoice => {
      if (serverInvoice && serverInvoice.id) {
        // Update with server ID
        const updatedDrafts = this.getAllDrafts();
        const index = updatedDrafts.findIndex(d => d.id === draft.id);
        if (index !== -1) {
          updatedDrafts[index].serverId = serverInvoice.id;
          localStorage.setItem(this.draftsKey, JSON.stringify(updatedDrafts));
        }
      }
    }).catch(error => {
      console.error('Failed to save draft to server:', error);
    });
    
    this.notify();
    return draft ? draft.id : null;
  }
  
  // Save draft to server
  async saveDraftToServer(draft, serverId = null) {
    try {
      const url = serverId 
        ? `/api/v1/invoice/${serverId}`
        : '/api/v1/invoice/save';
      
      const method = serverId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: draft.title,
          data: draft.data,
          metadata: draft.metadata,
          status: 'saved' // Server uses 'saved' status
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      return result.invoice;
    } catch (error) {
      console.error('Draft server save failed:', error);
      throw error;
    }
  }
  
  // Load invoice/draft
  loadInvoice(id) {
    const invoices = this.getAllInvoices();
    const drafts = this.getAllDrafts();
    
    return invoices.find(inv => inv.id === id) || drafts.find(draft => draft.id === id);
  }
  
  // Delete invoice/draft - Also deletes from server
  async deleteInvoice(id) {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) return false;
    
    let serverId = null;
    let deleted = false;
    
    // Check invoices
    let invoices = this.getAllInvoices();
    const invoiceIndex = invoices.findIndex(inv => inv.id === id && inv.userId === currentUser.id);
    if (invoiceIndex !== -1) {
      serverId = invoices[invoiceIndex].serverId;
      invoices.splice(invoiceIndex, 1);
      localStorage.setItem(this.storageKey, JSON.stringify(invoices));
      deleted = true;
    }
    
    // Check drafts
    if (!deleted) {
      let drafts = this.getAllDrafts();
      const draftIndex = drafts.findIndex(draft => draft.id === id && draft.userId === currentUser.id);
      if (draftIndex !== -1) {
        serverId = drafts[draftIndex].serverId;
        drafts.splice(draftIndex, 1);
        localStorage.setItem(this.draftsKey, JSON.stringify(drafts));
        deleted = true;
      }
    }
    
    // Delete from server if we have a server ID
    if (deleted && serverId) {
      try {
        await this.deleteFromServer(serverId);
      } catch (error) {
        console.error('Failed to delete from server:', error);
        // Continue - item is already deleted locally
      }
    }
    
    if (deleted) {
      this.notify();
    }
    
    return deleted;
  }
  
  // Delete invoice from server
  async deleteFromServer(serverId) {
    try {
      const response = await fetch(`/api/v1/invoice/${serverId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('Server delete failed:', error);
      throw error;
    }
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
  
  // Get saved items (completed invoices only, not drafts)
  getSavedItems(limit = 10) {
    const invoices = this.getUserInvoices();
    
    // Sort by most recent first
    invoices.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return invoices.slice(0, limit);
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
    // Prevent concurrent auto-save operations
    if (this.isPerformingAutoSave) return;
    
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser || !currentUser.preferences?.autoSave) return;
    
    this.isPerformingAutoSave = true;
    
    // Get current invoice state from app
    if (window.app && window.app.state) {
      const currentState = window.app.state.getState();
      
      // Only auto-save if there's meaningful content
      if (this.hasContent(currentState)) {
        // Check if we have existing auto-save drafts and clean up duplicates
        const drafts = this.getUserDrafts();
        const autoSaveDrafts = drafts.filter(d => d.title.includes('Auto-Save'));
        
        let targetAutoSave = null;
        
        if (autoSaveDrafts.length > 1) {
          // Sort by updatedAt, keep most recent, remove others
          const sortedDrafts = autoSaveDrafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          targetAutoSave = sortedDrafts[0]; // Keep the most recent
          const draftsToRemove = sortedDrafts.slice(1); // Remove the rest
          
          draftsToRemove.forEach(draft => {
            this.deleteInvoice(draft.id);
          });
        } else if (autoSaveDrafts.length === 1) {
          targetAutoSave = autoSaveDrafts[0];
        }
        
        if (targetAutoSave) {
          // Update existing auto-save
          this.saveDraft(currentState, targetAutoSave.title, targetAutoSave.id);
        } else {
          // Create new auto-save
          this.saveDraft(currentState, 'Auto-Save');
        }
      }
    }
    
    // Reset the flag
    this.isPerformingAutoSave = false;
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