import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gatherInvoiceData } from '../utils/invoiceData';
import {
  InvoiceComment,
  normalizeInvoiceComments,
  getInitials
} from '../utils/invoiceComments';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../components/magic/index';
import { buildDiffIndex, ChangedValue, DiffIndex } from '../components/invoices/ChangedValue';
import { getLineItemOp } from '../components/invoices/LineItemsDiff';
import { cn } from '../lib/utils';
import { convertFieldDeltaToPatch, isFieldDeltaFormat } from '../utils/diffConverter';
import { PatchOperation } from '../types/diff.types';

interface LineItem {
  id?: string;
  description?: string;
  jobType?: string;
  itemType?: string;
  type?: string;
  quantity?: number;
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
  status: 'saved' | 'draft' | 'submitted' | 'change_requested';
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
  metadata?: unknown;
  parsedData?: unknown;
  data?: unknown;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  secondAttachmentUrl?: string;
  secondAttachmentName?: string;
  secondAttachmentType?: string;
  diff?: import('../types/diff.types').PatchOperation[];
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

interface ServiceSummaryItem {
  id: string;
  description: string;
  type: string;
  cost: number;
  markupAmount: number;
  taxAmount: number;
  totalBeforeTax: number;
  total: number;
}

const parseMetadata = (metadata: unknown): Record<string, unknown> => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    const trimmed = metadata.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn('Failed to parse invoice metadata:', error);
      return {};
    }
  }

  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>;
  }

  return {};
};

const formatCurrency = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(safeValue);
};

const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const truncate = (value: string, length: number) => {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
};

/**
 * Helper: Reconstruct baseline data by reversing diff operations
 */
const reconstructBaseline = (currentData: any, diff: PatchOperation[]): any => {
  const baseline = JSON.parse(JSON.stringify(currentData));

  // Group operations - we only need array-level add/remove operations
  const processedArrayPaths = new Set<string>();

  for (const operation of diff) {
    const pathParts = operation.path.split('/').filter(p => p !== '');

    if (operation.op === 'add') {
      // Check if this is an array item add (e.g., /services/-)
      if (pathParts.length >= 2 && pathParts[pathParts.length - 1] === '-') {
        const arrayPath = pathParts.slice(0, -1).join('/');
        if (!processedArrayPaths.has(arrayPath)) {
          processedArrayPaths.add(arrayPath);

          // Navigate to the array
          let current = baseline;
          for (const part of pathParts.slice(0, -1)) {
            current = current[part];
          }

          if (Array.isArray(current) && current.length > 0) {
            // Remove last item from array
            current.pop();
          }
        }
      }
    } else if (operation.op === 'replace' && operation.oldValue !== undefined) {
      // If something was replaced, restore old value
      let current = baseline;
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        current = current[part];
        if (!current) break;
      }
      if (current) {
        const lastPart = pathParts[pathParts.length - 1];
        current[lastPart] = operation.oldValue;
      }
    }
  }

  return baseline;
};

