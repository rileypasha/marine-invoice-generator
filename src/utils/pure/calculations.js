import { CONSTANTS } from './constants.js';
import { parseNumber } from './formatters.js';

export function calculateClearanceFee(weight) {
  const weightNum = parseNumber(weight);
  return weightNum > CONSTANTS.WEIGHT_THRESHOLD 
    ? CONSTANTS.CLEARANCE_FEE_HIGH 
    : CONSTANTS.CLEARANCE_FEE_LOW;
}

export function calculateLaborCost(regularHours, otHours) {
  const regular = parseNumber(regularHours) * CONSTANTS.LABOR_RATE;
  const overtime = parseNumber(otHours) * CONSTANTS.OT_LABOR_RATE;
  return regular + overtime;
}

export function applyMarkup(cost, markupRate) {
  const rate = parseNumber(markupRate) / 100;
  return cost * (1 + rate);
}

export function calculateTax(subtotal, isTaxable) {
  return isTaxable ? subtotal * CONSTANTS.TAX_RATE : 0;
}

export function calculateGrossProfit(total, baseCost) {
  return total - baseCost;
}

export function calculateGrossProfitPercentage(grossProfit, total) {
  if (total === 0) return 0;
  return (grossProfit / total) * 100;
}

export function calculateLineItemCost(lineItem) {
  const { jobType, manualCost, laborHours, otHours } = lineItem;
  
  if (jobType === CONSTANTS.JOB_TYPES.AGENT_SERVICES) {
    return calculateLaborCost(laborHours, otHours);
  }
  
  return parseNumber(manualCost);
}

/**
 * Calculate total for individual line item with per-line markup
 * @param {Object} lineItem - Line item object
 * @returns {number} Total cost including markup (if applicable)
 */
export function calculateLineItemTotal(lineItem) {
  const baseCost = calculateLineItemCost(lineItem);
  
  // Check if markup is exempt
  if (lineItem.isMarkupExempt || isMarkupExempt(lineItem)) {
    return baseCost;
  }
  
  const markupRate = parseNumber(lineItem.markupRate || '0');
  return applyMarkup(baseCost, markupRate);
}

/**
 * Check if line item should be exempt from markup
 * @param {Object} lineItem - Line item object
 * @returns {boolean} True if exempt from markup
 */
export function isMarkupExempt(lineItem) {
  return (lineItem.jobType === 'Manual Entry' && lineItem.itemType === 'Labor') ||
         lineItem.jobType === 'Agent Services' ||
         lineItem.jobType === 'Clearance Fee';
}

/**
 * Calculate totals using per-line markup system
 * @param {Array} lineItems - Array of line item objects
 * @param {string} fallbackMarkupRate - Fallback markup rate for backward compatibility
 * @returns {Object} Calculation results
 */
export function calculateTotalsWithPerLineMarkup(lineItems) {
  let baseCost = 0;
  let subtotal = 0;
  let totalTax = 0;
  
  lineItems.forEach(item => {
    const cost = calculateLineItemCost(item);
    baseCost += cost;
    
    // Calculate subtotal with per-line markup
    const lineTotal = calculateLineItemTotal(item);
    subtotal += lineTotal;
    
    // Add per-line tax (if taxAmount is precalculated)
    if (item.taxAmount) {
      totalTax += item.taxAmount;
    }
  });
  
  const total = subtotal + totalTax;
  const grossProfit = calculateGrossProfit(subtotal, baseCost);
  const grossProfitPercent = calculateGrossProfitPercentage(grossProfit, total);
  
  return {
    baseCost,
    subtotal,
    tax: totalTax,
    total,
    grossProfit,
    grossProfitPercent
  };
}

/**
 * Legacy calculateTotals function for backward compatibility
 * @param {Array} lineItems - Array of line item objects  
 * @param {string} markupRate - Universal markup rate
 * @param {boolean} isTaxable - Whether invoice is taxable
 * @param {string} vesselWeight - Vessel weight for clearance fee calculation
 * @returns {Object} Calculation results
 */
export function calculateTotals(lineItems, markupRate, isTaxable, vesselWeight) {
  // Check if we have per-line markup data
  const hasPerLineMarkup = lineItems.some(item => 
    item.hasOwnProperty('markupRate') || item.hasOwnProperty('isMarkupExempt')
  );
  
  if (hasPerLineMarkup) {
    return calculateTotalsWithPerLineMarkup(lineItems);
  }
  
  // Legacy calculation for backward compatibility
  let baseCost = 0;
  let subtotal = 0;
  
  lineItems.forEach(item => {
    const cost = calculateLineItemCost(item);
    baseCost += cost;
    
    // Skip markup for Labor items since $80/$120 rates are already marked up
    if (item.jobType === 'Manual Entry' && item.itemType === 'Labor') {
      subtotal += cost; // Use cost directly without markup
    } else {
      subtotal += applyMarkup(cost, markupRate);
    }
  });
  
  const clearanceFee = calculateClearanceFee(vesselWeight);
  subtotal += clearanceFee;
  baseCost += clearanceFee;
  
  const tax = calculateTax(subtotal, isTaxable);
  const total = subtotal + tax;
  const grossProfit = calculateGrossProfit(subtotal, baseCost);
  const grossProfitPercent = calculateGrossProfitPercentage(grossProfit, total);
  
  return {
    baseCost,
    subtotal,
    clearanceFee,
    tax,
    total,
    grossProfit,
    grossProfitPercent
  };
}