/**
 * Customers Entry Point - Initialize customer directory page
 * 🔧 PHASE 3 STABILIZATION: Enhanced initialization with comprehensive error handling
 * ✨ MAGIC UI INTEGRATION: React components with Magic UI styling
 */
import '../styles/main.css';
import { configureSidebar } from './components/sharedSidebar.js';
import { initializeReactSettings } from '../react/components/SettingsProvider.jsx';

// React imports for Magic UI integration
import React from 'react';
import { createRoot } from 'react-dom/client';
import CustomersPageUI from '../react/pages/CustomersPageUI.jsx';

// 🔧 PHASE 3 STABILIZATION: Enhanced state management
const CustomerManager = {
  instance: null,
  reactRoot: null,
  customers: [],
  searchQuery: '',
  isLoading: false,
  initialized: false,
  initializationAttempts: 0,
  maxAttempts: 3,

  async initialize() {
    this.initializationAttempts++;
    console.log(`🎯 PHASE 3: Initializing Customer Directory (attempt ${this.initializationAttempts})...`);

    try {
      // 🛡️ DEFENSIVE: Comprehensive authentication check
      const authResult = await this.validateAuthentication();
      if (!authResult.valid) {
        console.log(`🚫 Authentication failed: ${authResult.reason}`);
        this.redirectToLogin(authResult.reason);
        return;
      }

      console.log('✅ Authentication validated:', authResult.user.email);

      // 🛡️ DEFENSIVE: Validate environment
      const envResult = this.validateEnvironment();
      if (!envResult.valid) {
        console.error(`❌ Environment validation failed: ${envResult.reason}`);
        this.handleEnvironmentError(envResult);
        return;
      }

      console.log('✅ Environment validated');

      configureSidebar('customers');

      // Initialize React settings
      initializeReactSettings();

      // ✨ MAGIC UI: Initialize React-based UI with Magic UI components
      await this.createReactCustomersPage();

      this.initialized = true;
      console.log('🎉 Customer Directory initialization complete');

    } catch (error) {
      console.error(`❌ Initialization attempt ${this.initializationAttempts} failed:`, error);
      await this.handleInitializationError(error);
    }
  },

  async validateAuthentication() {
    try {
      console.log('🔍 CUSTOMERS: Checking server session authentication...');

      // Check server session only - NO localStorage fallback
      const response = await fetch('/api/simple-auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      console.log('📡 CUSTOMERS: Session check response:', response.status);

      if (response.ok) {
        const serverAuth = await response.json();
        if (serverAuth.authenticated && serverAuth.user) {
          console.log('✅ CUSTOMERS: Server session valid:', serverAuth.user.email);
          return { valid: true, user: serverAuth.user };
        }
      }

      console.log('🚫 CUSTOMERS: No valid server session found');
      return { valid: false, reason: 'Server session authentication required' };

    } catch (error) {
      console.error('❌ CUSTOMERS: Authentication check error:', error);
      return { valid: false, reason: 'Authentication service unavailable' };
    }
  },

  validateEnvironment() {
    try {
      // Check required globals
      if (typeof window === 'undefined') {
        return { valid: false, reason: 'Window object not available' };
      }

      if (typeof document === 'undefined') {
        return { valid: false, reason: 'Document object not available' };
      }

      // Check DOM readiness
      if (document.readyState === 'loading') {
        return { valid: false, reason: 'DOM still loading' };
      }

      // Check for required container
      const container = document.getElementById('customers-page');
      if (!container) {
        console.warn('⚠️ Target container not found, will be created');
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, reason: `Environment check failed: ${error.message}` };
    }
  },

  async createReactCustomersPage() {
    try {
      // Clean up any existing React root
      if (this.reactRoot) {
        console.log('🧹 Cleaning up existing React root');
        this.reactRoot.unmount();
        this.reactRoot = null;
      }

      // Create React root
      const container = document.getElementById('customers-page');
      if (!container) {
        throw new Error('Container #customers-page not found');
      }

      this.reactRoot = createRoot(container);

      // Load initial customer data
      await this.loadCustomers();

      // Render React component with Magic UI
      this.renderReactUI();

      // Add health monitoring
      this.setupHealthMonitoring();

      console.log('✅ React CustomersPage with Magic UI created');

    } catch (error) {
      console.error('❌ Failed to create React CustomersPage:', error);
      throw error;
    }
  },

  renderReactUI() {
    if (!this.reactRoot) return;

    this.reactRoot.render(
      React.createElement(CustomersPageUI, {
        customers: this.customers,
        searchQuery: this.searchQuery,
        isLoading: this.isLoading,
        onSearch: (query) => this.handleSearch(query),
        onEdit: (customer) => this.handleEdit(customer),
        onDelete: (customer) => this.handleDelete(customer),
        onAddNew: () => this.handleAddNew(),
        onImport: () => this.handleImport()
      })
    );
  },

  async loadCustomers() {
    this.isLoading = true;
    this.renderReactUI();

    try {
      const response = await fetch('/api/customers', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        // API returns { customers: [...], pagination: {...} }
        this.customers = Array.isArray(data.customers) ? data.customers : [];
        console.log(`✅ Loaded ${this.customers.length} customers`);
      } else {
        console.warn('⚠️ Failed to load customers, using empty array');
        this.customers = [];
      }
    } catch (error) {
      console.warn('⚠️ Error loading customers:', error);
      this.customers = [];
    }

    this.isLoading = false;
    this.renderReactUI();
  },

  handleSearch(query) {
    this.searchQuery = query;
    // Filter customers based on search query
    // For now, just re-render. In production, you'd implement proper filtering
    this.renderReactUI();
  },

  handleEdit(customer) {
    console.log('Edit customer:', customer);
    // TODO: Implement edit modal/form
  },

  handleDelete(customer) {
    console.log('Delete customer:', customer);
    // TODO: Implement delete confirmation
  },

  handleAddNew() {
    console.log('Add new customer');
    // TODO: Implement add customer modal/form
  },

  handleImport() {
    console.log('Import customers');
    // TODO: Implement CSV import functionality
  },

  setupHealthMonitoring() {
    // Monitor instance health
    const healthCheck = () => {
      if (!this.instance) return;

      const health = this.instance.getHealthStatus();
      if (!health.isHealthy) {
        console.warn('⚠️ CustomersPage health check failed:', health);

        // Attempt recovery if needed
        if (health.lastError && this.initializationAttempts < this.maxAttempts) {
          console.log('🔄 Attempting recovery...');
          setTimeout(() => this.initialize(), 2000);
        }
      }
    };

    // Run health check every 30 seconds
    setInterval(healthCheck, 30000);
  },

  redirectToLogin(reason) {
    console.log(`🔄 Redirecting to login: ${reason}`);

    // Clear invalid auth data
    localStorage.removeItem('marine_invoice_user');
    localStorage.removeItem('marine_invoice_session');

    // Add reason to URL for user feedback
    const params = new URLSearchParams({ auth_required: 'true', reason });
    window.location.href = `/?${params}`;
  },

  handleEnvironmentError(envResult) {
    console.error('🔧 Environment error:', envResult);

    // Show error message to user
    document.body.innerHTML = `
      <div class="environment-error">
        <h1>Environment Error</h1>
        <p>The page environment is not compatible:</p>
        <p><strong>${envResult.reason}</strong></p>
        <button onclick="window.location.reload()">Reload Page</button>
      </div>
    `;
  },

  async handleInitializationError(error) {
    console.error('🔧 Handling initialization error:', error);

    if (this.initializationAttempts < this.maxAttempts) {
      console.log(`🔄 Retrying initialization in 2 seconds (attempt ${this.initializationAttempts + 1}/${this.maxAttempts})`);

      setTimeout(() => {
        this.initialize();
      }, 2000);
    } else {
      console.error('❌ Max initialization attempts reached, showing error page');
      this.showFatalError(error);
    }
  },

  showFatalError(error) {
    const errorHTML = `
      <div class="fatal-error">
        <h1>Failed to Load Customer Directory</h1>
        <p>The customer directory could not be initialized after multiple attempts.</p>
        <details>
          <summary>Error Details</summary>
          <pre>${error.message}\n\n${error.stack}</pre>
        </details>
        <div class="error-actions">
          <button onclick="window.location.reload()">Reload Page</button>
          <button onclick="window.location.href='/'">Go to Home</button>
          <button onclick="CustomerManager.initialize()">Try Again</button>
        </div>
      </div>
    `;

    document.body.innerHTML = errorHTML;
  }
};

// 🔧 PHASE 3 STABILIZATION: Enhanced mobile menu with error handling
function toggleMobileMenu() {
  try {
    const sidebar = document.querySelector('.page-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('page-sidebar--open');
    } else {
      console.warn('⚠️ Mobile menu: Sidebar not found');
    }
  } catch (error) {
    console.error('❌ Mobile menu toggle error:', error);
  }
}

// Enhanced click outside handler with error protection
function setupMobileMenuHandlers() {
  try {
    document.addEventListener('click', (e) => {
      try {
        const sidebar = document.querySelector('.page-sidebar');
        if (!sidebar) return;

        const isClickInside = sidebar.contains(e.target);
        if (!isClickInside && window.innerWidth <= 1024) {
          sidebar.classList.remove('page-sidebar--open');
        }
      } catch (error) {
        console.error('❌ Mobile menu click handler error:', error);
      }
    });
  } catch (error) {
    console.error('❌ Mobile menu setup error:', error);
  }
}

// 🔧 PHASE 3 STABILIZATION: Enhanced initialization with multiple triggers
function initializeWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CustomerManager.initialize());
  } else {
    // DOM already loaded
    CustomerManager.initialize();
  }
}

// Initialize mobile menu handlers
setupMobileMenuHandlers();

// Start initialization
initializeWhenReady();

// Export for global access
window.toggleMobileMenu = toggleMobileMenu;

// Global exposure for debugging and manual recovery
window.CustomerManager = CustomerManager;

// 🔧 PHASE 3 STABILIZATION: Global error handling for customers page
window.addEventListener('error', (event) => {
  console.error('🔧 Global error in customers page:', event.error);

  if (CustomerManager && typeof CustomerManager.handleInitializationError === 'function') {
    CustomerManager.handleInitializationError(event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🔧 Unhandled promise rejection in customers page:', event.reason);

  if (CustomerManager && typeof CustomerManager.handleInitializationError === 'function') {
    CustomerManager.handleInitializationError(new Error(event.reason));
  }
});
