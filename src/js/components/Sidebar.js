export class Sidebar {
  constructor(userManager, invoiceStorage, authModal, settingsModal) {
    console.log('🏗️ SIDEBAR CONSTRUCTOR CALLED');
    this.userManager = userManager;
    this.invoiceStorage = invoiceStorage;
    this.authModal = authModal;
    this.settingsModal = settingsModal;
    this.isCollapsed = false;
    
    try {
      console.log('🏗️ Creating sidebar...');
      this.createSidebar();
      console.log('🔗 Attaching listeners...');
      this.attachListeners();
      console.log('📡 Setting up subscriptions...');
      this.setupSubscriptions();
      console.log('✅ SIDEBAR FULLY INITIALIZED');
    } catch (error) {
      console.error('💀 SIDEBAR CONSTRUCTOR FAILED:', error);
      throw error;
    }
  }
  
  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'app-sidebar';
    this.sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-toggle">
          <button class="sidebar-toggle-btn" title="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
        <button class="new-invoice-btn" title="New invoice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14m-7-7h14"/>
          </svg>
          <span class="btn-text">New Invoice</span>
        </button>
      </div>
      
      <div class="sidebar-content">
        <div class="sidebar-section">
          <div class="section-header">
            <h3>Recent</h3>
          </div>
          <div class="invoice-list" id="recent-list">
            <div class="empty-state">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              <p>No recent invoices</p>
              <span>Create your first invoice to get started</span>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="section-header">
            <h3>Drafts</h3>
          </div>
          <div class="invoice-list" id="drafts-list">
            <div class="empty-state">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              <p>No drafts</p>
              <span>Your auto-saved work will appear here</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="sidebar-footer">
        <div class="user-section" id="user-section" style="display: none;">
          <div class="user-info">
            <div class="user-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="user-details">
              <div class="user-name" id="user-name">User Name</div>
              <div class="user-email" id="user-email">user@example.com</div>
            </div>
          </div>
          <div class="user-actions">
            <button class="action-btn" id="settings-btn" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="m12 1 2.09 6.26L22 9l-6.26 2.09L14 17l-2.09-6.26L4 9l6.26-2.09L12 1z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="auth-section" id="auth-section">
          <button class="auth-btn primary" id="sign-in-btn">Sign In</button>
          <button class="auth-btn secondary" id="sign-up-btn">Sign Up</button>
        </div>
      </div>
    `;
    
    // Insert sidebar as first child of app container
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.insertBefore(this.sidebar, appContainer.firstChild);
      appContainer.classList.add('with-sidebar');
    }
  }
  
  attachListeners() {
    console.log('🔗 Attaching sidebar listeners...');
    console.log('🔍 AuthModal available:', !!this.authModal);
    
    // Sidebar toggle
    this.sidebar.querySelector('.sidebar-toggle-btn').addEventListener('click', () => {
      this.toggleSidebar();
    });
    
    // New invoice
    const newInvoiceBtn = this.sidebar.querySelector('.new-invoice-btn');
    console.log('🔍 Looking for new invoice button...');
    console.log('🔍 Button element:', newInvoiceBtn);
    console.log('🔍 Button classes:', newInvoiceBtn ? newInvoiceBtn.className : 'N/A');
    console.log('🔍 Button text:', newInvoiceBtn ? newInvoiceBtn.textContent : 'N/A');
    
    if (newInvoiceBtn) {
      console.log('🎯 NEW INVOICE BUTTON FOUND!');
      
      // Multiple event listeners for maximum coverage
      ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(eventType => {
        newInvoiceBtn.addEventListener(eventType, (e) => {
          if (eventType === 'click') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔥🔥🔥 BUTTON CLICKED - FIRING NUCLEAR CLEAR 🔥🔥🔥');
            this.createNewInvoice();
          }
        });
      });
      
      // Global test function 
      window.testNewInvoiceButton = () => {
        console.log('🧪 GLOBAL TEST FUNCTION CALLED');
        this.createNewInvoice();
      };
      
      // Reset button to normal styling
      newInvoiceBtn.style.backgroundColor = '';
      newInvoiceBtn.style.border = '';
      newInvoiceBtn.title = 'New invoice';
      
      console.log('✅ BUTTON FULLY ARMED AND READY');
      console.log('💡 Test with: window.testNewInvoiceButton()');
    } else {
      console.error('❌❌❌ NEW INVOICE BUTTON NOT FOUND ❌❌❌');
      console.log('🔍 Available buttons:', Array.from(this.sidebar.querySelectorAll('button')).map(btn => btn.className));
    }
    
    // Auth buttons
    const signInBtn = this.sidebar.querySelector('#sign-in-btn');
    console.log('🔍 Sign-in button found:', !!signInBtn);
    
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        console.log('🔐 Sign-in button clicked');
        try {
          if (!this.authModal) {
            console.error('❌ AuthModal not available');
            return;
          }
          this.authModal.show('signin');
          console.log('✅ AuthModal.show() called successfully');
        } catch (error) {
          console.error('❌ Error showing auth modal:', error);
        }
      });
    } else {
      console.error('❌ Sign-in button not found!');
    }
    
    this.sidebar.querySelector('#sign-up-btn').addEventListener('click', () => {
      this.authModal.show('signup');
    });
    
    // Settings button
    this.sidebar.querySelector('#settings-btn').addEventListener('click', () => {
      this.settingsModal.show();
    });
  }
  
  setupSubscriptions() {
    // Listen for user changes
    this.userManager.subscribe((user) => {
      this.updateUserSection(user);
      this.refreshInvoiceList();
    });
    
    // Listen for invoice storage changes
    this.invoiceStorage.subscribe(() => {
      this.refreshInvoiceList();
    });
  }
  
  updateUserSection(user) {
    const userSection = this.sidebar.querySelector('#user-section');
    const authSection = this.sidebar.querySelector('#auth-section');
    
    if (user) {
      // Show user section
      userSection.style.display = 'block';
      authSection.style.display = 'none';
      
      // Update user info
      this.sidebar.querySelector('#user-name').textContent = user.name;
      this.sidebar.querySelector('#user-email').textContent = user.email;
    } else {
      // Show auth section
      userSection.style.display = 'none';
      authSection.style.display = 'flex';
    }
  }
  
  refreshInvoiceList() {
    this.updateRecentList();
    this.updateDraftsList();
  }
  
  updateRecentList() {
    const container = this.sidebar.querySelector('#recent-list');
    const recent = this.invoiceStorage.getRecentItems(5);
    
    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <p>No recent invoices</p>
          <span>Create your first invoice to get started</span>
        </div>
      `;
    } else {
      container.innerHTML = recent.map(item => this.createInvoiceItem(item)).join('');
    }
  }
  
  updateDraftsList() {
    const container = this.sidebar.querySelector('#drafts-list');
    const drafts = this.invoiceStorage.getUserDrafts().slice(0, 5);
    
    if (drafts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
          <p>No drafts</p>
          <span>Your auto-saved work will appear here</span>
        </div>
      `;
    } else {
      container.innerHTML = drafts.map(item => this.createInvoiceItem(item)).join('');
    }
  }
  
  createInvoiceItem(item) {
    const isCompleted = item.status === 'completed';
    const relativeTime = this.getRelativeTime(item.updatedAt);
    
    return `
      <div class="invoice-item ${item.status}" data-id="${item.id}">
        <div class="invoice-item-content" data-action="load">
          <div class="invoice-item-header">
            <div class="invoice-title">${this.truncateText(item.title, 25)}</div>
            <div class="invoice-status ${item.status}">
              ${isCompleted ? 
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>' :
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>'
              }
            </div>
          </div>
          <div class="invoice-item-meta">
            <span class="invoice-vessel">${item.metadata.vesselName || 'No vessel'}</span>
            <span class="invoice-time">${relativeTime}</span>
          </div>
        </div>
        <div class="invoice-item-actions">
          <button class="action-btn" data-action="duplicate" title="Duplicate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="action-btn danger" data-action="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
  
  // Event delegation for invoice items
  setupInvoiceItemListeners() {
    this.sidebar.addEventListener('click', (e) => {
      const invoiceItem = e.target.closest('.invoice-item');
      if (!invoiceItem) return;
      
      const id = invoiceItem.dataset.id;
      const action = e.target.closest('[data-action]')?.dataset.action;
      
      switch (action) {
        case 'load':
          this.loadInvoice(id);
          break;
        case 'duplicate':
          this.duplicateInvoice(id);
          break;
        case 'delete':
          this.deleteInvoice(id);
          break;
      }
    });
  }
  
  loadInvoice(id) {
    const invoice = this.invoiceStorage.loadInvoice(id);
    if (invoice && window.app) {
      // Load invoice data into the app state
      window.app.state.state = invoice.data;
      window.app.state.notify();
      
      // Update form components
      if (window.app.vesselForm) {
        window.app.vesselForm.populate(invoice.data.vessel);
      }
      if (window.app.customerForm) {
        window.app.customerForm.populate(invoice.data.customer);
      }
      if (window.app.scopeForm) {
        window.app.scopeForm.populate(invoice.data.scope);
      }
      
      console.log('Loaded invoice:', invoice.title);
    }
  }
  
  duplicateInvoice(id) {
    const newId = this.invoiceStorage.duplicateInvoice(id);
    if (newId) {
      console.log('Duplicated invoice with ID:', newId);
    }
  }
  
  deleteInvoice(id) {
    if (confirm('Are you sure you want to delete this invoice?')) {
      this.invoiceStorage.deleteInvoice(id);
    }
  }
  
  createNewInvoice() {
    console.log('🔘 Sidebar createNewInvoice called');
    
    // NUCLEAR OPTION: Direct DOM manipulation
    console.log('💥 NUCLEAR OPTION: Direct DOM clearing');
    
    try {
      // Clear ALL input fields directly - no fancy methods
      const inputs = document.querySelectorAll('input');
      console.log(`🔍 Found ${inputs.length} input elements`);
      
      inputs.forEach((input, index) => {
        const oldValue = input.value;
        input.value = '';
        console.log(`  ${index}: ${input.id || input.className} - was "${oldValue}" now "${input.value}"`);
        
        // Force trigger input event
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      // Clear all suffix displays by removing has-value class
      const wrappers = document.querySelectorAll('.input-with-suffix');
      console.log(`🎯 Found ${wrappers.length} suffix wrappers`);
      wrappers.forEach((wrapper, index) => {
        const hadValue = wrapper.classList.contains('has-value');
        wrapper.classList.remove('has-value');
        console.log(`  ${index}: ${hadValue ? 'removed' : 'already clear'} has-value`);
      });
      
      // Clear line items
      const lineItemsList = document.getElementById('line-items-list');
      if (lineItemsList) {
        console.log(`🧹 Clearing ${lineItemsList.children.length} line items`);
        lineItemsList.innerHTML = '';
      }
      
      // Force switch to vessel tab
      const vesselTab = document.querySelector('.tab-button[data-tab="vessel"]');
      if (vesselTab) {
        console.log('🎯 Force switching to vessel tab');
        vesselTab.click();
      }
      
      // Force update state if available
      if (window.app && window.app.state && typeof window.app.state.reset === 'function') {
        console.log('🔄 Force resetting state');
        window.app.state.reset();
      }
      
      console.log('💥 NUCLEAR CLEAR COMPLETED');
      return true;
      
    } catch (error) {
      console.error('💀 EVEN NUCLEAR OPTION FAILED:', error);
      return false;
    }
  }
  
  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.sidebar.classList.toggle('collapsed', this.isCollapsed);
    
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.classList.toggle('sidebar-collapsed', this.isCollapsed);
    }
  }
  
  // Utility methods
  truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
}