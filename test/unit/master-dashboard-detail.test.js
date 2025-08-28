const { expect } = require('chai');
const sinon = require('sinon');
const { JSDOM } = require('jsdom');

// Mock the MasterDashboard class
class MasterDashboard {
    constructor() {
        this.invoices = [];
        this.lastViewedInvoiceId = null;
    }
    
    async viewInvoice(id) {
        // Validate invoice ID
        if (!id) {
            console.error('Invalid invoice ID:', id);
            this.showError('Invalid invoice ID');
            return;
        }
        
        // Store last viewed ID for retry
        this.lastViewedInvoiceId = id;
        
        // Show loading state immediately
        this.showLoadingModal();
        
        try {
            console.log('🔍 Fetching invoice details for ID:', id);
            
            const response = await fetch(`/api/master/invoices/${id}`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            console.log('📡 Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to fetch invoice details'}`);
            }
            
            const invoice = await response.json();
            console.log('✅ Invoice data received:', invoice);
            
            // Validate response has required fields
            if (!invoice || !invoice.id) {
                console.error('❌ Invalid invoice data:', invoice);
                throw new Error('Invalid invoice data received');
            }
            
            this.showDetailModal(invoice);
        } catch (error) {
            console.error('Failed to load invoice details:', error);
            this.showError(`Failed to load invoice: ${error.message}`);
        }
    }
    
    showLoadingModal() {
        const modal = document.getElementById('detailModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) {
            console.error('Modal elements not found');
            return;
        }
        
        modalBody.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading invoice details...</p>
            </div>
        `;
        
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
        
        modalBody.innerHTML = `
            <div class="error-state">
                <h3>⚠️ Error</h3>
                <p>${this.escapeHtml(message)}</p>
                <div class="error-buttons">
                    <button class="btn-secondary" onclick="window.masterDashboard.closeModal()">Close</button>
                    <button class="btn-primary" onclick="window.masterDashboard.retryLastView()">Retry</button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '10000';
    }
    
    retryLastView() {
        if (this.lastViewedInvoiceId) {
            this.viewInvoice(this.lastViewedInvoiceId);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showDetailModal(invoice) {
        const modal = document.getElementById('detailModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) {
            console.error('Modal elements not found');
            alert('UI Error: Could not display invoice details');
            return;
        }
        
        // For testing, just set simple content
        modalBody.innerHTML = `
            <div class="invoice-detail">
                <h3>Invoice ${invoice.id}</h3>
                <p>Status: ${invoice.status}</p>
                <p>Vessel: ${invoice.vesselName}</p>
                <p>Customer: ${invoice.customerName}</p>
                <p>Total: ${invoice.total}</p>
            </div>
        `;
        
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '10000';
    }
    
    closeModal() {
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

describe('MasterDashboard Invoice Detail View', function() {
    let dashboard;
    let dom;
    let document;
    let window;
    let fetchStub;
    let consoleErrorStub;
    
    beforeEach(function() {
        // Setup DOM
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div id="detailModal" style="display: none;">
                        <div id="modalBody"></div>
                    </div>
                </body>
            </html>
        `);
        
        document = dom.window.document;
        window = dom.window;
        
        // Make document and window global for tests
        global.document = document;
        global.window = window;
        global.alert = sinon.stub();
        
        // Setup fetch stub
        fetchStub = sinon.stub(global, 'fetch');
        
        // Setup console stubs
        consoleErrorStub = sinon.stub(console, 'error');
        
        // Create dashboard instance
        dashboard = new MasterDashboard();
        window.masterDashboard = dashboard;
    });
    
    afterEach(function() {
        fetchStub.restore();
        consoleErrorStub.restore();
        delete global.document;
        delete global.window;
        delete global.alert;
    });
    
    describe('viewInvoice method', function() {
        it('should handle missing invoice ID gracefully', async function() {
            await dashboard.viewInvoice(null);
            
            expect(consoleErrorStub.calledWith('Invalid invoice ID:', null)).to.be.true;
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Invalid invoice ID');
        });
        
        it('should handle empty invoice ID gracefully', async function() {
            await dashboard.viewInvoice('');
            
            expect(consoleErrorStub.calledWith('Invalid invoice ID:', '')).to.be.true;
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Invalid invoice ID');
        });
        
        it('should show loading state immediately', async function() {
            const validResponse = {
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    id: 'test-123',
                    status: 'saved',
                    vesselName: 'Test Vessel',
                    customerName: 'Test Customer',
                    total: 1000
                })
            };
            
            fetchStub.returns(Promise.resolve(validResponse));
            
            const promise = dashboard.viewInvoice('test-123');
            
            // Check loading state is shown immediately
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Loading invoice details');
            
            await promise;
        });
        
        it('should store last viewed invoice ID for retry', async function() {
            const validResponse = {
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    id: 'test-456',
                    status: 'saved',
                    vesselName: 'Test Vessel',
                    customerName: 'Test Customer',
                    total: 1000
                })
            };
            
            fetchStub.returns(Promise.resolve(validResponse));
            
            await dashboard.viewInvoice('test-456');
            
