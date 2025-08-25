console.log('🔥 APP.JS FILE LOADED');

import '../styles/main.css';
import { InvoiceState } from './state/InvoiceState.js';
import { VesselForm } from './components/VesselForm.js';
import { CustomerForm } from './components/CustomerForm.js';
import { ScopeForm } from './components/ScopeForm.js';
import { Preview } from './components/Preview.js';
import { Sidebar } from './components/Sidebar.js';
import { UserManager } from './auth/UserManager.js';
import { AuthModal } from './auth/AuthModal.js';
import { ThemeManager } from './settings/ThemeManager.js';
import { SettingsModal } from './settings/SettingsModal.js';
import { InvoiceStorage } from './storage/InvoiceStorage.js';
import { PromptModal } from './components/PromptModal.js';
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
    // Initialize core systems
    this.userManager = new UserManager();
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
    
    // Setup invoice item listeners
    this.sidebar.setupInvoiceItemListeners();
    
    // Make state available for testing
    window.app = this;
    
    console.log('✅ Full app initialized with authentication and storage');
  }
  
  initComponents() {
    this.vesselForm = new VesselForm(this.state);
    this.customerForm = new CustomerForm(this.state);
    this.scopeForm = new ScopeForm(this.state);
    this.preview = new Preview(this.state, this.userManager);
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
    
    saveBtn.addEventListener('click', () => {
      this.saveInvoice();
    });
    
    pdfBtn.addEventListener('click', () => {
      generatePDF();
    });
    
    emailBtn.addEventListener('click', () => {
      composeEmail(this.state, this.userManager);
    });
    
    printBtn.addEventListener('click', () => {
      printInvoice();
    });
    
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
    
    
    // Add global debug functions for console testing
    window.debugApp = {
      app: app,
      testTabSwitch: (tabName) => {
        console.log(`🧪 Testing tab switch to: ${tabName}`);
        const button = document.querySelector(`[data-tab="${tabName}"]`);
        if (button) {
          button.click();
          console.log('✅ Tab click triggered');
        } else {
          console.error(`❌ No tab button found for: ${tabName}`);
        }
      },
      testStateUpdate: (section, data) => {
        console.log(`🧪 Testing state update: ${section}`, data);
        switch(section) {
          case 'vessel':
            app.state.updateVessel(data);
            break;
          case 'customer':
            app.state.updateCustomer(data);
            break;
          case 'scope':
            app.state.updateScope(data);
            break;
        }
      },
      getState: () => app.state.getState(),
      listTabs: () => {
        const buttons = document.querySelectorAll('.tab-button');
        const panels = document.querySelectorAll('.tab-panel');
        console.log('🗂️ Available tabs:');
        buttons.forEach((btn, i) => console.log(`  ${i}: ${btn.getAttribute('data-tab')} - "${btn.textContent.trim()}"`));
        console.log('📁 Available panels:');
        panels.forEach((panel, i) => console.log(`  ${i}: ${panel.getAttribute('data-section')} - visible: ${panel.classList.contains('visible')}`));
      }
    };
    
    console.log('🛠️ Debug tools added to window.debugApp');
    console.log('💡 Try: debugApp.listTabs() or debugApp.testTabSwitch("customer")');
    
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    console.error(error.stack);
  }
  // Temporarily disabled formatters due to conflicts
  // initializeFormatters();
});

// Add methods to InvoiceApp class
InvoiceApp.prototype.initKeyboardShortcuts = function() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + S = Save invoice
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      this.saveCurrentInvoice();
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
  const hasContent = this.invoiceStorage.hasContent(currentState);
  
  if (hasContent) {
    if (!confirm('Create a new invoice? Any unsaved changes will be lost.')) {
      return;
    }
  }
  
  // Reset the state
  this.state.reset();
  
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

