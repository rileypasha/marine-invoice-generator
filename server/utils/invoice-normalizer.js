/**
 * Invoice Normalization Utilities
 * Ensures consistent data format for accurate diffing
 */

/**
 * Normalize an invoice object for consistent comparison
 * @param {Object} invoice - Raw invoice data
 * @returns {Object} Normalized invoice data
 */
function normalizeInvoice(invoice) {
  if (!invoice) return null;
  
  // Deep clone to avoid mutations
  const normalized = JSON.parse(JSON.stringify(invoice));
  
  // Normalize recursively
  return normalizeValue(normalized);
}

/**
 * Recursively normalize any value
 */
function normalizeValue(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }
  
  // Handle strings
  if (typeof value === 'string') {
    return value.trim();
  }
  
  // Handle numbers
  if (typeof value === 'number') {
    // Round monetary values to 2 decimal places
    if (!Number.isInteger(value)) {
      return Math.round(value * 100) / 100;
    }
    return value;
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return value;
  }
  
  // Handle dates
  if (value instanceof Date || (typeof value === 'string' && isISODate(value))) {
    return new Date(value).toISOString();
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== null && item !== undefined)
      .map(item => normalizeValue(item))
      .sort((a, b) => {
        // Sort by lineId if available, otherwise by first meaningful field
        if (a.lineId && b.lineId) return a.lineId.localeCompare(b.lineId);
        if (a.id && b.id) return a.id.localeCompare(b.id);
        return JSON.stringify(a).localeCompare(JSON.stringify(b));
      });
  }
  
  // Handle objects
  if (typeof value === 'object' && value !== null) {
    const normalized = {};
    
    // Sort keys alphabetically
    const sortedKeys = Object.keys(value).sort();
    
    for (const key of sortedKeys) {
      // Skip system fields
      if (shouldSkipField(key)) continue;
      
      const normalizedValue = normalizeValue(value[key]);
      
      // Only include non-empty values
      if (normalizedValue !== '' && normalizedValue !== null) {
        normalized[key] = normalizedValue;
      }
    }
    
    return normalized;
  }
  
  return value;
}

/**
 * Check if a string is an ISO date
 */
function isISODate(str) {
  if (typeof str !== 'string') return false;
  const date = new Date(str);
  return !isNaN(date.getTime()) && str.includes('-');
}

/**
 * Fields to exclude from diff comparisons
 */
function shouldSkipField(fieldName) {
  const skipFields = [
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    'savedAt',
    'lastModified',
    'sessionId',
    'tempId'
  ];
  
  return skipFields.includes(fieldName);
}

/**
 * Extract key fields for summary
 */
function extractKeyFields(invoice) {
  if (!invoice) return {};
  
  return {
    invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || '',
    customerName: invoice.customerName || invoice.customer?.name || '',
    vesselName: invoice.vesselName || invoice.vessel?.name || '',
    total: invoice.total || invoice.grandTotal || 0,
    status: invoice.status || 'draft',
    market: invoice.market || '',
    lineItemCount: invoice.lineItems?.length || invoice.items?.length || 0
  };
}

/**
 * Generate a stable ID for line items
 */
function generateLineItemId(item) {
  if (item.lineId) return item.lineId;
  if (item.id) return item.id;
  
  // Generate hash from content
  const content = [
    item.description || '',
    item.quantity || 0,
    item.unitPrice || item.price || 0,
    item.category || ''
  ].join('|');
  
  return hashString(content);
}

/**
 * Simple string hash function
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalize line items with stable IDs
 */
function normalizeLineItems(items) {
  if (!Array.isArray(items)) return [];
  
  return items.map(item => {
    const normalized = normalizeValue(item);
    normalized.lineId = generateLineItemId(item);
    return normalized;
  });
}

module.exports = {
  normalizeInvoice,
  normalizeValue,
  extractKeyFields,
  generateLineItemId,
  normalizeLineItems,
  shouldSkipField
};