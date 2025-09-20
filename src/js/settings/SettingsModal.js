import { PromptModal } from '../components/PromptModal.js';

export class SettingsModal {
  constructor(userManager, themeManager) {
    this.userManager = userManager;
    this.themeManager = themeManager;
    this.isVisible = false;
    this.promptModal = new PromptModal();
    this.createModal();
    this.attachListeners();
  }
  
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'settings-modal';
    this.modal.innerHTML = `
      <div class="settings-modal-overlay">
        <div class="settings-modal-content">
          <div class="settings-header">
            <h2>Settings</h2>
            <button class="settings-close-btn">&times;</button>
          </div>
          
          <div class="settings-body">
            <div class="settings-section">
              <h3>Appearance</h3>
              <div class="setting-item">
                <div class="setting-info">
                  <label>Theme</label>
                  <span class="setting-description">Choose your preferred color scheme</span>
                </div>
                <div class="theme-toggle">
                  <button class="theme-option" data-theme="light">
                    <div class="theme-preview light-preview">
                      <div class="theme-circle"></div>
                      <div class="theme-bars">
                        <div class="theme-bar"></div>
                        <div class="theme-bar"></div>
                        <div class="theme-bar"></div>
                      </div>
                    </div>
                    Light
                  </button>
                  <button class="theme-option active" data-theme="dark">
                    <div class="theme-preview dark-preview">
                      <div class="theme-circle"></div>
                      <div class="theme-bars">
                        <div class="theme-bar"></div>
                        <div class="theme-bar"></div>
                        <div class="theme-bar"></div>
                      </div>
                    </div>
                    Dark
                  </button>
                </div>
              </div>
            </div>
            
            
            <div class="settings-section" id="account-section">
              <h3>Account</h3>
              <div class="setting-item">
                <div class="setting-info">
                  <label>Email</label>
                  <span class="setting-description" id="user-email">Loading...</span>
                </div>
                <button class="setting-btn secondary">Change</button>
              </div>
              
              <div class="setting-item">
                <div class="setting-info">
                  <label>Password</label>
                  <span class="setting-description">••••••••</span>
                </div>
                <button class="setting-btn secondary">Change</button>
              </div>
            </div>
            
            <div class="settings-section">
              <h3>Data</h3>
              <div class="setting-item">
                <div class="setting-info">
                  <label>Export all invoices</label>
                  <span class="setting-description">Download all your invoices as a ZIP file</span>
                </div>
                <button class="setting-btn secondary" id="export-all-btn">Export</button>
              </div>
              
              <div class="setting-item">
                <div class="setting-info">
                  <label>Clear all data</label>
                  <span class="setting-description">This will delete all your invoices and drafts</span>
                </div>
                <button class="setting-btn danger" id="clear-data-btn">Clear Data</button>
              </div>
            </div>
          </div>
          
          <div class="settings-footer">
            <div class="settings-footer-left">
              <button class="setting-btn danger" id="sign-out-btn">Sign Out</button>
            </div>
            <div class="settings-footer-right">
              <button class="setting-btn secondary" id="settings-cancel-btn">Cancel</button>
              <button class="setting-btn primary" id="settings-save-btn">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
  }
  
  attachListeners() {
    // Close modal
    this.modal.querySelector('.settings-close-btn').addEventListener('click', () => {
      this.hide();
    });
    
    this.modal.querySelector('#settings-cancel-btn').addEventListener('click', () => {
      this.hide();
    });
    
    this.modal.querySelector('.settings-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hide();
      }
    });
    
    // Theme switching
    this.modal.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.dataset.theme;
        this.selectTheme(theme);
      });
    });
    
    // Save changes
    this.modal.querySelector('#settings-save-btn').addEventListener('click', () => {
      this.saveSettings();
    });
    
    // Sign out
    this.modal.querySelector('#sign-out-btn').addEventListener('click', () => {
      this.handleSignOut();
    });
    
    // Clear data
    this.modal.querySelector('#clear-data-btn').addEventListener('click', () => {
      this.handleClearData();
    });
    
    // Export all
    this.modal.querySelector('#export-all-btn').addEventListener('click', () => {
      this.handleExportAll();
    });
    
    // Listen for user changes
    this.userManager.subscribe((user) => {
      this.updateUserInfo(user);
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }
  
  selectTheme(theme) {
    // Update visual selection
    this.modal.querySelectorAll('.theme-option').forEach(option => {
      option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    // Apply theme immediately
    this.themeManager.setTheme(theme);
  }
  
  saveSettings() {
    // Save to user preferences
    if (this.userManager.isAuthenticated()) {
      this.userManager.updatePreferences({
        // Settings saved
      });
    }
    
    this.hide();
    
    // Show success message
    this.showNotification('Settings saved successfully', 'success');
  }
  
  async handleSignOut() {
    const confirmed = await this.promptModal.showConfirm(
      'Sign Out',
      'Are you sure you want to sign out?',
      'Yes, Sign Out',
      'Cancel'
    );
    
    if (confirmed) {
      console.log('🔄 User confirmed logout, calling userManager.logout()...');
      this.hide();
      // Call logout directly - it will handle redirect
      this.userManager.logout();
    }
  }
  
  handleClearData() {
    const confirmText = 'DELETE';
    const input = prompt(`This will permanently delete ALL your invoices and drafts. This action cannot be undone.\\n\\nType "${confirmText}" to confirm:`);
    
    if (input === confirmText) {
      // Clear invoice data (will implement with InvoiceStorage)
      localStorage.removeItem('marine_invoices');
      localStorage.removeItem('marine_drafts');
      this.showNotification('All data cleared successfully', 'success');
      this.hide();
    }
  }
  
  handleExportAll() {
    // This will be implemented with InvoiceStorage
    this.showNotification('Export feature coming soon', 'info');
  }
  
  updateUserInfo(user) {
    const emailSpan = this.modal.querySelector('#user-email');
    const accountSection = this.modal.querySelector('#account-section');
    
    if (user) {
      emailSpan.textContent = user.email;
      accountSection.style.display = 'block';
      
      // Update preferences toggles
      // Preferences are handled by theme settings
    } else {
      accountSection.style.display = 'none';
    }
  }
  
  showNotification(message, type = 'info') {
    // Create and show notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
    
    // Manual close
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }
  
  show() {
    this.modal.style.display = 'flex';
    this.isVisible = true;
    
    // Update current theme selection
    const currentTheme = this.themeManager.getCurrentTheme();
    this.selectTheme(currentTheme);
    
    // Update user info
    const currentUser = this.userManager.getCurrentUser();
    this.updateUserInfo(currentUser);
  }
  
  hide() {
    this.modal.style.display = 'none';
    this.isVisible = false;
  }

  // Backward compatibility method
  open() {
    this.show();
  }
}