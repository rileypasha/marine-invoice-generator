console.log('🔥 APP.JS FILE LOADED');

import '../styles/main.css';
import '../styles/mobile-responsive.css';
import '../styles/enhanced-sidebar.css';
import '../styles/globals.css';
import '../styles/settings.css';
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
import { initializeReactSettings } from '../react/components/SettingsProvider.jsx';
import { InvoiceStorage } from './storage/InvoiceStorage.js';
import { PromptModal } from './components/PromptModal.js';
import { MobileMenu } from './components/MobileMenu.js';
import { generatePDF } from './exports/pdf.js';
import { composeEmail } from './exports/email.js';
import { printInvoice } from './exports/print.js';
import { initializeFormatters } from './formatters.js';
import { UnsavedChangesManager } from './utils/UnsavedChangesManager.js';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog.js';
import { NavigationProtection } from './utils/NavigationProtection.js';
import { configureSidebar, initializeEnhancedSidebar } from './components/sharedSidebar.js';

// React imports for Magic UI integration
import React from 'react';
import { createRoot } from 'react-dom/client';
import InvoiceEditorUI from '../react/pages/InvoiceEditorUI.jsx';
import VesselFormUI from '../react/components/forms/VesselFormUI.jsx';
import CustomerFormUI from '../react/components/forms/CustomerFormUI.jsx';
import ServicesFormUI from '../react/components/forms/ServicesFormUI.jsx';
import NotesFormUI from '../react/components/forms/NotesFormUI.jsx';
import InvoicePreviewUI from '../react/components/forms/InvoicePreviewUI.jsx';

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
      console.log('🎯 Authentication check result:', isAuthenticated);
      
      if (!isAuthenticated) {
        console.log('🚫 User not authenticated, redirecting to landing page...');
        window.location.href = '/';
        return;
      }
      
      console.log('✅ User authenticated, continuing with app initialization');
      
      // Check if user is master
      this.checkMasterUser();
      
      // Continue with app initialization
      this.themeManager = new ThemeManager(this.userManager);
      this.invoiceStorage = new InvoiceStorage(this.userManager);
      
      // Initialize UI components
      this.authModal = new AuthModal(this.userManager);
      this.promptModal = new PromptModal();

      // Initialize React settings modal
      initializeReactSettings();
      
      // Initialize invoice state and components
      this.state = new InvoiceState();
      this.initComponents();
      this.initTabNavigation();
      this.initActionButtons();
      // Try enhanced sidebar first, fall back to configureSidebar
      if (!initializeEnhancedSidebar('invoices', { manageAuth: false })) {
        configureSidebar('invoices', { manageAuth: false });
      }
      this.initSidebarNavigation();
      this.initKeyboardShortcuts();

      // Initialize unsaved changes system
      this.initUnsavedChangesSystem();

      // Restore edit state from previous session if applicable
      this.restoreEditSession();
      
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
      
      // User profile management removed - sidebar no longer shows user info
      
      // Setup invoice item listeners
      this.sidebar.setupInvoiceItemListeners();
      
      // Initialize mobile menu
      this.mobileMenu = new MobileMenu();
      console.log('📱 Mobile menu initialized');
      
      // Make state available for testing
      window.app = this;
      
      console.log('✅ Full app initialized with authentication and storage');

      // Initialize React-based Invoice Editor with Magic UI
      this.initReactInvoiceEditor();

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
      console.log('🔍 APP.JS: Checking server session authentication...');

      // Check server session only - NO localStorage fallback for authentication
      const sessionResponse = await fetch('/api/simple-auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('📡 APP.JS: Session check response:', sessionResponse.status);

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        if (sessionData.authenticated && sessionData.user) {
          console.log('✅ APP.JS: Server session valid:', sessionData.user.email);

          // Set user in UserManager for UI purposes
          this.userManager.currentUser = sessionData.user;
          this.userManager.notify();

          // Optional: Cache user info in localStorage for UI display only (NOT for auth)
          localStorage.setItem('marine_invoice_user_display', JSON.stringify(sessionData.user));

          return true;
        }
      }

      console.log('🚫 APP.JS: No valid server session found');
      this.userManager.clearSession();
      return false;

    } catch (error) {
      console.error('❌ APP.JS: Authentication check error:', error);
      this.userManager.clearSession();
      return false;
    }
  }
  
  async checkMasterUser() {
    // Master access check disabled to prevent redirect loop
    // Master users are redirected at login time via UserManager
    console.log('🎯 Skipping automatic master redirect to prevent infinite loop');
  }
  
  initComponents() {
    this.vesselForm = new VesselForm(this.state);
    this.customerForm = new CustomerForm(this.state);
    this.scopeForm = new ScopeForm(this.state);
    this.notesForm = new NotesForm(this.state, this.userManager);
    this.preview = new Preview(this.state, this.userManager);
    this.commentsPanel = new CommentsPanel(this.state, this.userManager);
  }

  initReactInvoiceEditor() {
    console.log('🚀 Initializing React Invoice Editor with Magic UI...');

    try {
      // Create main invoice editor container
      const editorContainer = document.createElement('div');
      editorContainer.id = 'react-invoice-editor';
      editorContainer.className = 'invoice-editor-container';

      // Replace the main content area with the React editor
      const mainContent = document.querySelector('main') || document.querySelector('.main-content');
      if (!mainContent) {
        console.error('❌ Could not find main content area');
        return;
      }

      // Clear existing content and add React container
      mainContent.innerHTML = '';
      mainContent.appendChild(editorContainer);

      // Create React root
      this.reactRoot = createRoot(editorContainer);

      // Initialize with empty state
      this.renderInvoiceEditor();

      // Set up form containers for individual React components
      this.initFormContainers();

      console.log('✅ React Invoice Editor initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to initialize React Invoice Editor:', error);
    }
  }

  renderInvoiceEditor() {
    if (!this.reactRoot) return;

    const currentState = this.state.getState();
    const currentUser = this.userManager.getCurrentUser();

    this.reactRoot.render(
      React.createElement(InvoiceEditorUI, {
        invoiceData: {
          vessel: currentState.vessel || {},
          customer: currentState.customer || {},
          services: currentState.scope?.lineItems || [],
          notes: currentState.notes || {},
          metadata: {
            title: currentState.title || '',
            invoiceDate: currentState.invoiceDate || new Date().toISOString(),
            taxRate: 8.75
          }
        },
        onVesselChange: (data) => this.handleVesselChange(data),
        onCustomerChange: (data) => this.handleCustomerChange(data),
        onServicesChange: (data) => this.handleServicesChange(data),
        onNotesChange: (data) => this.handleNotesChange(data),
        onSave: () => this.saveInvoice(),
        onPreview: () => this.showPreview(),
        onPrint: () => this.printInvoice(),
        onExportPDF: () => this.exportPDF(),
        onEmail: () => this.emailInvoice(),
        onNewInvoice: () => this.createNewInvoice(),
        isEditMode: this.state.getIsEditMode(),
        hasUnsavedChanges: this.unsavedChangesManager?.hasUnsavedChanges || false,
        isLoading: false,
        user: currentUser
      })
    );
  }

  initFormContainers() {
    // Set up individual form containers for mounting specific React components
    setTimeout(() => {
      this.initVesselForm();
      this.initCustomerForm();
      this.initServicesForm();
      this.initNotesForm();
      this.initPreviewComponent();
    }, 100);
  }

  initVesselForm() {
    const container = document.getElementById('vessel-form-container');
    if (container) {
      const vesselRoot = createRoot(container);
      const currentState = this.state.getState();

      vesselRoot.render(
        React.createElement(VesselFormUI, {
          vesselData: currentState.vessel || {},
          onVesselChange: (data) => this.handleVesselChange(data),
          onVesselSelect: (vessel) => this.handleVesselSelect(vessel),
          availableVessels: [], // TODO: Fetch from API
          isLoading: false
        })
      );
    }
  }

  initCustomerForm() {
    const container = document.getElementById('customer-form-container');
    if (container) {
      const customerRoot = createRoot(container);
      const currentState = this.state.getState();

      customerRoot.render(
        React.createElement(CustomerFormUI, {
          customerData: currentState.customer || {},
          onCustomerChange: (data) => this.handleCustomerChange(data),
          onCustomerSelect: (customer) => this.handleCustomerSelect(customer),
          availableCustomers: [], // TODO: Fetch from API
          isLoading: false
        })
      );
    }
  }

  initServicesForm() {
    const container = document.getElementById('services-form-container');
    if (container) {
      const servicesRoot = createRoot(container);
      const currentState = this.state.getState();

      servicesRoot.render(
        React.createElement(ServicesFormUI, {
          servicesData: currentState.scope?.lineItems || [],
          onServicesChange: (data) => this.handleServicesChange(data),
          onAddService: (service) => this.handleAddService(service),
          onRemoveService: (serviceId) => this.handleRemoveService(serviceId),
          isLoading: false
        })
      );
    }
  }

  initNotesForm() {
    const container = document.getElementById('notes-form-container');
    if (container) {
      const notesRoot = createRoot(container);
      const currentState = this.state.getState();
      const currentUser = this.userManager.getCurrentUser();

      notesRoot.render(
        React.createElement(NotesFormUI, {
          notesData: currentState.notes || {},
          onNotesChange: (data) => this.handleNotesChange(data),
          onAddComment: (comment) => this.handleAddComment(comment),
          currentUser: currentUser,
          isLoading: false
        })
      );
    }
  }

  initPreviewComponent() {
    const container = document.getElementById('invoice-preview-container');
    if (container) {
      const previewRoot = createRoot(container);
      const currentState = this.state.getState();
      const currentUser = this.userManager.getCurrentUser();

      previewRoot.render(
        React.createElement(InvoicePreviewUI, {
          invoiceData: {
            vessel: currentState.vessel || {},
            customer: currentState.customer || {},
            services: currentState.scope?.lineItems || [],
            notes: currentState.notes || {},
            metadata: {
              title: currentState.title || '',
              invoiceDate: currentState.invoiceDate || new Date().toISOString(),
              taxRate: 8.75
            }
          },
          user: currentUser,
          showFullPreview: false
        })
      );
    }
  }

  // Event handlers for React components
  handleVesselChange(data) {
    this.state.updateVessel(data);
    this.updateAllForms();
  }

  handleVesselSelect(vessel) {
    if (vessel) {
      this.state.updateVessel({
        id: vessel.id,
        name: vessel.name,
        weight: vessel.weight_tons || '',
        beam: vessel.beam_ft || ''
      });
    } else {
      this.state.updateVessel({ id: null });
    }
    this.updateAllForms();
  }

  handleCustomerChange(data) {
    this.state.updateCustomer(data);
    this.updateAllForms();
  }

  handleCustomerSelect(customer) {
    if (customer) {
      this.state.updateCustomer({
        id: customer.id,
        customerName: customer.company_name || customer.display_name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAddress: customer.address
      });
    } else {
      this.state.updateCustomer({ id: null });
    }
    this.updateAllForms();
  }

  handleServicesChange(services) {
    // Update all line items at once
    this.state.updateScope({ lineItems: services });
    this.updateAllForms();
  }

  handleAddService(service) {
    this.state.addLineItem(service);
    this.updateAllForms();
  }

  handleRemoveService(serviceId) {
    this.state.removeLineItem(serviceId);
    this.updateAllForms();
  }

  handleNotesChange(data) {
    this.state.updateNotes(data);
    this.updateAllForms();
  }

  handleAddComment(comment) {
    const currentState = this.state.getState();
    const updatedComments = [...(currentState.notes?.comments || []), comment];
    this.state.updateNotes({
      ...currentState.notes,
      comments: updatedComments
    });
    this.updateAllForms();
  }

  updateAllForms() {
    // Re-render all React components with updated state
    this.renderInvoiceEditor();
    setTimeout(() => {
      this.initFormContainers();
    }, 100);
  }

  showPreview() {
    // TODO: Open preview modal or new tab
    console.log('Show preview requested');
  }

  printInvoice() {
    // Use existing print functionality
    if (window.printInvoice) {
      window.printInvoice();
    }
  }

  exportPDF() {
    // Use existing PDF functionality
    if (window.generatePDF) {
      window.generatePDF();
    }
  }

  emailInvoice() {
    // Use existing email functionality
    if (window.composeEmail) {
      window.composeEmail(this.state, this.userManager);
    }
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

  initSidebarNavigation() {
    console.log('🔍 Initializing sidebar navigation...');

    // Find all sidebar navigation items
    const sidebarNavItems = document.querySelectorAll('.sidebar__nav-item');
    console.log('📊 Navigation items found:', sidebarNavItems.length);

    if (sidebarNavItems.length === 0) {
      console.error('❌ No sidebar navigation items found');
      return;
    }

    sidebarNavItems.forEach((navItem, index) => {
      const title = navItem.getAttribute('title');
      console.log(`  - Nav item ${index}: title="${title}"`);

      // Add click handler to each navigation item
      navItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log(`🔄 Navigation clicked: "${title}"`);
        this.handleSidebarNavigation(title, navItem);
      });
    });

    console.log('✅ Sidebar navigation initialization complete');
  }

  handleSidebarNavigation(title, navItem) {
    console.log(`🧭 Handling navigation to: ${title}`);

    // Handle different navigation destinations
    switch (title) {
      case 'Customers':
        this.navigateToCustomers();
        break;
      case 'Invoices':
        this.navigateToInvoices();
        break;
      case 'Vessels':
        this.navigateToVessels();
        break;
      case 'Reports':
        this.navigateToReports();
        break;
      case 'Settings':
        this.navigateToSettings();
        break;
      default:
        console.warn(`⚠️ Unknown navigation target: ${title}`);
    }
  }

  async navigateToCustomers() {
    console.log('👥 Navigating to Customers page...');

    try {
      // Check for unsaved changes before navigation
      if (this.unsavedChangesManager && this.unsavedChangesManager.hasUnsavedChanges) {
        console.log('⚠️ Unsaved changes detected, showing dialog...');

        // Use navigation protection to handle unsaved changes
        const shouldProceed = await this.handleUnsavedChangesBeforeNavigation();
        if (!shouldProceed) {
          console.log('❌ Navigation cancelled due to unsaved changes');
          return;
        }
      }

      // Add loading state
      const navItem = document.querySelector('a[title="Customers"]');
      if (navItem) {
        navItem.style.opacity = '0.6';
        navItem.style.pointerEvents = 'none';
      }

      // Navigate to customers page
      console.log('🚀 Navigating to /customers...');
      window.location.href = '/customers';

    } catch (error) {
      console.error('❌ Error navigating to customers:', error);

      // Reset navigation item state
      const navItem = document.querySelector('a[title="Customers"]');
      if (navItem) {
        navItem.style.opacity = '';
        navItem.style.pointerEvents = '';
      }

      // Show error message
      this.showNotification('Failed to navigate to customers page', 'error');
    }
  }

  async navigateToInvoices() {
    console.log('📄 Navigating to Invoices page...');

    try {
      // Check for unsaved changes before navigation
      if (this.unsavedChangesManager && this.unsavedChangesManager.hasUnsavedChanges) {
        console.log('⚠️ Unsaved changes detected, showing dialog...');

        const shouldProceed = await this.handleUnsavedChangesBeforeNavigation();
        if (!shouldProceed) {
          console.log('❌ Navigation cancelled due to unsaved changes');
          return;
        }
      }

      // Add loading state
      const navItem = document.querySelector('a[title="Invoices"]');
      if (navItem) {
        navItem.style.opacity = '0.6';
        navItem.style.pointerEvents = 'none';
      }

      // Navigate to invoices page
      console.log('🚀 Navigating to /invoices...');
      window.location.href = '/invoices';

    } catch (error) {
      console.error('❌ Error navigating to invoices:', error);

      // Reset navigation item state
      const navItem = document.querySelector('a[title="Invoices"]');
      if (navItem) {
        navItem.style.opacity = '';
        navItem.style.pointerEvents = '';
      }

      // Show error message
      this.showNotification('Failed to navigate to invoices page', 'error');
    }
  }

  async navigateToVessels() {
    console.log('🚢 Navigating to Vessels page...');

    try {
      // Check for unsaved changes before navigation
      if (this.unsavedChangesManager && this.unsavedChangesManager.hasUnsavedChanges) {
        console.log('⚠️ Unsaved changes detected, showing dialog...');

        const shouldProceed = await this.handleUnsavedChangesBeforeNavigation();
        if (!shouldProceed) {
          console.log('❌ Navigation cancelled due to unsaved changes');
          return;
        }
      }

      // Add loading state
      const navItem = document.querySelector('a[title="Vessels"]');
      if (navItem) {
        navItem.style.opacity = '0.6';
        navItem.style.pointerEvents = 'none';
      }

      // Navigate to vessels page
      console.log('🚀 Navigating to /vessels...');
      window.location.href = '/vessels';

    } catch (error) {
      console.error('❌ Error navigating to vessels:', error);

      // Reset navigation item state
      const navItem = document.querySelector('a[title="Vessels"]');
      if (navItem) {
        navItem.style.opacity = '';
        navItem.style.pointerEvents = '';
      }

      // Show error message
      this.showNotification('Failed to navigate to vessels page', 'error');
    }
  }

  navigateToReports() {
    console.log('⚠️ Reports page not implemented yet');
    this.showNotification('Reports page coming soon', 'info');
  }

  navigateToSettings() {
    console.log('⚙️ Opening settings modal');
    if (this.settingsModal) {
      this.settingsModal.show();
    }
  }

  async handleUnsavedChangesBeforeNavigation() {
    return new Promise((resolve) => {
      if (this.unsavedChangesDialog) {
        this.unsavedChangesDialog.showNavigationDialog(
          (action) => {
            if (action === 'save') {
              // Try to save, then navigate
              this.saveInvoice().then(() => {
                resolve(true);
              }).catch(() => {
                resolve(false);
              });
            } else if (action === 'discard') {
              // Discard changes and navigate
              resolve(true);
            } else {
              // Cancel navigation
              resolve(false);
            }
          }
        );
      } else {
        // No dialog available, proceed
        resolve(true);
      }
    });
  }

  showNotification(message, type = 'info') {
    // Simple notification implementation
    console.log(`📢 ${type.toUpperCase()}: ${message}`);

    // Create and show a simple toast notification
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 6px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      transition: all 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
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
    
    // Expose debug functions to window for troubleshooting
    window.debugApp = {
      invoiceStorage: app.invoiceStorage,
      userManager: app.userManager,
      sidebar: app.sidebar,
      forceRefresh: () => {
        console.log('🔄 Force refreshing invoices...');
        app.invoiceStorage.forceMigrationAndRefresh();
      },
      syncFromServer: async () => {
        console.log('📥 Manually syncing from server...');
        await app.invoiceStorage.syncFromServer();
        console.log('✅ Sync complete - check sidebar');
      },
      showInvoices: () => {
        const invoices = app.invoiceStorage.getAllInvoices();
        console.log('📦 Total invoices in localStorage:', invoices.length);
        console.table(invoices.map(inv => ({
          title: inv.title,
          userId: inv.userId,
          userEmail: inv.userEmail,
          status: inv.status,
          createdAt: inv.createdAt
        })));
        return invoices;
      },
      checkStorage: () => {
        // Direct localStorage check
        const raw = localStorage.getItem('marine_invoices');
        const invoices = raw ? JSON.parse(raw) : [];
        console.log('🗄️ Direct localStorage check:');
        console.log('Total invoices:', invoices.length);
        invoices.forEach((inv, i) => {
          console.log(`${i+1}. ${inv.title} - User: ${inv.userId || 'none'} - Email: ${inv.userEmail || 'none'}`);
        });
        return invoices;
      },
      currentUser: () => {
        const user = app.userManager.getCurrentUser();
        console.log('Current user:', user);
        return user;
      }
    };
    console.log('💡 Debug functions available: window.debugApp.forceRefresh(), window.debugApp.showInvoices(), window.debugApp.currentUser()');
    
    // App initialization completed successfully
    
    
    // Debug tools will be added after successful authentication
    
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    console.error(error.stack);
  }
  // Temporarily disabled formatters due to conflicts
  // initializeFormatters();
});

