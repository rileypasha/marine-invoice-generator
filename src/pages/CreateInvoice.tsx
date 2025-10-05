import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { SquarePen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { gatherInvoiceData } from '../utils/invoiceData';
import {
  InvoiceComment,
  CommentReply,
  CommentHighlightRect,
  getInitials,
  normalizeInvoiceComments
} from '../utils/invoiceComments';
import { PhoneField } from '../components/phone/PhoneField';
import { buildDiffIndex, ChangedValue, DiffIndex, getDelta } from '../components/invoices/ChangedValue';
import { PatchOperation } from '../types/diff.types';
import { cn } from '../lib/utils';
import { isChangeRequested } from '../utils/status';
import { convertFieldDeltaToPatch, isFieldDeltaFormat } from '../utils/diffConverter';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
  AvatarFallback,
  Textarea
} from '../components/magic/index';
import jsPDF from 'jspdf';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

interface Vessel {
  name: string;
  weight: string;
  beam: string;
  id?: string;
}

interface DatabaseVessel {
  id: string;
  name: string;
  registration_number?: string;
  length_ft?: number;
  beam_ft?: number;
  weight_tons?: number;
  home_port?: string;
  owner_name?: string;
}

interface DatabaseCustomer {
  id: string;
  display_name: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

interface Customer {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  estimatorName: string;
  contactName: string;
  id?: string;
}

interface Service {
  id: string;
  description: string;
  quantity: number;
  quantityDisplay?: string;
  rate: number;
  total: number;
  jobType?: string;
  itemType?: string;
  laborHours?: number;
  otHours?: number;
  manualCost?: number;
  manualCostInput?: string;
  taxStatus?: 'taxable' | 'non-taxable' | 'exempt';
  taxRate?: number;
  markupType?: 'preset-2.5' | 'preset-12.5' | 'custom' | 'exempt';
  markupRate?: number;
  isMarkupExempt?: boolean;
  isTaxExempt?: boolean;
}

interface PendingSelection {
  text: string;
  rect: CommentHighlightRect;
}

interface ServiceSnapshot {
  id: string;
  description: string;
  jobType?: string;
  itemType?: string;
  quantity: number;
  rate: number;
  laborHours: number;
  otHours: number;
  manualCost: number | null;
  taxStatus?: Service['taxStatus'];
  taxRate?: number;
  markupType?: Service['markupType'];
  markupRate?: number;
  isMarkupExempt: boolean;
  isTaxExempt: boolean;
  baseCost: number;
  markupAmount: number;
  totalBeforeTax: number;
  taxAmount: number;
  total: number;
}

interface InvoiceData {
  vessel: Vessel;
  customer: Customer;
  services: Service[];
  notes: string;
  metadata: {
    title?: string;
    taxRate?: number;
    comments?: InvoiceComment[];
  };
}

const toNumber = (value: any, fallback: number): number => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeBoolean = (value: any): boolean | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return undefined;
};

const normalizeTaxStatus = (value: any): Service['taxStatus'] | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = String(value).toLowerCase().replace(/[_ –-]/g, '');
  if (normalized === 'taxable') {
    return 'taxable';
  }
  if (normalized === 'nontaxable') {
    return 'non-taxable';
  }
  if (normalized === 'exempt') {
    return 'exempt';
  }
  return undefined;
};

const normalizeMarkupType = (value: any): Service['markupType'] | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = String(value).toLowerCase().replace(/[_ ]/g, '-');
  if (normalized === 'preset-2.5' || normalized === 'preset-25' || normalized === 'preset2.5') {
    return 'preset-2.5';
  }
  if (normalized === 'preset-12.5' || normalized === 'preset-125' || normalized === 'preset12.5') {
    return 'preset-12.5';
  }
  if (normalized === 'custom') {
    return 'custom';
  }
  if (normalized === 'exempt') {
    return 'exempt';
  }
  return undefined;
};





const formatAddress = (customer: Partial<DatabaseCustomer>) => {
  if (!customer) return '';
  const { address_line1, city, state, postal_code } = customer;
  return [address_line1, city, state, postal_code].filter(Boolean).join(', ');
};

const CreateInvoice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, csrfToken, currentUser } = useAuth();

  const isEditMode = !!id;

  // Debug logging for route params
  console.log('[CreateInvoice] Component mounted/updated', {
    id,
    isEditMode,
    pathname: location.pathname,
    isAuthenticated
  });

  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    vessel: { name: '', weight: '', beam: '' },
    customer: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      estimatorName: '',
      contactName: ''
    },
    services: [],
    notes: '',
    metadata: { taxRate: 0, comments: [] }
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(isEditMode);
  const [activeTab, setActiveTab] = useState('vessel');
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [customerPhoneError, setCustomerPhoneError] = useState('');
  const [focusedCostId, setFocusedCostId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [secondAttachedFile, setSecondAttachedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [originalInvoiceStatus, setOriginalInvoiceStatus] = useState<string | null>(null);
  const [statusChangedToChangeRequested, setStatusChangedToChangeRequested] = useState(false);
  const [attachmentData, setAttachmentData] = useState<{ url: string; name: string; type: string } | null>(null);
  const [secondAttachmentData, setSecondAttachmentData] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isFirstAttachmentNew, setIsFirstAttachmentNew] = useState(false);
  const [isSecondAttachmentNew, setIsSecondAttachmentNew] = useState(false);
  const restoreAppliedRef = useRef(false);
  const [comments, setComments] = useState<InvoiceComment[]>([]);
  const [invoiceDiff, setInvoiceDiff] = useState<PatchOperation[] | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
  const originalInvoiceDataRef = useRef<any>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [pendingCommentText, setPendingCommentText] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [deletedItemsCount, setDeletedItemsCount] = useState(0);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const selectionCardRef = useRef<HTMLDivElement | null>(null);

  const roundCurrency = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  };

  const roundRate = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  };

  const formatCurrency = (value: number): string => {
    if (!Number.isFinite(value)) {
      return '$0.00';
    }
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const parseCurrencyInput = (value: string): number | null => {
    if (!value) return null;

    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;

    const [integerPart, decimalPart] = cleaned.split('.');
    const normalized = integerPart + (decimalPart !== undefined ? `.${decimalPart.slice(0, 2)}` : '');
    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return roundCurrency(parsed);
  };

  const normalizeDecimalInput = (value: string, maxDecimals?: number): string => {
    if (!value) return '';

    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const integerPart = parts.shift() || '';
    const hadDecimal = cleaned.includes('.');
    if (!hadDecimal) {
      return integerPart;
    }

    const decimalsRaw = parts.join('');
    const decimals = maxDecimals !== undefined ? decimalsRaw.slice(0, maxDecimals) : decimalsRaw;

    if (decimals.length === 0 && value.endsWith('.')) {
      return `${integerPart}.`;
    }

    return decimals.length > 0 ? `${integerPart}.${decimals}` : integerPart;
  };

  const getManualCostInputValue = (service: Service, isFocused: boolean): string => {
    const rawValue = service.manualCostInput && service.manualCostInput !== ''
      ? service.manualCostInput
      : service.manualCost && service.manualCost !== 0
        ? normalizeDecimalInput(String(service.manualCost), 2)
        : '';

    if (isFocused) {
      return rawValue;
    }

    return service.manualCost && service.manualCost !== 0
      ? formatCurrency(service.manualCost)
      : rawValue;
  };

  const clearTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.removeAllRanges) {
      selection.removeAllRanges();
    }
  };

  const handlePreviewMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as Node;
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

  const handleCancelSelection = () => {
    setPendingSelection(null);
    setPendingCommentText('');
    clearTextSelection();
  };

  const handleCreateComment = () => {
    if (!pendingSelection) return;
    const trimmed = pendingCommentText.trim();
    if (!trimmed) return;

    const authorName = currentUser?.name || currentUser?.email || 'Unknown User';
    const highlight = {
      top: pendingSelection.rect.top,
      left: pendingSelection.rect.left,
      width: pendingSelection.rect.width || 28,
      height: pendingSelection.rect.height || 24,
    };

    const newComment: InvoiceComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      author: authorName,
      initials: getInitials(authorName),
      text: trimmed,
      selectionText: pendingSelection.text,
      createdAt: new Date().toISOString(),
      highlight,
      replies: []
    };

    setComments(prev => [...prev, newComment]);
    setPendingSelection(null);
    setPendingCommentText('');
    clearTextSelection();
  };

  const handleAddReply = (commentId: string) => {
    const draft = replyDrafts[commentId]?.trim();
    if (!draft) return;

    const authorName = currentUser?.name || currentUser?.email || 'Unknown User';
    const reply: CommentReply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      author: authorName,
      initials: getInitials(authorName),
      text: draft,
      createdAt: new Date().toISOString()
    };

    setComments(prev => prev.map(comment => {
      if (comment.id !== commentId) return comment;
      return {
        ...comment,
        replies: [...comment.replies, reply]
      };
    }));

    setReplyDrafts(prev => ({ ...prev, [commentId]: '' }));
  };

  const renderCommentsPanel = (className = '') => (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Comments</h3>
        <span className="text-xs text-muted-foreground">{comments.length} open</span>
      </div>
      {comments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Highlight any portion of the preview on the left to leave a comment.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment, index) => (
            <div key={comment.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{comment.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    “{comment.selectionText.slice(0, 70)}{comment.selectionText.length > 70 ? '…' : ''}”
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{comment.text}</p>

              {comment.replies.length > 0 && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  {comment.replies.map(reply => (
                    <div key={reply.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{reply.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{reply.author}</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                <Textarea
                  rows={2}
                  value={replyDrafts[comment.id] ?? ''}
                  onChange={(e) => setReplyDrafts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                  placeholder="Reply or mention others with @"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyDrafts(prev => ({ ...prev, [comment.id]: '' }))}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddReply(comment.id)}
                    disabled={!replyDrafts[comment.id]?.trim()}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const toNullableNumber = (value: number | undefined): number | null => {
    if (value === undefined || value === null) {
      return null;
    }
    return Number.isFinite(value) ? roundCurrency(value) : null;
  };

  // Vessel linking state
  const [availableVessels, setAvailableVessels] = useState<DatabaseVessel[]>([]);
  const [isLoadingVessels, setIsLoadingVessels] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [vesselSearchQuery, setVesselSearchQuery] = useState('');

  // Customer linking state
  const [availableCustomers, setAvailableCustomers] = useState<DatabaseCustomer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Build diff index for change tracking visualization
  const diffIndex: DiffIndex = useMemo(() => {
    return buildDiffIndex(invoiceDiff);
  }, [invoiceDiff]);

  // Helper: Check if invoice has change requested status
  const hasChangeRequestedStatus = useMemo(() => {
    return isChangeRequested(invoiceStatus);
  }, [invoiceStatus]);

  // Helper: Check if a field has changed based on client-side comparison
  const hasFieldChangedClientSide = (currentValue: any, path: string[]): boolean => {
    if (!originalInvoiceDataRef.current || !isEditMode) {
      return false;
    }

    let originalValue: any = originalInvoiceDataRef.current;
    for (const key of path) {
      if (originalValue === null || originalValue === undefined) {
        return false;
      }
      if (!(key in originalValue)) {
        // New item (e.g., new line item)
        const isArrayIndex = typeof key === 'number' || !isNaN(Number(key));
        if (isArrayIndex && Array.isArray(originalValue)) {
          return true;
        }
        return false;
      }
      originalValue = originalValue[key];
    }

    const normalizedCurrent = currentValue === '' || currentValue === null || currentValue === undefined ? '' : String(currentValue).trim();
    const normalizedOriginal = originalValue === '' || originalValue === null || originalValue === undefined ? '' : String(originalValue).trim();

    return normalizedCurrent !== normalizedOriginal && normalizedCurrent !== '';
  };

  // Helper: Reconstruct baseline data by reversing diff operations
  const reconstructBaseline = (currentData: any, diff: PatchOperation[]): any => {
    const baseline = JSON.parse(JSON.stringify(currentData));

    console.log('[reconstructBaseline] Starting reconstruction with diff operations:', diff.map(d => ({ path: d.path, op: d.op })));

    // Group operations - we only need array-level add/remove operations
    // Field-level operations within added items can be ignored
    const processedArrayPaths = new Set<string>();

    // Process diff operations in reverse to reconstruct baseline
    for (const operation of diff) {
      const pathParts = operation.path.split('/').filter(p => p !== '');
      console.log('[reconstructBaseline] Processing operation:', { path: operation.path, op: operation.op, pathParts });

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
              const removed = current.pop();
              console.log('[reconstructBaseline] Removed array item:', { arrayPath, itemId: removed?.id, itemDescription: removed?.description });
            }
          }
        }
        // Ignore field-level adds within array items (e.g., /services/-/id)
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
          console.log('[reconstructBaseline] Restored replaced value:', { path: operation.path, oldValue: operation.oldValue });
        }
      }
    }

    console.log('[reconstructBaseline] Baseline after reconstruction:', {
      servicesCount: baseline.services?.length,
      serviceIds: baseline.services?.map((s: any) => ({ id: s.id, description: s.description }))
    });

    return baseline;
  };

  // Helper: Check if a field is in backend diff
  const isFieldInBackendDiff = (path: string, arrayPath?: string[]): boolean => {
    console.log('[isFieldInBackendDiff] Called:', { path, arrayPath, hasChangeRequestedStatus, diffIndexSize: diffIndex?.size });

    if (!hasChangeRequestedStatus || !diffIndex || diffIndex.size === 0) {
      console.log('[isFieldInBackendDiff] Early return - no diff data');
      return false;
    }

    // For array item fields, check if the item exists in the original data
    // If the item is new (not in original), highlight all its fields
    if (/\/\d+\//.test(path) && arrayPath && arrayPath.length >= 2) {
      const arrayName = arrayPath[0]; // e.g., 'services'
      const itemIndex = parseInt(arrayPath[1], 10); // e.g., 0, 1, 2

      console.log('[isFieldInBackendDiff] Array item check:', {
        path,
        arrayName,
        itemIndex,
        arrayPathLength: arrayPath.length,
        fullArrayPath: arrayPath,
        hasOriginalData: !!originalInvoiceDataRef.current,
        isEditMode
      });

      // Get the current item - only use first two elements (arrayName, index)
      const itemPath = arrayPath.slice(0, 2);
      console.log('[isFieldInBackendDiff] Getting item with path:', itemPath);
      const currentItem = getValueFromPath(itemPath);
      console.log('[isFieldInBackendDiff] Current item:', { currentItem, hasId: !!currentItem?.id });

      if (!currentItem || !currentItem.id) {
        console.log('[isFieldInBackendDiff] No current item or ID');
        return false;
      }

      // Check if this item exists in the original data
      if (originalInvoiceDataRef.current && isEditMode) {
        const originalArray = originalInvoiceDataRef.current[arrayName];
        console.log('[isFieldInBackendDiff] Original array:', {
          originalArray: originalArray?.map((item: any) => ({ id: item.id, description: item.description })),
          isArray: Array.isArray(originalArray)
        });

        if (Array.isArray(originalArray)) {
          // Check if any item in the original array has this ID
          const existsInOriginal = originalArray.some((item: any) => item.id === currentItem.id);
          console.log('[isFieldInBackendDiff] ID match check:', {
            currentId: currentItem.id,
            originalIds: originalArray.map((item: any) => item.id),
            existsInOriginal
          });

          if (!existsInOriginal) {
            // This is a new item, highlight all its fields
            console.log('[isFieldInBackendDiff] ✅ New array item detected - HIGHLIGHTING:', { path, itemId: currentItem.id });
            return true;
          } else {
            console.log('[isFieldInBackendDiff] ❌ Existing item - NOT highlighting:', { path, itemId: currentItem.id });
          }
        }
      } else {
        console.log('[isFieldInBackendDiff] No original data or not in edit mode:', {
          hasOriginalData: !!originalInvoiceDataRef.current,
          isEditMode
        });
      }

      return false; // Existing item, don't highlight from backend diff
    }

    // Try exact match for non-array fields
    const delta = getDelta(diffIndex, path);
    if (delta && (delta.op === 'add' || delta.op === 'replace')) {
      console.log('[isFieldInBackendDiff] ✅ Exact match found - HIGHLIGHTING:', { path, op: delta.op });
      return true;
    }

    console.log('[isFieldInBackendDiff] ❌ No match - NOT highlighting:', path);
    return false;
  };

  // Helper: Check if a field should be highlighted (combines both approaches)
  const isFieldHighlighted = (jsonPointerPath: string, arrayPath?: string[]): boolean => {
    console.log('[isFieldHighlighted] Called with:', { jsonPointerPath, arrayPath, hasChangeRequestedStatus, diffIndexSize: diffIndex?.size });

    // Check backend diff first (for saved changes)
    if (isFieldInBackendDiff(jsonPointerPath, arrayPath)) {
      console.log('[isFieldHighlighted] Backend diff match!', jsonPointerPath);
      return true;
    }

    // Check client-side changes (for active editing)
    if (arrayPath && hasFieldChangedClientSide(getValueFromPath(arrayPath), arrayPath)) {
      console.log('[isFieldHighlighted] Client-side change match!', arrayPath);
      return true;
    }

    return false;
  };

  // Helper: Get current value from invoice data using array path
  const getValueFromPath = (path: string[]): any => {
    let value: any = invoiceData;
    for (const key of path) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }
    return value;
  };

  // Helper function to get styling classes for changed fields
  const getChangedFieldClasses = (jsonPointerPath: string, arrayPath?: string[]): string => {
    const isChanged = isFieldHighlighted(jsonPointerPath, arrayPath);
    return isChanged ? '!bg-green-50 !border-green-500 !border-2 font-semibold !text-green-900' : '';
  };

  // Helper function to get inline styles for changed fields
  const getChangedFieldStyles = (jsonPointerPath: string, arrayPath?: string[]): React.CSSProperties | undefined => {
    const isChanged = isFieldHighlighted(jsonPointerPath, arrayPath);
    return isChanged ? {
      backgroundColor: '#f0fdf4',
      borderColor: '#22c55e',
      borderWidth: '2px',
      color: '#14532d',
      fontWeight: 600
    } : undefined;
  };

  // Helper function to get classes for deleted fields
  const getDeletedFieldClasses = (isDeleted: boolean): string => {
    return isDeleted ? '!bg-red-50 !border-red-500 !border-2 font-bold !text-red-600' : '';
  };

  // Helper function to get inline styles for deleted fields
  const getDeletedFieldStyles = (isDeleted: boolean): React.CSSProperties | undefined => {
    return isDeleted ? {
      backgroundColor: '#fef2f2',
      borderColor: '#ef4444',
      borderWidth: '2px',
      color: '#dc2626',
      fontWeight: 700
    } : undefined;
  };

  useEffect(() => {
    if (restoreAppliedRef.current) return;
    const restoredFormState = (location.state as any)?.restoredFormState;
    if (!restoredFormState || isEditMode) return;

    try {
      const restoredInvoiceData: InvoiceData = restoredFormState.invoiceData
        ? JSON.parse(JSON.stringify(restoredFormState.invoiceData))
        : null;

      if (restoredInvoiceData) {
        restoredInvoiceData.services = restoredInvoiceData.services.map((service) => ({
          ...service,
          quantityDisplay: service.quantityDisplay ??
            (service.quantity !== undefined ? normalizeDecimalInput(String(service.quantity)) : ''),
          manualCostInput: service.manualCostInput ??
            (service.manualCost && service.manualCost !== 0
              ? normalizeDecimalInput(String(service.manualCost), 2)
              : '')
        }));
        const normalizedComments = normalizeInvoiceComments(restoredInvoiceData.metadata?.comments);
        restoredInvoiceData.metadata = {
          ...restoredInvoiceData.metadata,
          comments: normalizedComments
        };

        setInvoiceData(restoredInvoiceData);
      }

      if (Array.isArray(restoredFormState.comments)) {
        setComments(normalizeInvoiceComments(restoredFormState.comments));
      }

      if (typeof restoredFormState.selectedVesselId === 'string') {
        setSelectedVesselId(restoredFormState.selectedVesselId);
      }

      if (typeof restoredFormState.selectedCustomerId === 'string') {
        setSelectedCustomerId(restoredFormState.selectedCustomerId);
      }

      if (typeof restoredFormState.vesselSearchQuery === 'string') {
        setVesselSearchQuery(restoredFormState.vesselSearchQuery);
      }

      if (typeof restoredFormState.customerSearchQuery === 'string') {
        setCustomerSearchQuery(restoredFormState.customerSearchQuery);
      }

      if (typeof restoredFormState.activeTab === 'string') {
        setActiveTab(restoredFormState.activeTab);
      }

      if (typeof restoredFormState.customerPhoneError === 'string') {
        setCustomerPhoneError(restoredFormState.customerPhoneError);
      }

      setHasUnsavedChanges(true);
      restoreAppliedRef.current = true;

      navigate(location.pathname + location.search, { replace: true, state: {} });
    } catch (error) {
      console.error('Failed to restore invoice form state:', error);
    }
  }, [isEditMode, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!pendingSelection) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (selectionCardRef.current?.contains(target)) return;
      if (previewRef.current?.contains(target)) return;
      handleCancelSelection();
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [pendingSelection]);

  useEffect(() => {
    setInvoiceData(prev => {
      if (prev.metadata?.comments === comments) {
        return prev;
      }
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          comments,
        }
      };
    });
  }, [comments]);

  // Fetch existing invoice data when in edit mode
  useEffect(() => {
    console.log('[CreateInvoice] useEffect triggered', { isEditMode, isAuthenticated, id });

    // Don't do anything if not in edit mode or no id
    if (!isEditMode || !id) {
      console.log('[CreateInvoice] Skipping fetch - not edit mode or no id:', { isEditMode, id });
      setIsFetchingData(false);
      return;
    }

    // Wait for auth to be ready
    if (!isAuthenticated) {
      console.log('[CreateInvoice] Waiting for authentication...');
      return;
    }

    console.log('[CreateInvoice] Fetching invoice data for id:', id);

    const fetchInvoiceData = async () => {
      try {
        const response = await fetch(`/api/v1/invoice/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken })
          },
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Invoice not found');
          } else if (response.status === 403) {
            setError('You do not have access to this invoice');
          } else {
            setError('Failed to load invoice data');
          }
          return;
        }

        const data = await response.json();
        const invoice = data.data || data.invoice || data;

        console.log('[CreateInvoice] Response from backend:', data);
        console.log('[CreateInvoice] Extracted invoice:', invoice);
        console.log('Attachment fields:', {
          attachmentUrl: invoice.attachmentUrl,
          attachmentName: invoice.attachmentName,
          attachmentType: invoice.attachmentType,
          secondAttachmentUrl: invoice.secondAttachmentUrl,
          secondAttachmentName: invoice.secondAttachmentName,
          secondAttachmentType: invoice.secondAttachmentType
        });

        // Store diff and status for change tracking
        let diffData = data.diff || invoice.diff;
        console.log('[CreateInvoice] Raw diff data:', { diff: diffData, status: invoice.status });

        // Check if diff needs conversion from FieldDelta to PatchOperation
        if (isFieldDeltaFormat(diffData)) {
          console.log('[CreateInvoice] Converting FieldDelta to PatchOperation');
          diffData = convertFieldDeltaToPatch(diffData);
          console.log('[CreateInvoice] Converted diff:', diffData);
        }

        setInvoiceDiff(diffData || null);
        setInvoiceStatus(invoice.status || null);

        if (diffData && Array.isArray(diffData)) {
          console.log('[CreateInvoice] Diff items:', diffData.map((d: any) => ({ path: d.path, op: d.op, value: d.value })));
        }

        const { primaryData, scope, lineItems } = gatherInvoiceData<Record<string, any>>(invoice);

        console.log('[CreateInvoice] After gatherInvoiceData:', {
          primaryData,
          scope,
          lineItems,
          invoiceCustomer: invoice.customer,
          invoiceCustomerAddress: invoice.customerAddress
        });

        const vesselData = primaryData?.vessel || invoice.vessel || {};
        const customerData = primaryData?.customer || invoice.customer || {};

        const services: Service[] = lineItems.map((item: Record<string, any>, index: number) => {
          const quantity = toNumber(item.quantity ?? item.qty ?? 1, 1) || 1;
          const rate = toNumber(item.rate ?? item.cost ?? item.price ?? 0, 0);
          const manualCost = toOptionalNumber(item.manualCost ?? item.manual_cost);
          const total = toNumber(
            item.total ?? item.cost ?? (quantity * rate),
            quantity * rate
          );
          const laborHours = toOptionalNumber(item.laborHours ?? item.labor_hours ?? item.hours);
          const otHours = toOptionalNumber(item.otHours ?? item.ot_hours ?? item.overtimeHours);
          const taxRate = toOptionalNumber(item.taxRate ?? item.tax_rate ?? scope?.taxRate ?? scope?.tax_rate);
          const markupRate = toOptionalNumber(item.markupRate ?? item.markup_rate ?? scope?.markupRate ?? scope?.markup_rate);
          const taxStatus = normalizeTaxStatus(item.taxStatus ?? item.tax_status);
          const markupType = normalizeMarkupType(item.markupType ?? item.markup_type);
          const isMarkupExempt = normalizeBoolean(item.isMarkupExempt ?? item.markup_exempt);
          const isTaxExempt = normalizeBoolean(item.isTaxExempt ?? item.tax_exempt);

          console.log('[CreateInvoice] Service item processing:', {
            index,
            description: item.description,
            rawTaxStatus: item.taxStatus,
            rawTaxStatusAlt: item.tax_status,
            normalizedTaxStatus: taxStatus,
            rawMarkupType: item.markupType,
            rawMarkupTypeAlt: item.markup_type,
            normalizedMarkupType: markupType,
            rawIsMarkupExempt: item.isMarkupExempt,
            rawMarkupExemptAlt: item.markup_exempt,
            normalizedIsMarkupExempt: isMarkupExempt
          });

          const service: Service = {
            id: item.id ? String(item.id) : `service-${index}`,
            description: item.description || item.name || '',
            quantity,
            quantityDisplay: String(quantity),
            rate,
            total,
          };

          const jobType = item.jobType ?? item.job_type ?? item.type;
          if (jobType) {
            service.jobType = jobType;
          }

          const itemType = item.itemType ?? item.item_type;
          if (itemType) {
            service.itemType = itemType;
          }

          if (laborHours !== undefined) {
            service.laborHours = laborHours;
          }

          if (otHours !== undefined) {
            service.otHours = otHours;
          }

          service.manualCost = manualCost ?? 0;
          service.manualCostInput = manualCost != null ? String(manualCost) : '';

          if (taxStatus) {
            service.taxStatus = taxStatus;
          }

          if (taxRate !== undefined) {
            service.taxRate = taxRate;
          }

          if (markupType) {
            service.markupType = markupType;
          }

          if (markupRate !== undefined) {
            service.markupRate = markupRate;
          }

          if (isMarkupExempt !== undefined) {
            service.isMarkupExempt = isMarkupExempt;
          }

          if (isTaxExempt !== undefined) {
            service.isTaxExempt = isTaxExempt;
          }

          // Preserve deleted flag
          if (item._deleted) {
            service._deleted = true;
          }

          return service;
        });

        const vesselWeightSource =
          vesselData.weight ?? invoice.vesselWeight ?? invoice.vessel?.weight_tons ?? '';
        const vesselBeamSource =
          vesselData.beam ?? invoice.vesselBeam ?? invoice.vessel?.beam_ft ?? '';

        const resolvedCustomerName =
          customerData.customerName ||
          customerData.display_name ||
          customerData.legal_name ||
          invoice.customer?.display_name ||
          invoice.customer?.legal_name ||
          invoice.customerName ||
          '';

        const resolvedCustomerEmail =
          customerData.customerEmail ||
          customerData.email ||
          invoice.customer?.email ||
          invoice.customerEmail ||
          '';

        const resolvedCustomerPhone =
          customerData.customerPhone ||
          customerData.phone ||
          invoice.customer?.phone ||
          invoice.customerPhone ||
          '';

        // Try multiple sources for address
        const resolvedCustomerAddress =
          formatAddress(customerData) ||
          formatAddress(invoice.customer || {}) ||
          invoice.customerAddress ||
          '';

        console.log('[CreateInvoice] Address resolution:', {
          fromCustomerData: formatAddress(customerData),
          fromInvoiceCustomer: formatAddress(invoice.customer || {}),
          fromInvoiceField: invoice.customerAddress,
          resolved: resolvedCustomerAddress
        });

        const resolvedContactName =
          customerData.contactName ||
          customerData.contact_name ||
          invoice.customer?.contact_name ||
          invoice.customerName ||
          '';

        const loadedInvoiceData = {
          vessel: {
            name: vesselData.name || invoice.vessel?.name || invoice.vesselName || '',
            weight: vesselWeightSource === '' ? '' : vesselWeightSource.toString(),
            beam: vesselBeamSource === '' ? '' : vesselBeamSource.toString()
          },
          customer: {
            customerName: resolvedCustomerName,
            customerEmail: resolvedCustomerEmail,
            customerPhone: normalizePhoneNumber(resolvedCustomerPhone),
            customerAddress: resolvedCustomerAddress,
            estimatorName: invoice.userName || '',
            contactName: resolvedContactName
          },
          services,
          notes: invoice.notes || '',
          metadata: {
            title: invoice.title || '',
            taxRate: toNumber(
              scope?.taxRate ?? scope?.tax_rate ?? invoice.metadata?.taxRate ?? invoice.metadata?.tax_rate ?? 0,
              0
            ),
            comments: normalizeInvoiceComments(invoice.metadata?.comments)
          }
        };

        setInvoiceData(loadedInvoiceData);

        // Store original data for client-side change tracking
        // If there's a diff, reconstruct the baseline by reversing the diff operations
        if (diffData && Array.isArray(diffData) && diffData.length > 0) {
          originalInvoiceDataRef.current = reconstructBaseline(loadedInvoiceData, diffData);
          console.log('[CreateInvoice] originalInvoiceDataRef set from reconstructed baseline:', {
            hasServices: !!originalInvoiceDataRef.current?.services,
            servicesCount: originalInvoiceDataRef.current?.services?.length,
            serviceIds: originalInvoiceDataRef.current?.services?.map((s: any) => ({ id: s.id, description: s.description }))
          });
        } else {
          originalInvoiceDataRef.current = JSON.parse(JSON.stringify(loadedInvoiceData));
          console.log('[CreateInvoice] originalInvoiceDataRef set from current data (no diff):', {
            hasServices: !!originalInvoiceDataRef.current?.services,
            servicesCount: originalInvoiceDataRef.current?.services?.length,
            serviceIds: originalInvoiceDataRef.current?.services?.map((s: any) => ({ id: s.id, description: s.description }))
          });
        }

        const resolvedCustomerId = customerData.id ?? customerData.customerId ?? invoice.customer?.id ?? invoice.customerId ?? '';
        const resolvedVesselId = vesselData.id ?? invoice.vessel?.id ?? invoice.vesselId ?? '';

        console.log('[CreateInvoice] Resolved IDs:', {
          customerId: resolvedCustomerId,
          vesselId: resolvedVesselId,
          invoiceCustomerId: invoice.customerId,
          invoiceVesselId: invoice.vesselId
        });

        setSelectedCustomerId(resolvedCustomerId ? String(resolvedCustomerId) : '');
        setSelectedVesselId(resolvedVesselId ? String(resolvedVesselId) : '');
        setCustomerPhoneError('');

        const existingComments = normalizeInvoiceComments(invoice.metadata?.comments);
        setComments(existingComments);

        // Store original invoice status
        setOriginalInvoiceStatus(invoice.status || null);

        // Load attachment data from database
        if (invoice.attachmentUrl && invoice.attachmentName && invoice.attachmentType) {
          setAttachmentData({
            url: invoice.attachmentUrl,
            name: invoice.attachmentName,
            type: invoice.attachmentType
          });
          // Set file state to show attachment in UI (using a mock File object for display purposes)
          setAttachedFile(new File([], invoice.attachmentName, { type: invoice.attachmentType }));
          setIsFirstAttachmentNew(false); // Mark as existing attachment, not new
        }

        if (invoice.secondAttachmentUrl && invoice.secondAttachmentName && invoice.secondAttachmentType) {
          setSecondAttachmentData({
            url: invoice.secondAttachmentUrl,
            name: invoice.secondAttachmentName,
            type: invoice.secondAttachmentType
          });
          setSecondAttachedFile(new File([], invoice.secondAttachmentName, { type: invoice.secondAttachmentType }));
          setIsSecondAttachmentNew(false); // Mark as existing attachment, not new
          setStatusChangedToChangeRequested(true);
        }

        setHasUnsavedChanges(false);
      } catch (error: any) {
        console.error('Error fetching invoice data:', error);
        setError('Failed to load invoice data');
      } finally {
        setIsFetchingData(false);
      }
    };

    fetchInvoiceData();
  }, [isEditMode, isAuthenticated, id]);

  // Detect changes to approved invoices and trigger status change to "change_requested"
  useEffect(() => {
    // Only run if we're in edit mode, have original status, and it was approved
    if (!isEditMode || !originalInvoiceStatus || originalInvoiceStatus !== 'approved') {
      return;
    }

    // If already changed status, don't check again
    if (statusChangedToChangeRequested) {
      return;
    }

    // Check if there are unsaved changes (form has been modified)
    if (hasUnsavedChanges && isAuthenticated && csrfToken && id) {
      // Automatically update status to "change_requested"
      const updateStatus = async () => {
        try {
          const response = await fetch(`/api/v1/invoice/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({ status: 'change_requested' })
          });

          if (response.ok) {
            setStatusChangedToChangeRequested(true);
            console.log('Invoice status changed to change_requested');
          }
        } catch (error) {
          console.error('Error updating invoice status:', error);
        }
      };

      updateStatus();
    }
  }, [hasUnsavedChanges, isEditMode, originalInvoiceStatus, statusChangedToChangeRequested, isAuthenticated, csrfToken, id]);

  // Handle query parameters for pre-filling customer data
  useEffect(() => {
    // Only process query params if we're NOT in edit mode (creating a new invoice)
    if (isEditMode || restoreAppliedRef.current || !searchParams.has('customerId')) {
      return;
    }

    const customerId = searchParams.get('customerId');
    const customerName = searchParams.get('customerName');
    const legalName = searchParams.get('legalName');
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const address_line1 = searchParams.get('address_line1');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const postal_code = searchParams.get('postal_code');

    if (customerId) {
      // Set the selected customer ID to auto-select in the dropdown
      setSelectedCustomerId(customerId);

      // Pre-fill the customer data
      setInvoiceData(prev => ({
        ...prev,
        customer: {
          ...prev.customer,
          id: customerId,
          contactName: customerName || '',
          customerName: legalName || customerName || '',
          customerEmail: email || '',
          customerPhone: normalizePhoneNumber(phone),
          customerAddress: formatAddress({ address_line1, city, state, postal_code }) || ''
        }
      }));
      setCustomerPhoneError('');
    }
  }, [isEditMode, searchParams]);

  // Handle query parameters for pre-filling vessel data
  useEffect(() => {
    // Only process query params if we're NOT in edit mode (creating a new invoice)
    if (isEditMode || restoreAppliedRef.current || !searchParams.has('vesselId')) {
      return;
    }

    const vesselId = searchParams.get('vesselId');
    const vesselName = searchParams.get('vesselName');
    const vesselWeight = searchParams.get('vesselWeight');
    const vesselLength = searchParams.get('vesselLength');

    if (vesselId) {
      // Set the selected vessel ID to auto-select in the dropdown
      setSelectedVesselId(vesselId);

      // Pre-fill the vessel data
      setInvoiceData(prev => ({
        ...prev,
        vessel: {
          ...prev.vessel,
          id: vesselId,
          name: vesselName || '',
          weight: vesselWeight || '',
          beam: vesselLength || ''
        }
      }));
    }
  }, [isEditMode, searchParams]);

  // Automatically add/update Clearance Fee based on vessel weight
  useEffect(() => {
    const weight = parseFloat(invoiceData.vessel.weight) || 0;
    console.log('DEBUG Clearance Fee - rawWeight:', invoiceData.vessel.weight, 'parsedWeight:', weight, 'comparison >= 500:', weight >= 500, 'expectedAmount:', weight >= 500 ? 1250 : 950);

    if (weight > 0) {
      const clearanceFeeIndex = invoiceData.services.findIndex(s => s.jobType === 'Clearance Fee');
      const clearanceFeeAmount = weight >= 500 ? 1250 : 950;

      if (clearanceFeeIndex === -1) {
        // Add new Clearance Fee service
        const newClearanceFee: Service = {
          id: `clearance-${Date.now()}`,
          jobType: 'Clearance Fee',
          description: 'Clearance Fee',
          quantity: 1,
          rate: clearanceFeeAmount,
          manualCost: clearanceFeeAmount,
          total: clearanceFeeAmount,
          taxStatus: 'non-taxable',
          taxRate: 0,
          markupType: 'exempt',
          markupRate: 0,
          isMarkupExempt: true,
          isTaxExempt: true
        };

        setInvoiceData(prev => ({
          ...prev,
          services: [...prev.services, newClearanceFee]
        }));
        setHasUnsavedChanges(true);
      } else {
        // Only update if user hasn't manually overridden the cost
        const existingService = invoiceData.services[clearanceFeeIndex];
        const currentManualCost = existingService.manualCost || 0;

        // Check if manualCost is either 950 or 1250 (the only valid auto-calculated amounts)
        const isAutoCalculatedAmount = currentManualCost === 950 || currentManualCost === 1250;

        if (isAutoCalculatedAmount && existingService.rate !== clearanceFeeAmount) {
          const updatedServices = [...invoiceData.services];
          updatedServices[clearanceFeeIndex] = {
            ...existingService,
            rate: clearanceFeeAmount,
            manualCost: clearanceFeeAmount,
            total: clearanceFeeAmount
          };

          setInvoiceData(prev => ({
            ...prev,
            services: updatedServices
          }));
          setHasUnsavedChanges(true);
        }
      }
    } else {
      // Remove Clearance Fee if weight is 0 or empty
      const clearanceFeeExists = invoiceData.services.some(s => s.jobType === 'Clearance Fee');
      if (clearanceFeeExists) {
        setInvoiceData(prev => ({
          ...prev,
          services: prev.services.filter(s => s.jobType !== 'Clearance Fee')
        }));
        setHasUnsavedChanges(true);
      }
    }
  }, [invoiceData.vessel.weight]);

  // Cleanup address timeout on unmount
  useEffect(() => {
    return () => {
      if (addressTimeoutRef.current) {
        clearTimeout(addressTimeoutRef.current);
      }
    };
  }, []);

  // Normalize stored phone numbers to E.164 when possible
  const normalizePhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';
    if (phone.startsWith('+')) return phone;

    try {
      const parsed = parsePhoneNumber(phone, 'US');
      return parsed ? parsed.format('E.164') : phone;
    } catch (error) {
      return phone;
    }
  };

  const formatNumberWithSeparators = (value: string): string => {
    if (!value) return '';

    const normalized = value.replace(/,/g, '').trim();
    if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') {
      return normalized;
    }

    const [integerPart, decimalPart] = normalized.split('.');
    if (!integerPart || !/^-?\d+$/.test(integerPart)) {
      return normalized;
    }

    const formattedInteger = Number(integerPart).toLocaleString('en-US');

    if (decimalPart !== undefined) {
      return decimalPart.length > 0
        ? `${formattedInteger}.${decimalPart}`
        : `${formattedInteger}.`;
    }

    return formattedInteger;
  };

  const handleVesselChange = (field: keyof Vessel, value: string) => {
    // Strip suffixes before storing the value to keep raw numbers
    let cleanValue = value;
    if (field === 'weight') {
      cleanValue = value.replace(/\s*tons?$/i, '').trim();
    } else if (field === 'beam') {
      cleanValue = value.replace(/\s*ft$/i, '').trim();
    }

    cleanValue = cleanValue.replace(/,/g, '');

    setInvoiceData(prev => ({
      ...prev,
      vessel: { ...prev.vessel, [field]: cleanValue }
    }));
    setHasUnsavedChanges(true);

    // Clear vessel link when manually editing fields
    if (selectedVesselId) {
      setSelectedVesselId('');
    }
  };

  // Function to search vessels
  const searchVessels = async (query: string) => {
    if (!isAuthenticated || !csrfToken || query.length < 2) {
      setAvailableVessels([]);
      return;
    }

    setIsLoadingVessels(true);
    try {
      const response = await fetch(`/api/v1/vessels/search?query=${encodeURIComponent(query)}&limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableVessels(data.vessels || []);
      } else {
        console.error('Failed to search vessels:', response.statusText);
        setAvailableVessels([]);
      }
    } catch (error) {
      console.error('Error searching vessels:', error);
      setAvailableVessels([]);
    } finally {
      setIsLoadingVessels(false);
    }
  };

  const searchCustomers = async (query: string) => {
    if (!isAuthenticated || !csrfToken || query.length < 2) {
      setAvailableCustomers([]);
      return;
    }

    setIsLoadingCustomers(true);
    try {
      const response = await fetch(`/api/v1/customers/search?query=${encodeURIComponent(query)}&limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableCustomers(data.customers || []);
      } else {
        console.error('Failed to search customers:', response.statusText);
        setAvailableCustomers([]);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setAvailableCustomers([]);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const searchAddresses = async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setIsLoadingAddress(true);
    try {
      const response = await fetch(`/api/geo/address-autocomplete?query=${encodeURIComponent(query)}&limit=5`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const suggestions = await response.json();
        setAddressSuggestions(suggestions || []);
        setShowAddressSuggestions(true);
      } else {
        console.error('Failed to search addresses:', response.statusText);
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching addresses:', error);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleCustomerChange = (field: keyof Customer, value: string) => {
    setInvoiceData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: value }
    }));
    setHasUnsavedChanges(true);
  };

  const handleCustomerPhoneChange = (value: string | undefined) => {
    const phoneValue = value ?? '';

    setInvoiceData(prev => ({
      ...prev,
      customer: { ...prev.customer, customerPhone: phoneValue }
    }));
    setHasUnsavedChanges(true);

    if (phoneValue && !isValidPhoneNumber(phoneValue)) {
      setCustomerPhoneError('Please enter a valid phone number');
    } else {
      setCustomerPhoneError('');
    }
  };

  // Calculation functions based on legacy business logic
  const calculateLineItemCost = (service: Service): number => {
    // Priority: manualCost > cost > calculated from hours
    if (service.manualCost != null && service.manualCost !== 0) {
      return parseFloat(String(service.manualCost)) || 0;
    }
    if (service.rate != null && service.rate !== 0) {
      return parseFloat(String(service.rate)) * (service.quantity || 1);
    }

    // Calculate from labor hours for labor items
    if (service.jobType === 'Manual Entry' && service.itemType === 'Labor') {
      const laborHours = parseFloat(String(service.laborHours)) || 0;
      const otHours = parseFloat(String(service.otHours)) || 0;
      return (laborHours * 80) + (otHours * 120);
    }

    // Agent Services calculation
    if (service.jobType === 'Agent Services') {
      const laborHours = parseFloat(String(service.laborHours)) || 0;
      const otHours = parseFloat(String(service.otHours)) || 0;
      return (laborHours * 80) + (otHours * 120);
    }

    // Clearance Fee - use manual cost if set, otherwise auto-calculate
    if (service.jobType === 'Clearance Fee') {
      if (service.manualCost !== undefined && service.manualCost !== null) {
        return parseFloat(String(service.manualCost)) || 0;
      }
      const vesselWeight = parseFloat(invoiceData.vessel.weight) || 0;
      return vesselWeight >= 500 ? 1250 : 950;
    }

    // Other labor types
    if (service.itemType === 'Labor') {
      const laborHours = parseFloat(String(service.laborHours)) || 0;
      const otHours = parseFloat(String(service.otHours)) || 0;
      return (laborHours * 85) + (otHours * 127.5);
    }

    return service.rate * service.quantity;
  };

  const applyMarkup = (cost: number, service: Service): number => {
    // Check if item is markup exempt
    if (service.isMarkupExempt ||
        service.markupType === 'exempt' ||
        service.jobType === 'Clearance Fee' ||
        service.jobType === 'Agent Services' ||
        (service.jobType === 'Manual Entry' && service.itemType === 'Labor')) {
      return cost;
    }

    // For items with markupType set to exempt, no markup
    if (service.markupType === 'exempt') {
      return cost;
    }

    // Get markup rate based on type
    if (!service.markupType) {
      return cost; // No markup if type not selected
    }

    let markupRate = 0;
    if (service.markupType === 'preset-2.5') {
      markupRate = 2.5;
    } else if (service.markupType === 'preset-12.5') {
      markupRate = 12.5;
    } else if (service.markupType === 'custom' && service.markupRate) {
      markupRate = service.markupRate;
    }

    // Convert percentage to decimal
    return cost * (1 + markupRate / 100);
  };

  const calculateTax = (service: Service, totalWithMarkup: number): number => {
    // Clearance Fee is always non-taxable
    if (service.jobType === 'Clearance Fee') {
      return 0;
    }

    // Check tax status
    if (!service.taxStatus ||
        service.taxStatus === 'non-taxable' ||
        service.taxStatus === 'exempt' ||
        service.isTaxExempt === true) {
      return 0;
    }

    const defaultTaxRate =
      invoiceData.metadata.taxRate != null ? invoiceData.metadata.taxRate / 100 : 0.0875;
    const taxRate = typeof service.taxRate === 'number' ? service.taxRate : defaultTaxRate;
   return totalWithMarkup * taxRate;
 };

  const previewSummary = useMemo(() => {
    console.log('[previewSummary] Recalculating...', {
      totalServices: invoiceData.services.length,
      deletedCount: invoiceData.services.filter(s => s._deleted).length,
      deletedItemsCount
    });

    const calculatedServices = invoiceData.services
      .filter(service => {
        const isDeleted = !!service._deleted;
        if (isDeleted) {
          console.log('[previewSummary] Filtering out deleted service:', service.id, service.description);
        }
        return !isDeleted;
      })
      .map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      const markupAmount = roundCurrency(costWithMarkup - baseCost);
      return {
        id: service.id,
        description: service.description || 'Untitled Service',
        jobType: service.jobType || 'Manual Entry',
        itemType: service.itemType || 'General',
        quantity: roundCurrency(service.quantity || 0),
        baseCost: roundCurrency(baseCost),
        markupAmount,
        taxAmount: roundCurrency(taxAmount),
        totalBeforeTax: roundCurrency(costWithMarkup),
        total: roundCurrency(costWithMarkup + taxAmount)
      };
    });

    const subtotalWithMarkup = calculatedServices.reduce((sum, service) => sum + service.totalBeforeTax, 0);
    const baseCostTotal = calculatedServices.reduce((sum, service) => sum + service.baseCost, 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotalWithMarkup + totalTax;
    const grossProfit = subtotalWithMarkup - baseCostTotal;
    const grossProfitPercent = baseCostTotal > 0 ? roundRate((grossProfit / baseCostTotal) * 100) : 0;

    console.log('[previewSummary] Final totals:', {
      calculatedServicesCount: calculatedServices.length,
      subtotalWithMarkup: roundCurrency(subtotalWithMarkup),
      totalTax: roundCurrency(totalTax),
      finalTotal: roundCurrency(finalTotal)
    });

    return {
      services: calculatedServices,
      baseCostTotal: roundCurrency(baseCostTotal),
      subtotalWithMarkup: roundCurrency(subtotalWithMarkup),
      totalTax: roundCurrency(totalTax),
      finalTotal: roundCurrency(finalTotal),
      grossProfit: roundCurrency(grossProfit),
      grossProfitPercent
    };
  }, [
    invoiceData.services,
    invoiceData.vessel.weight,
    invoiceData.metadata.taxRate
  ]);

  const buildServiceSnapshot = (service: Service): ServiceSnapshot => {
    const quantity = Number.isFinite(service.quantity) ? Number(service.quantity) : 1;
    const rate = Number.isFinite(service.rate) ? Number(service.rate) : 0;
    const normalizedService: Service = {
      ...service,
      quantity,
      rate,
    };

    const baseCostRaw = calculateLineItemCost(normalizedService);
    const baseCost = roundCurrency(baseCostRaw);

    const manualCostValue =
      normalizedService.manualCost != null && normalizedService.manualCost > 0
        ? roundCurrency(normalizedService.manualCost)
        : null;

    const effectiveBaseCost = manualCostValue !== null ? manualCostValue : baseCost;
    const costWithMarkup = roundCurrency(applyMarkup(effectiveBaseCost, normalizedService));
    const taxAmountValue = roundCurrency(calculateTax(normalizedService, costWithMarkup));

    return {
      id: normalizedService.id,
      description: normalizedService.description?.trim() || '',
      jobType: normalizedService.jobType || '',
      itemType: normalizedService.itemType || '',
      quantity,
      rate,
      laborHours: Number.isFinite(normalizedService.laborHours) ? Number(normalizedService.laborHours) : 0,
      otHours: Number.isFinite(normalizedService.otHours) ? Number(normalizedService.otHours) : 0,
      manualCost: manualCostValue,
      taxStatus: normalizedService.taxStatus,
      taxRate: typeof normalizedService.taxRate === 'number' ? normalizedService.taxRate : undefined,
      markupType: normalizedService.markupType,
      markupRate: typeof normalizedService.markupRate === 'number' ? normalizedService.markupRate : undefined,
      isMarkupExempt: !!normalizedService.isMarkupExempt,
      isTaxExempt: !!normalizedService.isTaxExempt,
      baseCost: roundCurrency(effectiveBaseCost),
      markupAmount: roundCurrency(costWithMarkup - effectiveBaseCost),
      totalBeforeTax: costWithMarkup,
      taxAmount: normalizedService.isTaxExempt ? 0 : taxAmountValue,
      total: roundCurrency(costWithMarkup + (normalizedService.isTaxExempt ? 0 : taxAmountValue)),
    };
  };

  const buildInvoiceSubmissionPayload = () => {
    // Build snapshots for ALL services (including deleted)
    const allServiceSnapshots = invoiceData.services.map(buildServiceSnapshot);

    // Calculate totals only from non-deleted services
    const activeSnapshots = allServiceSnapshots.filter((_, index) => !invoiceData.services[index]._deleted);

    const baseCostSumRaw = activeSnapshots.reduce((sum, snapshot) => sum + snapshot.baseCost, 0);
    const subtotalBeforeTaxRaw = activeSnapshots.reduce((sum, snapshot) => sum + snapshot.totalBeforeTax, 0);
    const totalTaxRaw = activeSnapshots.reduce((sum, snapshot) => sum + snapshot.taxAmount, 0);

    const baseCostSum = roundCurrency(baseCostSumRaw);
    const subtotalBeforeTax = roundCurrency(subtotalBeforeTaxRaw);
    const totalTax = roundCurrency(totalTaxRaw);
    const finalTotal = roundCurrency(subtotalBeforeTax + totalTax);
    const grossProfit = roundCurrency(subtotalBeforeTax - baseCostSum);
    const profitPercent = baseCostSum > 0
      ? roundCurrency((grossProfit / baseCostSum) * 100)
      : 0;
    const markupRateValue = baseCostSum > 0
      ? roundRate((subtotalBeforeTax - baseCostSum) / baseCostSum)
      : 0;

    const vesselWeightRaw = toOptionalNumber(invoiceData.vessel.weight);
    const vesselBeamRaw = toOptionalNumber(invoiceData.vessel.beam);

    const structuredData = {
      scope: {
        markupRate: markupRateValue,
        isTaxable: totalTax > 0,
        lineItems: allServiceSnapshots.map((snapshot, index) => ({
          id: snapshot.id,
          jobType: snapshot.jobType || '',
          itemType: snapshot.itemType || '',
          description: snapshot.description,
          manualCost: snapshot.manualCost,
          laborHours: snapshot.laborHours || null,
          otHours: snapshot.otHours || null,
          cost: snapshot.baseCost,
          laborCost: snapshot.itemType === 'Labor' ? snapshot.baseCost : null,
          materialCost: snapshot.itemType === 'Material' ? snapshot.baseCost : null,
          subcontractorCost: snapshot.itemType === 'Subcontractor' ? snapshot.baseCost : null,
          taxStatus: snapshot.taxStatus,
          taxRate: snapshot.taxRate,
          markupType: snapshot.markupType,
          markupRate: snapshot.markupRate,
          isMarkupExempt: snapshot.isMarkupExempt,
          isTaxExempt: snapshot.isTaxExempt,
          _deleted: invoiceData.services[index]._deleted || false
        }))
      },
      laborRate: 85,
      otRate: 127.5
    };

    const metadataPayload = {
      ...invoiceData.metadata,
      taxRate: invoiceData.metadata.taxRate || 0
    };

    const parsedData = {
      ...structuredData,
      scope: {
        ...structuredData.scope,
        lineItems: allServiceSnapshots.map((snapshot, index) => ({
          id: snapshot.id,
          description: snapshot.description,
          jobType: snapshot.jobType,
          itemType: snapshot.itemType,
          quantity: snapshot.quantity,
          rate: snapshot.rate,
          laborHours: snapshot.laborHours,
          otHours: snapshot.otHours,
          manualCost: snapshot.manualCost,
          baseCost: snapshot.baseCost,
          markupAmount: snapshot.markupAmount,
          totalBeforeTax: snapshot.totalBeforeTax,
          taxAmount: snapshot.taxAmount,
          total: snapshot.total,
          isMarkupExempt: snapshot.isMarkupExempt,
          isTaxExempt: snapshot.isTaxExempt,
          taxStatus: snapshot.taxStatus,
          markupType: snapshot.markupType,
          markupRate: snapshot.markupRate,
          _deleted: invoiceData.services[index]._deleted || false
        })),
        subtotal: subtotalBeforeTax,
        taxAmount: totalTax,
        total: finalTotal
      },
      totals: {
        baseCost: baseCostSum,
        grossProfit,
        profitPercent
      }
    };

    return {
      serviceSnapshots: allServiceSnapshots,
      structuredData,
      metadataPayload,
      parsedData,
      totals: {
        subtotalBeforeTax,
        totalTax,
        finalTotal,
        baseCost: baseCostSum,
        grossProfit,
        profitPercent
      }
    };
  };

  const addService = () => {
    const newService: Service = {
      id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      description: '',
      quantity: 1,
      quantityDisplay: '1',
      rate: 0,
      total: 0,
      jobType: '',
      itemType: '',
      laborHours: 0,
      otHours: 0,
      manualCost: 0,
      manualCostInput: '',
      taxStatus: undefined,
      taxRate: 0.0875,
      markupType: undefined,
      markupRate: undefined,
      isMarkupExempt: false,
      isTaxExempt: false
    };
    setInvoiceData(prev => ({
      ...prev,
      services: [...prev.services, newService]
    }));
    setHasUnsavedChanges(true);
  };

  const updateService = (id: string, field: keyof Omit<Service, 'id'>, value: string | number | boolean) => {
    setInvoiceData(prev => ({
      ...prev,
      services: prev.services.map(service => {
        if (service.id === id) {
          const updated: Service = { ...service };

          if (field === 'manualCost') {
            const stringValue = typeof value === 'string' ? value : String(value ?? '');
            const normalizedInput = normalizeDecimalInput(stringValue, 2);
            const parsed = parseCurrencyInput(normalizedInput);
            updated.manualCostInput = normalizedInput;
            updated.manualCost = parsed ?? 0;
          } else if (field === 'quantity') {
            const stringValue = typeof value === 'string' ? value : String(value ?? '');
            const normalizedInput = normalizeDecimalInput(stringValue);
            const parsed = normalizedInput === '' ? NaN : parseFloat(normalizedInput);
            updated.quantityDisplay = normalizedInput;
            updated.quantity = Number.isFinite(parsed) ? parsed : 0;
          } else {
            let processedValue = value;
            if (field === 'isMarkupExempt' || field === 'isTaxExempt') {
              processedValue = value === true || value === 'true';
            }
            (updated as any)[field] = processedValue;
          }

          // Apply business rules based on job type
          if (field === 'jobType') {
            // Reset dependent fields when job type changes
            updated.itemType = '';
            updated.laborHours = 0;
            updated.otHours = 0;
            updated.manualCost = 0;
            updated.manualCostInput = '';

            // Set exemptions based on job type
            if (value === 'Agent Services') {
              updated.isMarkupExempt = true;
              // Don't set markupType, leave it as undefined to show placeholder
            } else if (value === 'Clearance Fee') {
              updated.isMarkupExempt = true;
              updated.isTaxExempt = true;
              updated.markupType = 'exempt';
              updated.taxStatus = 'non-taxable';
            } else if (value === 'Pilotage') {
              updated.isMarkupExempt = false;
              updated.isTaxExempt = false;
              updated.markupType = 'exempt';
              updated.taxStatus = 'non-taxable';
            } else if (value === 'Manual Entry') {
              updated.isMarkupExempt = false;
              updated.isTaxExempt = false;
            } else {
              updated.isMarkupExempt = false;
              updated.isTaxExempt = false;
            }
          }

          // Set exemptions for Manual Entry + Labor
          if (field === 'itemType' && updated.jobType === 'Manual Entry' && value === 'Labor') {
            updated.isMarkupExempt = true;
            // Don't set markupType, leave it as undefined to show placeholder
          } else if (field === 'itemType' && updated.jobType === 'Manual Entry' && value !== 'Labor') {
            updated.isMarkupExempt = false;
            // Don't set markupType, leave it as undefined
          }

          if (updated.manualCostInput === undefined || updated.manualCostInput === null) {
            updated.manualCostInput = updated.manualCost && updated.manualCost !== 0
              ? normalizeDecimalInput(String(updated.manualCost), 2)
              : '';
          }

          if (!updated.quantityDisplay) {
            updated.quantityDisplay = updated.quantity ? normalizeDecimalInput(String(updated.quantity)) : '';
          }

          // Recalculate cost and total based on all inputs
          const baseCost = calculateLineItemCost(updated);
          const costWithMarkup = applyMarkup(baseCost, updated);
          const taxAmount = calculateTax(updated, costWithMarkup);
          updated.total = costWithMarkup + taxAmount;

          return updated;
        }
        return service;
      })
    }));
    setHasUnsavedChanges(true);
  };

  const removeService = (id: string) => {
    if (isEditMode) {
      // In edit mode, mark as deleted (with strikethrough)
      setInvoiceData(prev => ({
        ...prev,
        services: prev.services.map(service =>
          service.id === id
            ? { ...service, _deleted: true }
            : service
        )
      }));
      setDeletedItemsCount(prev => prev + 1);
    } else {
      // In create mode, actually remove the item
      setInvoiceData(prev => ({
        ...prev,
        services: prev.services.filter(service => service.id !== id)
      }));
    }
    setHasUnsavedChanges(true);
  };

  // Form validation function to check required fields
  const getFormValidation = () => {
    const missingFields = [];

    // Check vessel fields
    if (!invoiceData.vessel.name?.trim()) {
      missingFields.push("Vessel Name");
    }
    if (!invoiceData.vessel.weight?.trim() || parseFloat(invoiceData.vessel.weight) <= 0) {
      missingFields.push("Vessel Weight");
    }

    // Check customer fields
    if (!invoiceData.customer.customerName?.trim()) {
      missingFields.push("Contact Name");
    }

    // Check services - at least one service with description and cost/rate
    const hasValidService = invoiceData.services.some(service => {
      const hasDescription = service.description?.trim();
      const hasCost = service.total > 0 || service.rate > 0 ||
                     (service.manualCost && service.manualCost > 0) ||
                     ((service.laborHours || 0) > 0 || (service.otHours || 0) > 0);
      return hasDescription && hasCost;
    });

    if (!hasValidService) {
      missingFields.push("At least one service");
    }

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      completedCount: 4 - missingFields.length,
      totalRequired: 4
    };
  };

  // Helper function to check if a specific field is missing
  const isFieldMissing = (fieldName: string) => {
    return hasAttemptedSave && formValidation.missingFields.includes(fieldName);
  };

  const selectionCardPosition = pendingSelection
    ? (() => {
        if (!pendingSelection) return null;
        const container = previewRef.current;
        const estimatedWidth = 312;
        const estimatedHeight = 220;
        let left = pendingSelection.rect.left;
        let top = pendingSelection.rect.top + pendingSelection.rect.height + 12;

        if (container) {
          const maxLeft = container.scrollLeft + container.clientWidth - estimatedWidth - 16;
          left = Math.min(left, maxLeft);
          left = Math.max(container.scrollLeft + 16, left);

          const visibleTop = container.scrollTop;
          const visibleBottom = visibleTop + container.clientHeight;
          if (top + estimatedHeight > visibleBottom) {
            top = Math.max(visibleTop + 16, pendingSelection.rect.top - estimatedHeight - 12);
          }
          top = Math.max(container.scrollTop + 16, top);
        }

        return { top, left };
      })()
    : null;

  const formValidation = getFormValidation();

  const handleSave = async () => {
    setHasAttemptedSave(true);

    if (!isAuthenticated || !csrfToken) {
      setError('Please log in to save invoices');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = isEditMode ? `/api/v1/invoice/${id}` : '/api/v1/invoice/save';
      const method = isEditMode ? 'PUT' : 'POST';

      const {
        structuredData,
        metadataPayload,
        parsedData,
        totals
      } = buildInvoiceSubmissionPayload();

      const titleBase = invoiceData.metadata.title?.trim();
      const defaultTitle = invoiceData.vessel.name
        ? `Invoice for ${invoiceData.vessel.name}`
        : 'Invoice Request';

      const payload = {
        title: titleBase || defaultTitle,
        data: JSON.stringify(structuredData),
        metadata: JSON.stringify(metadataPayload),
        notes: invoiceData.notes,
        customerId: invoiceData.customer.id || null,
        vesselId: invoiceData.vessel.id || null,
        customerName: invoiceData.customer.customerName,
        customerEmail: invoiceData.customer.customerEmail,
        customerPhone: invoiceData.customer.customerPhone,
        customerAddress: invoiceData.customer.customerAddress,
        vesselName: invoiceData.vessel.name,
        vesselWeight: toOptionalNumber(invoiceData.vessel.weight),
        vesselBeam: toOptionalNumber(invoiceData.vessel.beam),
        subtotal: totals.subtotalBeforeTax,
        taxAmount: totals.totalTax,
        total: totals.finalTotal,
        grossProfit: totals.grossProfit,
        profitPercent: totals.profitPercent,
        parsedData,
        // Only set status to 'approved' if a NEW attachment is being added
        ...((isFirstAttachmentNew || isSecondAttachmentNew) && { status: 'approved' }),
        ...(attachmentData && {
          attachmentUrl: attachmentData.url,
          attachmentName: attachmentData.name,
          attachmentType: attachmentData.type
        }),
        ...(secondAttachmentData && {
          secondAttachmentUrl: secondAttachmentData.url,
          secondAttachmentName: secondAttachmentData.name,
          secondAttachmentType: secondAttachmentData.type
        })
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Invoice save failed:', errorText);
        let errorMessage = `Failed to ${isEditMode ? 'update' : 'save'} invoice`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorMessage;
        } catch (parseError) {
          if (errorText?.trim()) {
            errorMessage = `${errorMessage}: ${errorText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setHasUnsavedChanges(false);

      // Navigate to invoice requests table on success
      navigate('/requests');

    } catch (error: any) {
      console.error('Error saving invoice:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndNew = async () => {
    // Check if form is valid before saving
    if (!formValidation.isComplete) {
      setError(`Please complete required fields: ${formValidation.missingFields.join(", ")}`);
      return;
    }

    if (!isAuthenticated || !csrfToken) {
      setError('Please log in to save invoices');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = isEditMode ? `/api/v1/invoice/${id}` : '/api/v1/invoice/save';
      const method = isEditMode ? 'PUT' : 'POST';

      const {
        structuredData,
        metadataPayload,
        parsedData,
        totals
      } = buildInvoiceSubmissionPayload();

      const titleBase = invoiceData.metadata.title?.trim();
      const defaultTitle = invoiceData.vessel.name
        ? `Invoice for ${invoiceData.vessel.name}`
        : 'Invoice Request';

      const payload = {
        title: titleBase || defaultTitle,
        data: JSON.stringify(structuredData),
        metadata: JSON.stringify(metadataPayload),
        notes: invoiceData.notes,
        customerId: invoiceData.customer.id || null,
        vesselId: invoiceData.vessel.id || null,
        customerName: invoiceData.customer.customerName,
        customerEmail: invoiceData.customer.customerEmail,
        customerPhone: invoiceData.customer.customerPhone,
        vesselName: invoiceData.vessel.name,
        vesselWeight: toOptionalNumber(invoiceData.vessel.weight),
        vesselBeam: toOptionalNumber(invoiceData.vessel.beam),
        subtotal: totals.subtotalBeforeTax,
        taxAmount: totals.totalTax,
        total: totals.finalTotal,
        grossProfit: totals.grossProfit,
        profitPercent: totals.profitPercent,
        parsedData
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Invoice save & new failed:', errorText);
        let errorMessage = `Failed to ${isEditMode ? 'update' : 'save'} invoice`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorMessage;
        } catch (parseError) {
          if (errorText?.trim()) {
            errorMessage = `${errorMessage}: ${errorText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Instead of navigating, clear the form for new invoice
      handleNewInvoice();

      // Clear any errors
      setError(null);

    } catch (error: any) {
      console.error('Error saving invoice:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewInvoice = () => {
    setInvoiceData({
      vessel: { name: '', weight: '', beam: '' },
      customer: {
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        estimatorName: '',
        contactName: ''
      },
      services: [],
      notes: '',
      metadata: { taxRate: 0, comments: [] }
    });
    setHasUnsavedChanges(false);
    setCustomerPhoneError('');
    setComments([]);
    setReplyDrafts({});
    setPendingSelection(null);
    setPendingCommentText('');
    setFocusedCostId(null);
  };

  const handlePrint = () => {
    // Calculate totals for print preview
    const calculatedServices = invoiceData.services.map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      return {
        ...service,
        cost: roundCurrency(baseCost),
        markupAmount: roundCurrency(costWithMarkup - baseCost),
        taxAmount: roundCurrency(taxAmount),
        totalBeforeTax: roundCurrency(costWithMarkup),
        total: roundCurrency(costWithMarkup + taxAmount)
      };
    });

    const subtotalWithMarkup = calculatedServices.reduce((sum, service) => sum + service.totalBeforeTax, 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotalWithMarkup + totalTax;
    const baseCostTotal = calculatedServices.reduce((sum, service) => sum + service.cost, 0);
    const grossProfit = subtotalWithMarkup - baseCostTotal;
    const grossProfitPercent = baseCostTotal > 0 ? roundRate((grossProfit / baseCostTotal) * 100) : 0;

    // Create print data structure
    const printData = {
      previewMode: true,
      id: 'print',
      invoiceNumber: `PRINT-${Date.now().toString().slice(-6)}`,
      title: invoiceData.metadata.title || `Invoice for ${invoiceData.vessel.name}`,
      total: finalTotal,
      subtotal,
      taxAmount: totalTax,
      grossProfit,
      profitPercent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      userName: invoiceData.customer.estimatorName || 'Current User',
      vesselId: invoiceData.vessel.id || null,
      vesselName: invoiceData.vessel.name,
      vesselWeight: parseFloat(invoiceData.vessel.weight) || 0,
      vesselBeam: parseFloat(invoiceData.vessel.beam) || 0,
      customerName: invoiceData.customer.customerName,
      customerEmail: invoiceData.customer.customerEmail,
      customerPhone: invoiceData.customer.customerPhone,
      notes: invoiceData.notes,
      parsedData: {
        vessel: {
          name: invoiceData.vessel.name,
          weight: parseFloat(invoiceData.vessel.weight) || 0,
          beam: parseFloat(invoiceData.vessel.beam) || 0
        },
        customer: {
          customerName: invoiceData.customer.customerName,
          customerEmail: invoiceData.customer.customerEmail,
          customerPhone: invoiceData.customer.customerPhone,
          customerAddress: invoiceData.customer.customerAddress
        },
        scope: {
          lineItems: calculatedServices,
          subtotal,
          taxAmount: totalTax,
          total: finalTotal
        }
      }
    };

    // Navigate to preview with print parameter
    navigate('/requests/preview?print=true', {
      state: { previewData: printData }
    });
  };

  const handleExportPDF = () => {
    // Calculate totals for PDF export
    const calculatedServices = invoiceData.services.map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      return {
        ...service,
        cost: baseCost,
        markupAmount: costWithMarkup - baseCost,
        taxAmount,
        total: costWithMarkup + taxAmount
      };
    });

    const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotal + totalTax;
    const baseCost = calculatedServices.reduce((sum, service) => sum + service.cost, 0);
    const grossProfit = subtotal - baseCost;
    const profitPercent = baseCost > 0 ? (grossProfit / baseCost) * 100 : 0;

    // Create PDF
    const pdf = new jsPDF();

    // Set font
    pdf.setFont('helvetica');

    // Header
    pdf.setFontSize(22);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Marine Group', 20, 20);

    pdf.setFontSize(14);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Invoice Request Summary', 20, 28);

    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, 36);
    pdf.text(`Invoice Ref: INV-${Date.now().toString().slice(-6)}`, 20, 42);

    // Divider
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(20, 48, 190, 48);

    // Vessel Information
    let yPos = 60;
    pdf.setFontSize(12);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Summary', 20, yPos);

    yPos += 8;
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(20, yPos, 170, 26, 3, 3, 'FD');

    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Base Cost', 28, yPos + 8);
    pdf.text('Subtotal (with markup)', 70, yPos + 8);
    pdf.text('Tax', 132, yPos + 8);
    pdf.text('Total', 162, yPos + 8);

    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text(formatCurrency(previewSummary.baseCostTotal), 28, yPos + 17);
    pdf.text(formatCurrency(previewSummary.subtotalWithMarkup), 70, yPos + 17);
    pdf.text(formatCurrency(previewSummary.totalTax), 132, yPos + 17);
    pdf.text(formatCurrency(previewSummary.finalTotal), 162, yPos + 17);

    yPos += 38;
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Gross Profit', 28, yPos);
    pdf.text('Gross Profit %', 70, yPos);
    pdf.setFontSize(11);
    pdf.text(formatCurrency(previewSummary.grossProfit), 28, yPos + 7);
    pdf.text(`${previewSummary.grossProfitPercent.toFixed(2)}%`, 70, yPos + 7);

    yPos += 18;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(20, yPos, 190, yPos);
    yPos += 12;

    pdf.setFontSize(12);
    pdf.text('Vessel & Contact Details', 20, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.text(`Vessel: ${invoiceData.vessel.name || 'N/A'}`, 20, yPos);
    pdf.text(`Weight: ${invoiceData.vessel.weight || 'N/A'} tons`, 20, yPos + 8);
    pdf.text(`Length: ${invoiceData.vessel.beam || 'N/A'} ft`, 20, yPos + 16);

    pdf.text(`Contact: ${invoiceData.customer.customerName || 'N/A'}`, 110, yPos);
    pdf.text(`Email: ${invoiceData.customer.customerEmail || 'N/A'}`, 110, yPos + 8);
    pdf.text(`Phone: ${invoiceData.customer.customerPhone || 'N/A'}`, 110, yPos + 16);
    yPos += 28;

    pdf.setDrawColor(226, 232, 240);
    pdf.line(20, yPos, 190, yPos);
    yPos += 12;

    pdf.setFontSize(12);
    pdf.text('Services', 20, yPos);
    yPos += 10;

    const tableColumnX = [20, 60, 90, 120, 140, 160, 178];
    const tableHeaders = ['Item', 'Type', 'Qty', 'Cost', 'Markup', 'Tax', 'Total'];

    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    tableHeaders.forEach((header, idx) => {
      pdf.text(header, tableColumnX[idx], yPos);
    });
    yPos += 4;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(20, yPos, 190, yPos);
    yPos += 6;

    // Contact Information
    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85);
    calculatedServices.forEach(service => {
      if (yPos > 265) {
        pdf.addPage();
        yPos = 30;
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        tableHeaders.forEach((header, idx) => {
          pdf.text(header, tableColumnX[idx], yPos);
        });
        yPos += 4;
        pdf.setDrawColor(226, 232, 240);
        pdf.line(20, yPos, 190, yPos);
        yPos += 6;
        pdf.setTextColor(51, 65, 85);
      }

      pdf.text((service.description || '').slice(0, 40), tableColumnX[0], yPos);
      pdf.text((service.jobType || service.itemType || '—').slice(0, 18), tableColumnX[1], yPos);
      pdf.text(String(roundCurrency(service.quantity || 0)), tableColumnX[2], yPos, { align: 'right' });
      pdf.text(formatCurrency(service.cost), tableColumnX[3], yPos, { align: 'right' });
      pdf.text(formatCurrency(service.markupAmount), tableColumnX[4], yPos, { align: 'right' });
      pdf.text(formatCurrency(service.taxAmount), tableColumnX[5], yPos, { align: 'right' });
      pdf.text(formatCurrency(service.total), tableColumnX[6], yPos, { align: 'right' });

      yPos += 8;
    });

    yPos += 6;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(20, yPos, 190, yPos);
    yPos += 10;

    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`Base Cost: ${formatCurrency(baseCostTotal)}`, 120, yPos);
    yPos += 8;
    pdf.text(`Subtotal (with markup): ${formatCurrency(subtotalWithMarkup)}`, 120, yPos);
    yPos += 8;
    pdf.text(`Tax: ${formatCurrency(totalTax)}`, 120, yPos);
    yPos += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total Due: ${formatCurrency(finalTotal)}`, 120, yPos);
    yPos += 12;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Gross Profit: ${formatCurrency(grossProfit)}`, 120, yPos);
    yPos += 8;
    pdf.text(`Gross Profit %: ${grossProfitPercent.toFixed(2)}%`, 120, yPos);

    // Notes section
    if (invoiceData.notes && invoiceData.notes.trim()) {
      yPos += 16;
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Notes', 20, yPos);
      yPos += 8;
      pdf.setTextColor(71, 85, 105);
      pdf.setFontSize(10);

      // Split notes into lines
      const noteLines = pdf.splitTextToSize(invoiceData.notes, 170);
      noteLines.forEach((line: string) => {
        pdf.text(line, 20, yPos);
        yPos += 6;
      });
    }

    // Save the PDF
    const fileName = `Invoice_${invoiceData.vessel.name || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  };

  const handleEmail = () => {
    // Set default email recipient to customer's email
    setEmailRecipient(invoiceData.customer.customerEmail || '');
    setEmailMessage('');
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailRecipient.trim()) {
      alert('Please enter an email recipient');
      return;
    }

    setIsEmailSending(true);

    try {
      // Calculate totals for email
      const calculatedServices = invoiceData.services.map(service => {
        const baseCost = calculateLineItemCost(service);
        const costWithMarkup = applyMarkup(baseCost, service);
        const taxAmount = calculateTax(service, costWithMarkup);
        return {
          ...service,
          cost: baseCost,
          markupAmount: costWithMarkup - baseCost,
          taxAmount,
          total: costWithMarkup + taxAmount
        };
      });

      const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
      const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
      const finalTotal = subtotal + totalTax;

      // Prepare email data
      const emailData = {
        invoiceData: {
          ...invoiceData,
          services: calculatedServices,
          total: finalTotal,
          subtotal,
          taxAmount: totalTax
        },
        emailTo: emailRecipient,
        emailMessage: emailMessage
      };

      const response = await fetch('/api/v1/invoice/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken!
        },
        credentials: 'include',
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      const result = await response.json();
      alert('Invoice email sent successfully!');
      setShowEmailDialog(false);

    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleFileAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type (PDF, images)
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF or image file (PNG, JPEG)');
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('File size must be less than 10MB');
        return;
      }

      setAttachedFile(file);
      setIsFirstAttachmentNew(true); // Mark as new attachment

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setAttachmentData({
          url: base64Data,
          name: file.name,
          type: file.type
        });

        // Automatically update status to "approved" when file is attached in edit mode
        if (isEditMode && id && isAuthenticated && csrfToken) {
          try {
            setIsUploadingFile(true);

            const response = await fetch(`/api/v1/invoice/${id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
              },
              credentials: 'include',
              body: JSON.stringify({
                status: 'approved',
                attachmentUrl: base64Data,
                attachmentName: file.name,
                attachmentType: file.type
              })
            });

            if (response.ok) {
              console.log('Invoice status updated to approved');
            }
          } catch (error) {
            console.error('Error updating invoice status:', error);
          } finally {
            setIsUploadingFile(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setAttachmentData(null);
    setIsFirstAttachmentNew(false);
  };

  const handleSecondFileAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type (PDF, images)
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF or image file (PNG, JPEG)');
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('File size must be less than 10MB');
        return;
      }

      setSecondAttachedFile(file);
      setIsSecondAttachmentNew(true); // Mark as new attachment

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setSecondAttachmentData({
          url: base64Data,
          name: file.name,
          type: file.type
        });

        // Automatically update status to "approved" when second file is attached
        if (isEditMode && id && isAuthenticated && csrfToken) {
          try {
            setIsUploadingFile(true);

            const response = await fetch(`/api/v1/invoice/${id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
              },
              credentials: 'include',
              body: JSON.stringify({
                status: 'approved',
                secondAttachmentUrl: base64Data,
                secondAttachmentName: file.name,
                secondAttachmentType: file.type
              })
            });

            if (response.ok) {
              console.log('Invoice status updated to approved');
            }
          } catch (error) {
            console.error('Error updating invoice status:', error);
          } finally {
            setIsUploadingFile(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSecondAttachment = () => {
    setSecondAttachedFile(null);
    setSecondAttachmentData(null);
    setIsSecondAttachmentNew(false);
  };

  const handleViewAttachment = (attachmentData: { url: string; name: string; type: string }) => {
    try {
      // Convert base64 to blob
      const base64Data = attachmentData.url.split(',')[1]; // Remove data:mime;base64, prefix
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachmentData.type });

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

  const handleExportCSV = () => {
    // Calculate totals for CSV export
    const calculatedServices = invoiceData.services.map(service => {
      const baseCost = calculateLineItemCost(service);
      const costWithMarkup = applyMarkup(baseCost, service);
      const taxAmount = calculateTax(service, costWithMarkup);
      return {
        ...service,
        cost: baseCost,
        markupAmount: costWithMarkup - baseCost,
        taxAmount,
        total: costWithMarkup + taxAmount
      };
    });

    // Create CSV content
    const csvHeaders = [
      'Description',
      'Type',
      'Labor Hours',
      'OT Hours',
      'Base Cost',
      'Markup',
      'Tax',
      'Total'
    ];

    const csvRows = calculatedServices.map(service => [
      `"${service.description || ''}"`, 
      `"${service.jobType || service.itemType || ''}"`, 
      service.laborHours || 0,
      service.otHours || 0,
      service.cost.toFixed(2),
      service.markupAmount.toFixed(2),
      service.taxAmount.toFixed(2),
      service.total.toFixed(2)
    ]);

    // Add summary rows
    const subtotal = calculatedServices.reduce((sum, service) => sum + (service.total - service.taxAmount), 0);
    const totalTax = calculatedServices.reduce((sum, service) => sum + service.taxAmount, 0);
    const finalTotal = subtotal + totalTax;
    const baseCost = calculatedServices.reduce((sum, service) => sum + service.cost, 0);
    const grossProfit = subtotal - baseCost;

    csvRows.push(
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', 'SUBTOTAL', '', '', subtotal.toFixed(2)],
      ['', '', '', '', 'TOTAL TAX', '', '', totalTax.toFixed(2)],
      ['', '', '', '', 'FINAL TOTAL', '', '', finalTotal.toFixed(2)],
      ['', '', '', '', 'GROSS PROFIT', '', '', grossProfit.toFixed(2)]
    );

    // Create CSV content
    const csvContent = [
      // Invoice header info
      `"Invoice for ${invoiceData.vessel.name}"`, 
      `"Contact: ${invoiceData.customer.customerName}"`, 
      `"Date: ${new Date().toLocaleDateString()}"`, 
      '',
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const fileName = `Invoice_${invoiceData.vessel.name || 'Unknown'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals
  const subtotal = invoiceData.services
    .filter(service => !service._deleted)
    .reduce((sum, service) => sum + service.total, 0);
  const taxAmount = invoiceData.metadata.taxRate ? (subtotal * invoiceData.metadata.taxRate / 100) : 0;
  const total = subtotal + taxAmount;

  const TabButton = ({ id, label, isActive, onClick }: {
    id: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? 'bg-[#1E3A5F] text-white'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {label}
    </button>
  );

  // Loading state for edit mode
  if (isFetchingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading invoice data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate('/requests')}> 
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <div className="w-full border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-2 md:px-6 pt-0 pb-2 -mt-1">
          {/* Left: Title + Status Badges */}
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl md:text-2xl font-semibold text-foreground">
              <SquarePen className="h-5 w-5" />
              {isEditMode ? 'Edit Invoice' : 'New Invoice Request'}
            </h1>

            {/* Unsaved Changes Indicator */}
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved
              </Badge>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Save & New (Desktop Only) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAndNew}
              disabled={isLoading || !formValidation.isComplete}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save & New
            </Button>

            {/* Primary Save Button */}
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className={`inline-flex items-center gap-1 rounded-md bg-[#1E3A5F] h-8 px-3 text-xs font-medium text-white shadow-sm hover:bg-[#152b47] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/50 ${hasUnsavedChanges ? 'shadow-lg' : ''}`}
            >
              {isLoading ? (
                <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              {isEditMode ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6">
        <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:gap-8 ${activeTab === 'notes' ? '' : 'lg:grid-cols-[minmax(0,6fr)_minmax(320px,1fr)]'}`}>

          {/* Main Form Area */}
          <div className="space-y-6">
            {/* Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-lg">
              <TabButton
                id="vessel"
                label="Vessel"
                isActive={activeTab === 'vessel'}
                onClick={() => setActiveTab('vessel')}
              />
              <TabButton
                id="customer"
                label="Contact"
                isActive={activeTab === 'customer'}
                onClick={() => setActiveTab('customer')}
              />
              <TabButton
                id="services"
                label="Services"
                isActive={activeTab === 'services'}
                onClick={() => setActiveTab('services')}
              />
              <TabButton
                id="notes"
                label="Notes"
                isActive={activeTab === 'notes'}
                onClick={() => setActiveTab('notes')}
              />
            </div>

            {/* Vessel Tab */}
            {activeTab === 'vessel' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vessel Information</CardTitle>
                  <CardDescription>
                    Enter details about the vessel for this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Link to Existing Vessel */}
                  <div className="space-y-2">
                    <Label htmlFor="vessel-link" className="!text-black font-medium">Link to Existing Vessel</Label>
                    <Select
                      value={selectedVesselId}
                      onValueChange={(value) => {
                        setSelectedVesselId(value);
                        if (value && value !== '') {
                          const selectedVessel = availableVessels.find(v => v.id === value);
                          if (selectedVessel) {
                            setInvoiceData(prev => ({
                              ...prev,
                              vessel: {
                                ...prev.vessel,
                                id: selectedVessel.id,
                                name: selectedVessel.name,
                                weight: selectedVessel.weight_tons?.toString() || '',
                                beam: selectedVessel.length_ft?.toString() || ''
                              }
                            }));
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        {selectedVesselId ? (
                          <div className="flex items-center">
                            <span>{availableVessels.find(v => v.id === selectedVesselId)?.name}</span>
                            <svg className="w-4 h-4 ml-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <SelectValue placeholder="Search for a vessel..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Type to search vessels..."
                            value={vesselSearchQuery}
                            onChange={(e) => {
                              setVesselSearchQuery(e.target.value);
                              searchVessels(e.target.value);
                            }}
                          />
                        </div>
                        {isLoadingVessels ? (
                          <div className="p-2 text-center">Loading...</div>
                        ) : (
                          availableVessels.map(vessel => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              {vessel.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vessel-name" className={isFieldMissing("Vessel Name") ? "text-red-600 font-medium" : "!text-black font-medium"}>
                        Vessel {isFieldMissing("Vessel Name") && <span className="text-red-600">*</span>}
                      </Label>
                      <Input
                        id="vessel-name"
                        value={invoiceData.vessel.name}
                        onChange={(e) => handleVesselChange('name', e.target.value)}
                        placeholder="e.g. The Sea Serpent"
                        className={cn(
                          getChangedFieldClasses('/vesselName', ['vessel', 'name']),
                          isFieldMissing("Vessel Name") && "border-red-500 focus:ring-red-500"
                        )}
                        style={getChangedFieldStyles('/vesselName', ['vessel', 'name'])}
                      />
                      {isFieldMissing("Vessel Name") && (
                        <p className="text-xs text-red-600">Vessel name is required</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel-weight" className={isFieldMissing("Vessel Weight") ? "text-red-600 font-medium" : "!text-black font-medium"}>
                        Weight {isFieldMissing("Vessel Weight") && <span className="text-red-600">*</span>}
                      </Label>
                      <div className="relative">
                        <Input
                          id="vessel-weight"
                          placeholder="e.g. 50"
                          className={cn(
                            'pr-12',
                            getChangedFieldClasses('/vesselWeight', ['vessel', 'weight']),
                            isFieldMissing("Vessel Weight") && "border-red-500 focus:ring-red-500"
                          )}
                          style={getChangedFieldStyles('/vesselWeight', ['vessel', 'weight'])}
                          value={formatNumberWithSeparators(invoiceData.vessel.weight)}
                          onChange={(e) => handleVesselChange('weight', e.target.value)}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                          tons
                        </span>
                      </div>
                      {isFieldMissing("Vessel Weight") && (
                        <p className="text-xs text-red-600">Vessel weight is required</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel-beam" className="!text-black font-medium">Length</Label>
                      <div className="relative">
                        <Input
                          id="vessel-beam"
                          placeholder="e.g. 65"
                          className={cn('pr-12', getChangedFieldClasses('/vesselBeam', ['vessel', 'beam']))}
                          style={getChangedFieldStyles('/vesselBeam', ['vessel', 'beam'])}
                          value={formatNumberWithSeparators(invoiceData.vessel.beam)}
                          onChange={(e) => handleVesselChange('beam', e.target.value)}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                          ft
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer Tab */}
            {activeTab === 'customer' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Information</CardTitle>
                  <CardDescription>
                    Enter contact details for this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Link to Existing Customer */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-link" className="!text-black font-medium">Link to Existing Vessel</Label>
                    <Select
                      value={selectedCustomerId}
                      onValueChange={(value) => {
                        setSelectedCustomerId(value);
                        if (value) {
                          const selectedCustomer = availableCustomers.find(c => c.id === value);
                          if (selectedCustomer) {
                            console.log('Selected Customer:', selectedCustomer);
                            setInvoiceData(prev => ({
                              ...prev,
                              customer: {
                                ...prev.customer,
                                id: selectedCustomer.id,
                                contactName: selectedCustomer.display_name,
                                customerName: selectedCustomer.legal_name || selectedCustomer.display_name,
                                customerEmail: selectedCustomer.email || '',
                                customerPhone: normalizePhoneNumber(selectedCustomer.phone),
                                customerAddress: formatAddress(selectedCustomer)
                              }
                            }));
                            setCustomerPhoneError('');
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        {selectedCustomerId ? (
                          <div className="flex items-center">
                            <span>{availableCustomers.find(c => c.id === selectedCustomerId)?.display_name}</span>
                            <svg className="w-4 h-4 ml-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <SelectValue placeholder="Search for a contact..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Type to search contacts..."
                            value={customerSearchQuery}
                            onChange={(e) => {
                              setCustomerSearchQuery(e.target.value);
                              searchCustomers(e.target.value);
                            }}
                          />
                        </div>
                        {isLoadingCustomers ? (
                          <div className="p-2 text-center">Loading...</div>
                        ) : (
                          availableCustomers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.display_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name" className={isFieldMissing("Contact Name") ? "text-red-600 font-medium" : "!text-black font-medium"}>
                        Contact Name {isFieldMissing("Contact Name") && <span className="text-red-600">*</span>}
                      </Label>
                      <Input
                        id="contact-name"
                        value={invoiceData.customer.contactName}
                        onChange={(e) => handleCustomerChange('contactName', e.target.value)}
                        placeholder="e.g. John Smith"
                        className={cn(
                          getChangedFieldClasses('/contactName', ['customer', 'contactName']),
                          isFieldMissing("Contact Name") && "border-red-500 focus:ring-red-500"
                        )}
                        style={getChangedFieldStyles('/contactName', ['customer', 'contactName'])}
                      />
                      {isFieldMissing("Contact Name") && (
                        <p className="text-xs text-red-600">Contact name is required</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-email" className="!text-black font-medium">Email Address</Label>
                      <Input
                        id="customer-email"
                        type="email"
                        value={invoiceData.customer.customerEmail}
                        onChange={(e) => handleCustomerChange('customerEmail', e.target.value)}
                        placeholder="e.g. john.smith@example.com"
                        className={cn(getChangedFieldClasses('/customerEmail', ['customer', 'customerEmail']))}
                        style={getChangedFieldStyles('/customerEmail', ['customer', 'customerEmail'])}
                      />
                    </div>
                    <div className="space-y-2">
                      <PhoneField
                        name="customer-phone"
                        label="Phone Number"
                        value={invoiceData.customer.customerPhone || undefined}
                        onChange={handleCustomerPhoneChange}
                        placeholder="e.g. (123) 456-7890"
                        defaultCountry="US"
                        error={customerPhoneError}
                        className={cn(getChangedFieldClasses('/customerPhone', ['customer', 'customerPhone']))}
                      />
                    </div>
                    <div className="space-y-2 md:-mt-1">
                      <Label htmlFor="customer-address" className="!text-black font-medium">Address</Label>
                      <div className="relative">
                        <Input
                          id="customer-address"
                          value={invoiceData.customer.customerAddress}
                          onChange={(e) => {
                            handleCustomerChange('customerAddress', e.target.value);
                            if (addressTimeoutRef.current) {
                              clearTimeout(addressTimeoutRef.current);
                            }
                            addressTimeoutRef.current = setTimeout(() => {
                              searchAddresses(e.target.value);
                            }, 300);
                          }}
                          onFocus={() => setShowAddressSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 150)}
                          placeholder="e.g. 123 Main Street, Anytown, USA"
                          className={cn(getChangedFieldClasses('/customerAddress', ['customer', 'customerAddress']))}
                          style={getChangedFieldStyles('/customerAddress', ['customer', 'customerAddress'])}
                        />
                        {showAddressSuggestions && addressSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full bg-background border border-input rounded-md shadow-lg mt-1">
                            {addressSuggestions.map((suggestion, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                                onMouseDown={() => {
                                  handleCustomerChange('customerAddress', suggestion.formatted);
                                  setAddressSuggestions([]);
                                  setShowAddressSuggestions(false);
                                }}
                              >
                                {suggestion.formatted}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
              <Card>
                <CardHeader>
                  <CardTitle className={isFieldMissing("At least one service") ? "text-base text-red-600" : "text-base"}>
                    Services & Line Items {isFieldMissing("At least one service") && <span className="text-red-600">*</span>}
                  </CardTitle>
                  <CardDescription>
                    Add services, labor, and materials for this invoice
                  </CardDescription>
                  {isFieldMissing("At least one service") && (
                    <p className="text-xs text-red-600 mt-2">At least one service is required</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {invoiceData.services
                    .filter(service => {
                      // If approved, filter out deleted items
                      if (invoiceStatus === 'approved' && service._deleted) {
                        return false;
                      }
                      return true;
                    })
                    .map((service, index) => {
                    const isDeleted = service._deleted;
                    const isLaborHoursEntry =
                      service.jobType === 'Manual Entry' && service.itemType === 'Labor';
                    const isAgentServices = service.jobType === 'Agent Services';
                    const shouldHideTaxAndMarkup = isLaborHoursEntry || isAgentServices;
                    const shouldShowManualCostInputs =
                      (service.jobType === 'Manual Entry' &&
                        service.itemType &&
                        service.itemType !== 'Labor') ||
                      (service.jobType &&
                        service.jobType !== 'Manual Entry' &&
                        service.jobType !== 'Agent Services');

                    return (
                      <div
                        key={service.id}
                        className={cn(
                          "border rounded-lg p-4 space-y-4",
                          isDeleted && "bg-red-50 border-red-300 opacity-75"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className={cn("text-sm font-medium", isDeleted && "text-red-600 line-through")}>
                            {isDeleted ? "Deleted Service Item" : "Service Item"}
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeService(service.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            disabled={isDeleted}
                          >
                            ×
                          </Button>
                        </div>

                        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", isDeleted && "pointer-events-none opacity-60")}>
                          <div className="space-y-2">
                            <Label htmlFor={`service-job-type-${index}`} className={isDeleted ? "line-through text-red-600" : "!text-black font-medium"}>Service Type *</Label>
                            <Select
                              value={service.jobType || ''}
                              onValueChange={(value) => updateService(service.id, 'jobType', value)}
                              disabled={isDeleted}
                            >
                              <SelectTrigger
                                id={`service-job-type-${index}`}
                                className={cn(
                                  isDeleted
                                    ? getDeletedFieldClasses(isDeleted)
                                    : getChangedFieldClasses(`/services/${index}/jobType`, ['services', index, 'jobType'])
                                )}
                                style={isDeleted ? getDeletedFieldStyles(isDeleted) : undefined}
                              >
                                <SelectValue placeholder="Select service type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Manual Entry">Manual Entry</SelectItem>
                                <SelectItem value="Clearance Fee">Clearance Fee</SelectItem>
                                <SelectItem value="Pilotage">Pilotage</SelectItem>
                                <SelectItem value="Car Rental">Car Rental</SelectItem>
                                <SelectItem value="Trash Removal">Trash Removal</SelectItem>
                                <SelectItem value="Good Stew">Good Stew</SelectItem>
                                <SelectItem value="Crew Placement">Crew Placement</SelectItem>
                                <SelectItem value="Agent Services">Agent Services</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {service.jobType === 'Manual Entry' && (
                            <div className="space-y-2">
                              <Label htmlFor={`service-item-type-${index}`} className="!text-black font-medium">Item Type *</Label>
                              <Select
                                value={service.itemType || ''}
                                onValueChange={(value) => updateService(service.id, 'itemType', value)}
                              >
                                <SelectTrigger id={`service-item-type-${index}`}>
                                  <SelectValue placeholder="Select item type..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Labor">Labor</SelectItem>
                                  <SelectItem value="Material">Material</SelectItem>
                                  <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {(isLaborHoursEntry || isAgentServices) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`service-labor-hours-${index}`} className="!text-black font-medium">Regular Hours</Label>
                              <div className="relative">
                                <Input
                                  id={`service-labor-hours-${index}`}
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    service.laborHours !== undefined &&
                                    service.laborHours !== null &&
                                    service.laborHours !== 0
                                      ? service.laborHours.toString()
                                      : ''
                                  }
                                  onChange={(e) =>
                                    updateService(
                                      service.id,
                                      'laborHours',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  placeholder="0"
                                  className="pr-12"
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tracking-wide text-muted-foreground">
                                  hours
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`service-ot-hours-${index}`} className="!text-black font-medium">Overtime Hours</Label>
                              <div className="relative">
                                <Input
                                  id={`service-ot-hours-${index}`}
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    service.otHours !== undefined &&
                                    service.otHours !== null &&
                                    service.otHours !== 0
                                      ? service.otHours.toString()
                                      : ''
                                  }
                                  onChange={(e) =>
                                    updateService(
                                      service.id,
                                      'otHours',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  placeholder="0"
                                  className="pr-12"
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tracking-wide text-muted-foreground">
                                  hours
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {shouldShowManualCostInputs && (
                          <div className="space-y-2">
                            <Label htmlFor={`service-manual-cost-${index}`}>Cost</Label>
                            <Input
                              id={`service-manual-cost-${index}`}
                              type="text"
                              inputMode="decimal"
                              value={getManualCostInputValue(service, focusedCostId === service.id)}
                              onChange={(e) =>
                                updateService(service.id, 'manualCost', e.target.value)
                              }
                              onFocus={() => setFocusedCostId(service.id)}
                              onBlur={() => {
                                setFocusedCostId(null);
                                updateService(
                                  service.id,
                                  'manualCost',
                                  service.manualCostInput ?? ''
                                );
                              }}
                              placeholder="$0.00"
                              className={cn(
                                isDeleted
                                  ? getDeletedFieldClasses(isDeleted)
                                  : getChangedFieldClasses(`/services/${index}/manualCost`, ['services', index, 'manualCost'])
                              )}
                              style={isDeleted ? getDeletedFieldStyles(isDeleted) : getChangedFieldStyles(`/services/${index}/manualCost`, ['services', index, 'manualCost'])}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor={`service-description-${index}`} className="!text-black font-medium">Description *</Label>
                          <Input
                            id={`service-description-${index}`}
                            value={service.description}
                            onChange={(e) => updateService(service.id, 'description', e.target.value)}
                            placeholder="e.g. Engine Repair, oil change, hull cleaning"
                            className={cn(
                              isDeleted
                                ? getDeletedFieldClasses(isDeleted)
                                : getChangedFieldClasses(`/services/${index}/description`, ['services', index, 'description'])
                            )}
                            style={isDeleted ? getDeletedFieldStyles(isDeleted) : getChangedFieldStyles(`/services/${index}/description`, ['services', index, 'description'])}
                          />
                        </div>

                        {!shouldHideTaxAndMarkup && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`service-tax-status-${index}`} className="!text-black font-medium">Tax Status</Label>
                                {service.jobType === 'Clearance Fee' ? (
                                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                                    Non-Taxable (Fixed)
                                  </div>
                                ) : (
                                  <Select
                                    value={service.taxStatus || ''}
                                    onValueChange={(value) => updateService(service.id, 'taxStatus', value)}
                                  >
                                    <SelectTrigger
                                      id={`service-tax-status-${index}`}
                                      className={cn(
                                        isDeleted
                                          ? getDeletedFieldClasses(isDeleted)
                                          : getChangedFieldClasses(`/services/${index}/taxStatus`, ['services', index, 'taxStatus'])
                                      )}
                                      style={isDeleted ? getDeletedFieldStyles(isDeleted) : undefined}
                                    >
                                      <SelectValue placeholder="Non-Taxable">
                                        {service.taxStatus === 'taxable' && 'Taxable (8.75%)'}
                                        {(service.taxStatus === 'non-taxable' || service.taxStatus === 'exempt') && 'Non-Taxable'}
                                        {!service.taxStatus && 'Non-Taxable'}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="taxable">Taxable (8.75%)</SelectItem>
                                      <SelectItem value="non-taxable">Non-Taxable</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`service-markup-${index}`} className="!text-black font-medium">Markup</Label>
                                {service.jobType === 'Clearance Fee' ? (
                                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                                    No Markup (Fixed)
                                  </div>
                                ) : (
                                  <Select
                                    value={service.markupType || ''}
                                    onValueChange={(value) => updateService(service.id, 'markupType', value)}
                                    disabled={service.isMarkupExempt}
                                  >
                                    <SelectTrigger
                                      id={`service-markup-${index}`}
                                      className={cn(
                                        isDeleted
                                          ? getDeletedFieldClasses(isDeleted)
                                          : getChangedFieldClasses(`/services/${index}/markupType`, ['services', index, 'markupType'])
                                      )}
                                      style={isDeleted ? getDeletedFieldStyles(isDeleted) : undefined}
                                    >
                                      <SelectValue placeholder="No Markup">
                                        {service.markupType === 'preset-2.5' && '2.5%'}
                                        {service.markupType === 'preset-12.5' && '12.5%'}
                                        {service.markupType === 'custom' && 'Custom Markup'}
                                        {service.markupType === 'exempt' && 'No Markup'}
                                        {!service.markupType && 'No Markup'}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="preset-2.5">2.5%</SelectItem>
                                      <SelectItem value="preset-12.5">12.5%</SelectItem>
                                      <SelectItem value="custom">Custom Markup</SelectItem>
                                      <SelectItem value="exempt">No Markup</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>

                            {service.markupType === 'custom' &&
                              !service.isMarkupExempt &&
                              service.jobType !== 'Clearance Fee' && (
                                <div className="space-y-2">
                                  <Label htmlFor={`service-markup-rate-${index}`} className="!text-black font-medium">Custom Markup</Label>
                                  <div className="relative">
                                    <Input
                                      id={`service-markup-rate-${index}`}
                                      type="text"
                                      inputMode="decimal"
                                      value={service.markupRate ? `${service.markupRate}%` : ''}
                                      onChange={(e) => {
                                        const value = e.target.value.replace('%', '');
                                        updateService(
                                          service.id,
                                          'markupRate',
                                          parseFloat(value) || 0
                                        );
                                      }}
                                      placeholder="e.g. 15%"
                                    />
                                  </div>
                                </div>
                              )}
                          </>
                        )}

                        <div className="border-t pt-2">
                          <div className="flex justify-between items-center text-sm font-medium">
                            <span>Line Total:</span>
                            <span className="text-lg">{formatCurrency(service.total)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {service.isMarkupExempt && (
                              <Badge variant="secondary" className="text-xs">
                                No Markup
                              </Badge>
                            )}
                            {service.isTaxExempt && (
                              <Badge variant="secondary" className="text-xs">
                                Tax Exempt
                              </Badge>
                            )}
                            {service.jobType === 'Clearance Fee' && (() => {
                              const weight = parseFloat(invoiceData.vessel.weight) || 0;
                              const autoCalculatedAmount = weight >= 500 ? 1250 : 950;
                              const currentCost = parseFloat(String(service.manualCost)) || 0;
                              const isManuallyOverridden = currentCost !== autoCalculatedAmount;

                              return (
                                <Badge variant={isManuallyOverridden ? "secondary" : "outline"} className="text-xs">
                                  {isManuallyOverridden ? 'Manually Overridden' : 'Auto-calculated'}
                                </Badge>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <Button onClick={addService} variant="outline" className="w-full">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
                    </svg>
                    Add Service
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-base">Comments & Preview</CardTitle>
                  <CardDescription>
                    Highlight the invoice preview to leave contextual comments for collaborators.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-0">
                  <div className="relative">
                    {renderCommentsPanel(
                      'hidden lg:flex lg:flex-col lg:gap-4 lg:absolute lg:left-0 lg:top-0 lg:-translate-x-[calc(100%+1.5rem)] lg:w-72 lg:max-h-[70vh] lg:overflow-y-auto lg:rounded-lg lg:border lg:bg-white lg:p-4 lg:shadow-sm'
                    )}
                    <div className="flex flex-col gap-6">
                      <div
                        ref={previewRef}
                        onMouseUp={handlePreviewMouseUp}
                        className="relative max-h-[70vh] overflow-auto rounded-lg border bg-white p-6 shadow-sm"
                      >
                        <div className="space-y-6 text-sm text-slate-700">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                              {invoiceData.metadata.title?.trim() ||
                                (invoiceData.vessel.name
                                  ? `Invoice for ${invoiceData.vessel.name}`
                                  : 'Invoice Request')}
                            </h2>
                            <p className="text-xs text-muted-foreground">Draft preview • {new Date().toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vessel</h3>
                            <p className={cn("font-medium", isFieldInBackendDiff('/vesselName') ? 'text-green-600 font-semibold' : 'text-slate-800')}>
                              {invoiceData.vessel.name || 'Not specified'}
                            </p>
                            <p className={cn("text-xs", isFieldInBackendDiff('/vesselWeight') ? 'text-green-600 font-semibold' : 'text-muted-foreground')}>
                              Weight: {invoiceData.vessel.weight ? `${formatNumberWithSeparators(invoiceData.vessel.weight)} tons` : '—'}
                            </p>
                            <p className={cn("text-xs", isFieldInBackendDiff('/vesselBeam') ? 'text-green-600 font-semibold' : 'text-muted-foreground')}>
                              Length: {invoiceData.vessel.beam ? `${formatNumberWithSeparators(invoiceData.vessel.beam)} ft` : '—'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
                            <p className={cn("font-medium", isFieldInBackendDiff('/customerName') ? 'text-green-600 font-semibold' : 'text-slate-800')}>
                              {invoiceData.customer.customerName || invoiceData.customer.contactName || 'Not assigned'}
                            </p>
                            <p className={cn("text-xs", isFieldInBackendDiff('/customerEmail') ? 'text-green-600 font-semibold' : 'text-muted-foreground')}>
                              {invoiceData.customer.customerEmail || '—'}
                            </p>
                            <p className={cn("text-xs", isFieldInBackendDiff('/customerPhone') ? 'text-green-600 font-semibold' : 'text-muted-foreground')}>
                              {invoiceData.customer.customerPhone || '—'}
                            </p>
                            <p className={cn("text-xs", isFieldInBackendDiff('/customerAddress') ? 'text-green-600 font-semibold' : 'text-muted-foreground')}>
                              {invoiceData.customer.customerAddress || '—'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-slate-800">Services</h3>
                          {previewSummary.services.length === 0 ? (
                            <div className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-muted-foreground">
                              No services added yet.
                            </div>
                          ) : (
                            <>
                              {/* Mobile: Card Layout */}
                              <div className="space-y-3 md:hidden">
                                {previewSummary.services.map((service, index) => (
                                  <div key={service.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                    <div>
                                      <p className={cn("font-medium text-sm", isFieldInBackendDiff(`/services/${index}/description`) ? 'text-green-600 font-semibold' : 'text-slate-800')}>{service.description}</p>
                                      <p className={cn("text-xs text-muted-foreground", isFieldInBackendDiff(`/services/${index}/jobType`) && 'text-green-600 font-semibold')}>{service.jobType}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-slate-500">Type:</span>
                                        <span className={cn("ml-1 text-slate-700", isFieldInBackendDiff(`/services/${index}/itemType`) && 'text-green-600 font-semibold')}>{service.itemType}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Qty:</span>
                                        <span className={cn("ml-1 text-slate-700", isFieldInBackendDiff(`/services/${index}/quantity`) && 'text-green-600 font-semibold')}>{service.quantity}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Cost:</span>
                                        <span className={cn("ml-1 text-slate-700", isFieldInBackendDiff(`/services/${index}/manualCost`) && 'text-green-600 font-semibold')}>{formatCurrency(service.baseCost)}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Markup:</span>
                                        <span className={cn("ml-1 text-slate-700", isFieldInBackendDiff(`/services/${index}/markupType`) && 'text-green-600 font-semibold')}>{formatCurrency(service.markupAmount)}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Tax:</span>
                                        <span className={cn("ml-1 text-slate-700", isFieldInBackendDiff(`/services/${index}/taxStatus`) && 'text-green-600 font-semibold')}>{formatCurrency(service.taxAmount)}</span>
                                      </div>
                                      <div className="font-medium">
                                        <span className="text-slate-500">Total:</span>
                                        <span className="ml-1 text-slate-900">{formatCurrency(service.total)}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Desktop: Table Layout */}
                              <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200">
                                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                  <span>Item</span>
                                  <span className="text-right">Type</span>
                                  <span className="text-right">Qty</span>
                                  <span className="text-right">Cost</span>
                                  <span className="text-right">Markup</span>
                                  <span className="text-right">Tax</span>
                                  <span className="text-right">Total</span>
                                </div>
                                {previewSummary.services.map((service, index) => (
                                  <div key={service.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center border-t px-4 py-3 text-sm">
                                    <div>
                                      <p className={cn("font-medium", isFieldInBackendDiff(`/services/${index}/description`) ? 'text-green-600 font-semibold' : 'text-slate-800')}>{service.description}</p>
                                      <p className={cn("text-xs text-muted-foreground", isFieldInBackendDiff(`/services/${index}/jobType`) && 'text-green-600 font-semibold')}>{service.jobType}</p>
                                    </div>
                                    <div className={cn("text-right text-slate-700", isFieldInBackendDiff(`/services/${index}/itemType`) && 'text-green-600 font-semibold')}>{service.itemType}</div>
                                    <div className={cn("text-right text-slate-700", isFieldInBackendDiff(`/services/${index}/quantity`) && 'text-green-600 font-semibold')}>{service.quantity}</div>
                                    <div className={cn("text-right text-slate-700", isFieldInBackendDiff(`/services/${index}/manualCost`) && 'text-green-600 font-semibold')}>{formatCurrency(service.baseCost)}</div>
                                    <div className={cn("text-right text-slate-700", isFieldInBackendDiff(`/services/${index}/markupType`) && 'text-green-600 font-semibold')}>{formatCurrency(service.markupAmount)}</div>
                                    <div className={cn("text-right text-slate-700", isFieldInBackendDiff(`/services/${index}/taxStatus`) && 'text-green-600 font-semibold')}>{formatCurrency(service.taxAmount)}</div>
                                    <div className="text-right font-medium text-slate-900">{formatCurrency(service.total)}</div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                          <div className="flex justify-between">
                            <span>Base Cost</span>
                            <span className="font-medium text-slate-900">{formatCurrency(previewSummary.baseCostTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Subtotal (with markup)</span>
                            <span className="font-medium text-slate-900">{formatCurrency(previewSummary.subtotalWithMarkup)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax</span>
                            <span className="font-medium text-slate-900">{formatCurrency(previewSummary.totalTax)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 text-sm font-semibold text-slate-900">
                            <span>Total</span>
                            <span>{formatCurrency(previewSummary.finalTotal)}</span>
                          </div>
                          <div className="flex justify-between pt-2">
                            <span>Gross Profit</span>
                            <span className="font-medium text-slate-900">{formatCurrency(previewSummary.grossProfit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Gross Profit %</span>
                            <span className="font-medium text-slate-900">{previewSummary.grossProfitPercent.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="pointer-events-none absolute inset-0 z-10">
                        {comments.map((comment, index) => {
                          // Skip rendering highlight if highlight data is missing or invalid
                          if (!comment.highlight || typeof comment.highlight.top !== 'number' || typeof comment.highlight.left !== 'number') {
                            return null;
                          }

                          const width = Math.max(comment.highlight.width || 36, 36);
                          const height = Math.max(comment.highlight.height || 30, 30);
                          return (
                            <React.Fragment key={comment.id}>
                              <div
                                className="absolute rounded-md border border-blue-500 bg-blue-500/15"
                                style={{
                                  top: comment.highlight.top,
                                  left: comment.highlight.left,
                                  width,
                                  height,
                                }}
                              />
                              <div
                                className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-500 text-[11px] font-semibold text-white shadow"
                                style={{
                                  top: comment.highlight.top,
                                  left: comment.highlight.left,
                                }}
                              >
                                {index + 1}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {pendingSelection && selectionCardPosition && (
                        <div
                          ref={selectionCardRef}
                          className="absolute z-30 w-72 max-w-[320px] md:w-80"
                          style={{
                            top: selectionCardPosition.top,
                            left: selectionCardPosition.left,
                          }}
                        >
                          <Card className="shadow-xl">
                            <CardContent className="space-y-3 pt-4">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>{getInitials(currentUser?.name || currentUser?.email)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {currentUser?.name || currentUser?.email || 'You'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Commenting on “{pendingSelection.text.slice(0, 40)}{pendingSelection.text.length > 40 ? '…' : ''}”
                                  </p>
                                </div>
                              </div>
                              <Textarea
                                rows={3}
                                value={pendingCommentText}
                                onChange={(e) => setPendingCommentText(e.target.value)}
                                placeholder="Add a comment or mention others with @"
                              />
                              <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" size="sm" onClick={handleCancelSelection}>
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleCreateComment}
                                  disabled={pendingCommentText.trim().length === 0}
                                >
                                  Comment
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                      </div>
                      {renderCommentsPanel('flex flex-col gap-4 lg:hidden')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary Sidebar */}
          {activeTab !== 'notes' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>

            {isEditMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Attach Invoice</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Show read-only original attachment when re-approving */}
                  {statusChangedToChangeRequested && attachedFile ? (
                    <div className="space-y-2">
                      <Label>Original Invoice</Label>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {attachmentData ? (
                            <button
                              onClick={() => handleViewAttachment(attachmentData)}
                              className="text-sm truncate text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                            >
                              {attachedFile.name}
                            </button>
                          ) : (
                            <span className="text-sm truncate">{attachedFile.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {attachmentData && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewAttachment(attachmentData)}
                              className="flex-shrink-0"
                              title="View attachment"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Original approved invoice (read-only)
                      </p>
                    </div>
                  ) : (
                    /* Show file input for new uploads */
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-attachment">Upload File</Label>
                        <Input
                          id="invoice-attachment"
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileAttachment}
                          disabled={isUploadingFile}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground">
                          Accepted formats: PDF, PNG, JPEG (max 10MB)
                        </p>
                      </div>

                      {attachedFile && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {attachmentData ? (
                              <button
                                onClick={() => handleViewAttachment(attachmentData)}
                                className="text-sm truncate text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                              >
                                {attachedFile.name}
                              </button>
                            ) : (
                              <span className="text-sm truncate">{attachedFile.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {attachmentData && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewAttachment(attachmentData)}
                                className="flex-shrink-0"
                                title="View attachment"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveAttachment}
                              className="flex-shrink-0"
                              title="Remove attachment"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {statusChangedToChangeRequested && attachedFile && (
                    <div className="space-y-2 pt-4 border-t">
                      <Label htmlFor="second-invoice-attachment">Updated Invoice</Label>
                      <Input
                        id="second-invoice-attachment"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleSecondFileAttachment}
                        disabled={isUploadingFile}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload revised invoice (PDF, PNG, JPEG - max 10MB)
                      </p>

                      {secondAttachedFile && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {secondAttachmentData ? (
                              <button
                                onClick={() => handleViewAttachment(secondAttachmentData)}
                                className="text-sm truncate text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                              >
                                {secondAttachedFile.name}
                              </button>
                            ) : (
                              <span className="text-sm truncate">{secondAttachedFile.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {secondAttachmentData && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewAttachment(secondAttachmentData)}
                                className="flex-shrink-0"
                                title="View attachment"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveSecondAttachment}
                              className="flex-shrink-0"
                              title="Remove attachment"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button onClick={handlePrint} variant="outline" className="text-xs h-8">Print</Button>
                <Button onClick={handleExportPDF} variant="outline" className="text-xs h-8">Export PDF</Button>
                <Button onClick={handleEmail} variant="outline" className="text-xs h-8">Email</Button>
                <Button onClick={handleExportCSV} variant="outline" className="text-xs h-8">Export CSV</Button>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </div>

      {showEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Send Invoice Email</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-recipient">Recipient</Label>
                <Input
                  id="email-recipient"
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-message">Message</Label>
                <Textarea
                  id="email-message"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={isEmailSending}>
                {isEmailSending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateInvoice;
