import '../styles/globals.css';
import { VesselsPage } from './components/VesselsPage.js';
import { UserManager } from './auth/UserManager.js';
import { configureSidebar } from './components/sharedSidebar.js';

class VesselsApp {
  constructor() {
    this.userManager = new UserManager();
    this.vesselsPage = null;
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

      this.initVesselsPage();
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

  initVesselsPage() {
    if (this.vesselsPage && typeof this.vesselsPage.destroy === 'function') {
      this.vesselsPage.destroy();
    }

    this.vesselsPage = new VesselsPage();
    window.vesselsPage = this.vesselsPage;
    console.log('✅ VesselsPage instance created');
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapVesselsApp);
} else {
  bootstrapVesselsApp();
}