const InvoiceView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, csrfToken } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const isPreviewMode = id === 'preview' || Boolean(location.state?.previewData);
  const previewData = location.state?.previewData;
  const formState = location.state?.formState;

  useEffect(() => {
    if (isPreviewMode && previewData) {
      setInvoice(previewData);
      setIsLoading(false);
      return;
    }

    if (!isAuthenticated || !csrfToken || !id || isPreviewMode) {
      setIsLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/v1/invoice/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
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
        console.log('[InvoiceView] API Response:', data); // Debug log

        // Extract invoice from response (backend returns { data, diff, correlationId })
        const invoiceData = data?.data ?? data?.invoice ?? data;
        const diff = data?.diff ?? null;

        if (!invoiceData || typeof invoiceData !== 'object') {
          setInvoice(null);
          setError('Invalid invoice data received');
          return;
        }

        console.log('[InvoiceView] Extracted invoice:', invoiceData); // Debug log
        console.log('[InvoiceView] Extracted diff:', diff); // Debug log

        // Attach diff to invoice object for diffIndex computation
        setInvoice({ ...invoiceData, diff });
      } catch (fetchError) {
        console.error('Error fetching invoice:', fetchError);
        setError('Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [csrfToken, id, isAuthenticated, isPreviewMode, previewData]);

  useEffect(() => {
    if (searchParams.get('print') === 'true' && invoice && !isLoading && !error) {
      const timer = setTimeout(() => {
        window.print();
        setSearchParams((params) => {
          params.delete('print');
          return params;
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [invoice, isLoading, error, searchParams, setSearchParams]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    if (isPreviewMode && formState) {
      const returnTo = formState.returnTo || '/requests/new';
      navigate(returnTo, { state: { restoredFormState: formState } });
    } else if (isPreviewMode) {
      navigate(-1);
    } else {
      navigate('/requests');
    }
  };

  const handleViewAttachment = (attachmentUrl: string, attachmentType: string, attachmentName: string) => {
    try {
      // Convert base64 to blob
      const base64Data = attachmentUrl.split(',')[1]; // Remove data:mime;base64, prefix
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachmentType });

      // Create object URL and open in new tab
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');

      // Clean up object URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Error viewing attachment:', error);
      alert('Failed to view attachment');
    }
  };

  const metadata = useMemo(() => parseMetadata(invoice?.metadata), [invoice?.metadata]);

  const { primaryData, scope, lineItems } = useMemo(() => gatherInvoiceData<LineItem>(invoice), [invoice]);
  const vessel = primaryData?.vessel || invoice?.vessel || {};
  const customer = primaryData?.customer || invoice?.customer || {};

  // Build diff index for inline change visualization
  const diffIndex: DiffIndex = useMemo(() => {
    console.log('[InvoiceView] Computing diffIndex from:', invoice?.diff); // Debug log
    if (invoice?.diff && Array.isArray(invoice.diff)) {
      console.log('[InvoiceView] Diff items:', invoice.diff.map((d: any) => ({ path: d.path, op: d.op, field: d.field })));
      console.log('[InvoiceView] Full diff item[0]:', invoice.diff[0]);
    }

    // Check if diff needs conversion from FieldDelta to PatchOperation
    let diffData = invoice?.diff;
    if (isFieldDeltaFormat(diffData)) {
      console.log('[InvoiceView] Converting FieldDelta to PatchOperation'); // Debug log
      diffData = convertFieldDeltaToPatch(diffData);
    }

    const index = buildDiffIndex(diffData);
    console.log('[InvoiceView] DiffIndex built, size:', index.size); // Debug log
    console.log('[InvoiceView] DiffIndex paths:', Array.from(index.keys()));

    return index;
  }, [invoice?.diff]);

  // Reconstruct baseline line items from diff
  const baselineLineItems = useMemo(() => {
    if (!invoice?.diff || !Array.isArray(invoice.diff) || invoice.diff.length === 0) {
      return lineItems;
    }

    // Check if diff needs conversion
    let diffData = invoice.diff;
    if (isFieldDeltaFormat(diffData)) {
      diffData = convertFieldDeltaToPatch(diffData);
    }

    // Reconstruct the baseline by reversing diff operations
    const gatherData = gatherInvoiceData<LineItem>(invoice);
    const baseline = reconstructBaseline({ services: gatherData.lineItems }, diffData);

    console.log('[InvoiceView] Baseline line items:', {
      current: lineItems.length,
      baseline: baseline.services?.length || 0,
      baselineIds: baseline.services?.map((s: any) => s.id)
    });

    return baseline.services || [];
  }, [invoice, lineItems]);

  const servicesSummary = useMemo(() => {
    try {
      const sanitizedItems = lineItems.filter((item): item is LineItem => Boolean(item) && typeof item === 'object');
      let baseCostTotal = 0;
      let subtotalWithMarkup = 0;
      let totalTax = 0;

      const services: ServiceSummaryItem[] = sanitizedItems.map((item, index) => {
        const cost = calculateLineItemCost(item);
        const costWithMarkup = applyMarkup(cost, item, scope);
        const markupAmount = costWithMarkup - cost;
        const taxAmount = calculateTax(item, costWithMarkup);
        const total = costWithMarkup + taxAmount;

        baseCostTotal += cost;
        subtotalWithMarkup += costWithMarkup;
        totalTax += taxAmount;

        return {
          id: item.id || `service-${index}`,
          description: item.description || 'Untitled service',
          type: item.jobType || item.itemType || item.type || 'Service',
          cost,
          markupAmount,
          taxAmount,
          totalBeforeTax: costWithMarkup,
          total
        };
      });

      const finalTotal = subtotalWithMarkup + totalTax;
      const grossProfit = subtotalWithMarkup - baseCostTotal;
      const grossProfitPercent = baseCostTotal > 0 ? (grossProfit / baseCostTotal) * 100 : 0;

      return {
        services,
        baseCostTotal,
        subtotalWithMarkup,
        totalTax,
        finalTotal,
        grossProfit,
        grossProfitPercent
      };
    } catch (summaryError) {
      console.error('Failed to build invoice service summary', summaryError);
      return {
        services: [],
        baseCostTotal: 0,
        subtotalWithMarkup: 0,
        totalTax: 0,
        finalTotal: invoice?.total ?? 0,
        grossProfit: 0,
        grossProfitPercent: 0,
      };
    }
  }, [lineItems, scope, invoice?.total]);

  const comments: InvoiceComment[] = useMemo(() => {
    try {
      const source = (metadata as Record<string, unknown>)?.comments;
      return normalizeInvoiceComments(source);
    } catch (commentError) {
      console.error('Failed to parse invoice comments', commentError);
      return [];
    }
  }, [metadata]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Loading invoice…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Unable to load invoice</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button variant="outline" onClick={handleBack}>
              {isPreviewMode ? 'Back to create invoice' : 'Back to requests'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Invoice unavailable</CardTitle>
            <CardDescription>The requested invoice could not be found.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button variant="outline" onClick={handleBack}>
              {isPreviewMode ? 'Back to create invoice' : 'Back to requests'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoiceDate = formatDate(invoice.savedAt || invoice.createdAt || Date.now().toString());
  const createdAtLabel = formatDateTime(invoice.createdAt);
  const updatedAtLabel = formatDateTime(invoice.updatedAt);
  const invoiceTitle = invoice.title?.trim() || (vessel.name ? `Invoice for ${vessel.name}` : 'Invoice Request');
  const invoiceNumber = invoice.invoiceNumber || (invoice.id ? invoice.id.substring(0, 8) : '—');

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>{isPreviewMode ? 'Preview' : 'Invoice request'}</span>
              <span className="text-slate-300">•</span>
              <span>{invoiceDate}</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">{invoiceTitle}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {createdAtLabel && <span>Created {createdAtLabel}</span>}
              {updatedAtLabel && <span>• Last saved {updatedAtLabel}</span>}
              <span>• Invoice #{invoiceNumber}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'capitalize',
                invoice.status === 'change_requested' && 'border-amber-500 text-amber-700 bg-amber-50'
              )}
            >
              {invoice.status === 'change_requested' ? 'Changes Requested' : invoice.status}
              {invoice.status === 'change_requested' && invoice.diff && invoice.diff.length > 0 && (
                <span className="ml-1 text-xs">({invoice.diff.length})</span>
              )}
            </Badge>
            <Button variant="outline" onClick={handlePrint}>
              Print
            </Button>
            <Button onClick={handleBack}>
              {isPreviewMode ? 'Back to create' : 'Back to requests'}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <Card className="border-none shadow-lg">
            <CardContent className="relative p-0">
              <div
                ref={previewRef}
                className="relative max-h-[75vh] overflow-auto rounded-xl bg-white p-6"
              >
                <div className="space-y-6 text-sm text-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Marine Group • Invoice summary
                      </p>
                      <h2 className="text-xl font-semibold text-slate-900">
                        <ChangedValue
                          path="/title"
                          value={invoiceTitle}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </h2>
                      <p className="text-xs text-muted-foreground">Saved {invoiceDate}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-sm text-slate-600">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'capitalize',
                          invoice.status === 'change_requested' && 'border-amber-500 text-amber-700 bg-amber-50'
                        )}
                      >
                        {invoice.status === 'change_requested' ? 'Changes Requested' : invoice.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Invoice #{invoiceNumber}</span>
                      {invoice.userName && (
                        <span className="text-xs text-muted-foreground">Estimator: {invoice.userName}</span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vessel</h3>
                      <p className="font-medium text-slate-900">
                        <ChangedValue
                          path="/vesselName"
                          value={vessel.name || invoice.vesselName || 'Not specified'}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Weight: <ChangedValue
                          path="/vesselWeight"
                          value={`${vessel.weight_tons || vessel.weight || invoice.vesselWeight || '—'} tons`}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Beam: <ChangedValue
                          path="/vesselBeam"
                          value={`${vessel.beam_ft || vessel.beam || invoice.vesselBeam || '—'} ft`}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </p>
                      {vessel.length_ft && (
                        <p className="text-xs text-muted-foreground">Length: {vessel.length_ft} ft</p>
                      )}
                      {vessel.home_port && (
                        <p className="text-xs text-muted-foreground">Home port: {vessel.home_port}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
                      <p className="font-medium text-slate-900">
                        <ChangedValue
                          path="/customerName"
                          value={customer.display_name || customer.contact_name || invoice.customerName || 'Not assigned'}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <ChangedValue
                          path="/customerEmail"
                          value={customer.email || invoice.customerEmail || '—'}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <ChangedValue
                          path="/customerPhone"
                          value={customer.phone || invoice.customerPhone || '—'}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-800">Services</h3>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <span>Item</span>
                        <span className="text-right">Cost</span>
                        <span className="text-right">Markup</span>
                        <span className="text-right">Tax</span>
                        <span className="text-right">Total</span>
                      </div>
                      {servicesSummary.services.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No services recorded for this invoice.
                        </div>
                      ) : (
                        servicesSummary.services.map((service, index) => {
                          // Only show diff indicators when status is 'change_requested' AND we have a valid diff
                          const shouldShowRowDiff = invoice.status === 'change_requested' &&
                            invoice.diff &&
                            Array.isArray(invoice.diff) &&
                            invoice.diff.length > 0 &&
                            diffIndex &&
                            diffIndex.size > 0;

                          if (index === 0) {
                            console.log(`[InvoiceView] shouldShowRowDiff: status="${invoice.status}", hasDiff=${!!invoice.diff}, diffLength=${invoice.diff?.length}, diffIndexSize=${diffIndex.size}, shouldShowRowDiff=${shouldShowRowDiff}`);
                          }

                          // Check if this item is new by comparing against baseline
                          // Only mark as new if we should show diffs and the item doesn't exist in baseline
                          const isNewItem = shouldShowRowDiff &&
                            service.id &&
                            !baselineLineItems.some((item: any) => item.id === service.id);

                          // For row-level highlighting, only show if item is actually new
                          // Don't use getLineItemOp because /services/- wildcard applies to all items
                          const itemDiffOp = isNewItem ? { op: 'add' as const } : undefined;

                          return (
                            <div
                              key={service.id}
                              className={cn(
                                'grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center border-t px-4 py-3 text-sm',
                                itemDiffOp && 'border-l-4',
                                itemDiffOp?.op === 'add' && 'bg-green-50 border-green-500',
                                itemDiffOp?.op === 'remove' && 'bg-red-50 border-red-500 opacity-75',
                                itemDiffOp?.op === 'replace' && 'bg-yellow-50 border-yellow-500'
                              )}
                            >
                              <div className="pr-4">
                                <p className="font-medium text-slate-900">
                                  <ChangedValue
                                    path={`/lineItems/${index}/description`}
                                    value={service.description}
                                    diff={diffIndex}
                                    status={invoice.status}
                                    isNewItem={isNewItem}
                                  />
                                </p>
                                <p className="text-xs text-muted-foreground">{service.type}</p>
                              </div>
                              <span className="text-right">
                                <ChangedValue
                                  path={`/lineItems/${index}/cost`}
                                  value={formatCurrency(service.cost)}
                                  diff={diffIndex}
                                  status={invoice.status}
                                  isNewItem={isNewItem}
                                />
                              </span>
                              <span className="text-right">
                                <ChangedValue
                                  path={`/lineItems/${index}/markupAmount`}
                                  value={formatCurrency(service.markupAmount)}
                                  diff={diffIndex}
                                  status={invoice.status}
                                  isNewItem={isNewItem}
                                />
                              </span>
                              <span className="text-right">
                                <ChangedValue
                                  path={`/lineItems/${index}/taxAmount`}
                                  value={formatCurrency(service.taxAmount)}
                                  diff={diffIndex}
                                  status={invoice.status}
                                  isNewItem={isNewItem}
                                />
                              </span>
                              <span className="text-right font-medium text-slate-900">
                                <ChangedValue
                                  path={`/lineItems/${index}/total`}
                                  value={formatCurrency(service.total)}
                                  diff={diffIndex}
                                  status={invoice.status}
                                  isNewItem={isNewItem}
                                />
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <div className="flex justify-between">
                      <span>Base cost</span>
                      <span className="font-medium text-slate-900">{formatCurrency(servicesSummary.baseCostTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subtotal (with markup)</span>
                      <span className="font-medium text-slate-900">
                        <ChangedValue
                          path="/subtotal"
                          value={formatCurrency(servicesSummary.subtotalWithMarkup)}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span className="font-medium text-slate-900">
                        <ChangedValue
                          path="/taxAmount"
                          value={formatCurrency(servicesSummary.totalTax)}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-base font-semibold text-slate-900">
                      <span>Total</span>
                      <span>
                        <ChangedValue
                          path="/total"
                          value={formatCurrency(servicesSummary.finalTotal || invoice.total)}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 text-sm">
                      <span>Gross profit</span>
                      <span className="font-medium text-slate-900">
                        <ChangedValue
                          path="/grossProfit"
                          value={formatCurrency(servicesSummary.grossProfit)}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Gross profit %</span>
                      <span className="font-medium text-slate-900">
                        <ChangedValue
                          path="/profitPercent"
                          value={`${servicesSummary.grossProfitPercent.toFixed(2)}%`}
                          diff={diffIndex}
                          status={invoice.status}
                        />
                      </span>
                    </div>
                  </div>

                  {invoice.notes && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-800">Notes</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        <ChangedValue
                          path="/notes"
                          value={invoice.notes}
                          diff={diffIndex}
                          status={invoice.status}
                          renderMode="block"
                        />
                      </p>
                    </div>
                  )}
                </div>

                {comments.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 z-10">
                    {comments.map((comment, index) => {
                      const width = Math.max(comment.highlight.width, 36);
                      const height = Math.max(comment.highlight.height, 30);
                      return (
                        <React.Fragment key={comment.id}>
                          <div
                            className="absolute rounded-md border border-blue-500 bg-blue-500/15"
                            style={{
                              top: comment.highlight.top,
                              left: comment.highlight.left,
                              width,
                              height
                            }}
                          />
                          <div
                            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-500 text-[11px] font-semibold text-white shadow"
                            style={{
                              top: comment.highlight.top,
                              left: comment.highlight.left
                            }}
                          >
                            {index + 1}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial summary</CardTitle>
                <CardDescription>Snapshot of totals for this invoice request.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    <ChangedValue
                      path="/subtotal"
                      value={formatCurrency(servicesSummary.subtotalWithMarkup)}
                      diff={diffIndex}
                      status={invoice.status}
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>
                    <ChangedValue
                      path="/taxAmount"
                      value={formatCurrency(servicesSummary.totalTax)}
                      diff={diffIndex}
                      status={invoice.status}
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gross profit</span>
                  <span>
                    <ChangedValue
                      path="/grossProfit"
                      value={formatCurrency(servicesSummary.grossProfit)}
                      diff={diffIndex}
                      status={invoice.status}
                    />
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-900">
                  <span>Total due</span>
                  <span>
                    <ChangedValue
                      path="/total"
                      value={formatCurrency(servicesSummary.finalTotal || invoice.total)}
                      diff={diffIndex}
                      status={invoice.status}
                    />
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-100 bg-blue-50/60">
              <CardHeader>
                <CardTitle>Comments</CardTitle>
                <CardDescription>
                  {comments.length === 0
                    ? 'No comments have been added yet.'
                    : `${comments.length} contextual ${comments.length === 1 ? 'comment' : 'comments'}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-blue-200 bg-white/60 p-6 text-center text-sm text-blue-700">
                    Highlights and threaded feedback from the Notes tab will appear here.
                  </div>
                ) : (
                  comments.map((comment, index) => (
                    <div key={comment.id} className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{comment.initials || getInitials(comment.author)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                            <span className="text-xs font-medium text-blue-600">#{index + 1}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            “{truncate(comment.selectionText, 70)}”
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</p>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{comment.text}</p>

                      {comment.replies.length > 0 && (
                        <div className="mt-3 space-y-3 border-t border-blue-100 pt-3">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{reply.initials || getInitials(reply.author)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{reply.author}</p>
                                <p className="text-xs text-muted-foreground">{formatDateTime(reply.createdAt)}</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Attachments Section */}
            {(invoice?.attachmentUrl || invoice?.secondAttachmentUrl) && (
              <Card>
                <CardHeader>
                  <CardTitle>Attached Invoices</CardTitle>
                  <CardDescription>View attached invoice files</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invoice.attachmentUrl && invoice.attachmentName && invoice.attachmentType && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <button
                          onClick={() => handleViewAttachment(invoice.attachmentUrl!, invoice.attachmentType!, invoice.attachmentName!)}
                          className="text-sm truncate text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                        >
                          {invoice.attachmentName}
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAttachment(invoice.attachmentUrl!, invoice.attachmentType!, invoice.attachmentName!)}
                        className="flex-shrink-0"
                        title="View attachment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                    </div>
                  )}

                  {invoice.secondAttachmentUrl && invoice.secondAttachmentName && invoice.secondAttachmentType && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <button
                          onClick={() => handleViewAttachment(invoice.secondAttachmentUrl!, invoice.secondAttachmentType!, invoice.secondAttachmentName!)}
                          className="text-sm truncate text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                        >
                          {invoice.secondAttachmentName}
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAttachment(invoice.secondAttachmentUrl!, invoice.secondAttachmentType!, invoice.secondAttachmentName!)}
                        className="flex-shrink-0"
                        title="View updated attachment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Show message for legacy approved invoices without attachments */}
            {invoice?.status === 'approved' && !invoice.attachmentUrl && !invoice.secondAttachmentUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Attached Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Legacy approval - no attachment on file
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const calculateLineItemCost = (item: LineItem | null | undefined): number => {
  if (!item || typeof item !== 'object') {
    return 0;
  }
  if (item.manualCost != null && item.manualCost !== 0) {
    return parseFloat(String(item.manualCost)) || 0;
  }
  if (item.cost != null && item.cost !== 0) {
    return parseFloat(String(item.cost)) || 0;
  }

  const laborHours = parseFloat(String(item.laborHours)) || 0;
  const otHours = parseFloat(String(item.otHours)) || 0;

  if (item.jobType === 'Agent Services') {
    return (laborHours * 80) + (otHours * 120);
  }
  if (item.itemType === 'Labor') {
    return (laborHours * 80) + (otHours * 120);
  }

  return (laborHours * 85) + (otHours * 127.5);
};

const applyMarkup = (cost: number, item: LineItem | null | undefined, scope: any): number => {
  if (!item || typeof item !== 'object') {
    return cost;
  }
  if (
    item.isMarkupExempt ||
    item.markupType === 'exempt' ||
    item.jobType === 'Clearance Fee' ||
    (item.description && item.description.includes('Clearance Fee')) ||
    item.jobType === 'Agent Services' ||
    (item.jobType === 'Manual Entry' && item.itemType === 'Labor')
  ) {
    return cost;
  }

  if (item.markupRate === 0 || item.markupRate === '0') {
    return cost;
  }

  let markupRate = item.markupRate !== undefined ? item.markupRate : (scope?.markupRate ?? 2.5);
  markupRate = parseFloat(String(markupRate));
  if (Number.isNaN(markupRate)) {
    markupRate = 0;
  }

  if (markupRate > 1) {
    markupRate = markupRate / 100;
  }

  return cost * (1 + markupRate);
};

const calculateTax = (item: LineItem | null | undefined, totalWithMarkup: number): number => {
  if (!item || typeof item !== 'object') {
    return 0;
  }
  if (item.jobType === 'Clearance Fee') {
    return 0;
  }

  if (
    item.taxStatus === 'non-taxable' ||
    item.taxStatus === 'exempt' ||
    item.isTaxExempt === true ||
    item.isTaxable === false
  ) {
    return 0;
  }

  if (!item.taxStatus && item.description && item.description.includes('Clearance Fee')) {
    return 0;
  }

  const taxRate = parseFloat(String(item.taxRate)) || 0.0875;
  return totalWithMarkup * taxRate;
};

export default InvoiceView;
