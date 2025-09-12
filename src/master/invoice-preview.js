// Invoice Preview Enhancement for Master Dashboard
(function() {
    'use strict';
    
    // Wait for dashboard to load
    document.addEventListener('DOMContentLoaded', function() {
        // Wait a bit for the main dashboard script to initialize
        setTimeout(function() {
            if (window.masterDashboard) {
                enhanceDashboard();
            } else {
                console.error('Master dashboard not initialized');
            }
        }, 500);
    });
    
    function enhanceDashboard() {
        const dashboard = window.masterDashboard;
        
        // Override the viewInvoice method
        dashboard.viewInvoice = async function(invoiceId) {
            if (!invoiceId) {
                console.error("No ID provided to viewInvoice");
                return;
            }
            
            try {
                console.log("📡 Fetching invoice:", invoiceId);
                const response = await fetch(`/api/master/invoices/${invoiceId}`, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch invoice: ${response.status}`);
                }
                
                const invoice = await response.json();
                console.log("✅ Invoice fetched:", invoice);
                
                this.showInvoicePreview(invoice);
            } catch (error) {
                console.error("Error in viewInvoice:", error);
                alert("Failed to load invoice. Please try again.");
            }
        };
        
        // Add the new showInvoicePreview method
        dashboard.showInvoicePreview = function(invoice) {
            const modal = document.getElementById("invoicePreviewModal");
            const modalBody = document.getElementById("invoicePreviewBody");
            
            if (!modal || !modalBody) {
                console.error("Invoice preview modal elements not found");
                return;
            }
            
            // Parse invoice data
            const data = invoice.parsedData || invoice.data || {};
            const vessel = data.vessel || {};
            const customer = data.customer || {};
            const scope = data.scope || {};
            const lineItems = scope.lineItems || [];
            
            // Format date
            const invoiceDate = new Date(invoice.savedAt || Date.now()).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Generate line items HTML
            const lineItemsHTML = lineItems.map(item => {
                const cost = item.cost || item.manualCost || 0;
                const markupAmount = item.markupAmount || 0;
                const taxAmount = item.taxAmount || 0;
                const total = cost + markupAmount + taxAmount;
                
                return `
                    <tr>
                        <td>${item.description || 'N/A'}</td>
                        <td>${item.jobType || item.itemType || item.type || 'N/A'}</td>
                        <td>$${cost.toFixed(2)}</td>
                        <td class="markup-column">$${markupAmount.toFixed(2)}</td>
                        <td class="tax-column">$${taxAmount.toFixed(2)}</td>
                        <td>$${total.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
            
            // Calculate totals
            const subtotal = scope.subtotal || invoice.subtotal || 0;
            const clearanceFee = scope.clearanceFee || 0;
            const taxAmount = scope.taxAmount || invoice.taxAmount || 0;
            const total = scope.total || invoice.total || 0;
            const grossProfit = scope.grossProfit || invoice.grossProfit || 0;
            const profitPercent = scope.profitPercent || invoice.profitPercent || 0;
            
            // Build the invoice preview HTML
            modalBody.innerHTML = `
                <div class="invoice-preview">
                    <div class="invoice-header">
                        <img src="https://i.imgur.com/A9K1ByZ.png" alt="Marine Group" class="invoice-logo">
                        <h2>Invoice Request Form</h2>
                        <p class="invoice-date">Date: <span>${invoiceDate}</span></p>
                    </div>
                    
                    <div class="invoice-section">
                        <h3>Vessel Details</h3>
                        <div class="invoice-details">
                            <p><strong>Vessel:</strong> <span>${vessel.name || invoice.vesselName || 'N/A'}</span></p>
                            <p><strong>Weight:</strong> <span>${vessel.weight || invoice.vesselWeight || 'N/A'} tons</span></p>
                            <p><strong>Beam:</strong> <span>${vessel.beam || invoice.vesselBeam || 'N/A'} ft</span></p>
                        </div>
                    </div>
                    
                    <div class="invoice-section">
                        <h3>Customer Information</h3>
                        <div class="invoice-details">
                            <p><strong>Estimator:</strong> <span>${invoice.userName || 'N/A'}</span></p>
                            <p><strong>Customer:</strong> <span>${customer.customerName || invoice.customerName || 'N/A'}</span></p>
                            <p><strong>Email:</strong> <span>${customer.customerEmail || invoice.customerEmail || 'N/A'}</span></p>
                            <p><strong>Phone:</strong> <span>${customer.customerPhone || invoice.customerPhone || 'N/A'}</span></p>
                            <p><strong>Address:</strong> <span>${customer.customerAddress || invoice.customerAddress || 'N/A'}</span></p>
                        </div>
                    </div>
                    
                    ${lineItems.length > 0 ? `
                    <div class="invoice-section">
                        <h3>Services</h3>
                        <table class="invoice-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Type</th>
                                    <th>Cost</th>
                                    <th class="markup-column">Markup</th>
                                    <th class="tax-column">Tax</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lineItemsHTML}
                            </tbody>
                        </table>
                        
                        <div class="invoice-totals">
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span>$${subtotal.toFixed(2)}</span>
                            </div>
                            ${clearanceFee > 0 ? `
                            <div class="total-row">
                                <span>Clearance Fee:</span>
                                <span>$${clearanceFee.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            ${taxAmount > 0 ? `
                            <div class="total-row tax-row">
                                <span>Tax (8.75%):</span>
                                <span>$${taxAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="total-row total-final">
                                <span><strong>Total:</strong></span>
                                <span><strong>$${total.toFixed(2)}</strong></span>
                            </div>
                        </div>
                        
                        ${grossProfit > 0 ? `
                        <div class="profit-section">
                            <div class="profit-row">
                                <span>Gross Profit:</span>
                                <span>$${grossProfit.toFixed(2)}</span>
                            </div>
                            <div class="profit-row">
                                <span>Profit Margin:</span>
                                <span>${profitPercent.toFixed(1)}%</span>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    ` : '<p>No line items available</p>'}
                </div>
            `;
            
            // Show the modal
            modal.classList.add('active');
            
            // Store invoice data for export
            modal.dataset.invoiceId = invoice.id;
            this.currentInvoiceData = invoice;
        };
        
        // Add close modal functionality
        dashboard.closeInvoicePreview = function() {
            const modal = document.getElementById("invoicePreviewModal");
            if (modal) {
                modal.classList.remove('active');
                const modalBody = document.getElementById("invoicePreviewBody");
                if (modalBody) {
                    modalBody.innerHTML = '';
                }
            }
        };
        
        // Setup event listeners for the new modal
        setupModalEventListeners();
    }
    
    function setupModalEventListeners() {
        // Close button in header
        const closeBtn = document.getElementById('closePreviewModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                if (window.masterDashboard) {
                    window.masterDashboard.closeInvoicePreview();
                }
            });
        }
        
        // Close button in footer
        const closeFooterBtn = document.getElementById('closePreviewBtn');
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', function() {
                if (window.masterDashboard) {
                    window.masterDashboard.closeInvoicePreview();
                }
            });
        }
        
        // Click outside modal to close
        const modal = document.getElementById('invoicePreviewModal');
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    if (window.masterDashboard) {
                        window.masterDashboard.closeInvoicePreview();
                    }
                }
            });
        }
        
        // Export CSV button
        const exportBtn = document.getElementById('exportInvoiceCsv');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                if (window.masterDashboard && window.masterDashboard.currentInvoiceData) {
                    exportInvoiceToCSV(window.masterDashboard.currentInvoiceData);
                }
            });
        }
        
        // ESC key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const modal = document.getElementById('invoicePreviewModal');
                if (modal && modal.classList.contains('active')) {
                    if (window.masterDashboard) {
                        window.masterDashboard.closeInvoicePreview();
                    }
                }
            }
        });
    }
    
    function exportInvoiceToCSV(invoice) {
        // Parse invoice data
        const data = invoice.parsedData || invoice.data || {};
        const vessel = data.vessel || {};
        const customer = data.customer || {};
        const scope = data.scope || {};
        const lineItems = scope.lineItems || [];
        
        // Create CSV content
        let csv = 'Invoice Export\n';
        csv += `Invoice ID,${invoice.id}\n`;
        csv += `Date,${new Date(invoice.savedAt || Date.now()).toLocaleDateString()}\n`;
        csv += `Status,${invoice.status}\n`;
        csv += '\nVessel Details\n';
        csv += `Vessel Name,${vessel.name || invoice.vesselName || 'N/A'}\n`;
        csv += `Weight,${vessel.weight || invoice.vesselWeight || 'N/A'} tons\n`;
        csv += `Beam,${vessel.beam || invoice.vesselBeam || 'N/A'} ft\n`;
        csv += '\nCustomer Information\n';
        csv += `Customer,${customer.customerName || invoice.customerName || 'N/A'}\n`;
        csv += `Email,${customer.customerEmail || invoice.customerEmail || 'N/A'}\n`;
        csv += `Phone,${customer.customerPhone || invoice.customerPhone || 'N/A'}\n`;
        csv += '\nLine Items\n';
        csv += 'Description,Type,Cost,Markup,Tax,Total\n';
        
        lineItems.forEach(item => {
            const cost = item.cost || item.manualCost || 0;
            const markupAmount = item.markupAmount || 0;
            const taxAmount = item.taxAmount || 0;
            const total = cost + markupAmount + taxAmount;
            csv += `"${item.description || 'N/A'}","${item.jobType || item.itemType || 'N/A'}",${cost.toFixed(2)},${markupAmount.toFixed(2)},${taxAmount.toFixed(2)},${total.toFixed(2)}\n`;
        });
        
        csv += '\nTotals\n';
        csv += `Subtotal,${(scope.subtotal || invoice.subtotal || 0).toFixed(2)}\n`;
        csv += `Tax,${(scope.taxAmount || invoice.taxAmount || 0).toFixed(2)}\n`;
        csv += `Total,${(scope.total || invoice.total || 0).toFixed(2)}\n`;
        csv += `Gross Profit,${(scope.grossProfit || invoice.grossProfit || 0).toFixed(2)}\n`;
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${invoice.id}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
})();