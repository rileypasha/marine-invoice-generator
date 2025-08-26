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
            status: 'saved'
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
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.limit,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
                ...this.filters
            });
            
            const response = await fetch(`/api/master/invoices?${params}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch invoices');
            }
            
            const data = await response.json();
            this.invoices = data.invoices;
            this.totalPages = data.pagination.totalPages;
            
            loading.style.display = 'none';
            
            if (this.invoices.length === 0) {
                noResults.style.display = 'block';
            } else {
                this.renderInvoices();
            }
            
            this.updatePagination();
        } catch (error) {
            console.error('Failed to load invoices:', error);
            loading.style.display = 'none';
            noResults.style.display = 'block';
        }
    }
    
    renderInvoices() {
        const tbody = document.getElementById('invoicesTableBody');
        tbody.innerHTML = '';
        
        this.invoices.forEach(invoice => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDate(invoice.savedAt)}</td>
                <td>${invoice.userName || 'N/A'}<br><small>${invoice.userEmail || ''}</small></td>
                <td>${invoice.vesselName || 'N/A'}</td>
                <td>${invoice.customerName || 'N/A'}</td>
                <td>${invoice.invoiceNumber || 'N/A'}</td>
                <td>${this.formatCurrency(invoice.total)}</td>
                <td>${this.formatPercent(invoice.profitPercent)}</td>
                <td>
                    <button class="btn-view" data-id="${invoice.id}">View</button>
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
        
        // Parse invoice data
        const invoiceData = invoice.parsedData || {};
        const lineItems = invoiceData.lineItems || [];
        
        modalBody.innerHTML = `
            <div class="invoice-detail">
                <div class="detail-section">
                    <h3>Invoice Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Invoice Number</span>
                            <span class="detail-value">${invoice.invoiceNumber || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${invoice.status}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Saved At</span>
                            <span class="detail-value">${this.formatDate(invoice.savedAt)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Market</span>
                            <span class="detail-value">${invoice.market || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Vessel Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Vessel Name</span>
                            <span class="detail-value">${invoice.vesselName || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Weight</span>
                            <span class="detail-value">${invoice.vesselWeight ? invoice.vesselWeight + ' tons' : 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Beam</span>
                            <span class="detail-value">${invoice.vesselBeam ? invoice.vesselBeam + ' ft' : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Customer Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Customer Name</span>
                            <span class="detail-value">${invoice.customerName || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${invoice.customerEmail || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${invoice.customerPhone || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Financial Summary</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Subtotal</span>
                            <span class="detail-value">${this.formatCurrency(invoice.subtotal)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Tax</span>
                            <span class="detail-value">${this.formatCurrency(invoice.taxAmount)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total</span>
                            <span class="detail-value"><strong>${this.formatCurrency(invoice.total)}</strong></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Gross Profit</span>
                            <span class="detail-value">${this.formatCurrency(invoice.grossProfit)} (${this.formatPercent(invoice.profitPercent)})</span>
                        </div>
                    </div>
                </div>
                
                ${lineItems.length > 0 ? `
                    <div class="detail-section">
                        <h3>Line Items</h3>
                        <table class="invoices-table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Type</th>
                                    <th>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lineItems.map(item => `
                                    <tr>
                                        <td>${item.description || 'N/A'}</td>
                                        <td>${item.type || 'N/A'}</td>
                                        <td>${this.formatCurrency(item.cost || 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
                
                <div class="detail-section">
                    <h3>Submitter Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Submitted By</span>
                            <span class="detail-value">${invoice.userName || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${invoice.userEmail || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Store current invoice ID for export
        modal.dataset.invoiceId = invoice.id;
        
        modal.style.display = 'flex';
    }
    
    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Filter controls
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });
        
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadInvoices();
            }
        });
        
        document.getElementById('nextPage').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadInvoices();
            }
        });
        
        // Table sorting
        document.querySelectorAll('.invoices-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortBy = th.dataset.sort;
                if (this.sortBy === sortBy) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = sortBy;
                    this.sortOrder = 'desc';
                }
                this.loadInvoices();
            });
        });
        
        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('exportCsv').addEventListener('click', () => {
            this.exportCsv();
        });
        
        // Logout - with debugging
        const logoutBtn = document.getElementById('logoutBtn');
        console.log('Logout button element:', logoutBtn);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('Logout button clicked');
                await this.logout();
            });
        } else {
            console.error('Logout button not found!');
        }
        
        // Enter key on search
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
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
            status: 'saved'
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
        
        if (!invoiceId) return;
        
        try {
            window.location.href = `/api/master/invoices/${invoiceId}/export.csv`;
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export invoice');
        }
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
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MasterDashboard();
});