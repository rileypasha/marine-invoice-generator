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
        this.dateFromPicker = null;
        this.dateToPicker = null;
        
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
        
        // Setup date pickers
        this.setupDatePickers();
        
        // Load initial data
        await this.loadStats();
        await this.loadInvoices();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupDatePickers() {
        // Check if SimpleDatePicker is available
        if (typeof SimpleDatePicker === 'undefined') {
            console.warn('SimpleDatePicker not loaded, falling back to native inputs');
            // Just use native inputs with change listeners
            document.getElementById('dateFrom')?.addEventListener('change', () => {
                this.filters.dateFrom = document.getElementById('dateFrom').value;
            });
            document.getElementById('dateTo')?.addEventListener('change', () => {
                this.filters.dateTo = document.getElementById('dateTo').value;
            });
            return;
        }
        
        // Initialize date pickers
        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');
        
        if (dateFromInput) {
            this.dateFromPicker = new SimpleDatePicker(dateFromInput, {
                onChange: (date, formatted) => {
                    this.filters.dateFrom = formatted;
                    // Update min date for end picker
                    if (this.dateToPicker && date) {
                        this.dateToPicker.options.minDate = date;
                    }
                },
                maxDate: new Date()
            });
        }
        
        if (dateToInput) {
            this.dateToPicker = new SimpleDatePicker(dateToInput, {
                onChange: (date, formatted) => {
                    this.filters.dateTo = formatted;
                },
                maxDate: new Date()
            });
        }
    }
    
    initTheme() {
        // Always use dark theme
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
    }
    
    async checkAuth() {
        try {
            const response = await fetch('/api/auth/check-master', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'same-origin'
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
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'same-origin'
            });
            const stats = await response.json();
            
            document.getElementById('totalSaved').textContent = stats.totalSaved || 0;
            document.getElementById('todayCount').textContent = stats.todayCount || 0;
            // Round week total to nearest dollar
            const roundedTotal = Math.round(stats.weekTotal || 0);
            document.getElementById('weekTotal').textContent = this.formatCurrencyRounded(roundedTotal);
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
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'same-origin'
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
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'same-origin'
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
                <td>${this.formatCurrency(invoice.total)}</td>
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
        // TEMPORARY: Use simple modal for testing
        try {
            const response = await fetch(`/api/master/invoices/${id}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const invoice = await response.json();
                
                // Use the simple modal display
                if (window.simpleShowModal) {
                    window.simpleShowModal(invoice);
                    return; // Exit early
                }
            }
        } catch (error) {
            console.error('Error fetching invoice:', error);
        }
        
        // Original code below if simple modal fails
        // Validate invoice ID format client-side
        const invoiceIdRegex = /^inv_\d{13}_[a-z0-9]{9}$/;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (!id) {
            console.error('Invalid invoice ID: ID is missing');
            this.showError(
                'No invoice ID provided. Please refresh the page and try again. ' +
                'If the problem persists, contact support.'
            );
            return;
        }
        
        // Check if ID format is valid (support both formats)
        if (!invoiceIdRegex.test(id) && !uuidRegex.test(id)) {
            console.error('Invalid invoice ID format:', id);
            this.showError(
                'The invoice ID appears to be invalid. ' +
                'Please refresh the page and try again. ' +
                'If the problem persists, contact support.'
            );
            return;
        }
        
        // Store last viewed ID for retry
        this.lastViewedInvoiceId = id;
        
        // Show loading state immediately
        this.showLoadingModal();
        
        try {
            console.log('🔍 Fetching invoice details for ID:', id);
            
            const response = await fetch(`/api/master/invoices/${id}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'same-origin'
            });
            
            console.log('📡 Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                
                // Parse error for user-friendly message
                let userMessage = 'Unable to load invoice details. ';
                
                if (response.status === 400) {
                    // Try to parse JSON error
                    try {
                        const errorData = JSON.parse(errorText);
                        if (errorData.error) {
                            userMessage = errorData.error;
                        }
                    } catch {
                        userMessage += 'The invoice ID format is invalid.';
                    }
                } else if (response.status === 404) {
                    userMessage += 'This invoice could not be found.';
                } else if (response.status === 403) {
                    userMessage += 'You do not have permission to view this invoice.';
                } else if (response.status >= 500) {
                    userMessage += 'Server error. Please try again later.';
                } else {
                    userMessage += 'Please try again or contact support.';
                }
                
                throw new Error(userMessage);
            }
            
            const invoice = await response.json();
            console.log('✅ Invoice data received:', invoice);
            
            // Validate response has required fields
            if (!invoice || !invoice.id) {
                console.error('❌ Invalid invoice data:', invoice);
                throw new Error(
                    'Invoice data is incomplete. Please refresh and try again. ' +
                    'If this continues, contact support.'
                );
            }
            
            this.showDetailModal(invoice);
        } catch (error) {
            console.error('Failed to load invoice details:', error);
            
            // Check if it's a network error
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                this.showError(
                    'Network connection error. Please check your internet connection and try again.'
                );
            } else {
                // Use the error message directly as it's already user-friendly
                this.showError(error.message);
            }
        }
    }
    
    showLoadingModal() {
        const modal = document.getElementById('detailModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) {
            console.error('Modal elements not found');
            return;
        }
        
        // Lock body scroll
        document.body.classList.add('modal-open');
        
        modalBody.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading invoice details...</p>
            </div>
        `;
        
        // Ensure modal is visible
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '10000';
    }
    
    showError(message) {
        const modal = document.getElementById('detailModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) {
            console.error('Modal elements not found');
            alert(message);
            return;
        }
        
        // Lock body scroll
        document.body.classList.add('modal-open');
        
        modalBody.innerHTML = `
            <div class="error-state">
                <h3>⚠️ Error</h3>
                <p>${this.escapeHtml(message)}</p>
                <div class="error-buttons">
                    <button class="btn-secondary" id="errorCloseBtn">Close</button>
                    <button class="btn-primary" id="errorRetryBtn">Retry</button>
                </div>
            </div>
        `;
        
        // Bind event listeners properly (no inline handlers)
        const closeBtn = document.getElementById('errorCloseBtn');
        const retryBtn = document.getElementById('errorRetryBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.retryLastView();
            });
        }
        
        // Ensure modal is visible
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '10000';
    }
    
    retryLastView() {
        if (this.lastViewedInvoiceId) {
            this.viewInvoice(this.lastViewedInvoiceId);
        }
    }
    
    showDetailModal(invoice) {
        console.log('🎯 SHOWING DETAIL MODAL - SIMPLE APPROACH');
        
        const modal = document.getElementById('detailModal');
        const modalBody = document.getElementById('modalBody');
        
        // Ensure we have both elements
        if (!modal || !modalBody) {
            console.error('❌ Critical elements missing:', { modal: !!modal, modalBody: !!modalBody });
            return;
        }
        
        // Defensive checks
        if (!modal || !modalBody) {
            console.error('❌ Modal elements not found - checking DOM');
            console.log('Modal element exists:', !!document.getElementById('detailModal'));
            console.log('Modal body exists:', !!document.getElementById('modalBody'));
            console.log('All modal elements in DOM:', document.querySelectorAll('[id*="modal"]'));
            alert('UI Error: Could not display invoice details - modal elements missing');
            return;
        }
        
        // Enhanced debug logging
        console.log('🔍 === INVOICE DETAIL MODAL DEBUG ===');
        console.log('📋 Invoice ID:', invoice.id);
        console.log('📊 Full invoice object:', JSON.stringify(invoice, null, 2));
        console.log('🔧 Data structure analysis:', {
            hasId: !!invoice.id,
            hasStatus: !!invoice.status,
            hasData: !!invoice.data,
            hasParsedData: !!invoice.parsedData,
            hasVesselName: !!invoice.vesselName,
            hasCustomerName: !!invoice.customerName,
            dataType: typeof invoice.data,
            parsedDataType: typeof invoice.parsedData,
            dataIsEmpty: invoice.data && typeof invoice.data === 'object' ? Object.keys(invoice.data).length === 0 : true,
            parsedDataIsEmpty: invoice.parsedData && typeof invoice.parsedData === 'object' ? Object.keys(invoice.parsedData).length === 0 : true,
            dataKeys: invoice.data && typeof invoice.data === 'object' ? Object.keys(invoice.data) : [],
            parsedDataKeys: invoice.parsedData && typeof invoice.parsedData === 'object' ? Object.keys(invoice.parsedData) : []
        });
        console.log('🎨 Modal initial state:', {
            display: modal.style.display,
            visibility: modal.style.visibility,
            zIndex: modal.style.zIndex,
            className: modal.className
        });
        
        // Lock body scroll when modal opens
        document.body.classList.add('modal-open');
        
        // Parse invoice data - check multiple possible data locations
        // Backend might send data in different formats depending on the query
        console.log('📦 Raw data fields:', {
            data: invoice.data,
            parsedData: invoice.parsedData,
            dataType: typeof invoice.data,
            parsedDataType: typeof invoice.parsedData
        });
        
        const invoiceData = invoice.parsedData || invoice.data || {};
        
        // Ensure invoiceData is an object (might be a string that needs parsing)
        let parsedInvoiceData = {};
        if (typeof invoiceData === 'string') {
            console.log('📝 Data is string, attempting to parse:', invoiceData.substring(0, 100));
            try {
                parsedInvoiceData = JSON.parse(invoiceData);
                console.log('✅ Successfully parsed data:', parsedInvoiceData);
            } catch (e) {
                console.error('❌ Failed to parse invoice data:', e);
                console.error('Raw string that failed:', invoiceData);
                parsedInvoiceData = {};
            }
        } else {
            parsedInvoiceData = invoiceData;
            console.log('📊 Data is already an object:', parsedInvoiceData);
        }
        
        // Extract the actual vessel and customer info from the parsed data
        const vessel = parsedInvoiceData.vessel || {};
        const customer = parsedInvoiceData.customer || {};
        const scope = parsedInvoiceData.scope || {};
        const lineItems = scope.lineItems || [];
        
        console.log('🚢 Extracted vessel data:', vessel);
        console.log('👤 Extracted customer data:', customer);
        console.log('📄 Extracted scope data:', scope);
        console.log('📝 Line items count:', lineItems.length);
        
        // Check if invoice has changes
        const hasChanges = invoice.hasChanges || false;
        console.log('🔄 Has changes:', hasChanges);
        
        // Add debug info if data is missing
        if (!invoice || Object.keys(invoice).length === 0) {
            console.error('⚠️ Invoice object is empty or missing');
            modalBody.innerHTML = `
                <div class="error-state">
                    <h3>⚠️ No Data</h3>
                    <p>Invoice data is empty. Please refresh and try again.</p>
                    <pre>${JSON.stringify(invoice, null, 2)}</pre>
                </div>
            `;
            modal.style.display = 'block';
            modal.style.visibility = 'visible';
            modal.style.zIndex = '10000';
            modal.classList.add('active');
            return;
        }
        
        console.log('🎯 Building modal HTML with extracted data...');
        
        const modalHTML = `
            ${hasChanges ? `
                <div class="detail-tabs">
                    <button class="tab-button active" data-tab="details">Invoice Details</button>
                    <button class="tab-button" data-tab="changes">Changes ${invoice.unseenChanges ? '<span class="unseen-badge">NEW</span>' : ''}</button>
                </div>
            ` : ''}
            
            <div class="tab-content ${hasChanges ? 'active' : ''}" id="detailsTab">
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
                            <span class="detail-value">${this.formatCurrency(scope.total || invoice.total || 0)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Profit</span>
                            <span class="detail-value profit-value">${this.formatCurrency(scope.grossProfit || invoice.grossProfit || 0)} (${this.formatPercent(scope.profitPercent || invoice.profitPercent || 0)})</span>
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
            </div>
            
            ${hasChanges ? `
                <div class="tab-content" id="changesTab" style="display: none;">
                    <div class="changes-container">
                        <div class="loading-spinner">Loading changes...</div>
                    </div>
                </div>
            ` : ''}
        `;
        
        console.log('📝 Setting modal HTML (length:', modalHTML.length, 'chars)');
        console.log('🔍 modalBody element:', modalBody);
        console.log('🔍 modalBody id:', modalBody.id);
        console.log('🔍 modalBody className:', modalBody.className);
        
        // Set the HTML content
        modalBody.innerHTML = modalHTML;
        console.log('✅ Modal HTML set successfully');
        
        // Verify the HTML was actually inserted
        const insertedContent = modalBody.querySelector('.invoice-detail');
        console.log('🔍 Verifying inserted content:', {
            hasInvoiceDetail: !!insertedContent,
            modalBodyChildCount: modalBody.children.length,
            modalBodyHTML: modalBody.innerHTML.substring(0, 200) + '...',
            modalBodyVisible: window.getComputedStyle(modalBody).display !== 'none',
            modalBodyHeight: modalBody.offsetHeight
        });
        
        // Double-check the modal body is not hidden
        if (modalBody.style.display === 'none') {
            console.warn('⚠️ Modal body was hidden, making it visible');
            modalBody.style.display = 'block';
        }
        
        // Store current invoice ID for export
        modal.dataset.invoiceId = invoice.id;
        
        // Setup tab switching if there are changes
        if (hasChanges) {
            this.setupTabSwitching(invoice.id);
        }
        
        // CRITICAL: Display modal after content is set
        console.log('📋 Content set, now displaying modal...');
        this.forceModalDisplay(modal);
        
        // Log debugging info
        const rect = modal.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(modal);
        const modalBodyRect = modalBody.getBoundingClientRect();
        console.log('📐 Modal final display state:', {
            modal: {
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                position: computedStyle.position,
                zIndex: computedStyle.zIndex,
                opacity: computedStyle.opacity,
                rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    visible: rect.width > 0 && rect.height > 0
                }
            },
            modalBody: {
                hasContent: modalBody.innerHTML.length > 0,
                childCount: modalBody.children.length,
                rect: {
                    width: modalBodyRect.width,
                    height: modalBodyRect.height,
                    visible: modalBodyRect.width > 0 && modalBodyRect.height > 0
                }
            },
            panelFound: !!modal.querySelector('.invoice-detail-panel'),
            invoiceDetailFound: !!modal.querySelector('.invoice-detail')
        });
        console.log('=== END INVOICE DETAIL MODAL DEBUG ===');
        
        // Add event listeners for copy buttons
        this.setupCopyButtons();
        
        // Mark changes as seen if they were unseen
        if (invoice.unseenChanges) {
            this.markChangesSeen(invoice.id);
        }
    }
    
    setupTabSwitching(invoiceId) {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const targetTab = button.dataset.tab;
                
                // Update active states
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                tabContents.forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });
                
                const targetContent = document.getElementById(targetTab + 'Tab');
                if (targetContent) {
                    targetContent.style.display = 'block';
                    targetContent.classList.add('active');
                    
                    // Load changes if switching to changes tab
                    if (targetTab === 'changes') {
                        await this.loadChanges(invoiceId);
                    }
                }
            });
        });
    }
    
    async loadChanges(invoiceId) {
        const changesContainer = document.querySelector('#changesTab .changes-container');
        
        try {
            const response = await fetch(`/api/master/invoices/${invoiceId}/diff`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load changes');
            }
            
            const data = await response.json();
            
            changesContainer.innerHTML = this.renderChanges(data);
            
        } catch (error) {
            console.error('Failed to load changes:', error);
            changesContainer.innerHTML = '<div class="error-message">Failed to load changes</div>';
        }
    }
    
    renderChanges(diffData) {
        if (!diffData.diff) {
            return '<div class="no-changes">No changes detected</div>';
        }
        
        const { summary, sections } = diffData.diff;
        
        let html = `
            <div class="changes-summary">
                <span class="change-stat additions">+${summary.additions} additions</span>
                <span class="change-stat modifications">~${summary.modifications} modifications</span>
                <span class="change-stat removals">-${summary.removals} removals</span>
            </div>
        `;
        
        // Render each section with changes
        for (const [sectionName, changes] of Object.entries(sections)) {
            if (changes.length === 0) continue;
            
            const sectionTitle = sectionName.replace(/([A-Z])/g, ' $1').trim();
            
            html += `
                <div class="change-section">
                    <h4>${sectionTitle}</h4>
                    <div class="change-list">
            `;
            
            changes.forEach(change => {
                html += this.renderChange(change);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    renderChange(change) {
        const fieldName = change.path.split('.').pop();
        
        switch (change.type) {
            case 'added':
                return `
                    <div class="change-item added">
                        <span class="change-field">${fieldName}</span>
                        <span class="change-value new">${this.formatValue(change.new)}</span>
                    </div>
                `;
                
            case 'removed':
                return `
                    <div class="change-item removed">
                        <span class="change-field">${fieldName}</span>
                        <span class="change-value old">${this.formatValue(change.old)}</span>
                    </div>
                `;
                
            case 'changed':
            case 'modified':
                if (change.textDiff) {
                    return `
                        <div class="change-item modified">
                            <span class="change-field">${fieldName}</span>
                            <div class="text-diff">
                                ${this.renderTextDiff(change.textDiff)}
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="change-item modified">
                            <span class="change-field">${fieldName}</span>
                            <span class="change-value old">${this.formatValue(change.old)}</span>
                            <span class="change-arrow">→</span>
                            <span class="change-value new">${this.formatValue(change.new)}</span>
                        </div>
                    `;
                }
                
            default:
                return '';
        }
    }
    
    renderTextDiff(textDiff) {
        return textDiff.map(part => {
            if (part.operation === 'delete') {
                return `<span class="diff-delete">${part.text}</span>`;
            } else if (part.operation === 'insert') {
                return `<span class="diff-insert">${part.text}</span>`;
            } else {
                return part.text;
            }
        }).join('');
    }
    
    formatValue(value) {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return value.toLocaleString();
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            
            // Format: MMM DD, YYYY at HH:MM AM/PM
            const options = {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            };
            
            return date.toLocaleString('en-US', options);
        } catch (error) {
            console.error('Date formatting error:', error);
            return dateString;
        }
    }
    
    formatCurrency(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
    
    formatCurrencyRounded(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(amount));
    }
    
    formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return new Intl.NumberFormat('en-US').format(num);
    }
    
    formatPercent(value) {
        if (value === null || value === undefined || isNaN(value)) return '0%';
        return `${Math.round(value)}%`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    async markChangesSeen(invoiceId) {
        try {
            await fetch(`/api/master/invoices/${invoiceId}/mark-changes-seen`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                mode: 'same-origin'
            });
        } catch (error) {
            console.error('Failed to mark changes as seen:', error);
        }
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
        
        // Close modal on overlay click
        const overlay = document.querySelector('.invoice-detail-overlay');
        overlay?.addEventListener('click', () => {
            this.closeModal();
        });
        
        // Prevent closing when clicking on the panel itself
        const panel = document.querySelector('.invoice-detail-panel');
        panel?.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('detailModal').style.display === 'block') {
                this.closeModal();
            }
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
        
        // Clear date pickers
        this.filters.dateFrom = '';
        this.filters.dateTo = '';
        
        if (this.dateFromPicker) {
            this.dateFromPicker.setValue('');
        } else {
            document.getElementById('dateFrom').value = '';
        }
        
        if (this.dateToPicker) {
            this.dateToPicker.setValue('');
        } else {
            document.getElementById('dateTo').value = '';
        }
        
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
    
    forceModalDisplay(modal) {
        // BULLETPROOF MODAL DISPLAY
        console.log('🚀 FORCING MODAL DISPLAY...');
        
        // Step 1: Remove only previous force-show styles (not all styles)
        document.querySelectorAll('style[id*="modal-force-show"]').forEach(style => {
            style.remove();
        });
        
        // Step 2: Set classes and inline styles
        modal.className = 'invoice-detail-modal active show';
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        
        // Step 3: Verify it worked
        setTimeout(() => {
            const computed = window.getComputedStyle(modal);
            const modalBody = modal.querySelector('#modalBody');
            const rect = modal.getBoundingClientRect();
            
            console.log('✅ MODAL DISPLAY RESULT:', {
                display: computed.display,
                visibility: computed.visibility,
                opacity: computed.opacity,
                zIndex: computed.zIndex,
                position: computed.position,
                width: rect.width,
                height: rect.height,
                bodyHasContent: modalBody ? modalBody.innerHTML.length > 0 : false,
                bodyHeight: modalBody ? modalBody.offsetHeight : 0
            });
            
            if (computed.display === 'none') {
                console.error('❌ MODAL STILL HIDDEN - Something is overriding our styles!');
            } else if (modalBody && modalBody.innerHTML.length > 0 && modalBody.offsetHeight === 0) {
                console.error('❌ MODAL BODY HAS NO HEIGHT - Content may be hidden!');
                // Force the modal body to have height
                modalBody.style.minHeight = '400px';
            }
        }, 10);
        
        // Log what's inside the modal
        const modalBody = modal.querySelector('#modalBody');
        const detailPanel = modal.querySelector('.invoice-detail-panel');
        const invoiceDetail = modal.querySelector('.invoice-detail');
        console.log('🔍 Modal display check:', {
            modalDisplay: modal.style.display,
            modalBodyExists: !!modalBody,
            modalBodyContent: modalBody ? modalBody.innerHTML.length : 0,
            modalBodyHasChildren: modalBody ? modalBody.children.length : 0,
            detailPanelExists: !!detailPanel,
            invoiceDetailExists: !!invoiceDetail,
            modalChildren: modal.children.length
        });
        
        // Check if content is visible
        if (modalBody && modalBody.innerHTML.length > 0) {
            const bodyComputed = window.getComputedStyle(modalBody);
            console.log('📊 Modal body styles:', {
                display: bodyComputed.display,
                visibility: bodyComputed.visibility,
                color: bodyComputed.color,
                background: bodyComputed.background,
                height: modalBody.offsetHeight,
                hasContent: modalBody.textContent.trim().length > 0
            });
        }
    }
    
    closeModal() {
        console.log('🔐 Closing modal...');
        const modal = document.getElementById('detailModal');
        if (modal) {
            // Remove any force-show styles
            document.querySelectorAll('style').forEach(style => {
                if (style.id && style.id.includes('modal-force-show')) {
                    style.remove();
                }
            });
            
            // Simple hide
            modal.style.display = 'none';
            modal.classList.remove('active', 'show');
            
            // Clear flags
            this.modalClosing = false;
            this.modalIsIntentionallyOpen = false;
            
            console.log('✅ Modal closed');
        }
    }
    
    // Test method to verify modal display
    testModal() {
        console.log('🧪 Testing modal with dummy invoice data...');
        const testInvoice = {
            id: 'test-' + Date.now(),
            status: 'Completed',
            savedAt: new Date().toISOString(),
            vesselName: 'Test Vessel Marina',
            vesselWeight: 500,
            vesselBeam: 45,
            customerName: 'John Doe Marine Services',
            customerEmail: 'john@marineservices.com',
            customerPhone: '(555) 123-4567',
            subtotal: 15000,
            taxAmount: 1200,
            total: 16200,
            grossProfit: 4500,
            profitPercent: 27.78,
            userName: 'Admin User',
            userEmail: 'admin@marineinvoice.com',
            parsedData: {
                vessel: {
                    name: 'Test Vessel Marina',
                    weight: 500,
                    beam: 45
                },
                customer: {
                    customerName: 'John Doe Marine Services',
                    customerEmail: 'john@marineservices.com',
                    customerPhone: '(555) 123-4567'
                },
                scope: {
                    subtotal: 15000,
                    taxAmount: 1200,
                    total: 16200,
                    grossProfit: 4500,
                    profitPercent: 27.78,
                    lineItems: [
                        {
                            description: 'Hull Cleaning and Preparation',
                            type: 'Labor',
                            cost: 5000
                        },
                        {
                            description: 'Anti-Fouling Paint (10 gallons)',
                            type: 'Materials',
                            cost: 3000
                        },
                        {
                            description: 'Underwater Inspection Services',
                            type: 'Subcontractor',
                            cost: 2000
                        },
                        {
                            description: 'Crane Service for Haul-Out',
                            type: 'Equipment',
                            cost: 5000
                        }
                    ]
                }
            }
        };
        
        this.showDetailModal(testInvoice);
        console.log('✅ Test modal triggered');
        console.log('📋 Check if modal is:');
        console.log('   1. Visible on screen');
        console.log('   2. Centered properly');
        console.log('   3. Showing invoice data');
        console.log('   4. Has working close button');
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new MasterDashboard();
    // Make globally accessible for debugging
    window.masterDashboard = dashboard;
    
    // Ensure modal is hidden on page load
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active', 'show');
        // Clear any content that might be there
        const modalBody = document.getElementById('modalBody');
        if (modalBody) {
            modalBody.innerHTML = '';
        }
    }
    
    // Add console helper for testing
    console.log('🔧 Debug: To test modal display, run: window.masterDashboard.testModal()');
    console.log('🔧 Debug: To force close modal, run: window.masterDashboard.closeModal()');
    console.log('🔧 Debug: To nuclear close, run: document.getElementById("detailModal").style.display = "none"');
    
    // Global ESC key handler as fallback
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('detailModal');
            if (modal && (modal.style.display === 'block' || modal.style.display === 'flex')) {
                console.log('🚨 Emergency ESC key close');
                dashboard.closeModal();
            }
        }
    });
    
    // Global click handler for close buttons as nuclear option
    document.addEventListener('click', (e) => {
        // Check if clicked element is a close button or X
        if (e.target.id === 'closeModal' || 
            e.target.id === 'closeModalBtn' || 
            e.target.classList.contains('invoice-detail-close') ||
            e.target.classList.contains('invoice-detail-overlay')) {
            console.log('🚨 Nuclear close triggered for:', e.target);
            const modal = document.getElementById('detailModal');
            if (modal) {
                // Force hide no matter what
                modal.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                dashboard.modalClosing = false; // Reset flag
            }
        }
    }, true); // Use capture phase to catch before any stopPropagation
    
    // Add global nuclear close function
    window.nukeModal = function() {
        console.log('☢️ NUCLEAR MODAL CLOSE INITIATED');
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: fixed !important; left: -9999px !important; top: -9999px !important;';
            modal.className = '';
            
            // Inject permanent hide style
            let style = document.getElementById('permanent-modal-hide');
            if (!style) {
                style = document.createElement('style');
                style.id = 'permanent-modal-hide';
                document.head.appendChild(style);
            }
            style.textContent = '#detailModal { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: fixed !important; left: -9999px !important; }';
            
            console.log('☢️ Modal nuked successfully');
        }
    };
    
    console.log('💣 Emergency: If modal won\'t close, type: nukeModal()');
    
    // Add simple show modal function for testing
    window.showModal = function() {
        const modal = document.getElementById('detailModal');
        if (modal) {
            // Use the same bulletproof method as the dashboard
            dashboard.forceModalDisplay(modal);
        } else {
            console.error('Modal element not found!');
        }
    };
    console.log('🔧 Debug: To force show modal, type: showModal()');
});