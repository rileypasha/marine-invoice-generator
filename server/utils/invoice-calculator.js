/**
 * Invoice Calculator Utility
 * Calculates totals, subtotals, and tax from line items
 */

function calculateInvoiceTotals(data) {
    let subtotal = 0;
    let taxAmount = 0;
    let total = 0;
    
    // Extract line items from various possible locations
    const lineItems = data.lineItems || 
                     data.scope?.lineItems || 
                     (data.data && typeof data.data === 'object' && data.data.scope?.lineItems) ||
                     [];
    
    // Calculate subtotal from line items
    if (Array.isArray(lineItems)) {
        lineItems.forEach(item => {
            // Get the cost for this line item
            let itemCost = 0;
            
            // Try different ways the cost might be stored
            if (item.cost !== undefined && item.cost !== null && item.cost !== '') {
                itemCost = parseFloat(item.cost) || 0;
            } else if (item.manualCost !== undefined && item.manualCost !== null && item.manualCost !== '') {
                itemCost = parseFloat(item.manualCost) || 0;
            } else if (item.totalCost !== undefined && item.totalCost !== null && item.totalCost !== '') {
                itemCost = parseFloat(item.totalCost) || 0;
            } else if (item.amount !== undefined && item.amount !== null && item.amount !== '') {
                itemCost = parseFloat(item.amount) || 0;
            }
            
            // Apply markup if present
            const markupRate = parseFloat(data.markupRate || data.scope?.markupRate || 1);
            if (markupRate > 1) {
                itemCost = itemCost * markupRate;
            }
            
            subtotal += itemCost;
        });
    }
    
    // Check if invoice is taxable
    const isTaxable = data.isTaxable || data.scope?.isTaxable || false;
    const taxRate = parseFloat(data.taxRate || data.scope?.taxRate || 0.0725); // Default 7.25% tax
    
    if (isTaxable && subtotal > 0) {
        taxAmount = subtotal * taxRate;
    }
    
    // Calculate total
    total = subtotal + taxAmount;
    
    // If we calculated values, use them; otherwise fall back to provided values
    return {
        subtotal: subtotal > 0 ? subtotal : (data.subtotal ? parseFloat(data.subtotal) : 0),
        taxAmount: taxAmount > 0 ? taxAmount : (data.taxAmount ? parseFloat(data.taxAmount) : 0),
        total: total > 0 ? total : (data.total ? parseFloat(data.total) : 0)
    };
}

module.exports = {
    calculateInvoiceTotals
};