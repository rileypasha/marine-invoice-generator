/**
 * standalone-app.js - Modern React-based Standalone Invoice Entry Point
 * Replaces vanilla standalone app with React architecture
 */
console.log('🔥 Modern React Standalone App Loading...');

import '../styles/main.css';
import '../styles/mobile-responsive.css';

// React imports
import React from 'react';
import { createRoot } from 'react-dom/client';

// Context providers
import { AuthProvider } from '../react/context/AuthContext.jsx';
import { InvoiceProvider } from '../react/context/InvoiceContext.jsx';

// Main standalone app component
import StandaloneInvoiceApp from '../react/pages/StandaloneInvoiceApp.jsx';

/**
 * Modern React-based Standalone Invoice App
 */
class ModernStandaloneInvoiceApp {
  constructor() {
    this.reactRoot = null;
    this.isStandaloneMode = true;

    console.log('🚀 Initializing Modern React Standalone Invoice App...');
    console.log('📄 Standalone mode: true');

    this.init();
  }

  /**
   * Initialize the React app
   */
  async init() {
    try {
      // Create React root
      const container = document.getElementById('app');
      if (!container) {
        throw new Error('App container not found');
      }

      this.reactRoot = createRoot(container);

      // Render React app with providers
      this.reactRoot.render(
        React.createElement(AuthProvider, { isStandaloneMode: true },
          React.createElement(InvoiceProvider, {},
            React.createElement(StandaloneInvoiceApp, {
              isStandaloneMode: this.isStandaloneMode
            })
          )
        )
      );

      // Setup global utilities for testing
      this.setupGlobalUtilities();

      console.log('✅ Modern React Standalone Invoice App initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Modern React Standalone Invoice App:', error);
      this.showError('Failed to initialize standalone invoice editor');
    }
  }

  /**
   * Setup global utilities for backward compatibility
   */
  setupGlobalUtilities() {
    // Make app instance available globally for testing
    window.standaloneApp = this;

    // Legacy compatibility for addLineItem
    window.addLineItem = function(lineItem) {
      console.warn('⚠️ window.addLineItem is deprecated. Use React context instead.');
      // This could be enhanced to integrate with React context if needed
    };

    console.log('🔧 Standalone global utilities configured');
  }

  /**
   * Show error message
   */
  showError(message) {
    const container = document.getElementById('app');
    if (container) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444;">
          <h1>Error Loading Standalone Invoice Editor</h1>
          <p>${message}</p>
          <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Reload Page
          </button>
        </div>
      `;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }

    // Clean up global references
    if (window.standaloneApp === this) {
      window.standaloneApp = null;
    }

    console.log('🧹 Modern React Standalone Invoice App destroyed');
  }
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ModernStandaloneInvoiceApp();
  });
} else {
  new ModernStandaloneInvoiceApp();
}

// Export for testing
export default ModernStandaloneInvoiceApp;