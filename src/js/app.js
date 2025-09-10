console.log('🔥 APP.JS FILE LOADED');

import '../styles/main.css';
import '../styles/mobile-responsive.css';
import { InvoiceState } from './state/InvoiceState.js';
import { VesselForm } from './components/VesselForm.js';
import { CustomerForm } from './components/CustomerForm.js';
import { ScopeForm } from './components/ScopeForm.js';
import { NotesForm } from './components/NotesForm.js';
import { Preview } from './components/Preview.js';
import { Sidebar } from './components/Sidebar.js';
import { CommentsPanel } from './components/CommentsPanel.js';
import { UserManager } from './auth/UserManager.js';
import { AuthModal } from './auth/AuthModal.js';
import { ThemeManager } from './settings/ThemeManager.js';
import { SettingsModal } from './settings/SettingsModal.js';
import { InvoiceStorage } from './storage/InvoiceStorage.js';
import { PromptModal } from './components/PromptModal.js';
import { MobileMenu } from './components/MobileMenu.js';
import { generatePDF } from './exports/pdf.js';
import { composeEmail } from './exports/email.js';
import { printInvoice } from './exports/print.js';
import { initializeFormatters } from './formatters.js';

// Make addLineItem available globally for testing
window.addLineItem = function(lineItem) {
  if (window.app && window.app.state) {
    window.app.state.addLineItem(lineItem);
  }
};

class InvoiceApp {
  constructor() {
    // Initialize core systems first
    this.userManager = new UserManager();
    
    // Check authentication before initializing app
    this.checkAuthentication().then(isAuthenticated => {
      if (!isAuthenticated) {
        console.log('🚫 User not authenticated, redirecting to landing page...');
        window.location.href = '/';
        return;
      }
      
      // Check if user is master
      this.checkMasterUser();
      
      // Continue with app initialization
      this.themeManager = new ThemeManager(this.userManager);
      this.invoiceStorage = new InvoiceStorage(this.userManager);
      
      // Initialize UI components
      this.authModal = new AuthModal(this.userManager);
      this.settingsModal = new SettingsModal(this.userManager, this.themeManager);
      this.promptModal = new PromptModal();
      
      // Initialize invoice state and components
      this.state = new InvoiceState();
      this.initComponents();
      this.initTabNavigation();
      this.initActionButtons();
      this.initKeyboardShortcuts();
      
      // Initialize sidebar (must be after other components)
      console.log('🏗️ About to create sidebar...');
      console.log('🏗️ Constructor params:', {
        userManager: !!this.userManager,
        invoiceStorage: !!this.invoiceStorage, 
        authModal: !!this.authModal,
        settingsModal: !!this.settingsModal
      });
      this.sidebar = new Sidebar(this.userManager, this.invoiceStorage, this.authModal, this.settingsModal);
      console.log('✅ Sidebar created successfully');
      
      // Force sidebar to update with current user
      const currentUser = this.userManager.getCurrentUser();
      if (currentUser) {
        console.log('🔄 Forcing sidebar update with authenticated user');
        this.sidebar.updateUserSection(currentUser);
      }
      
      // Setup invoice item listeners
      this.sidebar.setupInvoiceItemListeners();
      
      // Initialize mobile menu
      this.mobileMenu = new MobileMenu();
      console.log('📱 Mobile menu initialized');
      
      // Make state available for testing
      window.app = this;
      
      console.log('✅ Full app initialized with authentication and storage');
      
      // Check for failed saves on startup and retry
      if (this.invoiceStorage && this.invoiceStorage.retryFailedSaves) {
        setTimeout(async () => {
          const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');
          if (failedSaves.length > 0) {
            console.log(`📦 Found ${failedSaves.length} failed saves. Attempting retry...`);
            const result = await this.invoiceStorage.retryFailedSaves();
            if (result && result.stillFailed > 0) {
              this.showNotification(`${result.stillFailed} invoices are pending save. Will retry later.`, 'warning');
            }
          }
        }, 2000);
      }
    });
  }
  
  async checkAuthentication() {
    try {
      console.log('🔍 Checking authentication (hybrid mode)...');
      
      // First check for cookie-based session
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Cookie auth response:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Cookie authentication successful:', userData);
        this.userManager.currentUser = userData.user;
        this.userManager.saveSession(true);
        this.userManager.notify();
        localStorage.setItem('auth_method', 'cookie');
        return true;
      }
      
      // Cookie auth failed, try token auth
      console.log('🔄 Cookie auth failed, trying token authentication...');
      
      const token = localStorage.getItem('auth_token');
      const tokenExpiry = localStorage.getItem('auth_token_expiry');
      
      if (token && tokenExpiry) {
        // Check if token is expired
        if (Number(tokenExpiry) < Date.now()) {
          console.log('⚠️ Token expired, clearing...');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_token_expiry');
          localStorage.removeItem('auth_method');
        } else {
          // Verify token with server
          const tokenResponse = await fetch('/api/token-auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log('✅ Token authentication successful:', tokenData);
            this.userManager.currentUser = tokenData.user;
            this.userManager.saveSession(true);
            this.userManager.notify();
            localStorage.setItem('auth_method', 'token');
            
            // Store token for API calls
            window.authToken = token;
            return true;
          } else {
            console.log('❌ Token verification failed');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token_expiry');
          }
        }
      }
      
      // Both cookie and token auth failed, check localStorage fallback
      const storedUser = localStorage.getItem('marine_invoice_user');
      if (storedUser && window.location.pathname === '/app') {
        console.log('📦 Using localStorage fallback (offline mode)');
        this.userManager.currentUser = JSON.parse(storedUser);
        this.userManager.notify();
        localStorage.setItem('auth_method', 'localStorage');
        return true;
      }
      
      // No valid authentication found
      console.log('🚫 No valid authentication found');
      this.userManager.clearSession();
      return false;
      
    } catch (error) {
      console.log('🚫 Authentication check error:', error);
      
      // On network error, try localStorage fallback
      const storedUser = localStorage.getItem('marine_invoice_user');
      if (storedUser) {
        console.log('📦 Network error - using localStorage fallback');
        this.userManager.currentUser = JSON.parse(storedUser);
        this.userManager.notify();
        return true;
      }
      
      this.userManager.clearSession();
      return false;
    }
  }
  
  async checkMasterUser() {
    try {
      // Check if user is already authenticated as master
      const response = await fetch('/api/auth/check-master', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.isMaster) {
          console.log('👑 Master user detected - redirecting to dashboard');
          window.location.href = '/master';
        }
      }
    } catch (error) {
      console.log('Could not check master status:', error);
    }
  }
  
  initComponents() {
    this.vesselForm = new VesselForm(this.state);
    this.customerForm = new CustomerForm(this.state);
    this.scopeForm = new ScopeForm(this.state);
    this.notesForm = new NotesForm(this.state, this.userManager);
    this.preview = new Preview(this.state, this.userManager);
    this.commentsPanel = new CommentsPanel(this.state, this.userManager);
  }
  
  initTabNavigation() {
    console.log('🔍 Initializing tab navigation...');
    
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    console.log('📊 Tab Debug Info:');
    console.log('  - Tab buttons found:', tabButtons.length);
    console.log('  - Tab panels found:', tabPanels.length);
    
    // Debug: List all buttons and their data-tab attributes
    tabButtons.forEach((button, index) => {
      const dataTab = button.getAttribute('data-tab');
      console.log(`  - Button ${index}: data-tab="${dataTab}", text="${button.textContent.trim()}"`);
    });
    
    // Debug: List all panels and their data-section attributes
    tabPanels.forEach((panel, index) => {
      const dataSection = panel.getAttribute('data-section');
      const isVisible = panel.classList.contains('visible');
      console.log(`  - Panel ${index}: data-section="${dataSection}", visible=${isVisible}`);
    });
    
    if (tabButtons.length === 0) {
      console.error('❌ No tab buttons found! Check if HTML is loaded correctly.');
      return;
    }
    
    if (tabPanels.length === 0) {
      console.error('❌ No tab panels found! Check if HTML is loaded correctly.');
      return;
    }
    
    tabButtons.forEach((button, buttonIndex) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const targetTab = button.getAttribute('data-tab');
        console.log(`🔄 Tab clicked: "${targetTab}" (button ${buttonIndex})`);
        
        // Update active button
        let activeButtonSet = false;
        tabButtons.forEach((btn, btnIndex) => {
          const wasActive = btn.classList.contains('active');
          btn.classList.remove('active');
          if (btn === button) {
            btn.classList.add('active');
            activeButtonSet = true;
            console.log(`  ✅ Button ${btnIndex} set as active`);
          } else if (wasActive) {
            console.log(`  ❌ Button ${btnIndex} removed from active`);
          }
        });
        
        if (!activeButtonSet) {
          console.error('❌ Failed to set active button!');
        }
        
        // Update visible panel
        let panelFound = false;
        tabPanels.forEach((panel, panelIndex) => {
          const section = panel.getAttribute('data-section');
          const wasVisible = panel.classList.contains('visible');
          
          if (section === targetTab) {
            panel.classList.add('visible');
            panelFound = true;
            console.log(`  ✅ Panel ${panelIndex} (${section}) made visible`);
          } else {
            panel.classList.remove('visible');
            if (wasVisible) {
              console.log(`  ❌ Panel ${panelIndex} (${section}) hidden`);
            }
          }
        });
        
        if (!panelFound) {
          console.error(`❌ No panel found for tab "${targetTab}"!`);
        } else {
          console.log(`✅ Tab switch to "${targetTab}" completed successfully`);
        }
      });
      
      console.log(`🎯 Event listener attached to button ${buttonIndex}`);
    });
    
    console.log('✅ Tab navigation initialization complete');
  }
  
  initActionButtons() {
    const saveBtn = document.getElementById('save-invoice');
    const pdfBtn = document.getElementById('generate-pdf');
    const emailBtn = document.getElementById('compose-email');
    const printBtn = document.getElementById('print-invoice');
    
    console.log('🔍 Action buttons found:');
    console.log('  - saveBtn:', saveBtn ? '✅' : '❌');
    console.log('  - pdfBtn:', pdfBtn ? '✅' : '❌');
    console.log('  - emailBtn:', emailBtn ? '✅' : '❌');
    console.log('  - printBtn:', printBtn ? '✅' : '❌');
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveInvoice();
      });
    } else {
      console.error('❌ Save button not found');
    }
    
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        generatePDF();
      });
    } else {
      console.error('❌ PDF button not found');
    }
    
    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        composeEmail(this.state, this.userManager);
      });
    } else {
      console.error('❌ Email button not found');
    }
    
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        printInvoice();
      });
    } else {
      console.error('❌ Print button not found');
    }
    
    // Handle Electron IPC messages if available
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      
      ipcRenderer.on('new-invoice', () => {
        this.state.reset();
      });
      
      ipcRenderer.on('export-pdf', () => {
        generatePDF();
      });
    }
  }
}

console.log('🔥 APP.JS FILE LOADED');

// Add global error handler
window.addEventListener('error', (e) => {
  console.error('💀 GLOBAL ERROR:', e.error);
  console.error('💀 ERROR STACK:', e.error?.stack);
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM CONTENT LOADED - STARTING APP INITIALIZATION');
  try {
    console.log('🏗️ Creating InvoiceApp instance...');
    const app = new InvoiceApp();
    console.log('✅ App initialized successfully');
    
    // Test if sidebar was created
    setTimeout(() => {
      const sidebar = document.querySelector('.app-sidebar');
      const newBtn = document.querySelector('.new-invoice-btn');
      console.log('🔍 POST-INIT CHECK:');
      console.log('  - Sidebar exists:', !!sidebar);
      console.log('  - New button exists:', !!newBtn);
      console.log('  - Window.app exists:', !!window.app);
      
      if (newBtn) {
        console.log('🎯 BUTTON FOUND - READY TO TEST');
        // Add extra debugging
        newBtn.addEventListener('click', () => {
          console.log('🔥🔥🔥 BUTTON CLICK DETECTED 🔥🔥🔥');
        });
      } else {
        console.error('❌❌❌ BUTTON NOT FOUND ❌❌❌');
      }
    }, 1000);
    
    
    // Debug tools will be added after successful authentication
    
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    console.error(error.stack);
  }
  // Temporarily disabled formatters due to conflicts
  // initializeFormatters();
});

// Add methods to InvoiceApp class
InvoiceApp.prototype.saveInvoice = async function() {
  try {
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser) {
      this.authModal.show();
      return;
    }
    
    // Get current invoice data
    const invoiceData = this.state.getState();
    
    // Validate minimum required data
    if (!invoiceData.vessel?.name && !invoiceData.customer?.customerName) {
      this.showNotification('Please add vessel or customer information before saving', 'warning');
      return;
    }
    
    // Generate title from vessel and customer
    const title = `${invoiceData.vessel?.name || 'Unnamed'} - ${invoiceData.customer?.customerName || 'Unknown'}`;
    
    // Save to localStorage first for immediate UI update
    const localId = await this.invoiceStorage.saveInvoice(invoiceData, title);
    
    // Update sidebar to show saved invoice
    if (this.sidebar) {
      this.sidebar.updateSavedItems();
    }
    
    // Show success notification
    this.showNotification('Invoice saved successfully', 'success');
    
    // Enable export buttons
    document.querySelectorAll('.export-group button').forEach(btn => {
      btn.disabled = false;
    });
    
    console.log('✅ Invoice saved with ID:', localId);
    
  } catch (error) {
    console.error('Failed to save invoice:', error);
    this.showNotification('Failed to save invoice. Please try again.', 'error');
  }
};