// REMOVED: Old simple save method that always created new invoices
// This was causing the bug where edit mode would create duplicates instead of updating
// The correct saveInvoice method with edit mode support is defined below (around line 800)

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

/**
 * Initialize the unsaved changes warning system
 */
InvoiceApp.prototype.initUnsavedChangesSystem = function() {
  console.log('🛡️ Initializing unsaved changes warning system...');

  try {
    // Create unsaved changes dialog
    this.unsavedChangesDialog = new UnsavedChangesDialog();

    // Create unsaved changes manager
    this.unsavedChangesManager = new UnsavedChangesManager(this.state, this.invoiceStorage);

    // Create navigation protection
    this.navigationProtection = new NavigationProtection(this.unsavedChangesManager, this.unsavedChangesDialog);

    // Integrate with InvoiceState
    this.state.setUnsavedChangesManager(this.unsavedChangesManager);

    // Integrate with UserManager for logout protection
    this.userManager.setUnsavedChangesIntegration(this.unsavedChangesManager, this.unsavedChangesDialog);

    // Subscribe to unsaved changes for UI updates
    this.unsavedChangesManager.subscribe((changeData) => {
      this.updateUnsavedChangesUI(changeData);
    });

    console.log('✅ Unsaved changes warning system initialized');
  } catch (error) {
    console.error('❌ Error initializing unsaved changes system:', error);
  }
};

