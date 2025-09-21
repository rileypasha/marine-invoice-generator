/**
 * app.js - Modern React-based Invoice Editor Entry Point
 * Replaces vanilla InvoiceApp class with React architecture
 */
console.log('🔥 Modern React App.js Loading...');

import '../styles/main.css';
import '../styles/mobile-responsive.css';

// React imports
import React from 'react';
import { createRoot } from 'react-dom/client';

// Context providers
import { AuthProvider } from '../react/context/AuthContext.jsx';
import { InvoiceProvider } from '../react/context/InvoiceContext.jsx';

// Main app component
import InvoiceEditorApp from '../react/pages/InvoiceEditorApp.jsx';

// Export utilities
import { generatePDF } from './exports/pdf.js';
import { composeEmail } from './exports/email.js';
import { printInvoice } from './exports/print.js';

/**
 * Modern React-based Invoice App
 */
class ModernInvoiceApp {
  constructor() {
    this.reactRoot = null;
    this.isViewMode = this.detectViewMode();
    this.invoiceId = this.getInvoiceIdFromUrl();

    console.log('🚀 Initializing Modern React Invoice App...');
    console.log('🔍 View mode:', this.isViewMode);
    console.log('📄 Invoice ID:', this.invoiceId);

    this.init();
  }

  /**
   * Detect if we're in view-only mode
   */
  detectViewMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('view') === 'true' || urlParams.has('print');
  }

  /**
   * Get invoice ID from URL parameters
   */
  getInvoiceIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('invoice');
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
        React.createElement(AuthProvider, {},
          React.createElement(InvoiceProvider, {},
            React.createElement(InvoiceEditorApp, {
              isViewMode: this.isViewMode,
              invoiceId: this.invoiceId,
              onExportPDF: this.handleExportPDF.bind(this),
              onComposeEmail: this.handleComposeEmail.bind(this),
              onPrint: this.handlePrint.bind(this)
            })
          )
        )
      );

      // Setup global utilities
      this.setupGlobalUtilities();

      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts();

      console.log('✅ Modern React Invoice App initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Modern React Invoice App:', error);
      this.showError('Failed to initialize invoice editor');
    }
  }

  /**
   * Setup global utilities for backward compatibility
   */
  setupGlobalUtilities() {
    // Make app instance available globally for testing
    window.app = this;

    // Legacy compatibility for addLineItem
    window.addLineItem = function(lineItem) {
      console.warn('⚠️ window.addLineItem is deprecated. Use React context instead.');
      // This could be enhanced to integrate with React context if needed
    };

    console.log('🔧 Global utilities configured');
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+S or Cmd+S - Save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        console.log('💾 Save shortcut triggered');
        // The React component will handle save via context
        return;
      }

      // Ctrl+P or Cmd+P - Print
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        console.log('🖨️ Print shortcut triggered');
        this.handlePrint();
        return;
      }

      // Escape - Cancel/Close modals
      if (event.key === 'Escape') {
        console.log('❌ Escape key pressed');
        // React components will handle this via their own listeners
        return;
      }
    });

    console.log('⌨️ Keyboard shortcuts configured');
  }

  /**
   * Handle PDF export
   */
  async handleExportPDF(invoiceData) {
    try {
      console.log('📄 Exporting PDF...');
      await generatePDF(invoiceData);
      console.log('✅ PDF export completed');
    } catch (error) {
      console.error('❌ PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  }

  /**
   * Handle email composition
   */
  async handleComposeEmail(invoiceData) {
    try {
      console.log('📧 Composing email...');
      await composeEmail(invoiceData);
      console.log('✅ Email composition completed');
    } catch (error) {
      console.error('❌ Email composition failed:', error);
      alert('Failed to compose email. Please try again.');
    }
  }

  /**
   * Handle print
   */
  async handlePrint(invoiceData) {
    try {
      console.log('🖨️ Printing invoice...');

      if (invoiceData) {
        await printInvoice(invoiceData);
      } else {
        // Fallback to browser print
        window.print();
      }

      console.log('✅ Print completed');
    } catch (error) {
      console.error('❌ Print failed:', error);
      alert('Failed to print invoice. Please try again.');
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const container = document.getElementById('app');
    if (container) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444;">
          <h1>Error Loading Invoice Editor</h1>
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
    if (window.app === this) {
      window.app = null;
    }

    console.log('🧹 Modern React Invoice App destroyed');
  }
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ModernInvoiceApp();
  });
} else {
  new ModernInvoiceApp();
}

// Export for testing
export default ModernInvoiceApp;