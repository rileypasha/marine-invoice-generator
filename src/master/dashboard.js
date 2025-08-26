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
            market: '',
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
        const container = document.getElementById('invoicesTableBody');
        container.innerHTML = '';
        
        this.invoices.forEach(invoice => {
            const profitClass = invoice.profitPercent > 0 ? 'profit-positive' : 'profit-negative';
            const statusClass = invoice.status === 'saved' ? 'status-active' : 'status-pending';
            
            const row = document.createElement('div');
            row.className = 'invoice-row';
            row.innerHTML = `
                <div class="invoice-company">${invoice.customerName || 'N/A'}</div>
                <div class="invoice-vessel">${invoice.vesselName || 'N/A'}</div>
                <div class="invoice-number">#${invoice.invoiceNumber || 'N/A'}</div>
                <div class="invoice-date">${this.formatShortDate(invoice.savedAt)}</div>
                <div class="invoice-amount">${this.formatCurrency(invoice.total)}</div>
                <div class="invoice-profit ${profitClass}">${this.formatPercent(invoice.profitPercent)}</div>
                <div class="invoice-action" data-id="${invoice.id}">View</div>
            `;
            container.appendChild(row);
        });
        
        // Add click handlers for view buttons
        container.querySelectorAll('.invoice-action').forEach(btn => {
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
        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Apply time-based filter
                this.applyTimeFilter(btn.textContent.toLowerCase());
            });
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
        
        // View all button
        document.querySelector('.view-all-btn')?.addEventListener('click', () => {
            // Show all invoices
            this.filters.search = '';
            this.loadInvoices();
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
        
        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.loadInvoices();
        });
    }
    
    applyTimeFilter(period) {
        const now = new Date();
        let dateFrom = '';
        
        switch(period) {
            case 'today':
                dateFrom = new Date(now.setHours(0,0,0,0)).toISOString();
                break;
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                dateFrom = weekAgo.toISOString();
                break;
            case 'month':
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                dateFrom = monthAgo.toISOString();
                break;
            default:
                dateFrom = '';
        }
        
        this.filters.dateFrom = dateFrom;
        this.filters.dateTo = '';
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
    
    formatShortDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const diffTime = Math.abs(today - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MasterDashboard();
});