export class ThemeManager {
  constructor(userManager) {
    this.userManager = userManager;
    this.currentTheme = 'dark'; // Default theme
    this.storageKey = 'marine_invoice_theme';
    
    this.loadTheme();
    this.setupUserListener();
  }
  
  setupUserListener() {
    // Listen for user changes to sync theme preferences
    this.userManager.subscribe((user) => {
      if (user && user.preferences && user.preferences.theme) {
        this.setTheme(user.preferences.theme, false); // Don't save to user prefs to avoid loop
      }
    });
  }
  
  loadTheme() {
    // Load theme from localStorage or user preferences
    const currentUser = this.userManager.getCurrentUser();
    
    if (currentUser && currentUser.preferences && currentUser.preferences.theme) {
      this.currentTheme = currentUser.preferences.theme;
    } else {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.currentTheme = stored;
      }
    }
    
    this.applyTheme();
  }
  
  setTheme(theme, saveToUserPrefs = true) {
    if (!['light', 'dark'].includes(theme)) {
      console.warn('Invalid theme:', theme);
      return;
    }
    
    this.currentTheme = theme;
    this.applyTheme();
    
    // Save to localStorage
    localStorage.setItem(this.storageKey, theme);
    
    // Save to user preferences if logged in
    if (saveToUserPrefs && this.userManager.isAuthenticated()) {
      this.userManager.updatePreferences({ theme });
    }
  }
  
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    
    // Update any theme-aware components
    this.notifyThemeChange();
  }
  
  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }
  
  getCurrentTheme() {
    return this.currentTheme;
  }
  
  isLightMode() {
    return this.currentTheme === 'light';
  }
  
  isDarkMode() {
    return this.currentTheme === 'dark';
  }
  
  // Notify components of theme changes
  notifyThemeChange() {
    const event = new CustomEvent('themechange', {
      detail: { theme: this.currentTheme }
    });
    document.dispatchEvent(event);
  }
  
  // Get theme-appropriate colors for dynamic content
  getThemeColors() {
    const colors = {
      light: {
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#1a1a1a',
        textSecondary: '#6b7280',
        border: '#e5e7eb',
        accent: '#3b82f6'
      },
      dark: {
        background: '#212121',
        surface: '#2a2a2a',
        text: '#ececf1',
        textSecondary: '#c5c5d2',
        border: '#424242',
        accent: '#19c37d'
      }
    };
    
    return colors[this.currentTheme];
  }
}