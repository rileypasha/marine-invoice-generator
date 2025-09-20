import '../styles/globals.css';
import { VesselsPage } from './components/VesselsPage.js';
import { UserManager } from './auth/UserManager.js';
import { configureSidebar } from './components/sharedSidebar.js';

// React imports for Magic UI integration
import React from 'react';
import { createRoot } from 'react-dom/client';
import VesselsPageUI from '../react/pages/VesselsPageUI.jsx';

class VesselsApp {
  constructor() {
    this.userManager = new UserManager();
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
      const authResult = await this.checkAuthentication();
      if (!authResult.valid) {
        console.log('🚫 VesselsApp: authentication required:', authResult.reason);
        this.showAuthModal(authResult.reason);
        return;
      }

      console.log('✅ VesselsApp: authenticated as', authResult.user.email);

      // Initialize React-based Vessels Page with Magic UI
      await this.createReactVesselsPage();
      this.initAuth(authResult.user);
      this.setupLogoutHandler();
      configureSidebar('vessels');

    } catch (error) {
      console.error('❌ Failed to initialize VesselsApp:', error);
      this.showError('Failed to initialize vessel directory');
    }
  }

  async checkAuthentication() {
    try {
      const response = await fetch('/api/simple-auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          this.userManager.currentUser = data.user;
          this.userManager.saveSession(true);
          this.userManager.notify();
          return { valid: true, user: data.user };
        }
      }
    } catch (error) {
      console.warn('⚠️ VesselsApp: server auth check failed, falling back to local session', error);
    }

    // Fallback to local storage state
    const user = this.userManager.getCurrentUser();
    if (user) {
      return { valid: true, user };
    }

    return { valid: false, reason: 'Authentication required' };
  }

  async createReactVesselsPage() {
    try {
      // Clean up any existing React root
      if (this.reactRoot) {
        console.log('🧹 Cleaning up existing React root');
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
        await this.userManager.logout();
      } catch (error) {
        console.error('❌ Logout failed:', error);
        this.showError('Failed to logout');
      }
    }, { once: false });
  }

  showAuthModal(reason) {
    const modal = document.getElementById('auth-modal');
    if (!modal) {
      window.location.href = '/';
      return;
    }

    const message = modal.querySelector('p');
    if (message) {
      message.textContent = reason ? `Please log in to access the vessel directory. (${reason})` : 'Please log in to access the vessel directory.';
    }

    modal.classList.remove('hidden');

    const cancelBtn = document.getElementById('auth-cancel');
    const loginBtn = document.getElementById('auth-login');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.location.href = '/';
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        window.location.href = '/';
      });
    }
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

// Global exposure for debugging and manual recovery
window.VesselsApp = VesselsApp;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapVesselsApp);
} else {
  bootstrapVesselsApp();
}
