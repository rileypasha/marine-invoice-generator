import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './InvoiceView.css';

interface LineItem {
  description?: string;
  jobType?: string;
  itemType?: string;
  type?: string;
  laborHours?: number;
  otHours?: number;
  cost?: number;
  manualCost?: number;
  markupRate?: number;
  taxRate?: number;
  taxStatus?: string;
  isTaxExempt?: boolean;
  isTaxable?: boolean;
  isMarkupExempt?: boolean;
  markupType?: string;
}

interface Invoice {
  id: string;
  invoiceNumber?: string;
  title?: string;
  status: 'saved' | 'draft' | 'submitted';
  total: number;
  subtotal?: number;
  taxAmount?: number;
  grossProfit?: number;
  profitPercent?: number;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  userName?: string;
  vesselName?: string;
  vesselWeight?: number;
  vesselBeam?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  comments?: string;
  parsedData?: {
    vessel?: {
      name?: string;
      weight?: number;
      beam?: number;
    };
    customer?: {
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      customerAddress?: string;
    };
    scope?: {
      lineItems?: LineItem[];
      markupRate?: number;
      clearanceFee?: number;
      subtotal?: number;
      taxAmount?: number;
      total?: number;
    };
  };
  customer?: {
    id: string;
    display_name: string;
    legal_name?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  vessel?: {
    id: string;
    name: string;
    weight_tons?: number;
    beam_ft?: number;
    length_ft?: number;
    home_port?: string;
  };
}

const InvoiceView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, csrfToken } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if we're in preview mode
  const isPreviewMode = id === 'preview' || location.state?.previewData;
  const previewData = location.state?.previewData;

  useEffect(() => {
    // Handle preview mode
    if (isPreviewMode && previewData) {
      setInvoice(previewData);
      setIsLoading(false);
      return;
    }

    // Handle regular mode
    if (!isAuthenticated || !csrfToken || !id || isPreviewMode) {
      setIsLoading(false);
      return;
    }

    fetchInvoice();
  }, [isAuthenticated, csrfToken, id, isPreviewMode, previewData]);

  // Handle auto-print functionality
  useEffect(() => {
    if (searchParams.get('print') === 'true' && invoice && !isLoading && !error) {
      // Small delay to ensure the page is fully loaded before printing
      const timer = setTimeout(() => {
        window.print();
        // Remove the print parameter from URL after printing
        setSearchParams(params => {
          params.delete('print');
          return params;
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [invoice, isLoading, error, searchParams, setSearchParams]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/v1/invoice/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken!
        },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Invoice not found');
        } else if (response.status === 403) {
          setError('You do not have access to this invoice');
        } else {
          setError('Failed to load invoice');
        }
        return;
      }

      const data = await response.json();
      setInvoice(data);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setError('Failed to load invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateLineItemCost = (item: LineItem): number => {
    // Priority: manualCost > cost > calculated from hours
    if (item.manualCost != null && item.manualCost !== 0) {
      return parseFloat(String(item.manualCost)) || 0;
    }
    if (item.cost != null && item.cost !== 0) {
      return parseFloat(String(item.cost)) || 0;
    }

    // Calculate from labor hours
    let total = 0;
    const laborHours = parseFloat(String(item.laborHours)) || 0;
    const otHours = parseFloat(String(item.otHours)) || 0;

    if (item.jobType === 'Agent Services') {
      total = (laborHours * 80) + (otHours * 120);
    } else if (item.itemType === 'Labor') {
      total = (laborHours * 80) + (otHours * 120);
    } else {
      total = (laborHours * 85) + (otHours * 127.5);
    }

    return total;
  };

  const applyMarkup = (cost: number, item: LineItem, scope: any): number => {
    // Check if item is markup exempt
    if (item.isMarkupExempt ||
        item.markupType === 'exempt' ||
        item.jobType === 'Clearance Fee' ||
        (item.description && item.description.includes('Clearance Fee')) ||
        item.jobType === 'Agent Services' ||
        (item.jobType === 'Manual Entry' && item.itemType === 'Labor')) {
      return cost;
    }

    // For items with markupRate set to '0' or 0, no markup
    if (item.markupRate === 0 || item.markupRate === '0') {
      return cost;
    }

    // Use item's specific markup rate or fall back to scope markup
    let markupRate = item.markupRate !== undefined ? item.markupRate : (scope.markupRate || 2.5);

    // Convert to number and ensure it's in decimal form
    markupRate = parseFloat(String(markupRate));
    if (markupRate > 1) {
      // It's a percentage, convert to decimal
      markupRate = markupRate / 100;
    }

    return cost * (1 + markupRate);
  };

  const calculateTax = (item: LineItem, totalWithMarkup: number): number => {
    // Clearance Fee is always non-taxable
    if (item.jobType === 'Clearance Fee') {
      return 0;
    }

    // Check tax status
    if (item.taxStatus === 'non-taxable' ||
        item.taxStatus === 'exempt' ||
        item.isTaxExempt === true ||
        item.isTaxable === false) {
      return 0;
    }

    // Check description for clearance fee
    if (!item.taxStatus && item.description && item.description.includes('Clearance Fee')) {
      return 0;
    }

    const taxRate = parseFloat(String(item.taxRate)) || 0.0875;
    return totalWithMarkup * taxRate;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    if (isPreviewMode) {
      navigate(-1); // Go back to the create invoice page
    } else {
      navigate('/invoices');
    }
  };

  if (isLoading) {
    return (
      <div className="invoice-view-container">
        <div className="loading">Loading invoice...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invoice-view-container">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleBack} className="btn-back">
            {isPreviewMode ? 'Back to Create Invoice' : 'Back to Invoices'}
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="invoice-view-container">
        <div className="error">
          <h2>Invoice Not Found</h2>
          <button onClick={handleBack} className="btn-back">
            {isPreviewMode ? 'Back to Create Invoice' : 'Back to Invoices'}
          </button>
        </div>
      </div>
    );
  }

  // Parse invoice data
  const data = invoice.parsedData || {};
  const vessel = data.vessel || invoice.vessel || {};
  const customer = data.customer || invoice.customer || {};
  const scope = data.scope || {};
  const lineItems = scope.lineItems || [];

  // Format date
  const invoiceDate = new Date(invoice.savedAt || invoice.createdAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate totals
  let baseCost = 0;
  let subtotal = 0;
  let totalTax = 0;

  const lineItemsData = lineItems.map(item => {
    const cost = calculateLineItemCost(item);
    baseCost += cost;

    const totalWithMarkup = applyMarkup(cost, item, scope);
    const markupAmount = totalWithMarkup - cost;
    subtotal += totalWithMarkup;

    const taxAmount = calculateTax(item, totalWithMarkup);
    totalTax += taxAmount;

    const total = totalWithMarkup + taxAmount;

    return {
      ...item,
      cost,
      markupAmount,
      taxAmount,
      total: total
    };
  });

  const finalTotal = subtotal + totalTax;
  const grossProfit = subtotal - baseCost;
  const profitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;

  return (
    <div className="invoice-view-container">
      <div className="invoice-view-header no-print">
        <h1>{isPreviewMode ? 'Invoice Preview' : 'Invoice Details'}</h1>
        <div className="header-actions">
          <button onClick={handlePrint} className="btn-print">
            Print Invoice
          </button>
          <button onClick={handleBack} className="btn-back">
            {isPreviewMode ? 'Back to Create Invoice' : 'Back to Invoices'}
          </button>
        </div>
      </div>

      <div className="invoice-preview">
        <div className="invoice-header">
          <img
            src="https://i.imgur.com/A9K1ByZ.png"
            alt="Marine Group"
            className="invoice-logo"
          />
          <h2>Invoice Request Form</h2>
          <p className="invoice-date">Date: <span>{invoiceDate}</span></p>
          <p className="invoice-number">
            Invoice #{invoice.invoiceNumber || (invoice.id ? invoice.id.substring(0, 8) : 'N/A')}
          </p>
          <p className="invoice-status">
            Status: <span className={`status-${invoice.status}`}>{invoice.status}</span>
          </p>
        </div>

        <div className="invoice-section">
          <h3>Vessel Details</h3>
          <div className="invoice-details">
            <p><strong>Vessel:</strong> <span>{vessel.name || invoice.vesselName || 'N/A'}</span></p>
            <p><strong>Weight:</strong> <span>{vessel.weight_tons || vessel.weight || invoice.vesselWeight || 'N/A'} tons</span></p>
            <p><strong>Beam:</strong> <span>{vessel.beam_ft || vessel.beam || invoice.vesselBeam || 'N/A'} ft</span></p>
            {vessel.length_ft && (
              <p><strong>Length:</strong> <span>{vessel.length_ft} ft</span></p>
            )}
            {vessel.home_port && (
              <p><strong>Home Port:</strong> <span>{vessel.home_port}</span></p>
            )}
          </div>
        </div>

        <div className="invoice-section">
          <h3>Customer Information</h3>
          <div className="invoice-details">
            <p><strong>Estimator:</strong> <span>{invoice.userName || 'N/A'}</span></p>
            <p><strong>Customer:</strong> <span>{customer.display_name || customer.customerName || invoice.customerName || 'N/A'}</span></p>
            <p><strong>Email:</strong> <span>{customer.email || customer.customerEmail || invoice.customerEmail || 'N/A'}</span></p>
            <p><strong>Phone:</strong> <span>{customer.phone || customer.customerPhone || invoice.customerPhone || 'N/A'}</span></p>
            {customer.address && (
              <p><strong>Address:</strong> <span>{customer.address}</span></p>
            )}
          </div>
        </div>

        {lineItems.length > 0 && (
          <div className="invoice-section">
            <h3>Services</h3>
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Cost</th>
                  <th className="markup-column">Markup</th>
                  <th className="tax-column">Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItemsData.map((item, index) => (
                  <tr key={index}>
                    <td>{item.description || 'N/A'}</td>
                    <td>{item.jobType || item.itemType || item.type || 'N/A'}</td>
                    <td>${item.cost.toFixed(2)}</td>
                    <td className="markup-column">${item.markupAmount.toFixed(2)}</td>
                    <td className="tax-column">${item.taxAmount.toFixed(2)}</td>
                    <td>${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="invoice-totals">
              <div className="total-row">
                <span>Base Cost:</span>
                <span>${baseCost.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Subtotal (with markup):</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Tax:</span>
                <span>${totalTax.toFixed(2)}</span>
              </div>
              <div className="total-row total-final">
                <span>Total:</span>
                <span>${finalTotal.toFixed(2)}</span>
              </div>

              <div className="profit-section">
                <div className="profit-row">
                  <span>Gross Profit:</span>
                  <span>${grossProfit.toFixed(2)}</span>
                </div>
                <div className="profit-row">
                  <span>Profit Percentage:</span>
                  <span>{profitPercent.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {invoice.notes && (
          <div className="invoice-section">
            <h3>Notes</h3>
            <div className="notes-content">
              <p>{invoice.notes}</p>
            </div>
          </div>
        )}

        {invoice.comments && (
          <div className="invoice-section">
            <h3>Comments</h3>
            <div className="comments-content">
              <p>{invoice.comments}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceView;