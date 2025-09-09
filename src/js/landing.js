import '../styles/landing.css';
import '../styles/auth.css';
import { UserManager } from './auth/UserManager.js';
import { AuthModal } from './auth/AuthModal.js';

class LandingPage {
  constructor() {
    console.log('🚀 Initializing Landing Page...');
    
    // Initialize authentication
    this.userManager = new UserManager();
    this.authModal = new AuthModal(this.userManager);
    
    // Check if user is already authenticated
    this.checkAuthentication();
    
    // Initialize event listeners
    this.initEventListeners();
    
    console.log('✅ Landing Page initialized');
  }
  
  async checkAuthentication() {
    try {
      // Check server authentication status
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('👤 User authenticated via server, redirecting to app...');
        // Set the user data directly and notify listeners
        this.userManager.currentUser = userData.user;
        this.userManager.saveSession(true);
        this.userManager.notify();
        this.redirectToApp();
      } else {
        // Don't clear localStorage - just show landing page
        // Users can still have valid localStorage from previous sessions
        console.log('No server authentication found, showing landing page');
      }
    } catch (error) {
      console.log('Authentication check failed, showing landing page:', error);
      // Don't clear localStorage on network errors
    }
  }
  
  redirectToApp() {
    // Redirect to the main application
    window.location.href = '/app';
  }
  
  initEventListeners() {
    // Header navigation buttons
    const signInNavBtn = document.getElementById('sign-in-nav-btn');
    
    // System access buttons
    const getStartedBtn = document.getElementById('get-started-btn');
    
    // Sign in buttons (all buttons now show signin)
    [signInNavBtn, getStartedBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.showAuthModal('signin');
        });
      }
    });
    
    // Listen for successful authentication
    this.userManager.subscribe((user) => {
      if (user) {
        console.log('👤 User authenticated, redirecting to app...');
        setTimeout(() => {
          this.redirectToApp();
        }, 1000); // Small delay to show success state
      }
    });
  }
  
  showAuthModal(mode = 'signup') {
    this.authModal.show(mode);
  }
}

// Initialize landing page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔥 Landing Page DOM loaded, initializing...');
  new LandingPage();
});

// Add global error handler
window.addEventListener('error', (e) => {
  console.error('Landing Page Error:', e.error);
});