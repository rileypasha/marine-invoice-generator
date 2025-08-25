export function composeEmail(state, userManager) {
  const invoiceState = state.getState();
  const currentUser = userManager.getCurrentUser();
  const estimatorName = currentUser ? currentUser.name : 'Marine Group Team';
  
  // Calculate totals for the email
  const totals = calculateInvoiceTotals(invoiceState);
  
  const subject = encodeURIComponent(`Invoice Request - ${invoiceState.vessel.name || 'Marine Services'}`);
  
  const body = encodeURIComponent(`
Hello,

Please find below the invoice request details for ${invoiceState.vessel.name || 'your vessel'}:

VESSEL DETAILS:
- Vessel Name: ${invoiceState.vessel.name || 'N/A'}
- Weight: ${invoiceState.vessel.weight || '0'} tons
- Beam: ${invoiceState.vessel.beam || '0'} ft
- Customer Type: ${invoiceState.vessel.customerType || 'N/A'}

CUSTOMER INFORMATION:
- Estimator: ${estimatorName}
- Customer: ${invoiceState.customer.customerName || 'N/A'}
- Email: ${invoiceState.customer.customerEmail || 'N/A'}
- Phone: ${invoiceState.customer.customerPhone || 'N/A'}

SCOPE OF WORK & COSTS:
${invoiceState.scope.lineItems.map(item => 
  `- ${item.description}: ${item.jobType}${item.itemType ? ` (${item.itemType})` : ''} - $${(item.cost || 0).toFixed(2)}`
).join('\n')}

INVOICE TOTALS:
- Subtotal: $${totals.subtotal.toFixed(2)}
- Clearance Fee: $${totals.clearanceFee.toFixed(2)}${totals.taxAmount > 0 ? `
- Tax (8.75%): $${totals.taxAmount.toFixed(2)}` : ''}
- TOTAL: $${totals.total.toFixed(2)}
- Gross Profit: $${totals.grossProfit.toFixed(2)} (${totals.grossProfitPercent.toFixed(2)}%)

Please contact us if you have any questions.

Best regards,
${estimatorName}
Marine Group
  `.trim());
  
  const mailto = `mailto:?subject=${subject}&body=${body}`;
  
  // Handle email differently for Electron vs browser
  if (window.require) {
    // Electron environment - use shell to open email client
    const { shell } = window.require('electron');
    shell.openExternal(mailto);
  } else {
    // Browser environment - use window.location
    window.location.href = mailto;
  }
}

// Helper function to calculate invoice totals
function calculateInvoiceTotals(invoiceState) {
  const lineItems = invoiceState.scope.lineItems || [];
  const subtotal = lineItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  
  // Calculate clearance fee (2.5% or 12.5% markup)
  const markupRate = parseFloat(invoiceState.scope.markupRate || '2.5') / 100;
  const clearanceFee = subtotal * markupRate;
  
  // Calculate tax if applicable
  const isTaxable = invoiceState.scope.taxable === 'yes';
  const taxRate = 0.0875; // 8.75%
  const taxAmount = isTaxable ? (subtotal + clearanceFee) * taxRate : 0;
  
  // Calculate total
  const total = subtotal + clearanceFee + taxAmount;
  
  // Calculate gross profit
  const grossProfit = clearanceFee;
  const grossProfitPercent = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
  
  return {
    subtotal,
    clearanceFee,
    taxAmount,
    total,
    grossProfit,
    grossProfitPercent
  };
}