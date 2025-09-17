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

    // 🔧 PHASE 2 FIX: Add server failure tracking and retry management
    this.serverFailureCount = 0; // Track consecutive server failures
    this.lastServerCheck = null; // Track when we last attempted server sync
    this.serverRetryDelay = 1000; // Start with 1 second delay
    this.maxRetryDelay = 30000; // Maximum 30 second delay
    this.maxFailedSaves = 10; // Limit failed save queue to 10 items
    this.persistentFailureStartTime = null; // Track when persistent failures started
    this.circuitBreakerActive = false; // Circuit breaker for persistent errors

    this.setupAutoSave();

    // Listen for user auth changes
    if (userManager) {
      userManager.subscribe(async (user) => {
        if (user) {
          // User logged in, reset auth failure flag and retry failed saves
          this.authFailed = false;
          this.serverFailureCount = 0; // Reset failure count on new auth
          this.circuitBreakerActive = false; // Reset circuit breaker on new auth
          this.persistentFailureStartTime = null; // Reset persistent failure tracking
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
        if (!draft.userEmail && draft.userId === currentUser.id) {
          console.log(`  Migrating draft "${draft.title}"`);
          draft.userEmail = currentUser.email;
          draftsMigrated++;
        }
        return draft;
      });

      if (draftsMigrated > 0) {
        localStorage.setItem(this.draftsKey, JSON.stringify(updatedDrafts));
        console.log(`  Migrated ${draftsMigrated} draft(s)`);
      }

      if (invoicesMigrated > 0 || draftsMigrated > 0) {
        console.log(`✅ Migration complete: ${invoicesMigrated} invoices, ${draftsMigrated} drafts migrated to ${currentUser.email}`);
        this.notify(); // Refresh UI
      }

    } catch (error) {
      console.error('❌ Error during user email migration:', error);
    }
  }

  /**
   * Tax Data Migration v1
   * Migrates invoices to include proper tax calculations
   */
  migrateTaxData() {
    const migrationKey = 'marine_tax_migration_v1';
    const hasMigrated = localStorage.getItem(migrationKey);

    if (hasMigrated) {
      console.log('✅ Tax data migration v1 already completed');
      return;
    }

    console.log('🔄 Starting tax data migration v1...');
    let migrated = 0;

    try {
      const invoices = this.getAllInvoices();
      const updatedInvoices = invoices.map(invoice => {
        if (invoice.data && invoice.data.scope) {
          let needsUpdate = false;

          // Check if line items need tax calculation
          if (invoice.data.scope.lineItems) {
            invoice.data.scope.lineItems.forEach(item => {
              if (item.amount && (!item.tax || item.tax === 0)) {
                const tax = TaxCalculator.calculateLineTax(item.amount);
                item.tax = tax;
                needsUpdate = true;
              }
            });
          }

          // Recalculate totals if needed
          if (needsUpdate) {
            const totals = TaxCalculator.calculateTotals(invoice.data.scope.lineItems || []);
            invoice.data.scope.subtotal = totals.subtotal;
            invoice.data.scope.tax = totals.tax;
            invoice.data.scope.total = totals.total;
            invoice.total = totals.total; // Also update top-level total
            migrated++;

            console.log(`  Migrated tax data for invoice: ${invoice.title}`);
          }
        }
        return invoice;
      });

      if (migrated > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(updatedInvoices));
        console.log(`✅ Tax migration complete: ${migrated} invoices updated`);
      }

      // Mark migration as complete
      localStorage.setItem(migrationKey, 'true');

    } catch (error) {
      console.error('❌ Error during tax data migration:', error);
    }
  }

  setupAutoSave() {
    // Auto-save every 30 seconds for authenticated users
    this.autoSaveInterval = setInterval(() => {
      if (!this.isPerformingAutoSave && this.userManager && this.userManager.getCurrentUser()) {
        this.autoSaveCurrentInvoice();
      }
    }, 30000);
  }

  async autoSaveCurrentInvoice() {
    if (this.isPerformingAutoSave) return;

    this.isPerformingAutoSave = true;
    try {
      // Get current state from the global state manager
      if (window.app && window.app.state) {
        const currentState = window.app.state.getState();
        if (currentState && (currentState.vessel || currentState.customer || currentState.scope)) {
          // Check if this state has meaningful content worth auto-saving
          const hasVessel = currentState.vessel && currentState.vessel.name;
          const hasCustomer = currentState.customer && currentState.customer.customerName;
          const hasLineItems = currentState.scope && currentState.scope.lineItems && currentState.scope.lineItems.length > 0;

          if (hasVessel || hasCustomer || hasLineItems) {
            console.log('💾 Auto-saving current invoice...');
            await this.saveDraft(currentState);
          }
        }
      }
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
    } finally {
      this.isPerformingAutoSave = false;
    }
  }

  // Save invoice
  async saveInvoice(invoiceData, title = 'Untitled Invoice') {
    console.log('💾 saveInvoice called with title:', title);
    console.log('💾 saveInvoice: Current user:', this.userManager.getCurrentUser());
    console.log('💾 saveInvoice: Auth failed flag:', this.authFailed);

    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      console.log('❌ No user logged in, cannot save invoice');
      // Still save locally but mark as unsynced
    }

    const invoice = {
      id: this.generateId(),
      title,
      data: invoiceData,
      status: 'saved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUser?.id || 'anonymous',
      userEmail: currentUser?.email || null,
      total: this.calculateTotal(invoiceData)
    };

    // Save to localStorage first
    const invoices = this.getAllInvoices();
    invoices.push(invoice);
    localStorage.setItem(this.storageKey, JSON.stringify(invoices));

    // Store the saved state for unsaved change detection
    this.lastSavedState = JSON.parse(JSON.stringify(invoiceData));
    console.log('💾 saveInvoice: Stored state for unsaved change detection');
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
      console.log('⚠️ Server save failed, invoice saved locally only:', error.message);
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
        skipQueue: false
      });
      return null;
    }

    // 🔧 PHASE 2 FIX: Check server failure circuit breaker
    if (this.serverFailureCount >= 5) {
      const now = Date.now();
      const timeSinceLastCheck = this.lastServerCheck ? now - this.lastServerCheck : 0;

      if (timeSinceLastCheck < this.serverRetryDelay) {
        console.log(`⏸️ [${requestId}] Circuit breaker active - server failures: ${this.serverFailureCount}, waiting ${this.serverRetryDelay}ms`);
        this.queueFailedSave(invoice, {
          status: 503,
          body: 'Circuit breaker active - too many server failures',
          requestId,
          skipQueue: false
        });
        return null;
      }
    }

    try {
      console.log(`📤 [${requestId}] Making request to /api/v2/invoice/save`);
      console.log(`📤 [${requestId}] Invoice title: "${invoice.title}"`);
      console.log(`📤 [${requestId}] Invoice total: $${invoice.total}`);

      const response = await fetch('/api/v2/invoice/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: invoice.title,
          data: invoice.data,
          total: invoice.total,
          requestId
        })
      });

      console.log(`📨 [${requestId}] Response status: ${response.status}`);

      if (response.ok) {
        const responseData = await response.json();
        console.log(`✅ [${requestId}] Server save successful`);
        console.log(`📨 [${requestId}] Server assigned ID: ${responseData.id}`);

        // Reset server failure tracking on success
        this.serverFailureCount = 0;
        this.serverRetryDelay = 1000;
        this.lastServerCheck = Date.now();

        return responseData;
      } else {
        let errorBody;
        try {
          errorBody = await response.text();
          console.log(`📨 [${requestId}] Response body: ${errorBody}`);
        } catch (e) {
          errorBody = 'Unable to read response body';
          console.log(`📨 [${requestId}] Unable to read response body`);
        }

        // 🔧 PHASE 2 FIX: Track server failures and implement exponential backoff
        this.serverFailureCount++;
        this.lastServerCheck = Date.now();

        if (response.status >= 500) {
          // Server error - implement exponential backoff
          this.serverRetryDelay = Math.min(this.serverRetryDelay * 2, this.maxRetryDelay);
          console.log(`🔄 [${requestId}] Server error ${response.status}, increased retry delay to ${this.serverRetryDelay}ms`);
        }

        if (response.status === 401 || response.status === 403) {
          console.log(`🔐 [${requestId}] Authentication failed`);
          this.authFailed = true;
          if (this.onAuthRequired) {
            this.onAuthRequired();
          }
        }

        this.queueFailedSave(invoice, {
          status: response.status,
          body: errorBody,
          requestId,
          skipQueue: response.status === 400 // Don't retry client errors
        });

        throw new Error(`Server save failed: ${response.status} - ${errorBody}`);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Request failed:`, error.message);

      // 🔧 PHASE 2 FIX: Handle network errors with exponential backoff
      this.serverFailureCount++;
      this.lastServerCheck = Date.now();
      this.serverRetryDelay = Math.min(this.serverRetryDelay * 2, this.maxRetryDelay);

      // Network errors are retriable
      this.queueFailedSave(invoice, {
        status: 0,
        body: error.message,
        requestId,
        skipQueue: false
      });

      throw error;
    }
  }

  // Update an existing invoice
  async updateInvoice(invoiceId, invoiceData, title) {
    console.log('🔄 updateInvoice called for ID:', invoiceId);

    const invoices = this.getAllInvoices();
    const index = invoices.findIndex(inv => inv.id === invoiceId);

    if (index === -1) {
      console.error('❌ Invoice not found for update:', invoiceId);
      return false;
    }

    // Update the invoice
    invoices[index].data = invoiceData;
    invoices[index].updatedAt = new Date().toISOString();
    invoices[index].total = this.calculateTotal(invoiceData);

    if (title && title.trim()) {
      invoices[index].title = title.trim();
    }

    // Save to localStorage
    localStorage.setItem(this.storageKey, JSON.stringify(invoices));

    // Store the saved state for unsaved change detection
    this.lastSavedState = JSON.parse(JSON.stringify(invoiceData));
    console.log('🔄 updateInvoice: Stored state for unsaved change detection');

    // Save to server
    try {
      const serverInvoice = await this.saveToServer(invoices[index]);
      if (serverInvoice && serverInvoice.id) {
        this.serverInvoiceMap.set(invoiceId, serverInvoice.id);
        invoices[index].serverId = serverInvoice.id;
        localStorage.setItem(this.storageKey, JSON.stringify(invoices));
      }
    } catch (error) {
      console.log('⚠️ Server update failed, invoice updated locally only:', error.message);
    }

    this.notify();
    return true;
  }

  // Calculate total for an invoice
  calculateTotal(invoiceData) {
    if (!invoiceData || !invoiceData.scope || !invoiceData.scope.lineItems) {
      return 0;
    }

    let total = 0;
    invoiceData.scope.lineItems.forEach(item => {
      const amount = parseFloat(item.amount) || 0;
      const tax = parseFloat(item.tax) || 0;
      total += amount + tax;
    });

    return Math.round(total * 100) / 100; // Round to 2 decimal places
  }

  // Generate unique ID
  generateId() {
    return 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Get all invoices for current user
  getAllInvoices() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];

      const allInvoices = JSON.parse(stored);
      const currentUser = this.userManager.getCurrentUser();

      if (!currentUser || !currentUser.email) {
        console.log('🔍 getSavedItems: No user logged in, returning empty list');
        return [];
      }

      // Filter by user email
      const userInvoices = allInvoices.filter(invoice => {
        return invoice.userEmail === currentUser.email;
      });

      console.log(`🔍 getSavedItems: Found ${userInvoices.length} total invoices in localStorage`);

      if (userInvoices.length === 0) {
        console.log(`⚠️ No invoices showing for user: ${currentUser.email}`);
        console.log('📋 Debug: All invoices in storage:');
        allInvoices.forEach((inv, idx) => {
          console.log(`  ${idx + 1}. Title: "${inv.title}", UserEmail: "${inv.userEmail}", UserId: "${inv.userId}"`);
        });
      }

      return userInvoices;
    } catch (error) {
      console.error('❌ Error getting invoices:', error);
      return [];
    }
  }

  // Get saved items (filtered by current user)
  getSavedItems() {
    return this.getAllInvoices();
  }

  // Get invoice by ID
  getInvoice(id) {
    const invoices = this.getAllInvoices();
    return invoices.find(invoice => invoice.id === id);
  }

  // Delete invoice
  async deleteInvoice(id) {
    const invoices = this.getAllInvoices();
    const index = invoices.findIndex(invoice => invoice.id === id);

    if (index === -1) {
      console.error('Invoice not found for deletion:', id);
      return false;
    }

    const invoice = invoices[index];

    // Delete from server if it has a server ID
    if (invoice.serverId) {
      try {
        const response = await fetch(`/api/v2/invoice/${invoice.serverId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          console.warn('Failed to delete from server, proceeding with local deletion');
        }
      } catch (error) {
        console.warn('Server deletion failed, proceeding with local deletion:', error);
      }
    }

    // Remove from localStorage
    invoices.splice(index, 1);
    localStorage.setItem(this.storageKey, JSON.stringify(invoices));

    // Remove from server ID mapping
    this.serverInvoiceMap.delete(id);

    this.notify();
    return true;
  }

  // Draft management
  async saveDraft(invoiceData, title = 'Draft Invoice') {
    const currentUser = this.userManager.getCurrentUser();

    const draft = {
      id: this.generateId(),
      title,
      data: invoiceData,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUser?.id || 'anonymous',
      userEmail: currentUser?.email || null,
      total: this.calculateTotal(invoiceData)
    };

    const drafts = this.getAllDrafts();
    drafts.push(draft);
    localStorage.setItem(this.draftsKey, JSON.stringify(drafts));

    this.notify();
    return draft.id;
  }

  // Get all drafts for current user
  getAllDrafts() {
    try {
      const stored = localStorage.getItem(this.draftsKey);
      if (!stored) return [];

      const allDrafts = JSON.parse(stored);
      const currentUser = this.userManager.getCurrentUser();

      if (!currentUser || !currentUser.email) {
        return [];
      }

      return allDrafts.filter(draft => draft.userEmail === currentUser.email);
    } catch (error) {
      console.error('Error getting drafts:', error);
      return [];
    }
  }

  // Get last saved state for unsaved change detection
  getLastSavedState() {
    return this.lastSavedState;
  }

  // Clear last saved state
  clearLastSavedState() {
    this.lastSavedState = null;
  }

  // Add listener for storage changes
  subscribe(callback) {
    this.listeners.push(callback);
  }

  // Remove listener
  unsubscribe(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners
  notify() {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in storage listener:', error);
      }
    });
  }

  // Clear all data (for testing)
  clearAll() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.draftsKey);
    localStorage.removeItem('failedSaves');
    this.serverInvoiceMap.clear();
    this.lastSavedState = null;
    this.notify();
  }

  // Set callback for authentication required
  onAuthenticationRequired(callback) {
    this.onAuthRequired = callback;
  }

  // Queue failed save for retry
  queueFailedSave(invoice, errorDetails) {
    // 🔧 PHASE 2 FIX: Skip queueing if specified or if queue is full
    if (errorDetails.skipQueue) {
      console.log(`⏭️ [${errorDetails.requestId}] Skipping queue for non-retriable error: ${errorDetails.status}`);
      return;
    }

    const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');

    // 🔧 PHASE 2 FIX: Limit queue size to prevent infinite accumulation
    if (failedSaves.length >= this.maxFailedSaves) {
      console.log(`🚫 [${errorDetails.requestId}] Failed save queue full (${this.maxFailedSaves}), discarding oldest entry`);
      failedSaves.shift(); // Remove oldest entry
    }

    failedSaves.push({
      invoice,
      errorDetails,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
    localStorage.setItem('failedSaves', JSON.stringify(failedSaves));
    console.log(`📦 [${errorDetails.requestId}] Queued failed save for retry. Total queued: ${failedSaves.length}`);
  }

  // Retry failed saves (only if authenticated)
  async retryFailedSaves() {
    const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');
    if (failedSaves.length === 0) return;

    // Check if user is authenticated before retrying
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      console.log('🔐 No user authenticated - skipping retry of failed saves');
      return;
    }

    console.log(`🔄 Retrying ${failedSaves.length} failed saves...`);
    const stillFailed = [];

    for (const failedSave of failedSaves) {
      try {
        failedSave.retryCount++;

        // 🔧 PHASE 2 FIX: Implement exponential backoff for retries
        const retryDelay = Math.min(1000 * Math.pow(2, failedSave.retryCount - 1), 30000);
        if (failedSave.retryCount > 1) {
          console.log(`⏳ [${failedSave.errorDetails.requestId}] Waiting ${retryDelay}ms before retry ${failedSave.retryCount}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        const result = await this.saveToServer(failedSave.invoice);
        console.log(`✅ [${failedSave.errorDetails.requestId}] Retry ${failedSave.retryCount} successful for invoice: ${failedSave.invoice.title}`);
      } catch (error) {
        // If it's an authentication error, stop retrying
        if (error.message && error.message.includes('401')) {
          console.log(`🔐 [${failedSave.errorDetails.requestId}] Authentication lost - stopping retries`);
          stillFailed.push(failedSave);
          break;
        }

        // 🔧 PHASE 2 FIX: Limit retry attempts to prevent infinite loops
        if (failedSave.retryCount < 3) {
          console.log(`🔄 [${failedSave.errorDetails.requestId}] Retry ${failedSave.retryCount} failed, will try again: ${error.message}`);
          stillFailed.push(failedSave);
        } else {
          console.log(`🚫 [${failedSave.errorDetails.requestId}] Giving up after ${failedSave.retryCount} failed retries: ${error.message}`);
          // Don't add to stillFailed - give up on this one
        }
      }
    }

    // Update failed saves list
    localStorage.setItem('failedSaves', JSON.stringify(stillFailed));

    if (stillFailed.length > 0) {
      console.log(`⚠️ ${stillFailed.length} saves still failed after retry`);
    } else {
      console.log('✅ All failed saves successfully retried');
    }
  }

  /**
   * Sync invoices from server to localStorage
   * This ensures users don't lose their invoices when localStorage is cleared
   */
  async syncFromServer() {
    // 🔧 CIRCUIT BREAKER: Stop persistent failure retries
    if (this.circuitBreakerActive) {
      console.log('🔌 Circuit breaker active - skipping server sync to prevent console spam');
      return;
    }

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

        // Merge server invoices with local using sophisticated deduplication
        const invoiceMap = new Map();

        // Helper function to create a content signature for deduplication
        const getInvoiceSignature = (inv) => {
          // Create a signature based on title, creation time, and content structure
          const titlePart = (inv.title || '').trim().toLowerCase();
          const timePart = new Date(inv.createdAt).getTime();
          const contentPart = JSON.stringify(inv.data).length; // Content size as rough signature
          return `${titlePart}_${Math.floor(timePart/60000)}_${contentPart}`; // Group by minute to handle small timing differences
        };

        // Create signature map to detect content duplicates
        const signatureMap = new Map();

        // Add local invoices first
        localInvoices.forEach(inv => {
          const signature = getInvoiceSignature(inv);
          invoiceMap.set(inv.id, inv);
          signatureMap.set(signature, inv.id);
        });

        // Process server invoices with duplicate detection
        serverInvoices.forEach(inv => {
          // Ensure the invoice has the user's email for future filtering
          inv.userEmail = currentUser.email;
          inv.userId = inv.userId || currentUser.id;

          const signature = getInvoiceSignature(inv);

          // Check if this content already exists locally
          if (signatureMap.has(signature)) {
            const existingId = signatureMap.get(signature);
            const existingInvoice = invoiceMap.get(existingId);

            console.log(`🔍 Detected duplicate invoice: "${inv.title}" (server) matches "${existingInvoice.title}" (local)`);

            // Server version is more authoritative, but preserve local ID if no server ID
            if (inv.serverId || new Date(inv.updatedAt) > new Date(existingInvoice.updatedAt)) {
              console.log(`📥 Using server version (more recent or has serverId)`);
              invoiceMap.delete(existingId); // Remove old local version
              invoiceMap.set(inv.id, inv);   // Add server version
              signatureMap.set(signature, inv.id); // Update signature map
            } else {
              console.log(`📦 Keeping local version (more recent or server has no ID)`);
              // Keep local version, don't add server duplicate
            }
          } else {
            // No duplicate found, add server invoice
            invoiceMap.set(inv.id, inv);
            signatureMap.set(signature, inv.id);
          }
        });

        // Convert back to array
        const mergedInvoices = Array.from(invoiceMap.values());

        // Save to localStorage
        localStorage.setItem(this.storageKey, JSON.stringify(mergedInvoices));
        console.log(`✅ Synced ${mergedInvoices.length} total invoices to localStorage`);

        // Reset server failure tracking on successful sync
        this.serverFailureCount = 0;
        this.serverRetryDelay = 1000;
        this.lastServerCheck = Date.now();
        this.persistentFailureStartTime = null; // Reset persistent failure tracking
        this.circuitBreakerActive = false; // Reset circuit breaker on success

        // Notify listeners (update sidebar)
        this.notify();
      } else if (response.status === 404) {
        console.log('📭 No invoices found on server for user');
        // Reset server failure tracking on successful connection (even if no data)
        this.serverFailureCount = 0;
        this.serverRetryDelay = 1000;
        this.lastServerCheck = Date.now();
        this.persistentFailureStartTime = null; // Reset persistent failure tracking
        this.circuitBreakerActive = false; // Reset circuit breaker on successful connection
      } else if (response.status >= 500) {
        // 🔧 ENHANCED: Detect persistent failures and activate circuit breaker
        this.serverFailureCount++;
        this.lastServerCheck = Date.now();

        // Track when persistent failures started
        if (!this.persistentFailureStartTime) {
          this.persistentFailureStartTime = Date.now();
        }

        // Check if failures have been persistent for >2 minutes
        const failureDuration = Date.now() - this.persistentFailureStartTime;
        if (failureDuration > 120000 && this.serverFailureCount >= 3) { // 2 minutes and 3+ failures
          this.circuitBreakerActive = true;
          console.log('🔌 CIRCUIT BREAKER ACTIVATED: Persistent server errors detected');
          console.log('🛑 Stopping retry attempts to prevent console spam');
          console.log('💡 Circuit breaker will reset on next user authentication');
          this.notify(); // Update UI with local data
          return; // Exit without scheduling retry
        }

        this.serverRetryDelay = Math.min(this.serverRetryDelay * 2, this.maxRetryDelay);

        console.error(`❌ Failed to sync from server: ${response.status}`);
        console.log(`🔄 Server failure count: ${this.serverFailureCount}, next retry delay: ${this.serverRetryDelay}ms`);

        // Show user-friendly message about working offline
        const localInvoices = this.getAllInvoices();
        console.log(`📦 Working offline: ${localInvoices.length} invoices available locally`);

        // Schedule retry with exponential backoff (only if circuit breaker not active)
        if (this.serverFailureCount <= 5) {
          console.log(`🔄 Will retry server sync in ${this.serverRetryDelay}ms`);
          setTimeout(() => {
            console.log('🔄 Retrying server sync after failure...');
            this.syncFromServer();
          }, this.serverRetryDelay);
        } else {
          console.log('🚫 Too many server failures, switching to offline mode');
          // TODO: Show offline mode indicator in UI
        }

        // Don't throw error - continue with local data
        this.notify(); // Update UI with local data
      } else {
        console.error('❌ Failed to sync from server:', response.status);
        // For non-500 errors, don't implement exponential backoff
        this.notify(); // Update UI with local data
      }
    } catch (error) {
      // 🔧 PHASE 2 FIX: Network error handling
      this.serverFailureCount++;
      this.lastServerCheck = Date.now();
      this.serverRetryDelay = Math.min(this.serverRetryDelay * 2, this.maxRetryDelay);

      console.error('❌ Error syncing from server:', error);
      console.log(`🔄 Network error, failure count: ${this.serverFailureCount}, next retry delay: ${this.serverRetryDelay}ms`);

      // Continue with local data if server sync fails
      const localInvoices = this.getAllInvoices();
      console.log(`📦 Network error - working offline: ${localInvoices.length} invoices available locally`);

      // Schedule retry for network errors if not too many failures
      if (this.serverFailureCount <= 3) {
        setTimeout(() => {
          console.log('🔄 Retrying server sync after network error...');
          this.syncFromServer();
        }, this.serverRetryDelay);
      }

      this.notify(); // Update UI with local data
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
        localStorage.setItem(this.storageKey, JSON.stringify(invoices));
        console.log(`  Claimed ${claimed} orphaned invoices`);
      }
    }

    // Force sync from server
    this.syncFromServer();
  }

  // Cleanup
  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    this.listeners = [];
  }
}