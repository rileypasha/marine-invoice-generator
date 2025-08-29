const { Decimal } = require('@prisma/client/runtime/library');

class InvoiceCalculator {
  constructor() {
    this.TAX_RATE = 0.0875; // 8.75% California tax
  }
  
  /**
   * Calculate the cost for a single line item
   * Priority: manualCost > cost > calculated from hours
   */
  calculateLineCost(item, laborRate = 85, otRate = 127.5) {
    // Priority: manualCost > cost > calculated from hours
    if (item.manualCost != null && item.manualCost > 0) {
      return new Decimal(item.manualCost);
    }
    
    if (item.cost != null && item.cost > 0) {
      return new Decimal(item.cost);
    }
    
    // Calculate from hours
    let total = new Decimal(0);
    if (item.laborHours != null && item.laborHours > 0) {
      total = total.plus(new Decimal(item.laborHours).times(laborRate));
    }
    if (item.otHours != null && item.otHours > 0) {
      total = total.plus(new Decimal(item.otHours).times(otRate));
    }
    
    return total;
  }
  
  /**
   * Calculate totals for an invoice
   * @returns {Object} Object with Decimal values for subtotal, taxAmount, total, grossProfit, profitPercent
   */
  calculateTotals(lineItems, markupRate, isTaxable, laborRate = 85, otRate = 127.5) {
    // Handle empty or invalid input
    if (!Array.isArray(lineItems)) {
      lineItems = [];
    }
    
    // Calculate base costs
    let baseCost = new Decimal(0);
    
    for (const item of lineItems) {
      const lineCost = this.calculateLineCost(item, laborRate, otRate);
      baseCost = baseCost.plus(lineCost);
    }
    
    // Apply markup
    // markupRate is a decimal (0.5 = 50%, 2.5 = 250%)
    const markupMultiplier = new Decimal(1).plus(markupRate || 0);
    const subtotal = baseCost.times(markupMultiplier);
    
    // Calculate tax
    const taxAmount = isTaxable 
      ? subtotal.times(this.TAX_RATE) 
      : new Decimal(0);
    
    // Total
    const total = subtotal.plus(taxAmount);
    
    // Gross profit (markup amount)
    const grossProfit = subtotal.minus(baseCost);
    
    // Profit percentage
    const profitPercent = baseCost.isZero() 
      ? new Decimal(0)
      : grossProfit.dividedBy(baseCost).times(100);
    
    // Round all to 2 decimal places using banker's rounding
    return {
      subtotal: subtotal.toDecimalPlaces(2),
      taxAmount: taxAmount.toDecimalPlaces(2),
      total: total.toDecimalPlaces(2),
      grossProfit: grossProfit.toDecimalPlaces(2),
      profitPercent: profitPercent.toDecimalPlaces(2),
      // Also return as plain numbers for compatibility
      subtotalNumber: parseFloat(subtotal.toFixed(2)),
      taxAmountNumber: parseFloat(taxAmount.toFixed(2)),
      totalNumber: parseFloat(total.toFixed(2)),
      grossProfitNumber: parseFloat(grossProfit.toFixed(2)),
      profitPercentNumber: parseFloat(profitPercent.toFixed(2))
    };
  }
  
  /**
   * Legacy compatibility function
   */
  calculateInvoiceTotals(data) {
    // Extract line items from various possible locations
    const lineItems = data.lineItems || 
                     data.scope?.lineItems || 
                     (data.data && typeof data.data === 'object' && data.data.scope?.lineItems) ||
                     [];
    
    const markupRate = parseFloat(data.markupRate || data.scope?.markupRate || 0);
    const isTaxable = data.isTaxable || data.scope?.isTaxable || false;
    
    const result = this.calculateTotals(lineItems, markupRate, isTaxable);
    
    // Return in legacy format
    return {
      subtotal: result.subtotalNumber,
      taxAmount: result.taxAmountNumber,
      total: result.totalNumber
    };
  }
}

// Export singleton instance
const invoiceCalculator = new InvoiceCalculator();

module.exports = {
  invoiceCalculator,
  InvoiceCalculator,
  // Legacy export
  calculateInvoiceTotals: (data) => invoiceCalculator.calculateInvoiceTotals(data)
};