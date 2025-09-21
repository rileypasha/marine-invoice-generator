import React, { useMemo, useEffect, useState } from 'react';
import { useInvoice, useInvoiceActions } from '../../context/InvoiceContext.jsx';
import { formatCurrency, formatPercentage, formatDate } from '../../../js/utils/formatters.js';
import { calculateLineItemCost, calculateLineItemTotal } from '../../../js/utils/calculations.js';
import { TaxCalculator } from '../../../js/utils/taxCalculator.js';

// Import Magic UI components
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { Badge } from '../ui/badge.jsx';
import { Separator } from '../ui/separator.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import {
  Eye,
  Ship,
  User,
  DollarSign,
  Calculator,
  TrendingUp,
  AlertCircle,
  FileText
} from 'lucide-react';

// Mock user context - in production this would come from a proper auth context
const useUser = () => {
  return {
    currentUser: {
      name: 'Marine Group Team',
      email: 'team@marinegroup.com'
    }
  };
};

const InvoiceHeader = ({ vesselData, customerData, estimatorName }) => {
  return (
    <div className="space-y-6">
      <div className="text-center border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">MARINE SERVICES INVOICE</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invoice Date: {formatDate()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vessel Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Ship className="h-4 w-4" />
            Vessel Information
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-medium">Name:</span>
              <span>{vesselData.name || '-'}</span>
              <span className="font-medium">Weight:</span>
              <span>{vesselData.weight || '0'} tons</span>
              <span className="font-medium">Beam:</span>
              <span>{vesselData.beam || '0'} ft</span>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <User className="h-4 w-4" />
            Customer Information
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Name:</span> {customerData.customerName || '-'}</div>
              <div><span className="font-medium">Email:</span> {customerData.customerEmail || '-'}</div>
              <div><span className="font-medium">Phone:</span> {customerData.customerPhone || '-'}</div>
              <div><span className="font-medium">Address:</span> {customerData.customerAddress || '-'}</div>
              <div><span className="font-medium">Estimator:</span> {estimatorName}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LineItemsTable = ({ lineItems }) => {
  if (!lineItems || lineItems.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No services added yet. Add line items to see them in the preview.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 font-semibold text-gray-900">
        <FileText className="h-4 w-4" />
        Services & Line Items
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Base Cost</th>
              <th className="text-right p-3 font-medium">Markup</th>
              <th className="text-right p-3 font-medium">Tax</th>
              <th className="text-right p-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.filter(item => item.jobType).map((item) => {
              try {
                const baseCost = calculateLineItemCost(item) || 0;
                const totalWithMarkup = calculateLineItemTotal(item) || 0;
                const markupAmount = totalWithMarkup - baseCost;
                const lineTax = TaxCalculator.calculateLineTax(item, item.markupRate || '0') || 0;
                const finalTotal = totalWithMarkup + lineTax;

              // Create service type display
              let serviceTypeDisplay = item.itemType || item.jobType || 'Service';
              if (item.jobType === 'Manual Entry') {
                serviceTypeDisplay = item.itemType || 'Service';
              }

              // Add labor hours info if applicable
              let laborInfo = '';
              if ((item.itemType === 'Labor' || item.jobType === 'Agent Services') && (item.laborHours || item.otHours)) {
                const regularHours = item.laborHours || 0;
                const otHours = item.otHours || 0;
                if (regularHours > 0 && otHours > 0) {
                  laborInfo = ` (${regularHours}hrs + ${otHours}hrs OT)`;
                } else if (regularHours > 0) {
                  laborInfo = ` (${regularHours}hrs)`;
                } else if (otHours > 0) {
                  laborInfo = ` (${otHours}hrs OT)`;
                }
              }

                return (
                  <tr key={item.id || Date.now() + Math.random()} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      {item.description || 'Description needed'}
                      {laborInfo && <span className="text-muted-foreground text-sm">{laborInfo}</span>}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{serviceTypeDisplay}</Badge>
                    </td>
                    <td className="p-3 text-right font-mono">{formatCurrency(baseCost)}</td>
                    <td className="p-3 text-right font-mono text-green-600">{formatCurrency(markupAmount)}</td>
                    <td className="p-3 text-right font-mono text-blue-600">{formatCurrency(lineTax)}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatCurrency(finalTotal)}</td>
                  </tr>
                );
              } catch (error) {
                console.warn('Error calculating line item:', item, error);
                return (
                  <tr key={item.id || Date.now() + Math.random()} className="border-b hover:bg-muted/30">
                    <td className="p-3 text-red-600" colSpan="6">
                      Error calculating item: {item.description || 'Unknown item'}
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TotalsSection = ({ lineItems }) => {
  const totals = useMemo(() => {
    if (!lineItems || !Array.isArray(lineItems)) {
      return {
        baseCost: 0,
        subtotal: 0,
        totalTax: 0,
        total: 0,
        grossProfit: 0,
        grossProfitPercent: 0
      };
    }

    let subtotal = 0;
    let totalTax = 0;
    let baseCost = 0;

    lineItems.filter(item => item?.jobType).forEach(item => {
      try {
        const cost = calculateLineItemCost(item) || 0;
        baseCost += cost;

        const lineTotal = calculateLineItemTotal(item) || 0;
        subtotal += lineTotal;

        const lineTax = TaxCalculator.calculateLineTax(item, item.markupRate || '0') || 0;
        totalTax += lineTax;
      } catch (error) {
        console.warn('Error calculating totals for item:', item, error);
      }
    });

    const total = subtotal + totalTax;
    const grossProfit = subtotal - baseCost;
    const grossProfitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;

    return {
      baseCost,
      subtotal,
      totalTax,
      total,
      grossProfit,
      grossProfitPercent
    };
  }, [lineItems]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 font-semibold text-gray-900">
        <Calculator className="h-4 w-4" />
        Invoice Totals
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Subtotal (with markup):</span>
            <span className="font-mono font-semibold">{formatCurrency(totals.subtotal)}</span>
          </div>

          {totals.totalTax > 0 && (
            <div className="flex justify-between items-center text-blue-600">
              <span className="text-sm">Tax:</span>
              <span className="font-mono font-semibold">{formatCurrency(totals.totalTax)}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total:</span>
            <span className="font-mono">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 font-medium text-green-700">
            <TrendingUp className="h-4 w-4" />
            Profit Analysis
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Base Cost:</span>
              <div className="font-mono font-semibold">{formatCurrency(totals.baseCost)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Gross Profit:</span>
              <div className="font-mono font-semibold text-green-600">
                {formatCurrency(totals.grossProfit)} ({formatPercentage(totals.grossProfitPercent)})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const InvoicePreviewReact = () => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  let state = null;
  let actions = null;
  let contextError = null;

  try {
    const context = useInvoice();
    state = context?.state;
    actions = useInvoiceActions();
  } catch (err) {
    contextError = err;
    console.warn('Error accessing invoice context:', err);
  }

  const { currentUser } = useUser();

  useEffect(() => {
    const loadInvoiceForView = async () => {
      // Check if we're in view mode and need to load invoice data
      const urlParams = new URLSearchParams(window.location.search);
      const isViewMode = urlParams.get('view') === 'true';
      const invoiceId = urlParams.get('invoice');

      if (isViewMode && invoiceId && (!state?.meta?.currentInvoiceId || state.meta.currentInvoiceId !== invoiceId)) {
        console.log('📖 InvoicePreviewReact: Loading invoice for view mode...', invoiceId);

        try {
          // Get invoice data from InvoiceStorage (localStorage)
          if (window.app && window.app.invoiceStorage) {
            const invoice = window.app.invoiceStorage.getInvoice(invoiceId);

            if (invoice) {
              console.log('✅ Invoice data loaded from storage:', invoice);

              // Extract the actual invoice data from the wrapper structure
              // Stored invoices may have structure: { id, title, data: {vessel, customer, scope...}, status }
              // or direct structure: { id, title, vessel, customer, scope... }
              const invoiceData = invoice.data || invoice;

              // Load into React Context using the loadInvoiceForEditing action
              if (actions?.loadInvoiceForEditing) {
                actions.loadInvoiceForEditing(invoiceData, invoiceId);
                console.log('✅ Invoice loaded into React Context for preview');
              }
            } else {
              console.error('❌ Invoice not found in storage:', invoiceId);
              setError('Invoice not found');
            }
          } else {
            console.error('❌ InvoiceStorage not available');
            setError('Storage not available');
          }
        } catch (err) {
          console.error('❌ Error loading invoice:', err);
          setError('Failed to load invoice data');
        }
      }

      setIsLoading(false);
    };

    loadInvoiceForView();
  }, [state?.meta?.currentInvoiceId, actions]);

  // Handle context or loading errors
  if (contextError || error) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Invoice Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Unable to load invoice context. Please refresh the page or contact support.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Handle loading state
  if (isLoading || !state) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Invoice Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Loading invoice data...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Get data from context with safe fallbacks
  const vesselData = state?.vessel || { name: '', weight: '', beam: '' };
  const customerData = state?.customer || {
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: ''
  };
  const lineItems = state?.scope?.lineItems || state?.services?.lineItems || [];
  const estimatorName = currentUser?.name || 'Marine Group Team';


  const hasContent = vesselData?.name || customerData?.customerName || (lineItems && lineItems.length > 0);

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Invoice Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {!hasContent ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Fill out the vessel information, customer details, and add services to see the invoice preview.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <InvoiceHeader
              vesselData={vesselData}
              customerData={customerData}
              estimatorName={estimatorName}
            />

            <Separator />

            <LineItemsTable lineItems={lineItems} />

            <Separator />

            <TotalsSection lineItems={lineItems} />

            {lineItems.length > 0 && (
              <>
                <Separator />
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Ready for Review:</strong> Invoice preview is complete and ready for final review.
                    All calculations include individual line item markup and tax configurations.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoicePreviewReact;