import '../styles/main.css';
import '../styles/enhanced-sidebar.css';
import '../styles/globals.css';
import { VesselsPage } from './components/VesselsPage.js';
import { configureSidebar } from './components/sharedSidebar.js';

// React imports for Magic UI integration
import React from 'react';
import { createRoot } from 'react-dom/client';
import VesselsPageUI from '../react/pages/VesselsPageUI.jsx';

class VesselsApp {
  constructor() {
    console.log('🏗️ VESSELS DEBUG: VesselsApp constructor started');
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
    console.log('✅ VESSELS DEBUG: VesselsApp constructor completed successfully');
  }

  async initialize() {
    console.log('🚀 VESSELS DEBUG: VesselsApp initialize started');
    try {
      console.log('🔐 VESSELS DEBUG: About to check authentication...');
      const authResult = await checkAuthentication(); // Use standalone function like invoices.js

      console.log('🔍 VESSELS DEBUG: Authentication result:', authResult);

      if (!authResult.valid) {
        console.log('🚫 VESSELS DEBUG: Authentication failed, redirecting to login...');
        window.location.href = '/working-login';
        return;
      }

      console.log('✅ VESSELS DEBUG: Authentication successful for user:', authResult.user.email);

      // CRITICAL FIX: Only create UserManager AFTER successful authentication
      console.log('🎯 VESSELS DEBUG: Creating UserManager after successful auth...');
      const { UserManager } = await import('./auth/UserManager.js');
      this.userManager = new UserManager();
      this.userManager.currentUser = authResult.user;
      this.userManager.notify();
      console.log('✅ VESSELS DEBUG: UserManager created and configured');

      console.log('🎨 VESSELS DEBUG: About to create React vessels page...');
      await this.createReactVesselsPage();
      console.log('✅ VESSELS DEBUG: React vessels page created');

      console.log('👤 VESSELS DEBUG: Initializing auth UI...');
      this.initAuth(authResult.user);
      console.log('✅ VESSELS DEBUG: Auth UI initialized');

      console.log('🚪 VESSELS DEBUG: Setting up logout handler...');
      this.setupLogoutHandler();
      console.log('✅ VESSELS DEBUG: Logout handler set up');

      console.log('📱 VESSELS DEBUG: Configuring sidebar...');
      configureSidebar('vessels');
      console.log('✅ VESSELS DEBUG: Sidebar configured');

      console.log('🎉 VESSELS DEBUG: VesselsApp initialization completed successfully');

    } catch (error) {
      console.error('❌ VESSELS DEBUG: Failed to initialize VesselsApp:', error);
      console.error('❌ VESSELS DEBUG: Error stack:', error.stack);
      this.showError('Failed to initialize vessel directory');
    }
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
        console.log('🚪 VESSELS DEBUG: Logout button clicked');
        if (this.userManager) {
          console.log('🔐 VESSELS DEBUG: Using UserManager logout');
          await this.userManager.logout();
        } else {
          console.log('🔄 VESSELS DEBUG: No UserManager, redirecting to home');
          window.location.href = '/';
        }
      } catch (error) {
        console.error('❌ VESSELS DEBUG: Logout failed:', error);
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
    console.log('🔍 VESSELS STANDALONE: Checking server session authentication...');

    // Check server session only - NO localStorage fallback
    const response = await fetch('/api/simple-auth/check', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    console.log('📡 VESSELS STANDALONE: Session check response:', response.status);

    if (response.ok) {
      const serverAuth = await response.json();
      console.log('📄 VESSELS STANDALONE: Server response:', serverAuth);
      if (serverAuth.authenticated && serverAuth.user) {
        console.log('✅ VESSELS STANDALONE: Server session valid:', serverAuth.user.email);
        return { valid: true, user: serverAuth.user };
      }
    }

    console.log('🚫 VESSELS STANDALONE: No valid server session found');
    return { valid: false, reason: 'Server session authentication required' };

  } catch (error) {
    console.error('❌ VESSELS STANDALONE: Authentication check error:', error);
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
