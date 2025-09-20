/**
 * Invoices Entry Point - Initialize invoice directory page
 */

import '../styles/invoices-page.css';
import '../styles/globals.css';
import { InvoicesIndex } from './components/InvoicesIndex.js';
import { configureSidebar } from './components/sharedSidebar.js';

// React imports for Magic UI integration
import React from 'react';
import { createRoot } from 'react-dom/client';
import InvoicesPageUI from '../react/pages/InvoicesPageUI.jsx';

// Invoice Manager for React UI integration
const InvoiceManager = {
  reactRoot: null,
  invoices: [],
  searchTerm: '',
  isLoading: false,
  stats: { total: 0, saved: 0, drafts: 0, submitted: 0 },
  currentPage: 1,
  totalPages: 1,
  itemsPerPage: 20,

  async initialize() {
    console.log('🚀 Initializing Invoices Directory...');

    configureSidebar('invoices');

    try {
      // Check authentication
      const authResult = await checkAuthentication();
      if (!authResult.valid) {
        console.log('🚫 Authentication failed, redirecting to login...');
        window.location.href = '/';
        return;
      }

      console.log('✅ Authentication validated:', authResult.user.email);

      // Initialize React-based Invoices Page with Magic UI
      await this.createReactInvoicesPage();

      console.log('✅ Invoices Directory initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing Invoices Directory:', error);
      showError('Failed to initialize invoice directory');
    }
  },

  async createReactInvoicesPage() {
    try {
      // Clean up any existing React root
      if (this.reactRoot) {
        console.log('🧹 Cleaning up existing React root');
        this.reactRoot.unmount();
        this.reactRoot = null;
      }

      // Create React root
      const container = document.getElementById('invoices-page');
      if (!container) {
        throw new Error('Container #invoices-page not found');
      }

      this.reactRoot = createRoot(container);

      // Load initial invoice data
      await this.loadInvoices();

      // Render React component with Magic UI
      this.renderReactUI();

      console.log('✅ React InvoicesPage with Magic UI created');

    } catch (error) {
      console.error('❌ Failed to create React InvoicesPage:', error);
      throw error;
    }
  },

  renderReactUI() {
    if (!this.reactRoot) return;

    this.reactRoot.render(
      React.createElement(InvoicesPageUI, {
        invoices: this.invoices,
        searchTerm: this.searchTerm,
        isLoading: this.isLoading,
        stats: this.stats,
        currentPage: this.currentPage,
        totalPages: this.totalPages,
        onSearch: (term) => this.handleSearch(term),
        onEdit: (invoice) => this.handleEdit(invoice),
        onDelete: (invoice) => this.handleDelete(invoice),
        onView: (invoice) => this.handleView(invoice),
        onPrint: (invoice) => this.handlePrint(invoice),
        onAddNew: () => this.handleAddNew(),
        onPageChange: (page) => this.handlePageChange(page)
      })
    );
  },

  async loadInvoices() {
    this.isLoading = true;
    this.renderReactUI();

    try {
      console.log('🔄 Fetching invoices from server...');
      const response = await fetch('/api/invoices/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const serverInvoices = await response.json();
        console.log(`✅ Fetched ${serverInvoices.length} invoices from server`);

        // Store invoices array directly (API returns array, not object)
        this.invoices = Array.isArray(serverInvoices) ? serverInvoices : [];

        // Calculate stats from the invoices
        this.calculateStats();

        // Store in localStorage for offline access
        try {
          localStorage.setItem('marine_invoices', JSON.stringify(this.invoices));
        } catch (storageError) {
          console.warn('Failed to save invoices to localStorage:', storageError);
        }

        console.log(`✅ Loaded ${this.invoices.length} invoices`);
      } else {
        console.warn('⚠️ Server request failed, trying localStorage...');
        this.loadFromLocalStorage();
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch from server, trying localStorage:', error);
      this.loadFromLocalStorage();
    }

    this.isLoading = false;
    this.renderReactUI();
  },

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('marine_invoices');
      if (stored) {
        const storedInvoices = JSON.parse(stored);
        this.invoices = Array.isArray(storedInvoices) ? storedInvoices : [];
        this.calculateStats();
        console.log(`✅ Loaded ${this.invoices.length} invoices from localStorage`);
      } else {
        console.log('📭 No invoices found in localStorage');
        this.invoices = [];
        this.stats = { total: 0, saved: 0, drafts: 0, submitted: 0 };
      }
    } catch (error) {
      console.error('❌ Error loading from localStorage:', error);
      this.invoices = [];
      this.stats = { total: 0, saved: 0, drafts: 0, submitted: 0 };
    }
  },

  calculateStats() {
    if (!Array.isArray(this.invoices)) {
      this.stats = { total: 0, saved: 0, drafts: 0, submitted: 0 };
      return;
    }

    this.stats = {
      total: this.invoices.length,
      saved: this.invoices.filter(inv => inv.status === 'saved').length,
      drafts: this.invoices.filter(inv => inv.status === 'draft').length,
      submitted: this.invoices.filter(inv => inv.status === 'submitted').length
    };
  },

  handleSearch(term) {
    this.searchTerm = term;
    this.currentPage = 1;
    // For search, we filter locally instead of re-fetching
    this.filterAndRenderInvoices();
  },

  filterAndRenderInvoices() {
    if (!this.searchTerm) {
      // No search term, show all invoices
      this.renderReactUI();
      return;
    }

    // Filter invoices based on search term
    const searchLower = this.searchTerm.toLowerCase();
    const originalInvoices = this.invoices;

    this.invoices = originalInvoices.filter(invoice => {
      return (
        (invoice.invoice_number && invoice.invoice_number.toLowerCase().includes(searchLower)) ||
        (invoice.customer?.company_name && invoice.customer.company_name.toLowerCase().includes(searchLower)) ||
        (invoice.customer?.display_name && invoice.customer.display_name.toLowerCase().includes(searchLower)) ||
        (invoice.vessel?.name && invoice.vessel.name.toLowerCase().includes(searchLower)) ||
        (invoice.title && invoice.title.toLowerCase().includes(searchLower))
      );
    });

    this.renderReactUI();

    // Restore original invoices for next search
    setTimeout(() => {
      this.invoices = originalInvoices;
    }, 100);
  },

  handleEdit(invoice) {
    console.log('Edit invoice:', invoice);
    // TODO: Navigate to invoice edit page
    window.location.href = `/app?invoice=${invoice.id}`;
  },

  handleDelete(invoice) {
    console.log('Delete invoice:', invoice);
    // TODO: Implement delete confirmation modal
    if (confirm(`Are you sure you want to delete invoice ${invoice.invoice_number || '#' + invoice.id}?`)) {
      this.deleteInvoice(invoice.id);
    }
  },

  handleView(invoice) {
    console.log('View invoice:', invoice);
    // TODO: Navigate to invoice view page
    window.location.href = `/app?invoice=${invoice.id}&view=true`;
  },

  handlePrint(invoice) {
    console.log('Print invoice:', invoice);
    // TODO: Open print dialog or navigate to print view
    window.location.href = `/app?invoice=${invoice.id}&print=true`;
  },

  handleAddNew() {
    console.log('Add new invoice');
    // Navigate to main app for invoice creation
    window.location.href = '/app';
  },

  handlePageChange(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadInvoices();
  },

  async deleteInvoice(invoiceId) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        console.log('✅ Invoice deleted successfully');
        // Reload invoices to reflect changes
        this.loadInvoices();
      } else {
        throw new Error('Failed to delete invoice');
      }
    } catch (error) {
      console.error('❌ Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  InvoiceManager.initialize();
});

