export function composeEmail(state, userManager) {
  const invoiceState = state.getState();
  const currentUser = userManager.getCurrentUser();
  const estimatorName = currentUser ? currentUser.name : 'Marine Group Team';
  
  const subject = encodeURIComponent(`Invoice Request - ${invoiceState.vessel.name || 'Marine Services'}`);
  
  const body = encodeURIComponent(`
Dear ${invoiceState.customer.customerName || 'Customer'},

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

SCOPE OF WORK:
${invoiceState.scope.lineItems.map(item => 
  `- ${item.description}: ${item.jobType}${item.itemType ? ` (${item.itemType})` : ''}`
).join('\n')}

Please contact us if you have any questions.

Best regards,
${estimatorName}
Marine Group
  `.trim());
  
  const mailto = `mailto:${invoiceState.customer.customerEmail || ''}?subject=${subject}&body=${body}`;
  
  window.open(mailto);
}