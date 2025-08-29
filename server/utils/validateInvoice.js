/**
 * Simple validation without Zod to avoid version issues
 */

function coerceNumber(val) {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  
  const str = String(val).replace(/[$,]/g, '').trim();
  if (str === '') return null;
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function coerceMarkupRate(val) {
  if (!val || val === '') return 0;
  if (typeof val === 'number') return val;
  
  const str = String(val).replace('%', '').trim();
  if (str === '') return 0;
  
  const num = parseFloat(str);
  if (num > 10) return num / 100; // Convert percentage to decimal
  return isNaN(num) ? 0 : num;
}

function validateAndTransformInvoice(input) {
  const errors = [];
  
  // Ensure basic structure
  const result = {
    title: input.title || 'Untitled Invoice',
    data: input.data || {},
    metadata: input.metadata || {}
  };
  
  // Process vessel data
  if (result.data.vessel) {
    result.data.vessel = {
      name: result.data.vessel.name || null,
      weight: coerceNumber(result.data.vessel.weight),
      beam: coerceNumber(result.data.vessel.beam)
    };
  } else {
    result.data.vessel = { name: null, weight: null, beam: null };
  }
  
  // Process customer data
  if (result.data.customer) {
    const customer = result.data.customer;
    result.data.customer = {
      customerName: customer.customerName || null,
      customerEmail: customer.customerEmail || null,
      customerPhone: customer.customerPhone || null
    };
    
    // Basic email validation
    if (customer.customerEmail && !customer.customerEmail.includes('@')) {
      errors.push({ field: 'customer.customerEmail', message: 'Invalid email format' });
    }
  } else {
    result.data.customer = { 
      customerName: null, 
      customerEmail: null, 
      customerPhone: null 
    };
  }
  
  // Process scope and line items
  if (result.data.scope) {
    const scope = result.data.scope;
    result.data.scope = {
      markupRate: coerceMarkupRate(scope.markupRate),
      isTaxable: !!scope.isTaxable,
      lineItems: []
    };
    
    // Process line items
    if (Array.isArray(scope.lineItems)) {
      result.data.scope.lineItems = scope.lineItems.map(item => ({
        id: String(item.id || Date.now()),
        jobType: item.jobType || '',
        itemType: item.itemType || '',
        manualCost: coerceNumber(item.manualCost),
        laborHours: coerceNumber(item.laborHours),
        otHours: coerceNumber(item.otHours),
        description: item.description || '',
        cost: coerceNumber(item.cost),
        laborCost: coerceNumber(item.laborCost),
        materialCost: coerceNumber(item.materialCost),
        subcontractorCost: coerceNumber(item.subcontractorCost)
      }));
    }
  } else {
    result.data.scope = {
      markupRate: 0,
      isTaxable: false,
      lineItems: []
    };
  }
  
  // Add default labor rates if not present
  result.data.laborRate = coerceNumber(result.data.laborRate) || 85;
  result.data.otRate = coerceNumber(result.data.otRate) || 127.5;
  
  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }
  
  return {
    success: true,
    data: result
  };
}

module.exports = {
  validateAndTransformInvoice,
  coerceNumber,
  coerceMarkupRate
};