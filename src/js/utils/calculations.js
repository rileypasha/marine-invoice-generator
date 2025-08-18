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

export function calculateTotals(lineItems, markupRate, isTaxable, vesselWeight) {
  let baseCost = 0;
  let subtotal = 0;
  
  lineItems.forEach(item => {
    const cost = calculateLineItemCost(item);
    baseCost += cost;
    subtotal += applyMarkup(cost, markupRate);
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