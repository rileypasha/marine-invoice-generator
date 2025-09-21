import '../styles/main.css';
import { configureSidebar } from './components/sharedSidebar.js';
import { initializeReactSettings } from '../react/components/SettingsProvider.jsx';

// React imports for Magic UI integration
import React from 'react';
import { createRoot } from 'react-dom/client';
import VesselsPageUI from '../react/pages/VesselsPageUI.jsx';

class VesselsApp {
  constructor() {
    // CRITICAL FIX: Do NOT instantiate UserManager here - it causes localStorage operations
    this.userManager = null; // Will be created AFTER successful authentication
    this.vesselsPage = null;
    this.reactRoot = null;
    this.vessels = [];
    this.searchQuery = '';
    this.isLoading = false;
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalVessels = 0;
    this.pageSize = 25;
  }

  async initialize() {
    try {
      const authResult = await checkAuthentication(); // Use standalone function like invoices.js


      if (!authResult.valid) {
        window.location.href = '/working-login';
        return;
      }


      // CRITICAL FIX: Only create UserManager AFTER successful authentication
      const { UserManager } = await import('./auth/UserManager.js');
      this.userManager = new UserManager();
      this.userManager.currentUser = authResult.user;
      this.userManager.notify();

      await this.createReactVesselsPage();

      this.initAuth(authResult.user);

      this.setupLogoutHandler();

      configureSidebar('vessels');

      initializeReactSettings();


    } catch (error) {
      console.error('Failed to initialize VesselsApp:', error);
      console.error('Error stack:', error.stack);
      this.showError('Failed to initialize vessel directory');
    }
  }

  async createReactVesselsPage() {
    try {
      // Clean up any existing React root
      if (this.reactRoot) {
        this.reactRoot.unmount();
        this.reactRoot = null;
      }

      // Create React root
      const container = document.getElementById('vessels-page');
      if (!container) {
        throw new Error('Container #vessels-page not found');
      }

      this.reactRoot = createRoot(container);

      // Load initial vessel data
      await this.loadVessels();

      // Render React component with Magic UI
      this.renderReactUI();

      console.log('✅ React VesselsPage with Magic UI created');

    } catch (error) {
      console.error('❌ Failed to create React VesselsPage:', error);
      throw error;
    }
  }

  renderReactUI() {
    if (!this.reactRoot) return;

    this.reactRoot.render(
      React.createElement(VesselsPageUI, {
        vessels: this.vessels,
        searchQuery: this.searchQuery,
        isLoading: this.isLoading,
        currentPage: this.currentPage,
        totalPages: this.totalPages,
        totalVessels: this.totalVessels,
        pageSize: this.pageSize,
        onSearch: (query) => this.handleSearch(query),
        onEdit: (vessel) => this.handleEdit(vessel),
        onToggleStatus: (vesselId, currentStatus) => this.handleToggleStatus(vesselId, currentStatus),
        onAddNew: () => this.handleAddNew(),
        onPageChange: (page) => this.handlePageChange(page)
      })
    );
  }

  async loadVessels() {
    this.isLoading = true;
    this.renderReactUI();

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.pageSize,
        active: true
      });

      if (this.searchQuery) {
        params.append('search', this.searchQuery);
      }

      const response = await fetch(`/api/vessels?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        // API returns { vessels: [...], pagination: {...} }
        this.vessels = Array.isArray(data.vessels) ? data.vessels : [];
        this.totalVessels = data.pagination?.total || 0;
        this.totalPages = data.pagination?.pages || 1;
        console.log(`✅ Loaded ${this.vessels.length} vessels`);
      } else {
        console.warn('⚠️ Failed to load vessels, using empty array');
        this.vessels = [];
      }
    } catch (error) {
      console.warn('⚠️ Error loading vessels:', error);
      this.vessels = [];
    }

    this.isLoading = false;
    this.renderReactUI();
  }

  handleSearch(query) {
    this.searchQuery = query;
    this.currentPage = 1;
    this.loadVessels();
  }

  handleEdit(vessel) {
    console.log('Edit vessel:', vessel);
    // TODO: Implement edit modal/form
  }

  handleToggleStatus(vesselId, currentStatus) {
    console.log('Toggle vessel status:', vesselId, currentStatus);
    // TODO: Implement status toggle
  }

  handleAddNew() {
    console.log('Add new vessel');
    // TODO: Implement add vessel modal/form
  }

  handlePageChange(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadVessels();
  }

  initAuth(user) {
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar && user) {
      const nameSource = user.name || user.email || '';
      userAvatar.textContent = nameSource ? nameSource.charAt(0).toUpperCase() : '?';
    }
  }

  setupLogoutHandler() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async () => {
      try {
        if (this.userManager) {
          await this.userManager.logout();
        } else {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Logout failed:', error);
        this.showError('Failed to logout');
      }
    }, { once: false });
  }


  showError(message) {
    const container = document.getElementById('error-container');
    const messageEl = document.getElementById('error-message');
    const closeBtn = document.getElementById('error-close');

    if (!container || !messageEl) {
      alert(message);
      return;
    }

    messageEl.textContent = message;
    container.classList.remove('hidden');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        container.classList.add('hidden');
      }, { once: true });
    }

    setTimeout(() => {
      container.classList.add('hidden');
    }, 5000);
  }
}

function bootstrapVesselsApp() {
  const app = new VesselsApp();
  app.initialize();
  window.vesselsApp = app;
  return app;
}

// Standalone authentication function (like invoices.js)
async function checkAuthentication() {
  try {

    // Check server session only - NO localStorage fallback
    const response = await fetch('/api/simple-auth/check', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });


    if (response.ok) {
      const serverAuth = await response.json();
      if (serverAuth.authenticated && serverAuth.user) {
        return { valid: true, user: serverAuth.user };
      }
    }

    return { valid: false, reason: 'Server session authentication required' };

  } catch (error) {
    console.error('Authentication check error:', error);
    return { valid: false, reason: 'Authentication service unavailable' };
  }
}

// Global exposure for debugging and manual recovery
window.VesselsApp = VesselsApp;
window.checkAuthentication = checkAuthentication;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapVesselsApp);
} else {
  bootstrapVesselsApp();
}