InvoiceApp.prototype.saveCurrentInvoice = InvoiceApp.prototype.saveInvoice;

InvoiceApp.prototype.showNotification = function(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
};

InvoiceApp.prototype.createNewInvoice = function() {
  // Reset state
  this.state.reset();
  
  // Clear all form fields
  document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], textarea').forEach(input => {
    input.value = '';
  });
  
  // Clear line items
  const lineItemsList = document.getElementById('line-items-list');
  if (lineItemsList) {
    lineItemsList.innerHTML = '';
  }
  
  // Show notification
  this.showNotification('New invoice created', 'info');
};

InvoiceApp.prototype.initKeyboardShortcuts = function() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + S = Save invoice
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      this.saveInvoice();
    }
    
    // Cmd/Ctrl + N = New invoice
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      this.createNewInvoice();
    }
    
    // Cmd/Ctrl + , = Settings (on Mac)
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      this.settingsModal.show();
    }
  });
};

InvoiceApp.prototype.saveCurrentInvoice = function() {
  if (!this.userManager.isAuthenticated()) {
    this.authModal.show('signin');
    return;
  }
  
  const currentState = this.state.getState();
  if (!this.invoiceStorage.hasContent(currentState)) {
    console.log('No content to save');
    return;
  }
  
  const title = prompt('Enter a name for this invoice:') || undefined;
  const id = this.invoiceStorage.saveInvoice(currentState, title);
  console.log('Invoice saved with ID:', id);
};

InvoiceApp.prototype.createNewInvoice = function() {
  console.log('🆕 App createNewInvoice called');
  
  // Check if there's unsaved content
  const currentState = this.state.getState();
  const hasUnsavedChanges = this.invoiceStorage.hasUnsavedChanges(currentState);
  
  if (hasUnsavedChanges) {
    if (!confirm('Create a new invoice? Any unsaved changes will be lost.')) {
      return;
    }
  }
  
  // Reset the state
  this.state.reset();
  
  // Clear saved state since we're creating a new invoice
  this.invoiceStorage.clearSavedState();
  
  // Clear all form fields
  if (this.vesselForm) {
    this.vesselForm.populate({
      name: '',
      weight: '',
      beam: ''
    });
    
    // Trigger input events to clear suffix displays
    if (this.vesselForm.vesselWeight) {
      this.vesselForm.vesselWeight.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (this.vesselForm.vesselBeam) {
      this.vesselForm.vesselBeam.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  if (this.customerForm) {
    this.customerForm.populate({
      estimatorName: '',
      customerName: '',
      customerEmail: '',
      customerPhone: ''
    });
  }
  
  if (this.scopeForm) {
    this.scopeForm.clearLineItems();
  }
  
  // Reset to first tab
  const firstTab = document.querySelector('.tab-button[data-tab="vessel"]');
  if (firstTab) {
    firstTab.click();
  }
  
  console.log('✅ New invoice created - all forms cleared');
};

// Save invoice as completed/final
InvoiceApp.prototype.saveInvoice = async function() {
  if (!this.userManager.isAuthenticated()) {
    console.log('User not authenticated, showing auth modal');
    this.authModal.show('signin');
    return;
  }
  
  const currentState = this.state.getState();
  
  if (!this.invoiceStorage.hasContent(currentState)) {
    await this.promptModal.showAlert('Cannot Save', 'Please add some content before saving');
    return;
  }
  
  try {
    const title = await this.promptModal.show('Save Invoice', 'Enter a name for this invoice:', 'Untitled Invoice');
    if (title === null) return; // User cancelled
    
    const finalTitle = title.trim() || 'Untitled Invoice';
    
    const id = this.invoiceStorage.saveInvoice(currentState, finalTitle);
    
    if (id) {
      await this.promptModal.showAlert('Success', 'Invoice saved successfully!');
      this.sidebar.refreshInvoiceList();
    } else {
      await this.promptModal.showAlert('Error', 'Failed to save invoice');
    }
  } catch (error) {
    console.error('Error saving invoice:', error);
    await this.promptModal.showAlert('Error', 'Error saving invoice: ' + error.message);
  }
};

