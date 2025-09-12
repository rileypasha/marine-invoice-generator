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
        
        // Add success notification method
        dashboard.showSuccess = function(message) {
            const container = document.querySelector('.dashboard-container') || document.body;
            let successEl = document.getElementById('systemSuccess');
            
            if (!successEl) {
                successEl = document.createElement('div');
                successEl.id = 'systemSuccess';
                successEl.className = 'system-success';
                successEl.style.cssText = 'background: #10b981; color: white; padding: 12px; margin: 10px 0; border-radius: 4px; font-size: 14px; transition: opacity 0.3s ease;';
                container.insertBefore(successEl, container.firstChild);
            }
            
            successEl.textContent = message;
            successEl.style.display = 'block';
            successEl.style.opacity = '1';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                successEl.style.opacity = '0';
                setTimeout(() => {
                    successEl.style.display = 'none';
                }, 300);
            }, 3000);
        };
        
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
                if (this.showError) {
                    this.showError("Failed to load invoice. Please try again.");
                } else {
                    alert("Failed to load invoice. Please try again.");
                }
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
            
            // Calculate line items and totals properly
            let baseCost = 0;
            let subtotal = 0;
            let totalTax = 0;
            
            // Helper function to calculate line item cost
            const calculateLineItemCost = (item) => {
                // Priority: manualCost > cost > calculated from hours
                if (item.manualCost != null && item.manualCost !== '') {
                    return parseFloat(item.manualCost) || 0;
                }
                if (item.cost != null && item.cost !== '') {
                    return parseFloat(item.cost) || 0;
                }
                
                // Calculate from labor hours
                let total = 0;
                const laborHours = parseFloat(item.laborHours) || 0;
                const otHours = parseFloat(item.otHours) || 0;
                
                if (item.jobType === 'Agent Services') {
                    total = (laborHours * 100) + (otHours * 150);
                } else if (item.itemType === 'Labor') {
                    total = (laborHours * 100) + (otHours * 150);
                } else {
                    total = (laborHours * 85) + (otHours * 127.5);
                }
                
                return total;
            };
            
            // Helper function to apply markup
            const applyMarkup = (cost, item) => {
                // Check if item is markup exempt by job type or description
                // Clearance Fee, Agent Services, and Manual Entry Labor are exempt
                if (item.isMarkupExempt || 
                    item.markupType === 'exempt' ||
                    item.jobType === 'Clearance Fee' ||
                    (item.description && item.description.includes('Clearance Fee')) ||
                    item.jobType === 'Agent Services' ||
                    (item.jobType === 'Manual Entry' && item.itemType === 'Labor')) {
                    return cost;
                }
                
                // For items with markupRate set to '0' or 0, no markup
                if (item.markupRate === '0' || item.markupRate === 0) {
                    return cost;
                }
                
                // Use item's specific markup rate or fall back to scope markup
                // Note: markupRate might be stored as percentage (2.5) or decimal (0.025)
                let markupRate = item.markupRate !== undefined ? item.markupRate : (scope.markupRate || '2.5');
                
                // Convert to number and ensure it's in decimal form
                markupRate = parseFloat(markupRate);
                if (markupRate > 1) {
                    // It's a percentage, convert to decimal
                    markupRate = markupRate / 100;
                }
                
                return cost * (1 + markupRate);
            };
            
            // Helper function to calculate tax
            const calculateTax = (item, totalWithMarkup) => {
                // Clearance Fee is always non-taxable
                if (item.jobType === 'Clearance Fee') {
                    return 0;
                }
                
                // Check tax status - look at both item-level and legacy fields
                if (item.taxStatus === 'non-taxable' || 
                    item.taxStatus === 'exempt' ||
                    item.isTaxExempt === true ||
                    item.isTaxable === false) {
                    return 0;
                }
                
                // For items without explicit tax status, check if they're taxable
                // Default to taxable unless explicitly set otherwise
                if (item.taxStatus === undefined && item.isTaxable === false) {
                    return 0;
                }
                
                // Only apply tax if taxStatus is explicitly 'taxable' or undefined (default)
                // If the line item doesn't have a taxStatus, check the description
                if (!item.taxStatus && item.description && item.description.includes('Clearance Fee')) {
                    return 0;
                }
                
                const taxRate = parseFloat(item.taxRate || 0.0875);
                return totalWithMarkup * taxRate;
            };
            
            // Generate line items HTML
            const lineItemsHTML = lineItems.map(item => {
                const cost = calculateLineItemCost(item);
                baseCost += cost;
                
                const totalWithMarkup = applyMarkup(cost, item);
                const markupAmount = totalWithMarkup - cost;
                subtotal += totalWithMarkup;
                
                const taxAmount = calculateTax(item, totalWithMarkup);
                totalTax += taxAmount;
                
                const total = totalWithMarkup + taxAmount;
                
                // Log for debugging
                if (item.jobType === 'Clearance Fee' || (item.description && item.description.includes('Clearance Fee'))) {
                    console.log('Clearance Fee calculation:', {
                        cost,
                        totalWithMarkup,
                        markupAmount,
                        taxAmount,
                        total,
                        item
                    });
                }
                
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
            
            // Calculate final totals
            const total = subtotal + totalTax;
            const grossProfit = subtotal - baseCost;
            const profitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;
            
            // Log totals for debugging
            console.log('Master Dashboard Totals:', {
                baseCost,
                subtotal,
                totalTax,
                total,
                grossProfit,
                profitPercent: profitPercent.toFixed(2) + '%'
            });
            
            // For backward compatibility, check if scope has totals already
            const finalSubtotal = subtotal || scope.subtotal || invoice.subtotal || 0;
            const finalTaxAmount = totalTax || scope.taxAmount || invoice.taxAmount || 0;
            const finalTotal = total || scope.total || invoice.total || 0;
            const clearanceFee = scope.clearanceFee || 0;
            
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
                                <span>$${finalSubtotal.toFixed(2)}</span>
                            </div>
                            ${clearanceFee > 0 ? `
                            <div class="total-row">
                                <span>Clearance Fee:</span>
                                <span>$${clearanceFee.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            ${finalTaxAmount > 0 ? `
                            <div class="total-row tax-row">
                                <span>Tax (8.75%):</span>
                                <span>$${finalTaxAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="total-row total-final">
                                <span><strong>Total:</strong></span>
                                <span><strong>$${finalTotal.toFixed(2)}</strong></span>
                            </div>
                        </div>
                        
                        <div class="profit-section">
                            <div class="profit-row">
                                <span>Gross Profit:</span>
                                <span>$${grossProfit.toFixed(2)}</span>
                            </div>
                            <div class="profit-row">
                                <span>Profit Margin:</span>
                                <span>${profitPercent.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                    ` : '<p>No line items available</p>'}
                    
                    ${invoice.comments ? `
                    <div class="invoice-section comments-section">
                        <h3>Comments</h3>
                        <div class="comments-display">
                            <p>${invoice.comments.replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="invoice-section comments-section">
                        <h3>Add Comment</h3>
                        <div class="comment-input-container">
                            <textarea id="masterCommentInput" class="comment-input" placeholder="Add a comment to this invoice..." rows="3"></textarea>
                            <button id="addCommentBtn" class="btn btn-primary" onclick="window.masterDashboard.addComment('${invoice.id}')">Add Comment</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Show the modal and prevent body scroll
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            
            // Store invoice data for export
            modal.dataset.invoiceId = invoice.id;
            this.currentInvoiceData = invoice;
        };
        
        // Add comment functionality
        dashboard.addComment = async function(invoiceId) {
            const commentInput = document.getElementById('masterCommentInput');
            const comment = commentInput ? commentInput.value.trim() : '';
            
            if (!comment) {
                alert('Please enter a comment');
                return;
            }
            
            try {
                // Get existing invoice data
                const invoice = this.currentInvoiceData;
                if (!invoice) {
                    throw new Error('No invoice data available');
                }
                
                // Append comment with timestamp and user info
                const timestamp = new Date().toLocaleString();
                const currentUser = 'Master Admin'; // You may want to get this from session
                const newComment = `[${timestamp}] ${currentUser}: ${comment}`;
                
                const existingComments = invoice.comments || '';
                const updatedComments = existingComments ? 
                    `${existingComments}\n\n${newComment}` : newComment;
                
                // Update invoice with new comment
                console.log('Sending comment to:', `/api/master/invoices/${invoiceId}/comment`);
                console.log('Comment payload:', { comment: updatedComments });
                
                const response = await fetch(`/api/master/invoices/${invoiceId}/comment`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ comment: updatedComments })
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server error response:', errorText);
                    throw new Error(`Failed to add comment: ${response.status} - ${errorText}`);
                }
                
                // Update local data
                invoice.comments = updatedComments;
                
                // Refresh the preview
                this.showInvoicePreview(invoice);
                
                // Clear input
                if (commentInput) {
                    commentInput.value = '';
                }
                
                // Show success message with themed notification
                if (window.masterDashboard && window.masterDashboard.showSuccess) {
                    window.masterDashboard.showSuccess('Comment added successfully');
                } else {
                    // Fallback to inline success message
                    const container = document.querySelector('.dashboard-container') || document.body;
                    const successEl = document.createElement('div');
                    successEl.style.cssText = 'background: #10b981; color: white; padding: 12px; margin: 10px 0; border-radius: 4px; font-size: 14px; position: fixed; top: 20px; right: 20px; z-index: 10001;';
                    successEl.textContent = 'Comment added successfully';
                    container.appendChild(successEl);
                    setTimeout(() => successEl.remove(), 3000);
                }
                
            } catch (error) {
                console.error('Error adding comment:', error);
                // Show error message with themed notification
                if (window.masterDashboard && window.masterDashboard.showError) {
                    window.masterDashboard.showError('Failed to add comment. Please try again.');
                } else {
                    // Fallback to inline error message
                    const container = document.querySelector('.dashboard-container') || document.body;
                    const errorEl = document.createElement('div');
                    errorEl.style.cssText = 'background: #f44336; color: white; padding: 12px; margin: 10px 0; border-radius: 4px; font-size: 14px; position: fixed; top: 20px; right: 20px; z-index: 10001;';
                    errorEl.textContent = 'Failed to add comment. Please try again.';
                    container.appendChild(errorEl);
                    setTimeout(() => errorEl.remove(), 3000);
                }
            }
        };
        
        // Add close modal functionality
        dashboard.closeInvoicePreview = function() {
            const modal = document.getElementById("invoicePreviewModal");
            if (modal) {
                modal.classList.remove('active');
                // Restore body scroll
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
                
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