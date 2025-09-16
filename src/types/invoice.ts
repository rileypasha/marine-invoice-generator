/**
 * Invoice TypeScript definitions for frontend
 * These types correspond to the backend domain model
 */

export enum InvoiceState {
  SAVED = 'SAVED',
  MODIFIED = 'MODIFIED',
  FINALIZED = 'FINALIZED'
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  laborHours?: number;
  overtimeHours?: number;
}

export interface VesselData {
  name?: string;
  weight?: number;
  beam?: number;
  length?: number;
  type?: string;
}

export interface CustomerData {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface ScopeData {
  lineItems: LineItem[];
  markupRate: number;
  isTaxable: boolean;
  description?: string;
  notes?: string;
}

export interface InvoiceData {
  vessel?: VesselData;
  customer?: CustomerData;
  scope?: ScopeData;
  laborRate?: number;
  otRate?: number;
  terms?: string;
  notes?: string;
}

export interface InvoiceMetadata {
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  estimatedCompletion?: string;
  clonedFrom?: string;
  [key: string]: any;
}

export interface Invoice {
  id: string;
  title: string;
  data: InvoiceData;
  metadata: InvoiceMetadata;
  state: InvoiceState;
  version: number;

  // User association
  userId: string;
  userName: string;
  userEmail: string;

  // Denormalized fields for performance
  vesselName?: string;
  vesselWeight?: number;
  vesselBeam?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Calculated fields
  subtotal: number;
  taxAmount: number;
  total: number;
  grossProfit: number;
  profitPercent: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  finalizedAt?: string;
}

export interface CreateInvoiceRequest {
  title?: string;
  data?: InvoiceData;
  metadata?: InvoiceMetadata;
}

export interface UpdateInvoiceRequest {
  title?: string;
  data?: InvoiceData;
  metadata?: InvoiceMetadata;
}

export interface SmartSaveRequest extends CreateInvoiceRequest {
  id?: string; // If provided, updates existing; if not, creates new
}

export interface InvoiceListResponse {
  success: boolean;
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
  summary: {
    [key in InvoiceState]: number;
  };
}

export interface InvoiceResponse {
  success: boolean;
  invoice: Invoice;
  action?: 'CREATED' | 'UPDATED';
  requestId?: string;
}

export interface InvoiceError {
  message: string;
  code?: string;
  field?: string;
  details?: any;
}

export interface InvoiceApiError {
  success: false;
  error: InvoiceError;
  requestId?: string;
}

// Query and filter types
export interface InvoiceListQuery {
  page?: number;
  limit?: number;
  state?: InvoiceState;
  search?: string;
  orderBy?: 'createdAt' | 'updatedAt' | 'title' | 'total';
  orderDir?: 'asc' | 'desc';
}

// Dashboard summary types
export interface DashboardSummary {
  success: boolean;
  summary: {
    countByState: { [key in InvoiceState]: number };
    unsavedChanges: number;
    recentInvoices: Array<{
      id: string;
      title: string;
      createdAt: string;
    }>;
  };
}

// Hook return types
export interface UseInvoiceResult {
  invoice: Invoice | null;
  loading: boolean;
  error: string | null;
  save: () => Promise<void>;
  update: (data: Partial<InvoiceData>) => Promise<void>;
  clone: (newTitle?: string) => Promise<Invoice>;
  finalize: () => Promise<void>;
  canSave: boolean;
  canUpdate: boolean;
  canFinalize: boolean;
  hasUnsavedChanges: boolean;
}

export interface UseInvoiceListResult {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  summary: { [key in InvoiceState]: number } | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

// Context types
export interface InvoiceContextState {
  currentInvoice: Invoice | null;
  invoiceList: Invoice[];
  loading: boolean;
  error: string | null;
  summary: { [key in InvoiceState]: number } | null;
}

export interface InvoiceContextActions {
  // Invoice CRUD operations
  createInvoice: (data: CreateInvoiceRequest) => Promise<Invoice>;
  loadInvoice: (id: string) => Promise<Invoice>;
  saveInvoice: (invoice?: Invoice) => Promise<Invoice>;
  updateInvoice: (id: string, data: UpdateInvoiceRequest) => Promise<Invoice>;
  deleteInvoice: (id: string) => Promise<void>;
  cloneInvoice: (id: string, newTitle?: string) => Promise<Invoice>;
  finalizeInvoice: (id: string) => Promise<Invoice>;

  // Smart save (main UX improvement)
  smartSave: (data: SmartSaveRequest) => Promise<Invoice>;

  // List operations
  loadInvoiceList: (query?: InvoiceListQuery) => Promise<void>;
  refreshInvoiceList: () => Promise<void>;

  // State management
  setCurrentInvoice: (invoice: Invoice | null) => void;
  clearError: () => void;

  // Dashboard
  loadDashboardSummary: () => Promise<void>;
}

export interface InvoiceContextValue extends InvoiceContextState, InvoiceContextActions {}

// Form types for UI components
export interface InvoiceFormData {
  title: string;
  vessel: VesselData;
  customer: CustomerData;
  scope: ScopeData;
  laborRate: number;
  otRate: number;
  terms: string;
  notes: string;
}

export interface SaveButtonProps {
  invoice?: Invoice;
  onSave?: (invoice: Invoice) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

// Event types for invoice lifecycle
export interface InvoiceEvent {
  type: 'created' | 'updated' | 'saved' | 'finalized' | 'deleted' | 'cloned';
  invoice: Invoice;
  timestamp: string;
}

export type InvoiceEventHandler = (event: InvoiceEvent) => void;