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
  const { vessel = {}, customer = {}, services = [], notes = {}, metadata = {} } = invoiceData;

  // Calculate totals
  const subtotal = services.reduce((sum, service) => sum + (service.total || 0), 0);
  const taxRate = metadata.taxRate || 8.75;
  const taxableAmount = services
    .filter(service => service.taxStatus === 'taxable')
    .reduce((sum, service) => sum + (service.total || 0), 0);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const total = subtotal + taxAmount;

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

  if (!vessel.name && !customer.customerName && services.length === 0) {
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

          {/* Services Summary */}
          {services.length > 0 && (
            <div className="space-y-2">
              <div className="font-medium border-b pb-1">Services ({services.length})</div>
              {services.slice(0, 3).map((service, index) => (
                <div key={service.id || index} className="flex justify-between text-xs">
                  <span className="truncate mr-2">{service.jobType}</span>
                  <span className="font-medium">{formatCurrency(service.total)}</span>
                </div>
              ))}
              {services.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{services.length - 3} more services
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

          {/* Services Table */}
          {services.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Services Provided</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Service</TableHead>
                    <TableHead className="w-1/2">Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service, index) => (
                    <TableRow key={service.id || index}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{service.jobType}</div>
                          {service.itemType && (
                            <Badge variant="secondary" className="text-xs">
                              {service.itemType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{service.description}</p>
                          {service.hours && (
                            <p className="text-xs text-gray-600">
                              {service.hours} hours @ {formatCurrency(service.rate)}/hr
                            </p>
                          )}
                          {service.quantity && (
                            <p className="text-xs text-gray-600">Quantity: {service.quantity}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(service.total)}
                      </TableCell>
                    </TableRow>
                  ))}
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