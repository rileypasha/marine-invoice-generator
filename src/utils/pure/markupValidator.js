/**
 * Markup validation utilities for per-line markup system
 */
export class MarkupValidator {
  /**
   * Validate custom markup input
   * @param {string|number} value - Markup value to validate
   * @returns {Object} Validation result with isValid, errors, and sanitizedValue
   */
  static validateCustomMarkup(value) {
    const errors = [];
    const stringValue = String(value).trim();
    
    if (stringValue === '') {
      errors.push('Markup is required');
      return { isValid: false, errors, sanitizedValue: null };
    }
    
    const numValue = parseFloat(stringValue);
    
    if (isNaN(numValue)) {
      errors.push('Markup must be a valid number');
    } else if (numValue < 0) {
      errors.push('Markup cannot be negative');
    } else if (numValue > 1000) {
      errors.push('Markup cannot exceed 1000%');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: errors.length === 0 ? numValue : null
    };
  }
  
  /**
   * Format markup value for display
   * @param {string|number} markupRate - Markup rate to format
   * @returns {string} Formatted markup display
   */
  static formatMarkupDisplay(markupRate) {
    const rate = parseFloat(markupRate || 0);
    return isNaN(rate) ? '0.00%' : `${rate.toFixed(2)}%`;
  }
  
  /**
   * Parse markup type from select value
   * @param {string} selectValue - Value from markup type select
   * @returns {Object} Parsed markup configuration
   */
  static parseMarkupType(selectValue) {
    if (selectValue === 'exempt') {
      return {
        markupType: 'exempt',
        markupRate: '0',
        isMarkupExempt: true
      };
    }
    
    if (selectValue.startsWith('preset-')) {
      const rate = selectValue.replace('preset-', '');
      return {
        markupType: 'preset',
        markupRate: rate,
        isMarkupExempt: false
      };
    }
    
    if (selectValue === 'custom') {
      return {
        markupType: 'custom',
        markupRate: '0', // Will be set by custom input
        isMarkupExempt: false
      };
    }
    
    // Fallback
    return {
      markupType: 'preset',
      markupRate: '2.5',
      isMarkupExempt: false
    };
  }
  
  /**
   * Get select value from markup configuration
   * @param {Object} lineItem - Line item with markup config
   * @returns {string} Select option value
   */
  static getSelectValue(lineItem) {
    if (lineItem.isMarkupExempt) {
      return 'exempt';
    }
    
    if (lineItem.markupType === 'custom') {
      return 'custom';
    }
    
    // Preset values
    const rate = lineItem.markupRate || '2.5';
    return `preset-${rate}`;
  }
}