/**
 * Update UI based on unsaved changes state
 * @param {Object} changeData - Change data from UnsavedChangesManager
 */
InvoiceApp.prototype.updateUnsavedChangesUI = function(changeData) {
  const { hasUnsavedChanges, changesSummary } = changeData;

  // Update save button appearance
  const saveBtn = document.getElementById('save-invoice');
  if (saveBtn) {
    if (hasUnsavedChanges) {
      saveBtn.classList.add('has-unsaved-changes');
      saveBtn.title = `Save invoice (${changesSummary.changes.join(', ')} changed)`;
    } else {
      saveBtn.classList.remove('has-unsaved-changes');
      saveBtn.title = this.state.getIsEditMode() ? 'Update invoice' : 'Save invoice';
    }
  }

  // Update any other UI indicators as needed
  this.updatePageTitle(hasUnsavedChanges);
};

/**
 * Update page title to show unsaved changes indicator
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 */
InvoiceApp.prototype.updatePageTitle = function(hasUnsavedChanges) {
  const baseTitle = 'Marine Group - Invoice Generator';
  const isEditMode = this.state.getIsEditMode();

  if (hasUnsavedChanges) {
    document.title = `● ${isEditMode ? 'Editing' : 'Creating'} Invoice - Marine Group`;
  } else if (isEditMode) {
    document.title = `✏️ Editing Invoice - Marine Group`;
  } else {
    document.title = baseTitle;
  }
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

InvoiceApp.prototype.createNewInvoice = async function() {
  console.log('🆕 App createNewInvoice called');

  // Check for unsaved changes using the new system
  if (this.state.hasUnsavedChanges && this.state.hasUnsavedChanges()) {
    console.log('⚠️ New invoice creation blocked due to unsaved changes');

    // The NavigationProtection system will handle this automatically
    // when the button is clicked, so we shouldn't reach here normally.
    // This is a fallback for programmatic calls
    const changesSummary = this.state.getUnsavedChangesSummary();

    if (this.unsavedChangesDialog) {
      const action = await this.unsavedChangesDialog.show({
        type: 'navigation',
        title: 'Create New Invoice?',
        message: 'You have unsaved changes. What would you like to do before creating a new invoice?',
        changes: changesSummary.changes,
        saveText: 'Save & Continue',
        discardText: 'Discard Changes',
        cancelText: 'Cancel'
      });

      if (action === 'save') {
        try {
          await this.saveInvoice();
          // Continue with new invoice creation after save
        } catch (error) {
          console.error('❌ Error saving before new invoice:', error);
          return; // Cancel if save failed
        }
      } else if (action === 'cancel') {
        return; // User cancelled
      }
      // If discard, continue with creation
    } else {
      // Fallback to simple confirm if dialog not available
      if (!confirm('Create a new invoice? Any unsaved changes will be lost.')) {
        return;
      }
    }
  }

  // Reset the state (this already calls clearEditMode internally)
  this.state.reset();

  // Clear saved state since we're creating a new invoice
  this.invoiceStorage.clearSavedState();

  // Ensure edit mode is completely cleared
  this.state.clearEditMode();
  
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
    // Check if we're in edit mode FIRST
    const currentInvoiceId = this.state.getCurrentInvoiceId();
    const isEditMode = this.state.getIsEditMode();

    let title = null;
    if (!isEditMode) {
      // Only prompt for name when creating NEW invoices
      title = await this.promptModal.show('Save Invoice', 'Enter a name for this invoice:', 'Untitled Invoice');
      if (title === null) return; // User cancelled
    }

    const finalTitle = title ? title.trim() || 'Untitled Invoice' : null;

    let id;
    let actionMessage;

    if (isEditMode && currentInvoiceId) {
      // Edit mode - update existing invoice
      console.log('💾 Edit mode: Updating existing invoice:', currentInvoiceId);
      id = await this.invoiceStorage.updateExistingInvoice(currentInvoiceId, currentState, finalTitle);
      actionMessage = 'Invoice updated successfully!';
    } else {
      // Create mode - save new invoice
      console.log('💾 Create mode: Saving new invoice');
      id = await this.invoiceStorage.saveInvoice(currentState, finalTitle);
      actionMessage = 'Invoice saved successfully!';

      // Enter edit mode for the newly created invoice
      this.state.setCurrentInvoiceId(id);
    }

    if (id) {
      // Mark changes as saved after successful save
      if (this.state.markAsSaved) {
        this.state.markAsSaved();
      }

      await this.promptModal.showAlert('Success', actionMessage);
      this.sidebar.refreshInvoiceList();
    } else {
      await this.promptModal.showAlert('Error', 'Failed to save invoice');
    }
  } catch (error) {
    console.error('Error saving invoice:', error);
    await this.promptModal.showAlert('Error', 'Error saving invoice: ' + error.message);
  }
};

