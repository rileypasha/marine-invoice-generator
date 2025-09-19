/**
 * Customers Entry Point - Initialize customer directory page
 * 🔧 PHASE 3 STABILIZATION: Enhanced initialization with comprehensive error handling
 */
import { CustomersPage } from './components/CustomersPage.js';

// 🔧 PHASE 3 STABILIZATION: Enhanced state management
const CustomerManager = {
  instance: null,
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

      // 🔧 STABILIZATION: Initialize with enhanced error handling
      await this.createCustomersPage();

      this.initialized = true;
      console.log('🎉 Customer Directory initialization complete');

    } catch (error) {
      console.error(`❌ Initialization attempt ${this.initializationAttempts} failed:`, error);
      await this.handleInitializationError(error);
    }
  },

  async validateAuthentication() {
    try {
      // Check localStorage
      const storedUser = localStorage.getItem('marine_invoice_user');
      const storedSession = localStorage.getItem('marine_invoice_session');

      if (!storedUser || !storedSession) {
        return { valid: false, reason: 'No stored authentication data' };
      }

      const user = JSON.parse(storedUser);
      const session = JSON.parse(storedSession);

      // Validate user data
      if (!user.id || !user.email) {
        return { valid: false, reason: 'Invalid user data structure' };
      }

      // Check session expiry
      const now = Date.now();
      const sessionAge = now - session.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge > maxAge) {
        return { valid: false, reason: 'Session expired' };
      }

      // Validate with server if possible
      try {
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const serverAuth = await response.json();
          if (serverAuth.authenticated) {
            console.log('✅ Server authentication confirmed');
            return { valid: true, user: serverAuth.user || user, source: 'server' };
          }
        }
      } catch (serverError) {
        console.warn('⚠️ Server auth check failed, using localStorage:', serverError.message);
      }

      // Fallback to localStorage validation
      return { valid: true, user, source: 'localStorage' };

    } catch (error) {
      console.error('❌ Authentication validation error:', error);
      return { valid: false, reason: `Validation error: ${error.message}` };
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

  async createCustomersPage() {
    try {
      // Clean up any existing instance
      if (this.instance && typeof this.instance.destroy === 'function') {
        console.log('🧹 Cleaning up existing instance');
        this.instance.destroy();
      }

      // Create new instance
      this.instance = new CustomersPage({
        containerId: 'customers-page',
        maxRetries: 3,
        retryDelay: 1000
      });

      // Make globally available for onclick handlers
      window.customersPage = this.instance;

      // Add health monitoring
      this.setupHealthMonitoring();

      console.log('✅ CustomersPage instance created');

    } catch (error) {
      console.error('❌ Failed to create CustomersPage:', error);
      throw error;
    }
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