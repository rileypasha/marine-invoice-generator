import '../styles/landing.css';
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
      // Check if user is already logged in
      if (this.userManager.isAuthenticated()) {
        console.log('👤 User already authenticated, redirecting to app...');
        this.redirectToApp();
        return;
      }
      
      // Check server authentication status
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('👤 User authenticated via server, redirecting to app...');
        this.userManager.setCurrentUser(userData.user);
        this.redirectToApp();
      }
    } catch (error) {
      console.log('No existing authentication found, showing landing page');
    }
  }
  
  redirectToApp() {
    // Redirect to the main application
    window.location.href = '/app';
  }
  
  initEventListeners() {
    // Header navigation buttons
    const signInNavBtn = document.getElementById('sign-in-nav-btn');
    const signUpNavBtn = document.getElementById('sign-up-nav-btn');
    
    // Hero CTA buttons
    const getStartedBtn = document.getElementById('get-started-btn');
    const learnMoreBtn = document.getElementById('learn-more-btn');
    
    // Final CTA button
    const finalCtaBtn = document.getElementById('final-cta-btn');
    
    // Sign in buttons
    if (signInNavBtn) {
      signInNavBtn.addEventListener('click', () => {
        this.showAuthModal('signin');
      });
    }
    
    // Sign up / Get started buttons
    [signUpNavBtn, getStartedBtn, finalCtaBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.showAuthModal('signup');
        });
      }
    });
    
    // Learn more button - scroll to features
    if (learnMoreBtn) {
      learnMoreBtn.addEventListener('click', () => {
        const featuresSection = document.querySelector('.features-section');
        if (featuresSection) {
          featuresSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    }
    
    // Listen for successful authentication
    this.userManager.onAuthChange((user) => {
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