/**
 * Landing Page Entry Point - React-based landing page
 * Converted from vanilla JS to pure React implementation
 */
import '../styles/landing.css';
import '../styles/auth.css';
import '../styles/mobile-responsive.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import LandingPageUI from '../react/pages/LandingPageUI.jsx';
import AuthProvider from '../react/context/AuthContext.jsx';

// React app initialization
function initializeLandingPage() {
  console.log('🚀 Initializing React Landing Page...');

  try {
    // Get the container element
    const container = document.getElementById('landing-page');
    if (!container) {
      throw new Error('Landing page container not found');
    }

    // Create React root
    const root = createRoot(container);

    // Render the landing page with auth context
    root.render(
      React.createElement(AuthProvider, {},
        React.createElement(LandingPageUI)
      )
    );

    console.log('✅ React Landing Page initialized successfully');

  } catch (error) {
    console.error('❌ Failed to initialize React Landing Page:', error);

    // Fallback error display
    const container = document.getElementById('landing-page');
    if (container) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444;">
          <h1>Error Loading Landing Page</h1>
          <p>Failed to initialize the application. Please refresh the page.</p>
          <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Reload Page
          </button>
        </div>
      `;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLandingPage);
} else {
  initializeLandingPage();
}

// Global exposure for debugging
window.initializeLandingPage = initializeLandingPage;