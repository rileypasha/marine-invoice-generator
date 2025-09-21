import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from '../index.js';

const InvoicePreviewUI = ({
  invoiceData = {},
  user = null,
  showFullPreview = false
}) => {
  // Safely extract data with proper defaults and validation
  const vessel = invoiceData?.vessel || {};
  const customer = invoiceData?.customer || {};
  const scope = invoiceData?.scope || {};
  const notes = invoiceData?.notes || {};
  const metadata = invoiceData?.metadata || {};

  // Get line items from the correct location - support both structures for compatibility
  const lineItems = Array.isArray(scope?.lineItems) ? scope.lineItems :
                   Array.isArray(invoiceData?.services) ? invoiceData.services :
                   Array.isArray(invoiceData?.lineItems) ? invoiceData.lineItems : [];

  // Calculate totals with safe array operations - check scope first, fallback to calculated
  const scopeSubtotal = scope?.subtotal;
  const scopeTaxAmount = scope?.taxAmount;
  const scopeTotal = scope?.total;

  // Calculate from line items if scope totals not available
  const calculatedSubtotal = lineItems.length > 0
    ? lineItems.reduce((sum, item) => {
        // Try different field names that might contain the amount
        const amount = item?.total || item?.cost || item?.amount || 0;
        return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
      }, 0)
    : 0;

  const taxRate = metadata?.taxRate || scope?.taxRate || 8.75;
  const calculatedTaxableAmount = lineItems.length > 0
    ? lineItems
        .filter(item => item?.taxStatus === 'taxable' || item?.taxable !== false)
        .reduce((sum, item) => {
          const amount = item?.total || item?.cost || item?.amount || 0;
          return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
        }, 0)
    : 0;
  const calculatedTaxAmount = (calculatedTaxableAmount * taxRate) / 100;
  const calculatedTotal = calculatedSubtotal + calculatedTaxAmount;

  // Use scope values if available, otherwise use calculated values
  const subtotal = typeof scopeSubtotal === 'number' ? scopeSubtotal : calculatedSubtotal;
  const taxAmount = typeof scopeTaxAmount === 'number' ? scopeTaxAmount : calculatedTaxAmount;
  const total = typeof scopeTotal === 'number' ? scopeTotal : calculatedTotal;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return new Date().toLocaleDateString();
    return new Date(dateString).toLocaleDateString();
  };

  if (!vessel.name && !customer.customerName && lineItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium mb-2">Invoice Preview</h3>
        <p className="text-sm">Fill in the form to see your invoice preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Compact Preview (sidebar) */}
      {!showFullPreview && (
        <div className="space-y-4 text-sm">

          {/* Header */}
          <div className="text-center border-b pb-4">
            <h3 className="font-bold text-lg">MARINE GROUP</h3>
            <p className="text-xs text-muted-foreground">Invoice Preview</p>
            {metadata.title && (
              <p className="text-xs font-medium mt-1">{metadata.title}</p>
            )}
          </div>

          {/* Key Details */}
          <div className="space-y-2">
            {vessel.name && (
              <div>
                <span className="font-medium">Vessel:</span> {vessel.name}
              </div>
            )}
            {customer.customerName && (
              <div>
                <span className="font-medium">Customer:</span> {customer.customerName}
              </div>
            )}
            <div>
              <span className="font-medium">Date:</span> {formatDate(metadata.invoiceDate)}
            </div>
          </div>

          {/* Line Items Summary */}
          {lineItems.length > 0 && (
            <div className="space-y-2">
              <div className="font-medium border-b pb-1">Line Items ({lineItems.length})</div>
              {lineItems.slice(0, 3).map((item, index) => (
                <div key={item.id || index} className="flex justify-between text-xs">
                  <span className="truncate mr-2">{item.jobType || item.description || item.name || 'Service'}</span>
                  <span className="font-medium">{formatCurrency(item.total || item.cost || item.amount || 0)}</span>
                </div>
              ))}
              {lineItems.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{lineItems.length - 3} more items
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-2">
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview */}
      {showFullPreview && (
        <div className="bg-white p-8 shadow-lg border rounded-lg max-w-4xl mx-auto" style={{ minHeight: '11in' }}>

          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
            <h1 className="text-3xl font-bold text-gray-800">MARINE GROUP</h1>
            <p className="text-lg text-gray-600 mt-2">Marine Services & Consulting</p>
            <div className="text-sm text-gray-500 mt-2">
              Phone: (555) 123-4567 | Email: info@marinegroup.com
            </div>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Invoice To:</h2>
              <div className="space-y-1">
                <p className="font-medium">{customer.customerName || 'Customer Name'}</p>
                {customer.customerEmail && <p>{customer.customerEmail}</p>}
                {customer.customerPhone && <p>{customer.customerPhone}</p>}
                {customer.customerAddress && (
                  <p className="whitespace-pre-line">{customer.customerAddress}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold mb-4">Invoice Details:</h2>
              <div className="space-y-1">
                <p><span className="font-medium">Invoice #:</span> {metadata.invoiceNumber || 'TBD'}</p>
                <p><span className="font-medium">Date:</span> {formatDate(metadata.invoiceDate)}</p>
                {customer.estimatorName && (
                  <p><span className="font-medium">Estimator:</span> {customer.estimatorName}</p>
                )}
              </div>
            </div>
          </div>

          {/* Vessel Info */}
          {vessel.name && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Vessel Information</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="font-medium">Name:</span> {vessel.name}</div>
                {vessel.weight && <div><span className="font-medium">Weight:</span> {vessel.weight} tons</div>}
                {vessel.beam && <div><span className="font-medium">Beam:</span> {vessel.beam} ft</div>}
              </div>
            </div>
          )}

          {/* Line Items Table */}
          {lineItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Services Provided</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4">Service</TableHead>
                    <TableHead className="w-1/3">Description</TableHead>
                    <TableHead className="text-right">Base Cost</TableHead>
                    <TableHead className="text-right">Markup</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, index) => {
                    // Calculate per-line-item values
                    const baseCost = parseFloat(item.total || item.cost || item.amount || 0);

                    // Get markup rate and convert from percentage to decimal if needed
                    // For items with markupRate set to '0' or 0, no markup
                    if (item.markupRate === '0' || item.markupRate === 0) {
                      var markupRate = 0;
                    } else {
                      // Use item's specific markup rate or fall back to scope markup
                      // Note: markupRate might be stored as percentage (2.5) or decimal (0.025)
                      let rawMarkupRate = item.markupRate !== undefined ? item.markupRate : (scope?.markupRate || metadata?.markupRate || '0');

                      // Convert to number and ensure it's in decimal form
                      var markupRate = parseFloat(rawMarkupRate);
                      if (markupRate > 1) {
                        // It's a percentage, convert to decimal
                        markupRate = markupRate / 100;
                      }
                    }

                    const markupAmount = baseCost * markupRate;
                    const subtotalWithMarkup = baseCost + markupAmount;

                    // Determine if item is taxable - handle special cases and legacy fields
                    let isTaxable = true; // Default to taxable

                    // Clearance Fee is always non-taxable
                    if (item.jobType === 'Clearance Fee' ||
                        (item.description && item.description.includes('Clearance Fee'))) {
                      isTaxable = false;
                    }
                    // Check tax status - look at both item-level and legacy fields
                    else if (item.taxStatus === 'non-taxable' ||
                        item.taxStatus === 'exempt' ||
                        item.isTaxExempt === true ||
                        item.isTaxable === false) {
                      isTaxable = false;
                    }
                    // For items without explicit tax status, check if they're taxable
                    else if (item.taxStatus === undefined && item.isTaxable === false) {
                      isTaxable = false;
                    }

                    // Calculate tax - tax rate is already in decimal form (0.0875 = 8.75%)
                    const taxRate = parseFloat(item.taxRate || scope?.taxRate || metadata?.taxRate || 0.0875);
                    const taxAmount = isTaxable ? subtotalWithMarkup * taxRate : 0;

                    // Final total for this line item
                    const lineTotal = subtotalWithMarkup + taxAmount;

                    return (
                      <TableRow key={item.id || index}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{item.jobType || item.name || item.description || 'Service'}</div>
                            {(item.itemType || item.type) && (
                              <Badge variant="secondary" className="text-xs">
                                {item.itemType || item.type}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm">{item.description || item.details || item.jobType || ''}</p>
                            {item.hours && (
                              <p className="text-xs text-gray-600">
                                {item.hours} hours @ {formatCurrency(item.rate || item.hourlyRate || 0)}/hr
                              </p>
                            )}
                            {item.quantity && (
                              <p className="text-xs text-gray-600">Quantity: {item.quantity}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(baseCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(markupAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(taxAmount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(lineTotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Totals */}
          <div className="border-t-2 border-gray-300 pt-4 mb-8">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({taxRate}%):</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {notes.generalNotes && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">Notes</h3>
              <p className="text-sm whitespace-pre-line bg-gray-50 p-4 rounded">
                {notes.generalNotes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 border-t pt-4">
            <p>Thank you for your business!</p>
            <p className="mt-2">
              Please remit payment within 30 days of invoice date.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicePreviewUI;