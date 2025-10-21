import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gatherInvoiceData } from '../utils/invoiceData';
import {
  InvoiceComment,
  CommentHighlightRect,
  normalizeInvoiceComments,
  getInitials
} from '../utils/invoiceComments';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea
} from '../components/magic/index';
import { buildDiffIndex, ChangedValue, DiffIndex } from '../components/invoices/ChangedValue';
import { getLineItemOp } from '../components/invoices/LineItemsDiff';
import { cn } from '../lib/utils';
import { convertFieldDeltaToPatch, isFieldDeltaFormat } from '../utils/diffConverter';
import { PatchOperation } from '../types/diff.types';
import { FileText, X, Paperclip } from 'lucide-react';

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
  receiptUrl?: string;
  receiptName?: string;
  receiptType?: string;
  scope?: any;
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

interface PendingSelection {
  text: string;
  rect: CommentHighlightRect;
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
  receiptUrl?: string;
  receiptName?: string;
  receiptType?: string;
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
  const { isAuthenticated, csrfToken, currentUser: user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<{ url: string; name: string; type: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [pendingCommentText, setPendingCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const selectionCardRef = useRef<HTMLDivElement>(null);

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
    console.log('[InvoiceView] Opening receipt:', { url: attachmentUrl, name: attachmentName, type: attachmentType });

    // Check if URL is valid (base64 data URL or http URL)
    if (!attachmentUrl || (!attachmentUrl.startsWith('data:') && !attachmentUrl.startsWith('http'))) {
      console.error('[InvoiceView] Invalid receipt URL:', attachmentUrl);
      alert(`Cannot display receipt: Invalid image data. The receipt may not have been properly saved.`);
      return;
    }

    setCurrentReceipt({ url: attachmentUrl, name: attachmentName, type: attachmentType });
    setReceiptModalOpen(true);
  };

  const handleSubmitReply = async (commentId: string) => {
    if (!replyText.trim() || !user || !invoice || isPreviewMode) return;

    setIsSubmittingReply(true);
    try {
      const response = await fetch(`/api/v1/invoice/${invoice.id}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({
          text: replyText.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit reply');
      }

      const data = await response.json();

      // Update local invoice state with new metadata
      setInvoice(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          metadata: data.metadata
        };
      });

      // Reset reply form
      setReplyText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Error submitting reply:', err);
      alert('Failed to submit reply. Please try again.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const clearTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.removeAllRanges) {
      selection.removeAllRanges();
    }
  };

  const handleTextSelection = (target: Node) => {
    if (selectionCardRef.current?.contains(target)) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPendingSelection(null);
      setPendingCommentText('');
      return;
    }

    if (!previewRef.current) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) {
      setPendingSelection(null);
      setPendingCommentText('');
      return;
    }

    if (!previewRef.current.contains(anchorNode) || !previewRef.current.contains(focusNode)) {
      setPendingSelection(null);
      setPendingCommentText('');
      return;
    }

    const range = selection.getRangeAt(0);
    if (!range || range.toString().trim().length === 0) {
      setPendingSelection(null);
      setPendingCommentText('');
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setPendingSelection(null);
      setPendingCommentText('');
      return;
    }

    const containerRect = previewRef.current.getBoundingClientRect();
    const padding = 8;
    const top = rect.top - containerRect.top + previewRef.current.scrollTop;
    const left = rect.left - containerRect.left + previewRef.current.scrollLeft;
    const width = Math.max(rect.width + padding * 2, 36);
    const height = Math.max(rect.height + padding * 2, 30);
    const scrollHeight = previewRef.current.scrollHeight;
    const scrollWidth = previewRef.current.scrollWidth;
    const maxTop = Math.max(0, scrollHeight - height - 4);
    const maxLeft = Math.max(0, scrollWidth - width - 4);
    const highlight: CommentHighlightRect = {
      top: Math.max(0, Math.min(top - padding, maxTop)),
      left: Math.max(0, Math.min(left - padding, maxLeft)),
      width,
      height,
    };

    setPendingSelection({
      text: range.toString().trim(),
      rect: highlight
    });
    setPendingCommentText('');
  };

  const handlePreviewMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as Node;
    handleTextSelection(target);
  };

  const handleCancelSelection = () => {
    setPendingSelection(null);
    setPendingCommentText('');
    clearTextSelection();
  };

  const handleCreateComment = async () => {
    if (!pendingSelection || !user || !invoice || isPreviewMode) return;
    const trimmed = pendingCommentText.trim();
    if (!trimmed) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/v1/invoice/${invoice.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({
          text: trimmed,
          selectionText: pendingSelection.text,
          highlight: pendingSelection.rect
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create comment');
      }

      const data = await response.json();

      // Update local invoice state with new metadata
      setInvoice(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          metadata: data.metadata
        };
      });

      // Reset comment form
      setPendingSelection(null);
      setPendingCommentText('');
      clearTextSelection();
    } catch (err) {
      console.error('Error creating comment:', err);
      alert('Failed to create comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
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

    // Filter out items with _deleted flag from current services for proper baseline reconstruction
    // This ensures deleted items will appear as "removed" when comparing baseline to current
    const activeLineItems = lineItems.filter(item => !item._deleted);

    // Reconstruct the baseline by reversing diff operations
    const gatherData = gatherInvoiceData<LineItem>(invoice);
    const baseline = reconstructBaseline({ services: activeLineItems }, diffData);

    console.log('[InvoiceView] Baseline line items:', {
      current: lineItems.length,
      active: activeLineItems.length,
      deleted: lineItems.filter(item => item._deleted).length,
      baseline: baseline.services?.length || 0,
      baselineIds: baseline.services?.map((s: any) => s.id),
      deletedIds: lineItems.filter(item => item._deleted).map(item => item.id)
    });

    return baseline.services || [];
  }, [invoice, lineItems]);

  const applyMarkup = (cost: number, item: LineItem, scope: any): number => {
    // Check if item is markup exempt
    if (item.isMarkupExempt || item.markupType === 'exempt' || item.jobType === 'Clearance Fee') {
      return cost;
    }

    // Get markup rate
    let markupRate = item.markupRate !== undefined ? item.markupRate : (scope?.markupRate ?? 2.5);
    markupRate = parseFloat(String(markupRate));
    if (Number.isNaN(markupRate)) {
      markupRate = 0;
    }

    // If rate is > 1, assume it's a percentage, convert to decimal
    if (markupRate > 1) {
      markupRate = markupRate / 100;
    }

    return cost * (1 + markupRate);
  };

  const calculateTax = (item: LineItem, totalWithMarkup: number): number => {
    // Clearance Fee is always non-taxable
    if (item.jobType === 'Clearance Fee' || item.isTaxExempt || item.taxStatus === 'no_tax') {
      return 0;
    }

    // Get tax rate
    const taxRate = item.taxRate !== undefined ? parseFloat(String(item.taxRate)) : 0.0875;
    return totalWithMarkup * taxRate;
  };

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
          total,
          receiptUrl: item.receiptUrl,
          receiptName: item.receiptName,
          receiptType: item.receiptType
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
    <div className="min-h-full bg-white">
      <div className="mx-auto flex max-w-6xl flex-col">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 pl-0 pr-0 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-700" />
              <h1 className="text-lg font-semibold text-slate-900">Invoice Request Preview</h1>
            </div>
            <Button
              onClick={handleBack}
              className="bg-[#1e3a5f] text-white hover:bg-[#152d4a] rounded-md px-3 py-1.5 text-sm font-medium h-auto"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Exit
            </Button>
          </div>
        </div>

        {/* Comments & Preview Section */}
        <div className="pl-0 pr-4 py-4 mb-6">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Comments & Preview</h2>
          <p className="text-sm text-slate-600 md:hidden">
            Tap and hold a line item to add a comment
          </p>
          <p className="text-sm text-slate-600 hidden md:block">
            Click on a line item to add a comment
          </p>
        </div>

        <div className="relative">
        <div
          ref={previewRef}
          onMouseUp={!isPreviewMode ? handlePreviewMouseUp : undefined}
          className="bg-white rounded-lg border border-slate-200 p-6 space-y-6 text-sm text-slate-700 select-none md:select-auto [-webkit-touch-callout:none]"
        >
          {/* Header */}
          <div className="pb-4">
            <h2 className="text-xl font-semibold text-slate-900">
              {invoice.title || `Invoice for ${vessel.name || invoice.vesselName || 'Unnamed Vessel'}`}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {invoice.status === 'draft' ? 'Draft preview' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)} • {new Date(invoice.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="grid gap-6 border border-slate-200 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">VESSEL</h3>
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
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">CONTACT</h3>
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
              {customer.address && (
                <p className="text-xs text-muted-foreground">{customer.address}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Services</h3>
            {servicesSummary.services.length === 0 && baselineLineItems.length === 0 ? (
              <div className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-muted-foreground">
                No services added yet.
              </div>
            ) : (
              <>
                {/* Mobile: Card Layout */}
                <div className="space-y-3 md:hidden">
                  {servicesSummary.services.map((service, index) => {
                    // Show diff indicators when we have a valid diff (removed status restriction)
                    const shouldShowRowDiff = invoice.diff &&
                      Array.isArray(invoice.diff) &&
                      invoice.diff.length > 0 &&
                      diffIndex &&
                      diffIndex.size > 0;

                    // Check if this item is new by comparing against baseline
                    const isNewItem = shouldShowRowDiff &&
                      service.id &&
                      !baselineLineItems.some((item: any) => item.id === service.id);

                    return (
                      <div
                        key={service.id}
                        className={cn(
                          "rounded-lg border p-3 space-y-2 relative",
                          isNewItem && "bg-green-50 border-green-500 border-l-4",
                          !isNewItem && "border-slate-200 bg-white"
                        )}
                      >
                      {service.receiptUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewAttachment(service.receiptUrl!, service.receiptType || 'application/pdf', service.receiptName || 'receipt');
                          }}
                          className="absolute top-3 right-3 text-blue-600 hover:text-blue-800"
                        >
                          <Paperclip className="h-5 w-5" />
                        </button>
                      )}

                      <div>
                        <p className="font-medium text-sm text-slate-800 pr-8">{service.description}</p>
                        <p className="text-xs text-muted-foreground">{service.type}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Cost:</span>
                          <span className="ml-1 text-slate-700">{formatCurrency(service.cost)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Markup:</span>
                          <span className="ml-1 text-slate-700">{formatCurrency(service.markupAmount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Tax:</span>
                          <span className="ml-1 text-slate-700">{formatCurrency(service.taxAmount)}</span>
                        </div>
                        <div className="font-medium">
                          <span className="text-slate-500">Total:</span>
                          <span className="ml-1 text-slate-900">{formatCurrency(service.total)}</span>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Desktop: Table Layout */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
                  <div className="min-w-[600px]">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <span>Item</span>
                      <span className="text-right">Cost</span>
                      <span className="text-right">Markup</span>
                      <span className="text-right">Tax</span>
                      <span className="text-right">Total</span>
                    </div>
                {/* Show deleted items first */}
                {/* Combine two sources: 1) Items in baseline but not in current active services, 2) Items marked with _deleted flag */}
                {(() => {
                  const shouldShowRowDiff = invoice.status === 'change_requested' &&
                    invoice.diff &&
                    Array.isArray(invoice.diff) &&
                    invoice.diff.length > 0;

                  // Get active services (without _deleted flag)
                  const activeServiceIds = servicesSummary.services.filter((s: ServiceSummaryItem) => {
                    // Check if this service ID exists in lineItems with _deleted flag
                    const lineItem = lineItems.find(item => item.id === s.id);
                    return !lineItem || !lineItem._deleted;
                  }).map((s: ServiceSummaryItem) => s.id);

                  // Find items in baseline but not in active services
                  const removedFromBaseline = baselineLineItems.filter((baselineItem: any) =>
                    !activeServiceIds.includes(baselineItem.id)
                  );

                  // Find items in current lineItems with _deleted flag
                  const markedAsDeleted = lineItems.filter(item => item._deleted);

                  // Combine both, removing duplicates by id
                  const allDeletedItems = [...removedFromBaseline];
                  for (const deletedItem of markedAsDeleted) {
                    if (!allDeletedItems.some((item: any) => item.id === deletedItem.id)) {
                      allDeletedItems.push(deletedItem);
                    }
                  }

                  console.log('[InvoiceView] Deleted items analysis:', {
                    removedFromBaseline: removedFromBaseline.length,
                    markedAsDeleted: markedAsDeleted.length,
                    combined: allDeletedItems.length,
                    shouldShowRowDiff
                  });

                  return allDeletedItems.map((deletedItem: any, index: number) => (
                    <div
                      key={deletedItem.id || `deleted-${index}`}
                      className={cn(
                        'grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center border-t px-4 py-3 text-sm',
                        shouldShowRowDiff && 'border-l-4 bg-red-50 border-red-500 opacity-75'
                      )}
                    >
                      <div className="pr-4">
                        <p className="font-medium text-red-600 line-through">
                          {deletedItem.description || 'Untitled Service'}
                        </p>
                        <p className="text-xs text-muted-foreground line-through">{deletedItem.jobType || deletedItem.itemType || deletedItem.type || 'Service'}</p>
                      </div>
                      <span className="text-right text-red-600 line-through">
                        $0.00
                      </span>
                      <span className="text-right text-red-600 line-through">
                        $0.00
                      </span>
                      <span className="text-right text-red-600 line-through">
                        $0.00
                      </span>
                      <span className="text-right font-medium text-red-600 line-through">
                        $0.00
                      </span>
                    </div>
                  ));
                })()}

                {/* Show current items */}
                {servicesSummary.services.map((service, index) => {
                // Show diff indicators when we have a valid diff (removed status restriction)
                const shouldShowRowDiff = invoice.diff &&
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">
                          <ChangedValue
                            path={`/lineItems/${index}/description`}
                            value={service.description}
                            diff={diffIndex}
                            status={invoice.status}
                            isNewItem={isNewItem}
                          />
                        </p>
                        {service.receiptUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAttachment(service.receiptUrl!, service.receiptType || 'application/pdf', service.receiptName || 'receipt');
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
              })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg space-y-2 bg-slate-50 p-4 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
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
            <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-semibold text-slate-900">
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
          </div>

          {/* Invoice Attachments Section */}
          {(invoice.attachmentUrl || invoice.secondAttachmentUrl) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Attachments</h3>
              <div className="space-y-2">
                {invoice.attachmentUrl && (
                  <button
                    onClick={() => handleViewAttachment(
                      invoice.attachmentUrl!,
                      invoice.attachmentType || 'application/pdf',
                      invoice.attachmentName || 'Invoice Attachment'
                    )}
                    className="flex items-center gap-2 w-full px-4 py-3 text-left bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Paperclip className="h-4 w-4 text-slate-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {invoice.attachmentName || 'Invoice Attachment'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoice.attachmentType || 'Unknown type'}
                      </p>
                    </div>
                  </button>
                )}
                {invoice.secondAttachmentUrl && (
                  <button
                    onClick={() => handleViewAttachment(
                      invoice.secondAttachmentUrl!,
                      invoice.secondAttachmentType || 'application/pdf',
                      invoice.secondAttachmentName || 'Second Attachment'
                    )}
                    className="flex items-center gap-2 w-full px-4 py-3 text-left bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Paperclip className="h-4 w-4 text-slate-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {invoice.secondAttachmentName || 'Second Attachment'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoice.secondAttachmentType || 'Unknown type'}
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Line Item Comments Section */}
        {comments.length > 0 && (
          <div className="space-y-4 px-6 pb-12">
            <h3 className="text-base font-semibold text-slate-800">Line Item Comments</h3>
            {comments.map((comment, index) => (
              <div key={comment.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9">
                    {comment.avatarUrl && <img src={comment.avatarUrl} alt={comment.author} className="h-full w-full object-cover rounded-full" />}
                    <AvatarFallback>{comment.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white shadow-md">
                        {index + 1}
                      </div>
                    </div>
                    {comment.selectionText && (
                      <p className="text-xs text-slate-600 italic">
                        Re: "{comment.selectionText.length > 60 ? comment.selectionText.slice(0, 60) + '...' : comment.selectionText}"
                      </p>
                    )}
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.text}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    {comment.replies.map(reply => (
                      <div key={reply.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          {reply.avatarUrl && <img src={reply.avatarUrl} alt={reply.author} className="h-full w-full object-cover rounded-full" />}
                          <AvatarFallback>{reply.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{reply.author}</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.text}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(reply.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                {!isPreviewMode && (
                  <div className="mt-3 border-t pt-3">
                    {replyingTo === comment.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            {user?.avatarUrl && <img src={user.avatarUrl} alt={user.name || ''} className="h-full w-full object-cover rounded-full" />}
                            <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply..."
                              className="w-full min-h-[80px] p-2 text-sm text-slate-900 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isSubmittingReply}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                            disabled={isSubmittingReply}
                            className="text-slate-700 hover:text-slate-900"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSubmitReply(comment.id)}
                            disabled={!replyText.trim() || isSubmittingReply}
                            className="bg-[#1e3a5f] text-white hover:bg-[#152d4a]"
                          >
                            {isSubmittingReply ? 'Submitting...' : 'Reply'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingTo(comment.id)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      >
                        Reply
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

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

        {/* Comment Creation Modal */}
        {pendingSelection && !isPreviewMode && (
          <div
            ref={selectionCardRef}
            className="absolute z-30 w-72 max-w-[320px] md:w-80"
            style={{
              top: Math.min(pendingSelection.rect.top + pendingSelection.rect.height + 8, previewRef.current ? previewRef.current.scrollHeight - 300 : 0),
              left: Math.max(8, Math.min(pendingSelection.rect.left, previewRef.current ? previewRef.current.scrollWidth - 328 : 0))
            }}
          >
            <Card className="shadow-xl">
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || user.email || 'You'} />}
                    <AvatarFallback>{getInitials(user?.name || user?.email)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {user?.name || user?.email || 'You'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Commenting on "{pendingSelection.text.slice(0, 40)}{pendingSelection.text.length > 40 ? '…' : ''}"
                    </p>
                  </div>
                </div>
                <Textarea
                  rows={3}
                  value={pendingCommentText}
                  onChange={(e) => setPendingCommentText(e.target.value)}
                  placeholder="Add a comment or mention others with @"
                  disabled={isSubmittingComment}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelSelection} disabled={isSubmittingComment}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateComment}
                    disabled={pendingCommentText.trim().length === 0 || isSubmittingComment}
                    className="bg-[#1E3A5F] hover:bg-[#152b47] text-white"
                  >
                    {isSubmittingComment ? 'Submitting...' : 'Comment'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      </div>

      {/* Receipt Modal */}
      {receiptModalOpen && currentReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReceiptModalOpen(false)}>
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-slate-900">{currentReceipt.name}</h3>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {currentReceipt.type.startsWith('image/') ? (
                <img
                  src={currentReceipt.url}
                  alt={currentReceipt.name}
                  className="max-w-full h-auto mx-auto"
                />
              ) : currentReceipt.type === 'application/pdf' ? (
                <iframe
                  src={currentReceipt.url}
                  className="w-full h-[70vh] border-0"
                  title={currentReceipt.name}
                />
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="mb-4">Preview not available for this file type</p>
                  <a
                    href={currentReceipt.url}
                    download={currentReceipt.name}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Download {currentReceipt.name}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const calculateLineItemCost = (item: LineItem | null | undefined): number => {
  if (!item || typeof item !== 'object') {
    return 0;
  }
  if (item.manualCost != null && item.manualCost !== 0) {
    return item.manualCost;
  }

  let cost = item.cost !== undefined ? parseFloat(String(item.cost)) : 0;
  if (Number.isNaN(cost)) {
    cost = 0;
  }

  const scope = item.scope;
  if (!scope || typeof scope !== 'object') {
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

const calculateLineItemTax = (item: LineItem | null | undefined): number => {
  if (!item || typeof item !== 'object') {
    return 0;
  }

  let cost = item.cost !== undefined ? parseFloat(String(item.cost)) : 0;
  if (Number.isNaN(cost)) {
    cost = 0;
  }

  const scope = item.scope;
  if (!scope || typeof scope !== 'object') {
    return 0;
  }

  let markupRate = item.markupRate !== undefined ? item.markupRate : (scope?.markupRate ?? 2.5);
  markupRate = parseFloat(String(markupRate));
  if (Number.isNaN(markupRate)) {
    markupRate = 0;
  }

  if (markupRate > 1) {
    markupRate = markupRate / 100;
  }

  const totalWithMarkup = cost * (1 + markupRate);

  if (item.taxStatus === 'no_tax') {
    return 0;
  }

  if (!item.taxStatus && item.description && item.description.includes('Clearance Fee')) {
    return 0;
  }

  const taxRate = parseFloat(String(item.taxRate)) || 0.0875;
  return totalWithMarkup * taxRate;
};

export default InvoiceView;
