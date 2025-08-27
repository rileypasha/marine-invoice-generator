// Master Dashboard JavaScript

class MasterDashboard {
    constructor() {
        this.invoices = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.limit = 20;
        this.sortBy = 'savedAt';
        this.sortOrder = 'desc';
        this.filters = {
            search: '',
            dateFrom: '',
            dateTo: '',
            status: ''  // Empty string means show saved and submitted (default view)
        };
        
        this.init();
    }
    
    async init() {
        // Check authentication
        const authCheck = await this.checkAuth();
        if (!authCheck) {
            window.location.href = '/';
            return;
        }
        
        // Initialize theme
        this.initTheme();
        
        // Load initial data
        await this.loadStats();
        await this.loadInvoices();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    initTheme() {
        // Check localStorage for saved theme preference
        const savedTheme = localStorage.getItem('dashboardTheme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body.setAttribute('data-theme', savedTheme);
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('dashboardTheme', newTheme);
    }
    
    async checkAuth() {
        try {
            const response = await fetch('/api/auth/check-master', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.isMaster) {
                document.getElementById('userEmail').textContent = data.email;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/master/stats', {
                credentials: 'include'
            });
            const stats = await response.json();
            
            document.getElementById('totalSaved').textContent = stats.totalSaved || 0;
            document.getElementById('todayCount').textContent = stats.todayCount || 0;
            document.getElementById('weekTotal').textContent = this.formatCurrency(stats.weekTotal || 0);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }
    
    async loadInvoices() {
        const loading = document.getElementById('loadingIndicator');
        const table = document.getElementById('invoicesTableBody');
        const noResults = document.getElementById('noResults');
        
        loading.style.display = 'block';
        table.innerHTML = '';
        noResults.style.display = 'none';
        
        try {
            // Build clean parameters, omitting empty values
            const cleanParams = {
                page: this.currentPage,
                limit: this.limit,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder
            };
            
            // Only add filters if they have values
            if (this.filters.search && this.filters.search.trim()) {
                cleanParams.search = this.filters.search.trim();
            }
            if (this.filters.dateFrom && this.filters.dateFrom.trim()) {
                cleanParams.dateFrom = this.filters.dateFrom.trim();
            }
            if (this.filters.dateTo && this.filters.dateTo.trim()) {
                cleanParams.dateTo = this.filters.dateTo.trim();
            }
            // Status filter: empty means show saved+submitted (default)
            if (this.filters.status && this.filters.status.trim()) {
                cleanParams.status = this.filters.status.trim();
            }
            
            console.log('🔄 Loading invoices with params:', cleanParams);
            
            const params = new URLSearchParams(cleanParams);
            const response = await fetch(`/api/master/invoices?${params}`, {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // Check if we got a recovery response
                if (data.recovery && data.invoices) {
                    console.warn('⚠️ Recovery mode: displaying partial data');
                    this.showWarning(data.error || 'Displaying partial data due to system issue');
                    
                    this.invoices = data.invoices || [];
                    this.totalPages = data.pagination?.totalPages || 1;
                } else {
                    throw new Error(data.error || data.message || 'Failed to fetch invoices');
                }
            } else {
                this.invoices = data.invoices || [];
                this.totalPages = data.pagination?.totalPages || 1;
                this.clearWarning();
            }
            
            loading.style.display = 'none';
            
            if (this.invoices.length === 0) {
                noResults.style.display = 'block';
            } else {
                this.renderInvoices();
            }
            
            this.updatePagination();
            
        } catch (error) {
            console.error('❌ Failed to load invoices:', error);
            loading.style.display = 'none';
            
            // Try fallback with minimal parameters
            console.log('🚨 Attempting fallback load...');
            this.loadFallbackInvoices();
        }
    }
    
    async loadFallbackInvoices() {
        try {
            // Try with only pagination, no sorting or filters
            const response = await fetch(`/api/master/invoices?page=1&limit=20`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.invoices = data.invoices || [];
                this.totalPages = data.pagination?.totalPages || 1;
                
                if (this.invoices.length > 0) {
                    this.renderInvoices();
                    this.updatePagination();
                    this.showWarning('Some filters may not be working. Showing recent invoices.');
                } else {
                    document.getElementById('noResults').style.display = 'block';
                }
            } else {
                document.getElementById('noResults').style.display = 'block';
                this.showError('Unable to load invoices. Please refresh the page.');
            }
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
            document.getElementById('noResults').style.display = 'block';
            this.showError('Unable to connect to server. Please check your connection.');
        }
    }
    
    showWarning(message) {
        const container = document.querySelector('.dashboard-container') || document.body;
        let warningEl = document.getElementById('systemWarning');
        
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'systemWarning';
            warningEl.className = 'system-warning';
            warningEl.style.cssText = 'background: #ff9800; color: white; padding: 12px; margin: 10px 0; border-radius: 4px; font-size: 14px;';
            container.insertBefore(warningEl, container.firstChild);
        }
        
        warningEl.innerHTML = `⚠️ ${message}`;
        warningEl.style.display = 'block';
    }
    
    showError(message) {
        const container = document.querySelector('.dashboard-container') || document.body;
        let errorEl = document.getElementById('systemError');
        
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'systemError';
            errorEl.className = 'system-error';
            errorEl.style.cssText = 'background: #f44336; color: white; padding: 12px; margin: 10px 0; border-radius: 4px; font-size: 14px;';
            container.insertBefore(errorEl, container.firstChild);
        }
        
        errorEl.innerHTML = `❌ ${message}`;
        errorEl.style.display = 'block';
    }
    
    clearWarning() {
        const warningEl = document.getElementById('systemWarning');
        if (warningEl) warningEl.style.display = 'none';
        const errorEl = document.getElementById('systemError');
        if (errorEl) errorEl.style.display = 'none';
    }
    
    renderInvoices() {
        const tbody = document.getElementById('invoicesTableBody');
        tbody.innerHTML = '';
        
        this.invoices.forEach(invoice => {
            const row = document.createElement('tr');
            
            // Determine change status
            let changeIndicator = '';
            if (invoice.unseenChanges) {
                changeIndicator = '<span class="change-flag unseen" title="New changes">🚩</span>';
            } else if (invoice.hasChanges) {
                changeIndicator = '<span class="change-flag seen" title="Changes reviewed">○</span>';
            }
            
            row.innerHTML = `
                <td>${this.formatDate(invoice.savedAt || invoice.submittedAt)}</td>
                <td>${invoice.userName || 'N/A'}<br><small>${invoice.userEmail || ''}</small></td>
                <td>${invoice.vesselName || 'N/A'}</td>
                <td>${invoice.customerName || 'N/A'}</td>
                <td>${invoice.invoiceNumber || 'N/A'}</td>
                <td>${this.formatCurrency(invoice.total)}</td>
                <td>${this.formatPercent(invoice.profitPercent)}</td>
                <td class="changes-cell">${changeIndicator}</td>
                <td>
                    <button class="btn-view" data-id="${invoice.id}">View</button>
                    ${invoice.hasChanges ? `<button class="btn-changes" data-id="${invoice.id}">Changes</button>` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Add click handlers for view buttons
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.viewInvoice(e.target.dataset.id);
            });
        });
        
        // Add click handlers for changes buttons
        tbody.querySelectorAll('.btn-changes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                window.location.href = `/master/changes?id=${e.target.dataset.id}`;
            });
        });
    }
    
    async viewInvoice(id) {
        try {
            const response = await fetch(`/api/master/invoices/${id}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch invoice details');
            }
            
            const invoice = await response.json();
            this.showDetailModal(invoice);
        } catch (error) {
            console.error('Failed to load invoice details:', error);
            alert('Failed to load invoice details');
        }
    }
    
    showDetailModal(invoice) {
        const modal = document.getElementById('detailModal');
        const modalBody = document.getElementById('modalBody');
        
        // Parse invoice data - check if we have the actual data structure
        const invoiceData = invoice.parsedData || {};
        
        // Extract the actual vessel and customer info from the parsed data
        const vessel = invoiceData.vessel || {};
        const customer = invoiceData.customer || {};
        const scope = invoiceData.scope || {};
        const lineItems = scope.lineItems || [];
        
        modalBody.innerHTML = `
            <div class="invoice-detail">
                <div class="detail-section">
                    <h3>Invoice</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${invoice.status}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Save</span>
                            <span class="detail-value date-value">${this.formatDate(invoice.savedAt)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Vessel</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${vessel.name || invoice.vesselName || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Weight</span>
                            <span class="detail-value">${vessel.weight ? this.formatNumber(vessel.weight) + ' tons' : (invoice.vesselWeight ? this.formatNumber(invoice.vesselWeight) + ' tons' : 'N/A')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Beam</span>
                            <span class="detail-value">${vessel.beam ? this.formatNumber(vessel.beam) + ' ft' : (invoice.vesselBeam ? this.formatNumber(invoice.vesselBeam) + ' ft' : 'N/A')}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Customer</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${customer.customerName || invoice.customerName || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value email-value" title="${customer.customerEmail || invoice.customerEmail || 'N/A'}">${customer.customerEmail || invoice.customerEmail || 'N/A'}</span>
                            ${(customer.customerEmail || invoice.customerEmail) && (customer.customerEmail || invoice.customerEmail) !== 'N/A' ? `<button class="copy-btn" data-value="${customer.customerEmail || invoice.customerEmail}" title="Copy email">📋</button>` : ''}
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value phone-value">${customer.customerPhone || invoice.customerPhone || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Financials</h3>
                    <div class="detail-grid four-items">
                        <div class="detail-item">
                            <span class="detail-label">Subtotal</span>
                            <span class="detail-value">${this.formatCurrency(scope.subtotal || invoice.subtotal || 0)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Tax</span>
                            <span class="detail-value">${this.formatCurrency(scope.taxAmount || invoice.taxAmount || 0)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total</span>
                            <span class="detail-value"><strong>${this.formatCurrency(scope.total || invoice.total || 0)}</strong></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Profit</span>
                            <span class="detail-value">${this.formatCurrency(scope.grossProfit || invoice.grossProfit || 0)} (${this.formatPercent(scope.profitPercent || invoice.profitPercent || 0)})</span>
                        </div>
                    </div>
                </div>
                
                ${lineItems.length > 0 ? `
                    <div class="detail-section full-width">
                        <h3>Line Items</h3>
                        <table class="invoices-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Type</th>
                                    <th>Cost</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lineItems.map(item => `
                                    <tr>
                                        <td style="word-wrap: break-word; max-width: 300px;" title="${(item.description || 'N/A').replace(/"/g, '&quot;')}">${item.description || 'N/A'}</td>
                                        <td>${item.type || 'N/A'}</td>
                                        <td>${this.formatCurrency(item.cost || 0)}</td>
                                        <td>${this.formatCurrency(item.cost || 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
                
                <div class="detail-section">
                    <h3>Submitter</h3>
                    <div class="detail-grid two-items">
                        <div class="detail-item">
                            <span class="detail-label">Submitted By</span>
                            <span class="detail-value">${invoice.userName || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value email-value" title="${invoice.userEmail || 'N/A'}">${invoice.userEmail || 'N/A'}</span>
                            ${invoice.userEmail && invoice.userEmail !== 'N/A' ? `<button class="copy-btn" data-value="${invoice.userEmail}" title="Copy email">📋</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Store current invoice ID for export
        modal.dataset.invoiceId = invoice.id;
        
        modal.style.display = 'flex';
        
        // Add event listeners for copy buttons
        this.setupCopyButtons();
    }
    
    setupCopyButtons() {
        const copyButtons = document.querySelectorAll('.copy-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const value = btn.dataset.value;
                if (!value) return;
                
                try {
                    await navigator.clipboard.writeText(value);
                    
                    // Visual feedback
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '✓';
                    btn.classList.add('copied');
                    
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = value;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        btn.innerHTML = '✓';
                        btn.classList.add('copied');
                        setTimeout(() => {
                            btn.innerHTML = '📋';
                            btn.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        console.error('Fallback copy failed:', err);
                    }
                    document.body.removeChild(textArea);
                }
            });
        });
    }
    
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        // Filter controls with debounce
        let filterTimeout;
        document.getElementById('applyFilters')?.addEventListener('click', () => {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                this.applyFilters();
            }, 300);
        });
        
        document.getElementById('clearFilters')?.addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Search with debounce to prevent rapid API calls
        let searchTimeout;
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadInvoices();
                }, 500);
            });
            
            // Enter key on search
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(searchTimeout);
                    this.applyFilters();
                }
            });
        }
        
        // Pagination with error handling
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadInvoices().catch(err => {
                    console.error('Failed to load previous page:', err);
                    this.currentPage++; // Revert page change
                });
            }
        });
        
        document.getElementById('nextPage')?.addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadInvoices().catch(err => {
                    console.error('Failed to load next page:', err);
                    this.currentPage--; // Revert page change
                });
            }
        });
        
        // Table sorting with error handling
        document.querySelectorAll('.invoices-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortBy = th.dataset.sort;
                const prevSortBy = this.sortBy;
                const prevSortOrder = this.sortOrder;
                
                if (this.sortBy === sortBy) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = sortBy;
                    this.sortOrder = 'desc';
                }
                
                this.loadInvoices().catch(err => {
                    console.error('Failed to sort:', err);
                    // Revert sort changes
                    this.sortBy = prevSortBy;
                    this.sortOrder = prevSortOrder;
                });
            });
        });
        
        // Modal controls
        document.getElementById('closeModal')?.addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('closeModalBtn')?.addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('exportCsv')?.addEventListener('click', () => {
            this.exportCsv();
        });
        
        // Logout with error handling
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('Logout initiated');
                try {
                    await this.logout();
                } catch (error) {
                    console.error('Logout failed:', error);
                    alert('Failed to logout. Please try again.');
                }
            });
        }
        
        // Auto-retry failed loads
        window.addEventListener('online', () => {
            console.log('Connection restored, reloading data...');
            this.loadInvoices();
        });
    }
    
    applyFilters() {
        this.filters.search = document.getElementById('searchInput').value;
        this.filters.dateFrom = document.getElementById('dateFrom').value;
        this.filters.dateTo = document.getElementById('dateTo').value;
        
        this.currentPage = 1;
        this.loadInvoices();
    }
    
    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        
        this.filters = {
            search: '',
            dateFrom: '',
            dateTo: '',
            status: ''  // Empty string means show saved and submitted (default view)
        };
        
        this.currentPage = 1;
        this.loadInvoices();
    }
    
    updatePagination() {
        document.getElementById('currentPage').textContent = this.currentPage;
        document.getElementById('totalPages').textContent = this.totalPages;
        
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= this.totalPages;
    }
    
    closeModal() {
        document.getElementById('detailModal').style.display = 'none';
    }
    
    async exportCsv() {
        const modal = document.getElementById('detailModal');
        const invoiceId = modal.dataset.invoiceId;
        
        if (!invoiceId) {
            this.showNotification('No invoice selected', 'error');
            return;
        }
        
        const exportBtn = document.getElementById('exportCsv');
        const originalText = exportBtn.textContent;
        
        try {
            // Show loading state
            exportBtn.textContent = 'Exporting...';
            exportBtn.disabled = true;
            
            // Use fetch to properly handle errors
            const response = await fetch(`/api/master/invoices/${invoiceId}/export.csv`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'text/csv'
                }
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to export invoice';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = `Export failed: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            // Get the filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `invoice-${invoiceId}.csv`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            // Download the CSV
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            // Show success notification
            this.showNotification('Invoice exported successfully', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification(error.message || 'Failed to export invoice', 'error');
        } finally {
            // Restore button state
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            background: ${type === 'error' ? '#ef4444' : '#10b981'};
            color: white;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
    
    async logout() {
        console.log('Logout function called');
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            console.log('Logout response:', response.status);
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
            alert('Failed to logout: ' + error.message);
        }
    }
    
    // Utility functions
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    }
    
    formatPercent(percent) {
        return (percent || 0).toFixed(2) + '%';
    }
    
    formatNumber(num) {
        if (!num || num === 'N/A') return 'N/A';
        return new Intl.NumberFormat('en-US').format(num);
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MasterDashboard();
});