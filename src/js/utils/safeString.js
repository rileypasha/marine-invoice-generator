/**
 * Safe String Utilities - Type-safe string operations
 *
 * Prevents "cannot read property 'trim' of undefined/null" and
 * "X.trim is not a function" errors by ensuring type safety
 */

/**
 * Safely convert any value to a string and trim it
 * @param {any} value - Value to convert and trim
 * @param {string} defaultValue - Default value if input is null/undefined
 * @returns {string} Trimmed string
 */
export function safeString(value, defaultValue = '') {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  try {
    return String(value).trim();
  } catch (error) {
    console.warn('🔧 safeString: Error converting value to string:', value, error);
    return defaultValue;
  }
}

/**
 * Safely convert any value to a string without trimming
 * @param {any} value - Value to convert
 * @param {string} defaultValue - Default value if input is null/undefined
 * @returns {string} String representation
 */
export function safeStringNoTrim(value, defaultValue = '') {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  try {
    return String(value);
  } catch (error) {
    console.warn('🔧 safeStringNoTrim: Error converting value to string:', value, error);
    return defaultValue;
  }
}

/**
 * Safely convert any value to a number
 * @param {any} value - Value to convert
 * @param {number} defaultValue - Default value if conversion fails
 * @returns {number} Numeric value
 */
export function safeNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const numValue = Number(value);
  return isNaN(numValue) ? defaultValue : numValue;
}

/**
 * Safely check if a value is empty (null, undefined, empty string, or whitespace-only)
 * @param {any} value - Value to check
 * @returns {boolean} True if value is considered empty
 */
export function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }

  try {
    return String(value).trim() === '';
  } catch (error) {
    return true;
  }
}

/**
 * Normalize data from session restore to prevent type errors
 * @param {Object} data - Raw data from localStorage/sessionStorage
 * @returns {Object} Normalized data with safe types
 */
export function normalizeSessionData(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  try {
    return {
      vessel: {
        name: safeString(data.vessel?.name),
        weight: safeString(data.vessel?.weight),
        beam: safeString(data.vessel?.beam)
      },
      customer: {
        estimatorName: safeString(data.customer?.estimatorName),
        customerName: safeString(data.customer?.customerName),
        customerEmail: safeString(data.customer?.customerEmail),
        customerPhone: safeString(data.customer?.customerPhone)
      },
      scope: {
        markupRate: safeString(data.scope?.markupRate, '2.5'),
        isTaxable: Boolean(data.scope?.isTaxable),
        lineItems: Array.isArray(data.scope?.lineItems) ? data.scope.lineItems.map(item => ({
          id: safeString(item.id),
          jobType: safeString(item.jobType),
          itemType: safeString(item.itemType),
          manualCost: safeString(item.manualCost),
          laborHours: safeString(item.laborHours),
          otHours: safeString(item.otHours),
          description: safeString(item.description),
          taxStatus: safeString(item.taxStatus, 'taxable'),
          taxRate: safeNumber(item.taxRate, 0.0875),
          markupType: safeString(item.markupType, 'preset'),
          markupRate: safeString(item.markupRate, '2.5'),
          isMarkupExempt: Boolean(item.isMarkupExempt),
          taxAmount: safeNumber(item.taxAmount, 0)
        })) : []
      },
      notes: {
        comments: Array.isArray(data.notes?.comments) ? data.notes.comments.map(comment => ({
          id: safeString(comment.id),
          text: safeString(comment.text),
          author: safeString(comment.author),
          timestamp: comment.timestamp
        })) : []
      }
    };
  } catch (error) {
    console.error('🔧 normalizeSessionData: Error normalizing data:', error);
    return {};
  }
}