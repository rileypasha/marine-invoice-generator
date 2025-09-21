/**
 * Master Dashboard Entry Point - React implementation with Magic UI
 * Provides master dashboard functionality with authentication and data management
 */
import '../styles/globals.css';

// React imports for Magic UI integration
import React from 'react';
import { createRoot } from 'react-dom/client';
import MasterDashboardUI from '../react/pages/MasterDashboardUI.jsx';

const MasterDashboardManager = {
  instance: null,
  reactRoot: null,

  // State
  stats: { totalSaved: 0, todayCount: 0, weekTotal: 0 },
  invoices: [],
  user: null,
  currentPage: 1,
  totalPages: 1,
  limit: 20,
  isLoading: false,

  // Filters
  searchQuery: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'savedAt',
  sortOrder: 'desc',

  initialized: false,
  initializationAttempts: 0,
  maxAttempts: 3,

  async initialize() {
    this.initializationAttempts++;
    console.log(`🎯 Initializing Master Dashboard (attempt ${this.initializationAttempts})...`);

    try {
      // Authentication check for master access
      const authResult = await this.validateMasterAuthentication();
      if (!authResult.valid) {
        console.log(`🚫 Master authentication failed: ${authResult.reason}`);
        this.redirectToLogin(authResult.reason);
        return;
      }

      console.log('✅ Master authentication validated:', authResult.user.email);
      this.user = authResult.user;

      // Initialize React UI
      this.initializeReactUI();

      // Load initial data
      await this.loadStats();
      await this.loadInvoices();

      this.initialized = true;
      console.log('✅ Master Dashboard initialized successfully');

    } catch (error) {
      console.error('❌ Master Dashboard initialization failed:', error);
      this.handleInitializationError(error);
    }
  },

  async validateMasterAuthentication() {
    try {
      const response = await fetch('/api/auth/check-master', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          return { valid: true, user: data.user };
        }
      }

      return { valid: false, reason: 'Master authentication required' };
    } catch (error) {
      console.error('Master auth check failed:', error);
      return { valid: false, reason: 'Authentication check failed' };
    }
  },

  initializeReactUI() {
    console.log('🚀 Initializing React Master Dashboard UI...');

    const container = document.getElementById('master-dashboard-root');
    if (!container) {
      console.error('❌ Master dashboard container not found');
      return;
    }

    this.reactRoot = createRoot(container);
    this.renderDashboard();
  },

  renderDashboard() {
    if (!this.reactRoot) return;

    this.reactRoot.render(
      React.createElement(MasterDashboardUI, {
        stats: this.stats,
        invoices: this.invoices,
        user: this.user,
        currentPage: this.currentPage,
        totalPages: this.totalPages,
        isLoading: this.isLoading,
        searchQuery: this.searchQuery,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        sortBy: this.sortBy,
        sortOrder: this.sortOrder,
        onSearch: (query) => this.handleSearch(query),
        onDateFilter: (from, to) => this.handleDateFilter(from, to),
        onSort: (column, order) => this.handleSort(column, order),
        onPageChange: (page) => this.handlePageChange(page),
        onPreviewInvoice: (invoiceId) => this.handlePreviewInvoice(invoiceId),
        onExportCsv: () => this.handleExportCsv(),
        onLogout: () => this.handleLogout()
      })
    );
  },

  async loadStats() {
    try {
      const response = await fetch('/api/master/stats', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const stats = await response.json();
        this.stats = stats;
        this.renderDashboard();
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },

  async loadInvoices() {
    this.isLoading = true;
    this.renderDashboard();

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.limit,
        sortBy: this.sortBy,
        sortOrder: this.sortOrder
      });

      if (this.searchQuery) params.append('search', this.searchQuery);
      if (this.dateFrom) params.append('dateFrom', this.dateFrom);
      if (this.dateTo) params.append('dateTo', this.dateTo);

      const response = await fetch(`/api/master/invoices?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.invoices = data.invoices || [];
        this.currentPage = data.currentPage || 1;
        this.totalPages = data.totalPages || 1;
      } else {
        console.error('Failed to load invoices:', response.status);
        this.invoices = [];
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      this.invoices = [];
    } finally {
      this.isLoading = false;
      this.renderDashboard();
    }
  },

  handleSearch(query) {
    this.searchQuery = query;
    this.currentPage = 1; // Reset to first page
    this.loadInvoices();
  },

  handleDateFilter(dateFrom, dateTo) {
    this.dateFrom = dateFrom;
    this.dateTo = dateTo;
    this.currentPage = 1; // Reset to first page
    this.loadInvoices();
  },

  handleSort(column, order) {
    this.sortBy = column;
    this.sortOrder = order;
    this.currentPage = 1; // Reset to first page
    this.loadInvoices();
  },

  handlePageChange(page) {
    this.currentPage = page;
    this.loadInvoices();
  },

  async handlePreviewInvoice(invoiceId) {
    try {
      const response = await fetch(`/api/master/invoices/${invoiceId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const invoiceData = await response.json();
        return invoiceData;
      } else {
        console.error('Failed to load invoice preview:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error loading invoice preview:', error);
      return null;
    }
  },

  async handleExportCsv() {
    try {
      const params = new URLSearchParams({
        sortBy: this.sortBy,
        sortOrder: this.sortOrder
      });

      if (this.searchQuery) params.append('search', this.searchQuery);
      if (this.dateFrom) params.append('dateFrom', this.dateFrom);
      if (this.dateTo) params.append('dateTo', this.dateTo);

      const response = await fetch(`/api/master/export-csv?${params}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Failed to export CSV:', response.status);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  },

  async handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      // Redirect to home regardless of response
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect on error
      window.location.href = '/';
    }
  },

  redirectToLogin(reason) {
    console.log('Redirecting to login:', reason);
    window.location.href = '/';
  },

  handleInitializationError(error) {
    console.error('Initialization error:', error);

    if (this.initializationAttempts < this.maxAttempts) {
      console.log(`Retrying initialization in 2 seconds (attempt ${this.initializationAttempts + 1}/${this.maxAttempts})...`);
      setTimeout(() => this.initialize(), 2000);
    } else {
      console.error('Max initialization attempts reached. Redirecting to login.');
      this.redirectToLogin('Initialization failed');
    }
  }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 DOM loaded, initializing Master Dashboard...');
  MasterDashboardManager.initialize();
});

// Export for debugging
window.MasterDashboardManager = MasterDashboardManager;