// Restore edit session from previous page load
InvoiceApp.prototype.restoreEditSession = async function() {
  console.log('🔄 Checking for previous edit session...');

  // First restore the edit state from session storage
  const restoredInvoiceId = this.state.restoreEditState();

  if (restoredInvoiceId) {
    console.log('📂 Found previous edit session, attempting to restore invoice:', restoredInvoiceId);

    try {
      // Load the invoice data
      const invoice = await this.invoiceStorage.loadInvoice(restoredInvoiceId);

      if (invoice) {
        console.log('✅ Successfully restored invoice for editing:', invoice.title);

        // Populate form components with the restored data
        if (this.vesselForm) {
          this.vesselForm.populate(invoice.data.vessel);
        }
        if (this.customerForm) {
          this.customerForm.populate(invoice.data.customer);
        }
        if (this.scopeForm) {
          this.scopeForm.populate(invoice.data.scope);
        }

        // 🔧 PHASE 3 FIX: Set the saved state to prevent false "unsaved changes" warnings
        // Increased delay to ensure all components are fully populated
        setTimeout(() => {
          const finalState = this.state.getState();

          console.log('🔧 PHASE 3 BASELINE: Setting baseline after invoice restore');
          console.log(`  - Invoice ID: ${restoredInvoiceId}`);
          console.log(`  - Vessel name: "${finalState.vessel?.name || ''}"`);
          console.log(`  - Customer name: "${finalState.customer?.customerName || ''}"`);
          console.log(`  - Line items count: ${finalState.scope?.lineItems?.length || 0}`);

          this.invoiceStorage.setSavedState(finalState);

          // CRITICAL: Mark as saved in UnsavedChangesManager AFTER invoice data is loaded
          if (this.unsavedChangesManager) {
            this.unsavedChangesManager.markAsSaved();
            console.log('🔧 PHASE 3 FIX: markAsSaved called AFTER invoice load completion');
          }

          console.log('✅ Edit session restored successfully');
        }, 300); // Increased from 100ms to 300ms for better timing
      } else {
        console.warn('⚠️ Could not load invoice for restored session, clearing edit state');
        this.state.clearEditMode();
      }
    } catch (error) {
      console.error('❌ Error restoring edit session:', error);
      this.state.clearEditMode();
    }
  } else {
    console.log('ℹ️ No previous edit session found, starting in create mode');

    // 🔧 PHASE 3 FIX: For new invoices, set baseline after a short delay to ensure components are ready
    setTimeout(() => {
      if (this.unsavedChangesManager) {
        console.log('🔧 PHASE 3 BASELINE: Setting baseline for new invoice');
        this.unsavedChangesManager.markAsSaved();
        console.log('🔧 PHASE 3 FIX: markAsSaved called for new invoice baseline');
      }
    }, 300); // Increased from 100ms to 300ms for consistency
  }
};
