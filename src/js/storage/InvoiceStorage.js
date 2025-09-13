import { TaxCalculator } from '../utils/taxCalculator.js';

export class InvoiceStorage {
  constructor(userManager) {
    this.userManager = userManager;
    this.storageKey = 'marine_invoices';
    this.draftsKey = 'marine_drafts';
    this.autoSaveInterval = null;
    this.listeners = [];
    this.isPerformingAutoSave = false; // Prevent concurrent auto-saves
    this.serverInvoiceMap = new Map(); // Map local IDs to server IDs
    this.authFailed = false; // Track auth failures to prevent retry storms
    this.onAuthRequired = null; // Callback for auth required events
    this.lastSavedState = null; // Track the last saved state to detect unsaved changes
    this.taxMigrationVersion = 1; // Version for tax data migration
    
    this.setupAutoSave();
    
    // Listen for user auth changes
    if (userManager) {
      userManager.subscribe(async (user) => {
        if (user) {
          // User logged in, reset auth failure flag and retry failed saves
          this.authFailed = false;
          console.log('🔓 User authenticated - enabling server saves');
          
          // CRITICAL: Sync invoices from server when user logs in
          await this.syncFromServer();
          
          // Run email migration when user logs in
          // This ensures invoices are properly associated with the logged-in user
          this.migrateUserEmails();
          
          this.retryFailedSaves();
        } else {
          // User logged out
          this.authFailed = true;
          console.log('🔒 User logged out - disabling server saves');
        }
      });
    }
    
    // Run tax data migration on startup
    this.migrateTaxData();
    
    // Run user email migration on startup
    this.migrateUserEmails();
  }
  
  /**
   * Migrate existing invoices to include user email for backward compatibility
   */
  migrateUserEmails() {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser || !currentUser.email) return;
    
    console.log('🔄 Starting user email migration for:', currentUser.email);
    let invoicesMigrated = 0;
    let draftsMigrated = 0;
    
    try {
      // Migrate invoices
      const invoices = this.getAllInvoices();
      const updatedInvoices = invoices.map(invoice => {
        // Skip if already has email set to a different user
        if (invoice.userEmail && invoice.userEmail !== currentUser.email) {
          return invoice;
        }
        
        // If invoice belongs to current user by ID but missing email, add it
        if (invoice.userId === currentUser.id && !invoice.userEmail) {
          console.log(`  Migrating invoice "${invoice.title}" - matched by user ID`);
          invoice.userEmail = currentUser.email;
          invoicesMigrated++;
        }
        // For test user, claim ALL invoices without email OR with test IDs (aggressive migration)
        else if (currentUser.email === 'test@marinegroup.com') {
          // Claim any invoice that doesn't have an email or has a test user ID
          if (!invoice.userEmail || 
              invoice.userId === 'test_user_123' || 
              invoice.userId === 'test-user-1' ||
              invoice.userId?.includes('test')) {
            console.log(`  Migrating invoice "${invoice.title}" - test user claiming invoice`);
            invoice.userEmail = currentUser.email;
            invoicesMigrated++;
          }
        }
        // Also check for common test/default user IDs for other users
        else if (!invoice.userEmail && 
                 (invoice.userId === currentUser.id.toString())) {
          console.log(`  Migrating invoice "${invoice.title}" - matched by user ID string`);
          invoice.userEmail = currentUser.email;
          invoicesMigrated++;
        }
        return invoice;
      });
      
      if (invoicesMigrated > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(updatedInvoices));
        console.log(`  Migrated ${invoicesMigrated} invoice(s)`);
      }
      
      // Migrate drafts
      const drafts = this.getAllDrafts();
      const updatedDrafts = drafts.map(draft => {
        // Skip if already has email set to a different user
        if (draft.userEmail && draft.userEmail !== currentUser.email) {
          return draft;
        }
        
        // If draft belongs to current user by ID but missing email, add it
        if (draft.userId === currentUser.id && !draft.userEmail) {
          console.log(`  Migrating draft "${draft.title}" - matched by user ID`);
          draft.userEmail = currentUser.email;
          draftsMigrated++;
        }
        // For test user, claim ALL drafts without email OR with test IDs
        else if (currentUser.email === 'test@marinegroup.com') {
          // Claim any draft that doesn't have an email or has a test user ID
          if (!draft.userEmail || 
              draft.userId === 'test_user_123' || 
              draft.userId === 'test-user-1' ||
              draft.userId?.includes('test')) {
            console.log(`  Migrating draft "${draft.title}" - test user claiming draft`);
            draft.userEmail = currentUser.email;
            draftsMigrated++;
          }
        }
        // Also check for common test/default user IDs for other users
        else if (!draft.userEmail && 
                 (draft.userId === currentUser.id.toString())) {
          console.log(`  Migrating draft "${draft.title}" - matched by user ID string`);
          draft.userEmail = currentUser.email;
          draftsMigrated++;
        }
        return draft;
      });
      
      if (draftsMigrated > 0) {
        localStorage.setItem(this.draftsKey, JSON.stringify(updatedDrafts));
        console.log(`  Migrated ${draftsMigrated} draft(s)`);
      }
      
      const totalMigrated = invoicesMigrated + draftsMigrated;
      if (totalMigrated > 0) {
        console.log(`✅ User email migration complete - migrated ${totalMigrated} total item(s)`);
        // Notify listeners that storage has changed
        this.notify();
      } else {
        console.log('✅ User email migration complete - no items needed migration');
      }
    } catch (error) {
      console.error('❌ User email migration failed:', error);
    }
  }
  
  /**
   * Migrate tax data for existing invoices and drafts to use per-line tax configuration
   */
  migrateTaxData() {
    const migrationKey = 'tax_migration_version';
    const currentVersion = parseInt(localStorage.getItem(migrationKey) || '0');
    
    if (currentVersion >= this.taxMigrationVersion) {
      console.log('📋 Tax data already migrated to version', currentVersion);
      return;
    }
    
    console.log('🔄 Starting tax data migration...');
    
    try {
      // Migrate invoices
      const invoices = this.getAllInvoices();
      let invoicesMigrated = 0;
      const migratedInvoices = invoices.map(invoice => {
        if (this.migrateInvoiceTaxData(invoice)) {
          invoicesMigrated++;
        }
        return invoice;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(migratedInvoices));
      
      // Migrate drafts
      const drafts = this.getAllDrafts();
      let draftsMigrated = 0;
      const migratedDrafts = drafts.map(draft => {
        if (this.migrateInvoiceTaxData(draft)) {
          draftsMigrated++;
        }
        return draft;
      });
      localStorage.setItem(this.draftsKey, JSON.stringify(migratedDrafts));
      
      // Update migration version
      localStorage.setItem(migrationKey, this.taxMigrationVersion.toString());
      
      console.log(`✅ Tax data migration complete. Migrated ${invoicesMigrated} invoices and ${draftsMigrated} drafts`);
    } catch (error) {
      console.error('❌ Tax data migration failed:', error);
    }
  }
  
  /**
   * Migrate a single invoice/draft to use per-line tax and markup configuration
   * @param {Object} invoice - Invoice or draft object
   * @returns {boolean} - Whether migration was performed
   */
  migrateInvoiceTaxData(invoice) {
    if (!invoice.data || !invoice.data.scope || !invoice.data.scope.lineItems) {
      return false;
    }
    
    let migrated = false;
    const scopeIsTaxable = invoice.data.scope.isTaxable || false;
    const globalMarkupRate = invoice.data.scope.markupRate || '2.5';
    
    // Migrate each line item
    invoice.data.scope.lineItems = invoice.data.scope.lineItems.map(item => {
      let itemMigrated = false;
      
      // Check if this line item already has per-line tax configuration
      if (!('taxStatus' in item) || !('taxRate' in item)) {
        // Migrate legacy line item tax
        const migratedTaxItem = TaxCalculator.migrateLineItemTax(item, scopeIsTaxable);
        Object.assign(item, migratedTaxItem);
        itemMigrated = true;
      }
      
      // Check if this line item already has per-line markup configuration
      if (!('markupType' in item) || !('markupRate' in item) || !('isMarkupExempt' in item)) {
        // Migrate legacy markup configuration
        const markupConfig = this.migrateLineItemMarkup(item, globalMarkupRate);
        Object.assign(item, markupConfig);
        itemMigrated = true;
      }
      
      // Recalculate tax amount with per-line markup
      if (itemMigrated || !('taxAmount' in item)) {
        item.taxAmount = TaxCalculator.calculateLineTax(item, item.markupRate || '0');
        itemMigrated = true;
      }
      
      if (itemMigrated) {
        migrated = true;
      }
      
      return item;
    });
    
    // Add migration marker
    if (migrated) {
      invoice.data._taxMigrated = true;
      invoice.data._markupMigrated = true;
      invoice.data._taxMigrationVersion = this.taxMigrationVersion;
    }
    
    return migrated;
  }
  
  /**
   * Migrate legacy line item to include per-line markup configuration
   * @param {Object} lineItem - Legacy line item
   * @param {string} globalMarkupRate - Global markup rate from scope
   * @returns {Object} Markup configuration for line item
   */
  migrateLineItemMarkup(lineItem, globalMarkupRate) {
    // Check if this job type should be markup exempt
    const isExempt = this.isLegacyMarkupExempt(lineItem);
    
    if (isExempt) {
      return {
        markupType: 'exempt',
        markupRate: '0',
        isMarkupExempt: true
      };
    }
    
    // Use the global markup rate as preset
    return {
      markupType: 'preset',
      markupRate: globalMarkupRate,
      isMarkupExempt: false
    };
  }
  
  /**
   * Check if legacy line item should be markup exempt
   * @param {Object} lineItem - Line item to check
   * @returns {boolean} True if should be exempt from markup
   */
  isLegacyMarkupExempt(lineItem) {
    return (lineItem.jobType === 'Manual Entry' && lineItem.itemType === 'Labor') ||
           lineItem.jobType === 'Agent Services' ||
           lineItem.jobType === 'Clearance Fee';
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
      userEmail: currentUser.email, // Store email for backward compatibility
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
    
    // Track this as the saved state
    this.lastSavedState = JSON.parse(JSON.stringify(invoiceData));
    console.log('💾 saveInvoice: Set lastSavedState - Stack trace:');
    console.trace();
    console.log('💾 saveInvoice: Data:', JSON.stringify(this.lastSavedState, null, 2));
    
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
    
    // Check if we should skip server save due to previous auth failure
    if (this.authFailed) {
      console.log(`⏸️ [${requestId}] Skipping server save - auth previously failed`);
      this.queueFailedSave(invoice, { 
        status: 401, 
        body: 'Authentication required - queued for later', 
        requestId,
        skipped: true 
      });
      throw new Error('Authentication required - save queued locally');
    }
    
    try {
      // Ensure data is sent as object, not string
      const requestBody = {
        title: invoice.title,
        data: typeof invoice.data === 'string' ? JSON.parse(invoice.data) : invoice.data,
        metadata: typeof invoice.metadata === 'string' ? JSON.parse(invoice.metadata) : invoice.metadata
      };
      
      console.log(`📋 [${requestId}] Request body:`, JSON.stringify(requestBody, null, 2));
      console.log(`👤 [${requestId}] Current user:`, this.userManager.getCurrentUser());
      
      // Generate idempotency key for this save
      const idempotencyKey = `${invoice.id}_${Date.now()}_${requestId}`;
      
      const response = await fetch('/api/v2/invoice/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'Idempotency-Key': idempotencyKey
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
        
        // If it's a 401, mark auth as failed to prevent future attempts
        if (response.status === 401) {
          this.authFailed = true;
          console.log(`🔒 [${requestId}] Authentication failed - blocking future save attempts until re-auth`);
          
          // Show user notification
          if (this.onAuthRequired) {
            this.onAuthRequired();
          }
        }
        
        // Add to failed saves queue
        this.queueFailedSave(invoice, errorDetails);
        
        throw new Error(`Server error: ${response.status} - ${responseText}`);
      }
      
      // Auth succeeded, clear the flag
      this.authFailed = false;
      
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
  
  // Retry failed saves (only if authenticated)
  async retryFailedSaves() {
    const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');
    if (failedSaves.length === 0) return;
    
    // Check if user is authenticated before retrying
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      console.log('⏸️ Postponing retry - user not authenticated');
      return { retried: 0, stillFailed: failedSaves.length };
    }
    
    console.log(`🔄 Retrying ${failedSaves.length} failed saves...`);
    const stillFailed = [];
    
    for (const failedSave of failedSaves) {
      try {
        failedSave.retryCount++;
        const result = await this.saveToServer(failedSave.invoice);
        console.log(`✅ Retry successful for invoice:`, failedSave.invoice.title);
      } catch (error) {
        // If it's an authentication error, stop retrying
        if (error.message && error.message.includes('401')) {
          console.log('🔐 Authentication lost - stopping retries');
          stillFailed.push(failedSave);
          break;
        }
        
        if (failedSave.retryCount < 3) {
          stillFailed.push(failedSave);
        } else {
          console.error(`❌ Giving up on invoice after 3 retries:`, failedSave.invoice.title);
        }
      }
    }
    
    localStorage.setItem('failedSaves', JSON.stringify(stillFailed));
    return { retried: failedSaves.length - stillFailed.length, stillFailed: stillFailed.length };
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
        userEmail: currentUser.email, // Store email for backward compatibility
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
    
    // Track this as the saved state (for manual drafts, not auto-saves)
    if (title && !title.includes('Auto-Save')) {
      this.lastSavedState = JSON.parse(JSON.stringify(invoiceData));
      console.log('💾 saveDraft: Set lastSavedState - Stack trace:');
      console.trace();
      console.log('💾 saveDraft: Data:', JSON.stringify(this.lastSavedState, null, 2));
    } else {
      console.log('💾 saveDraft: Skipped setting lastSavedState (auto-save or no title), title:', title);
    }
    
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
    // Skip if auth has failed previously
    if (this.authFailed) {
      console.log('⏸️ Skipping draft server save - auth previously failed');
      return null;
    }
    
    try {
      const url = serverId 
        ? `/api/v1/invoice/${serverId}`
        : '/api/v2/invoice/save';
      
      const method = serverId ? 'PUT' : 'POST';
      const idempotencyKey = `draft_${draft.id}_${Date.now()}`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        credentials: 'include',
        body: JSON.stringify({
          title: draft.title,
          data: typeof draft.data === 'string' ? JSON.parse(draft.data) : draft.data,
          metadata: typeof draft.metadata === 'string' ? JSON.parse(draft.metadata) : draft.metadata,
          status: 'saved' // Server uses 'saved' status
        })
      });
      
      if (!response.ok) {
        // Mark auth as failed if we get a 401
        if (response.status === 401) {
          this.authFailed = true;
          console.log('🔒 Draft save got 401 - disabling future server saves');
          if (this.onAuthRequired) {
            this.onAuthRequired();
          }
        }
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Auth succeeded, clear the flag
      this.authFailed = false;
      
      const result = await response.json();
      return result.invoice;
    } catch (error) {
      console.error('Draft server save failed:', error);
      throw error;
    }
  }
  
  // Load invoice/draft
  async loadInvoice(id) {
    const invoices = this.getAllInvoices();
    const drafts = this.getAllDrafts();
    
    const invoice = invoices.find(inv => inv.id === id) || drafts.find(draft => draft.id === id);
    
    if (invoice && invoice.data) {
      // Try to fetch latest data from server to get any saved comments
      try {
        const response = await fetch(`/api/invoices/user`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const serverInvoices = await response.json();
          const serverInvoice = serverInvoices.find(inv => 
            inv.id === id || inv.id === invoice.serverId || inv.serverId === id
          );
          
          if (serverInvoice && serverInvoice.data) {
            console.log('📥 Loading fresh data from server for invoice:', id);
            // Merge server data (especially comments) with local data
            if (serverInvoice.data.notes && serverInvoice.data.notes.comments) {
              if (!invoice.data.notes) invoice.data.notes = {};
              invoice.data.notes.comments = serverInvoice.data.notes.comments;
              console.log('💬 Loaded comments from server:', serverInvoice.data.notes.comments.length);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch latest invoice data from server:', error);
        // Continue with localStorage data
      }
      
      // Ensure tax calculations are up to date after loading
      this.validateAndRecalculateTaxes(invoice.data);
    }
    
    return invoice;
  }
  
  /**
   * Validate and recalculate tax amounts for loaded invoice data
   * @param {Object} invoiceData - Invoice data object
   */
  validateAndRecalculateTaxes(invoiceData) {
    if (!invoiceData.scope || !invoiceData.scope.lineItems) {
      return;
    }
    
    let recalculated = false;
    const markupRate = invoiceData.scope.markupRate || '2.5';
    
    invoiceData.scope.lineItems.forEach(item => {
      if (!('taxStatus' in item) || !('taxRate' in item)) {
        console.warn('Line item missing tax configuration:', item);
        return;
      }
      
      // Recalculate tax amount to ensure consistency
      const calculatedTax = TaxCalculator.calculateLineTax(item, markupRate);
      if (Math.abs((item.taxAmount || 0) - calculatedTax) > 0.01) {
        console.log(`💰 Recalculating tax for item: ${item.description} (was: ${item.taxAmount}, now: ${calculatedTax})`);
        item.taxAmount = calculatedTax;
        recalculated = true;
      }
    });
    
    if (recalculated) {
      console.log('🔄 Tax amounts recalculated for loaded invoice');
    }
  }
  
  // Delete invoice/draft - Also deletes from server
  async deleteInvoice(id) {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) return false;
    
    let serverId = null;
    let deleted = false;
    
    // Check invoices
    let invoices = this.getAllInvoices();
    const invoiceIndex = invoices.findIndex(inv => 
      inv.id === id && 
      (inv.userId === currentUser.id || 
       (inv.userEmail && inv.userEmail === currentUser.email))
    );
    if (invoiceIndex !== -1) {
      serverId = invoices[invoiceIndex].serverId;
      invoices.splice(invoiceIndex, 1);
      localStorage.setItem(this.storageKey, JSON.stringify(invoices));
      deleted = true;
    }
    
    // Check drafts
    if (!deleted) {
      let drafts = this.getAllDrafts();
      const draftIndex = drafts.findIndex(draft => 
        draft.id === id && 
        (draft.userId === currentUser.id || 
         (draft.userEmail && draft.userEmail === currentUser.email))
      );
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
    if (!currentUser) return null;
    
    // Check ownership by ID or email
    const isOwner = original.userId === currentUser.id || 
                    (original.userEmail && original.userEmail === currentUser.email);
    if (!isOwner) return null;
    
    // Create duplicate as draft
    const duplicateData = JSON.parse(JSON.stringify(original.data));
    const title = `${original.title} (Copy)`;
    
    return this.saveDraft(duplicateData, title);
  }
  
  // Get all invoices for current user
  getUserInvoices() {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      console.log('❌ No current user found');
      return [];
    }
    
    console.log(`🔍 Getting invoices for user: ${currentUser.email} (ID: ${currentUser.id})`);
    
    const invoices = this.getAllInvoices();
    console.log(`📦 Total invoices in storage: ${invoices.length}`);
    
    const userInvoices = invoices.filter(inv => {
      // More aggressive matching for test user
      if (currentUser.email === 'test@marinegroup.com') {
        // Test user gets ALL invoices that don't have another user's email
        const canClaim = !inv.userEmail || 
                         inv.userEmail === currentUser.email ||
                         inv.userId === currentUser.id ||
                         inv.userId?.includes('test');
        if (canClaim) {
          console.log(`✅ Test user claiming invoice: ${inv.title}`);
        }
        return canClaim;
      }
      
      // Regular user matching
      const matches = inv.userId === currentUser.id || 
                     (inv.userEmail && inv.userEmail === currentUser.email);
      if (matches) {
        console.log(`✅ Invoice matches user: ${inv.title}`);
      }
      return matches;
    });
    
    console.log(`📊 Found ${userInvoices.length} invoices for user`);
    return userInvoices.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  
  // Get all drafts for current user
  getUserDrafts() {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) return [];
    
    const drafts = this.getAllDrafts();
    return drafts
      .filter(draft => {
        // Match by user ID OR by email (for backward compatibility)
        // This handles cases where user IDs change between local and server auth
        return draft.userId === currentUser.id || 
               (draft.userEmail && draft.userEmail === currentUser.email);
      })
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
    const currentUser = this.userManager.getCurrentUser();
    
    // FIRST PRINCIPLES: Get ALL invoices directly from localStorage
    const allInvoices = this.getAllInvoices();
    console.log(`🔍 getSavedItems: Found ${allInvoices.length} total invoices in localStorage`);
    
    if (!currentUser) {
      console.log('❌ No user logged in, returning empty array');
      return [];
    }
    
    // For test user, show ALL invoices (they're testing)
    if (currentUser.email === 'test@marinegroup.com') {
      console.log('🧪 Test user - showing all invoices');
      return allInvoices
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, limit);
    }
    
    // For regular users, filter by email OR ID
    const userInvoices = allInvoices.filter(inv => {
      return inv.userEmail === currentUser.email || 
             inv.userId === currentUser.id ||
             inv.userId === currentUser.id.toString();
    });
    
    console.log(`📊 Found ${userInvoices.length} invoices for user ${currentUser.email}`);
    
    // Sort by most recent first
    userInvoices.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    
    return userInvoices.slice(0, limit);
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
    const markup = this.analyzeMarkupUsage(invoiceData);
    const tax = this.analyzeTaxUsage(invoiceData);
    
    return {
      vesselName: invoiceData.vessel?.name || '',
      customerName: invoiceData.customer?.customerName || '',
      customerEmail: invoiceData.customer?.customerEmail || '',
      lineItemCount: invoiceData.scope?.lineItems?.length || 0,
      totalAmount: this.calculateTotal(invoiceData),
      markupConfiguration: markup,
      taxConfiguration: tax
    };
  }
  
  /**
   * Analyze markup usage across line items
   * @param {Object} invoiceData - Invoice data
   * @returns {Object} Markup usage analysis
   */
  analyzeMarkupUsage(invoiceData) {
    if (!invoiceData.scope?.lineItems) {
      return {
        hasCustomMarkups: false,
        uniqueMarkupRates: ['2.5'],
        exemptItemCount: 0,
        totalMarkupTypes: { preset: 1, custom: 0, exempt: 0 }
      };
    }
    
    const rates = new Set();
    const markupTypes = { preset: 0, custom: 0, exempt: 0 };
    let hasCustom = false;
    let exemptCount = 0;
    
    invoiceData.scope.lineItems.forEach(item => {
      const markupType = item.markupType || 'preset';
      markupTypes[markupType]++;
      
      if (item.isMarkupExempt) {
        exemptCount++;
      } else {
        const rate = item.markupRate || '2.5';
        rates.add(rate);
        if (markupType === 'custom') {
          hasCustom = true;
        }
      }
    });
    
    return {
      hasCustomMarkups: hasCustom,
      uniqueMarkupRates: Array.from(rates),
      exemptItemCount: exemptCount,
      totalMarkupTypes: markupTypes
    };
  }
  
  /**
   * Analyze tax usage across line items
   * @param {Object} invoiceData - Invoice data
   * @returns {Object} Tax usage analysis
   */
  analyzeTaxUsage(invoiceData) {
    if (!invoiceData.scope?.lineItems) {
      return {
        hasMixedTaxStatus: false,
        uniqueTaxRates: ['0.0875'],
        totalTaxTypes: { taxable: 1, 'non-taxable': 0, exempt: 0 }
      };
    }
    
    const rates = new Set();
    const taxTypes = { taxable: 0, 'non-taxable': 0, exempt: 0 };
    
    invoiceData.scope.lineItems.forEach(item => {
      const taxStatus = item.taxStatus || 'taxable';
      taxTypes[taxStatus]++;
      
      const rate = item.taxRate || 0.0875;
      rates.add(rate.toString());
    });
    
    const hasMixedTaxStatus = Object.values(taxTypes).filter(count => count > 0).length > 1;
    
    return {
      hasMixedTaxStatus,
      uniqueTaxRates: Array.from(rates),
      totalTaxTypes: taxTypes
    };
  }
  
  calculateTotal(invoiceData) {
    try {
      if (!invoiceData.scope?.lineItems) return 0;
      
      // Use TaxCalculator to get total with tax included
      let subtotal = 0;
      let totalTax = 0;
      const markupRate = invoiceData.scope.markupRate || '2.5';
      
      invoiceData.scope.lineItems.forEach(item => {
        // Calculate subtotal (base cost + markup if applicable)
        const baseCost = this.calculateLineItemBaseCost(item);
        if (TaxCalculator.isMarkupExempt(item)) {
          subtotal += baseCost;
        } else {
          subtotal += baseCost * (1 + parseFloat(markupRate) / 100);
        }
        
        // Add tax
        totalTax += TaxCalculator.calculateLineTax(item, markupRate);
      });
      
      return subtotal + totalTax;
    } catch (error) {
      console.error('Error calculating total:', error);
      return 0;
    }
  }
  
  /**
   * Calculate base cost for a line item
   * @param {Object} item - Line item
   * @returns {number} Base cost
   */
  calculateLineItemBaseCost(item) {
    if (item.jobType === 'Clearance Fee') {
      return parseFloat(item.manualCost) || 0;
    }
    
    if (item.jobType === 'Manual Entry') {
      if (item.itemType === 'Labor') {
        const regularHours = parseFloat(item.laborHours) || 0;
        const otHours = parseFloat(item.otHours) || 0;
        return (regularHours * 100) + (otHours * 150);
      }
      return parseFloat(item.manualCost) || 0;
    }
    
    if (item.jobType === 'Agent Services') {
      const regularHours = parseFloat(item.laborHours) || 0;
      const otHours = parseFloat(item.otHours) || 0;
      return (regularHours * 100) + (otHours * 150);
    }
    
    return parseFloat(item.manualCost) || 0;
  }
  
  hasContent(invoiceData) {
    return !!(
      invoiceData.vessel?.name ||
      invoiceData.customer?.customerName ||
      (invoiceData.scope?.lineItems && invoiceData.scope.lineItems.length > 0)
    );
  }

  hasUnsavedChanges(currentState) {
    // DISABLED: This was causing false positives and annoying the user
    return false;
    
    if (hasChanges) {
      console.log('🔍 DETAILED COMPARISON:');
      console.log('🔍 Current state keys:', Object.keys(currentState));
      console.log('🔍 Last saved state keys:', Object.keys(this.lastSavedState));
      
      // Check each top-level key
      for (let key of Object.keys(currentState)) {
        const currentValue = currentState[key];
        const savedValue = this.lastSavedState[key];
        if (!this.deepEqual(currentValue, savedValue)) {
          console.log(`🔍 DIFFERENCE in key "${key}":`);
          console.log('🔍   Current:', JSON.stringify(currentValue, null, 2));
          console.log('🔍   Saved:', JSON.stringify(savedValue, null, 2));
        }
      }
      
      // Check for keys only in saved state
      for (let key of Object.keys(this.lastSavedState)) {
        if (!(key in currentState)) {
          console.log(`🔍 KEY MISSING from current state: "${key}"`);
          console.log('🔍   Saved value:', JSON.stringify(this.lastSavedState[key], null, 2));
        }
      }
    }
    return hasChanges;
  }

  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return obj1 === obj2;
    
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (let key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }

  // Call this when loading an existing invoice to set the saved state
  setSavedState(invoiceData) {
    this.lastSavedState = JSON.parse(JSON.stringify(invoiceData));
    console.log('🔄 setSavedState called - Stack trace:');
    console.trace();
    console.log('🔄 setSavedState data:', JSON.stringify(this.lastSavedState, null, 2));
  }

  // Clear saved state (call when creating new invoice)
  clearSavedState() {
    this.lastSavedState = null;
    console.log('🔄 clearSavedState called - Stack trace:');
    console.trace();
  }
  
  // Clear failed saves queue (useful for resetting)
  clearFailedSaves() {
    localStorage.removeItem('failedSaves');
    console.log('🧹 Cleared failed saves queue');
  }
  
  // Get count of failed saves
  getFailedSavesCount() {
    const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');
    return failedSaves.length;
  }
  
  // Set callback for auth required events
  setAuthRequiredCallback(callback) {
    this.onAuthRequired = callback;
  }
  
  // Clear auth failure state (call when user re-authenticates)
  clearAuthFailure() {
    this.authFailed = false;
    console.log('🔓 Auth failure cleared - enabling server saves');
    // Try to process any queued saves
    this.retryFailedSaves();
  }
  
  /**
   * Sync invoices from server to localStorage
   * This ensures users don't lose their invoices when localStorage is cleared
   */
  async syncFromServer() {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      console.log('❌ No user logged in, cannot sync from server');
      return;
    }
    
    console.log('🔄 Syncing invoices from server for:', currentUser.email);
    
    try {
      // Fetch user's invoices from server
      const response = await fetch('/api/invoices/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const serverInvoices = await response.json();
        console.log(`📥 Received ${serverInvoices.length} invoices from server`);
        
        // Get current localStorage invoices
        const localInvoices = this.getAllInvoices();
        console.log(`📦 Current localStorage has ${localInvoices.length} invoices`);
        
        // Merge server invoices with local (server takes precedence)
        const invoiceMap = new Map();
        
        // Add local invoices first
        localInvoices.forEach(inv => {
          invoiceMap.set(inv.id, inv);
        });
        
        // Override with server invoices (they're more authoritative)
        serverInvoices.forEach(inv => {
          // Ensure the invoice has the user's email for future filtering
          inv.userEmail = currentUser.email;
          inv.userId = inv.userId || currentUser.id;
          invoiceMap.set(inv.id, inv);
        });
        
        // Convert back to array
        const mergedInvoices = Array.from(invoiceMap.values());
        
        // Save to localStorage
        localStorage.setItem(this.storageKey, JSON.stringify(mergedInvoices));
        console.log(`✅ Synced ${mergedInvoices.length} total invoices to localStorage`);
        
        // Notify listeners (update sidebar)
        this.notify();
      } else if (response.status === 404) {
        console.log('📭 No invoices found on server for user');
      } else {
        console.error('❌ Failed to sync from server:', response.status);
      }
    } catch (error) {
      console.error('❌ Error syncing from server:', error);
      // Continue with local data if server sync fails
    }
  }
  
  // Force migration and refresh (useful for debugging)
  forceMigrationAndRefresh() {
    console.log('🔄 Force migration and refresh triggered');
    
    // Force re-migrate with aggressive claiming for test user
    const currentUser = this.userManager.getCurrentUser();
    if (currentUser && currentUser.email === 'test@marinegroup.com') {
      console.log('🧪 Test user detected - claiming all orphaned invoices');
      const invoices = this.getAllInvoices();
      let claimed = 0;
      
      invoices.forEach(inv => {
        if (!inv.userEmail || inv.userId?.includes('test')) {
          inv.userEmail = currentUser.email;
          claimed++;
        }
      });
      
      if (claimed > 0) {
        this.saveToLocalStorage();
        console.log(`✅ Claimed ${claimed} invoices for test user`);
      }
    } else {
      this.migrateUserEmails();
    }
    
    this.notify();
    console.log('✅ Force migration complete, sidebar should update');
  }
  
  // Check if server saves are blocked
  isServerSaveBlocked() {
    return this.authFailed;
  }
  
  // Cleanup
  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}