// Global exposure for debugging
window.InvoiceManager = InvoiceManager;

async function checkAuthentication() {
  try {
    // Check localStorage first
    const storedUser = localStorage.getItem('marine_invoice_user');
    const storedSession = localStorage.getItem('marine_invoice_session');

    if (!storedUser || !storedSession) {
      return { valid: false, reason: 'No stored authentication data' };
    }

    const user = JSON.parse(storedUser);
    const session = JSON.parse(storedSession);

    // Basic validation
    if (!user.id || !user.email) {
      return { valid: false, reason: 'Invalid user data' };
    }

    // Check session age
    const sessionAge = Date.now() - session.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      return { valid: false, reason: 'Session expired' };
    }

    // Try to validate with server
    try {
      const response = await fetch('/api/simple-auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const serverAuth = await response.json();
        if (serverAuth.authenticated) {
          return { valid: true, user: serverAuth.user || user };
        }
      }
    } catch (serverError) {
      console.warn('Server auth check failed, using localStorage:', serverError.message);
    }

    // Fallback to localStorage
    return { valid: true, user };

  } catch (error) {
    console.error('Authentication check error:', error);
    return { valid: false, reason: 'Authentication error' };
  }
}

function showError(message) {
  const container = document.getElementById('invoices-page');
  if (container) {
    container.innerHTML = `
      <div class="invoices-page-container">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h3>Error</h3>
          <p>${message}</p>
          <button class="btn btn--primary" onclick="window.location.reload()">
            Retry
          </button>
        </div>
      </div>
    `;
  }
}
