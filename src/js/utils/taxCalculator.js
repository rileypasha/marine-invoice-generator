/**
 * Tax calculation utilities for per-line item tax management
 */

import { calculateLineItemCost } from './calculations.js';
import { applyMarkup } from './calculations.js';

export class TaxCalculator {
  /**
   * Calculate tax amount for a single line item
   * @param {Object} lineItem - The line item object
   * @param {string} markupRate - The markup rate as string (e.g., "2.5")
   * @returns {number} Tax amount rounded to 2 decimal places
   */
  static calculateLineTax(lineItem, markupRate) {
    // Return 0 for non-taxable or exempt items
    if (lineItem.taxStatus === 'non-taxable' || lineItem.taxStatus === 'exempt') {
      return 0;
    }
    
    // Default tax status to 'taxable' if not specified (for backward compatibility)
    const taxStatus = lineItem.taxStatus || 'taxable';
    if (taxStatus === 'non-taxable' || taxStatus === 'exempt') {
      return 0;
    }
    
    const baseCost = calculateLineItemCost(lineItem);
    let taxableAmount = baseCost;
    
    // Apply markup if not exempt from markup
    if (!this.isMarkupExempt(lineItem)) {
      taxableAmount = applyMarkup(baseCost, markupRate);
    }
    
    // Get tax rate, default to 8.75% if not specified
    const taxRate = lineItem.taxRate || 0.0875;
    
    // Calculate and round to 2 decimal places
    return Math.round(taxableAmount * taxRate * 100) / 100;
  }
  
  /**
   * Check if a line item is exempt from markup
   * @param {Object} lineItem - The line item object
   * @returns {boolean} True if exempt from markup
   */
  static isMarkupExempt(lineItem) {
    return (lineItem.jobType === 'Manual Entry' && lineItem.itemType === 'Labor') ||
           lineItem.jobType === 'Agent Services' ||
           lineItem.jobType === 'Clearance Fee';
  }
  
  /**
   * Calculate total tax for all line items
   * @param {Array} lineItems - Array of line item objects
   * @param {string} markupRate - The markup rate as string
   * @returns {number} Total tax amount
   */
  static calculateTotalTax(lineItems, markupRate) {
    return lineItems.reduce((total, item) => {
      return total + this.calculateLineTax(item, markupRate);
    }, 0);
  }
  
  /**
   * Get default tax configuration for a new line item
   * @param {string} jobType - Job type for context-specific defaults
   * @returns {Object} Default tax configuration
   */
  static getDefaultTaxConfig(jobType = null) {
    // Clearance fees are non-taxable by default
    if (jobType === 'Clearance Fee') {
      return {
        taxStatus: 'non-taxable',
        taxRate: 0,
        taxAmount: 0
      };
    }
    
    // Default for most line items
    return {
      taxStatus: 'taxable',
      taxRate: 0.0875, // 8.75%
      taxAmount: 0
    };
  }
  
  /**
   * Migrate legacy line item to include tax configuration
   * @param {Object} lineItem - Legacy line item
   * @param {boolean} scopeIsTaxable - Legacy scope tax setting
   * @returns {Object} Migrated line item with tax configuration
   */
  static migrateLineItemTax(lineItem, scopeIsTaxable) {
    // If already has tax configuration, return as-is
    if (lineItem.hasOwnProperty('taxStatus')) {
      return lineItem;
    }
    
    return {
      ...lineItem,
      taxStatus: scopeIsTaxable ? 'taxable' : 'non-taxable',
      taxRate: scopeIsTaxable ? 0.0875 : 0,
      taxAmount: 0 // Will be calculated
    };
  }
}

/**
 * Tax validation utilities
 */
export class TaxValidator {
  /**
   * Validate tax rate input
   * @param {number} rate - Tax rate as decimal (0.0875 for 8.75%)
   * @returns {boolean} True if valid
   * @throws {Error} If rate is invalid
   */
  static validateTaxRate(rate) {
    if (isNaN(rate) || rate < 0 || rate > 1) {
      throw new Error('Tax rate must be between 0% and 100%');
    }
    return true;
  }
  
  /**
   * Validate tax status
   * @param {string} status - Tax status
   * @returns {boolean} True if valid
   */
  static validateTaxStatus(status) {
    const validStatuses = ['taxable', 'non-taxable', 'exempt'];
    return validStatuses.includes(status);
  }
  
  /**
   * Validate tax calculation accuracy
   * @param {Object} lineItem - Line item to validate
   * @param {string} markupRate - Markup rate
   * @param {number} expectedTax - Expected tax amount
   * @returns {boolean} True if calculation is accurate (within 1 cent)
   */
  static validateTaxCalculation(lineItem, markupRate, expectedTax) {
    const calculatedTax = TaxCalculator.calculateLineTax(lineItem, markupRate);
    const difference = Math.abs(calculatedTax - expectedTax);
    
    if (difference > 0.01) {
      console.warn(`Tax calculation mismatch for item ${lineItem.id}: expected ${expectedTax}, got ${calculatedTax}`);
    }
    
    return difference <= 0.01;
  }
  
  /**
   * Validate total tax calculation
   * @param {Array} lineItems - Array of line items
   * @param {string} markupRate - Markup rate
   * @param {number} expectedTotal - Expected total tax
   * @returns {boolean} True if total is accurate
   */
  static validateTotalTax(lineItems, markupRate, expectedTotal) {
    const calculatedTotal = TaxCalculator.calculateTotalTax(lineItems, markupRate);
    const difference = Math.abs(calculatedTotal - expectedTotal);
    
    return difference <= 0.01;
  }
}