            expect(dashboard.lastViewedInvoiceId).to.equal('test-456');
        });
        
        it('should display error on 404 response', async function() {
            const errorResponse = {
                ok: false,
                status: 404,
                text: () => Promise.resolve('Invoice not found')
            };
            
            fetchStub.returns(Promise.resolve(errorResponse));
            
            await dashboard.viewInvoice('nonexistent-id');
            
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Error');
            expect(modalBody.innerHTML).to.include('Failed to load invoice');
            expect(modalBody.innerHTML).to.include('HTTP 404');
        });
        
        it('should display error on 500 response', async function() {
            const errorResponse = {
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal server error')
            };
            
            fetchStub.returns(Promise.resolve(errorResponse));
            
            await dashboard.viewInvoice('test-id');
            
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Error');
            expect(modalBody.innerHTML).to.include('HTTP 500');
        });
        
        it('should handle network errors gracefully', async function() {
            fetchStub.rejects(new Error('Network error'));
            
            await dashboard.viewInvoice('test-id');
            
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Error');
            expect(modalBody.innerHTML).to.include('Network error');
        });
        
        it('should validate invoice data has required fields', async function() {
            const invalidResponse = {
                ok: true,
                status: 200,
                json: () => Promise.resolve({}) // Missing required fields
            };
            
            fetchStub.returns(Promise.resolve(invalidResponse));
            
            await dashboard.viewInvoice('test-id');
            
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Invalid invoice data received');
        });
        
        it('should include correct headers in fetch request', async function() {
            const validResponse = {
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    id: 'test-123',
                    status: 'saved',
                    vesselName: 'Test Vessel',
                    customerName: 'Test Customer',
                    total: 1000
                })
            };
            
            fetchStub.returns(Promise.resolve(validResponse));
            
            await dashboard.viewInvoice('test-123');
            
            expect(fetchStub.calledOnce).to.be.true;
            const fetchCall = fetchStub.getCall(0);
            expect(fetchCall.args[0]).to.equal('/api/master/invoices/test-123');
            expect(fetchCall.args[1].headers['Accept']).to.equal('application/json');
            expect(fetchCall.args[1].headers['X-Requested-With']).to.equal('XMLHttpRequest');
            expect(fetchCall.args[1].credentials).to.equal('include');
        });
    });
    
    describe('showDetailModal method', function() {
        it('should render invoice data when valid', function() {
            const invoice = {
                id: 'test-id',
                status: 'saved',
                vesselName: 'Test Vessel',
                customerName: 'Test Customer',
                total: 1000,
                parsedData: { vessel: {}, customer: {}, scope: {} }
            };
            
            dashboard.showDetailModal(invoice);
            
            const modal = document.getElementById('detailModal');
            const modalBody = document.getElementById('modalBody');
            
            expect(modal.style.display).to.equal('block');
            expect(modal.style.visibility).to.equal('visible');
            expect(modal.style.zIndex).to.equal('10000');
            expect(modalBody.innerHTML).to.include('Test Vessel');
            expect(modalBody.innerHTML).to.include('Test Customer');
            expect(modalBody.innerHTML).to.include('test-id');
        });
        
        it('should handle missing modal elements gracefully', function() {
            // Remove modal from DOM
            const modal = document.getElementById('detailModal');
            modal.remove();
            
            const invoice = {
                id: 'test-id',
                status: 'saved',
                vesselName: 'Test Vessel',
                customerName: 'Test Customer',
                total: 1000
            };
            
            dashboard.showDetailModal(invoice);
            
            expect(global.alert.calledWith('UI Error: Could not display invoice details')).to.be.true;
            expect(consoleErrorStub.calledWith('Modal elements not found')).to.be.true;
        });
    });
    
    describe('Error state UI', function() {
        it('should show retry button in error state', async function() {
            const errorResponse = {
                ok: false,
                status: 404,
                text: () => Promise.resolve('Not found')
            };
            
            fetchStub.returns(Promise.resolve(errorResponse));
            
            await dashboard.viewInvoice('test-id');
            
            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).to.include('Retry');
            expect(modalBody.innerHTML).to.include('Close');
        });
        
        it('should retry last view when retry button clicked', async function() {
            dashboard.lastViewedInvoiceId = 'test-retry-id';
            
            const validResponse = {
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    id: 'test-retry-id',
                    status: 'saved',
                    vesselName: 'Retry Vessel',
                    customerName: 'Retry Customer',
                    total: 2000
                })
            };
            
            fetchStub.returns(Promise.resolve(validResponse));
            
            await dashboard.retryLastView();
            
            expect(fetchStub.calledWith('/api/master/invoices/test-retry-id')).to.be.true;
        });
    });
    
    describe('Loading state UI', function() {
        it('should display loading spinner', function() {
            dashboard.showLoadingModal();
            
            const modal = document.getElementById('detailModal');
            const modalBody = document.getElementById('modalBody');
            
            expect(modal.style.display).to.equal('block');
            expect(modalBody.innerHTML).to.include('spinner');
            expect(modalBody.innerHTML).to.include('Loading invoice details');
        });
        
        it('should handle missing modal elements in loading state', function() {
            const modal = document.getElementById('detailModal');
            modal.remove();
            
            dashboard.showLoadingModal();
            
            expect(consoleErrorStub.calledWith('Modal elements not found')).to.be.true;
        });
    });
});