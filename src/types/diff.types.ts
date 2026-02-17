/**
 * Diff Type Definitions for Invoice Change Tracking
 *
 * These types align with RFC-6902 JSON Patch standard and the
 * backend DiffService implementation.
 */

/**
 * RFC-6902 JSON Patch operation types
 */
export type DiffOperation = 'add' | 'remove' | 'replace';

/**
 * RFC-6902 JSON Patch operation
 * Matches the fast-json-patch Operation type
 */
export interface PatchOperation {
  op: DiffOperation;
  path: string;
  value?: unknown;
  oldValue?: unknown;
}

/**
 * Field-level change description
 * Matches the backend FieldChange interface
 */
export interface FieldChange {
  field: string;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  operation: DiffOperation;
}

/**
 * Change categorization by domain
 */
export interface DiffCategories {
  customer?: number;
  vessel?: number;
  items?: number;
  pricing?: number;
  metadata?: number;
}

/**
 * Human-readable diff summary
 * Matches the backend DiffSummary interface
 */
export interface DiffSummary {
  totalChanges: number;
  fields: FieldChange[];
  categories: DiffCategories;
}

/**
 * Invoice revision metadata
 */
export interface InvoiceRevision {
  id: string;
  invoiceId: string;
  revisionNumber: number;
  payloadJson: unknown;
  actorEmail: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  changeSummary?: string;
  patch?: PatchOperation[];
  summaryJson?: DiffSummary;
  changeCount: number;
}

/**
 * Invoice diff record
 */
export interface InvoiceDiff {
  id: string;
  invoiceId: string;
  fromRevisionId: string;
  toRevisionId: string;
  fromVersion: number;
  toVersion: number;
  patch: PatchOperation[];
  summary: DiffSummary;
  changeCount: number;
  createdAt: string;
  fromRevision?: InvoiceRevision;
  toRevision?: InvoiceRevision;
}

/**
 * Version history item for timeline display
 */
export interface VersionHistoryItem {
  revision: InvoiceRevision;
  diff: InvoiceDiff | null;
  previousRevision: InvoiceRevision | null;
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
  limit: number;
  offset: number;
  total: number;
}

/**
 * API response for version history
 */
export interface VersionHistoryResponse {
  history: VersionHistoryItem[];
  pagination: PaginationMetadata;
  correlationId: string;
}

/**
 * API response for active diff
 */
export interface ActiveDiffResponse {
  diff: InvoiceDiff | null;
  correlationId: string;
}

/**
 * API response for version creation
 */
export interface VersionCreateResponse {
  revision: InvoiceRevision;
  diff: InvoiceDiff | null;
  isNoOp: boolean;
  message: string;
  correlationId: string;
}

/**
 * Visual styling for diff rendering
 */
export interface DiffStyles {
  added: string; // CSS classes for added values
  removed: string; // CSS classes for removed values
  changed: string; // CSS classes for changed values
  unchanged: string; // CSS classes for unchanged values
}

/**
 * Diff rendering configuration
 */
export interface DiffRenderConfig {
  showLineNumbers?: boolean;
  showPaths?: boolean;
  enableCollapse?: boolean;
  highlightChanges?: boolean;
  styles?: Partial<DiffStyles>;
}

/**
 * Field metadata for smart diff rendering
 */
export interface FieldMetadata {
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array';
  formatter?: (value: unknown) => string;
  isNested?: boolean;
  nestedPath?: string;
}

/**
 * Field registry for diff rendering
 * Maps JSON paths to human-readable labels and metadata
 */
export type FieldRegistry = Record<string, FieldMetadata>;

/**
 * Default field registry for invoice diffs
 */
export const INVOICE_FIELD_REGISTRY: FieldRegistry = {
  '/invoiceNumber': {
    label: 'Invoice Number',
    type: 'string',
  },
  '/title': {
    label: 'Title',
    type: 'string',
  },
  '/status': {
    label: 'Status',
    type: 'string',
  },
  '/customerName': {
    label: 'Customer Name',
    type: 'string',
  },
  '/customerEmail': {
    label: 'Customer Email',
    type: 'string',
  },
  '/customerPhone': {
    label: 'Customer Phone',
    type: 'string',
  },
  '/vesselName': {
    label: 'Vessel Name',
    type: 'string',
  },
  '/vesselWeight': {
    label: 'Vessel Weight',
    type: 'number',
    formatter: (value) => `${value} tons`,
  },
  '/vesselBeam': {
    label: 'Vessel Beam',
    type: 'number',
    formatter: (value) => `${value} ft`,
  },
  '/subtotal': {
    label: 'Subtotal',
    type: 'number',
    formatter: (value) => `$${Number(value).toFixed(2)}`,
  },
  '/taxAmount': {
    label: 'Tax Amount',
    type: 'number',
    formatter: (value) => `$${Number(value).toFixed(2)}`,
  },
  '/total': {
    label: 'Total',
    type: 'number',
    formatter: (value) => `$${Number(value).toFixed(2)}`,
  },
  '/grossProfit': {
    label: 'Gross Profit',
    type: 'number',
    formatter: (value) => `$${Number(value).toFixed(2)}`,
  },
  '/profitPercent': {
    label: 'Profit %',
    type: 'number',
    formatter: (value) => `${Number(value).toFixed(1)}%`,
  },
  '/market': {
    label: 'Market',
    type: 'string',
  },
  '/notes': {
    label: 'Notes',
    type: 'string',
  },
  '/comments': {
    label: 'Comments',
    type: 'string',
  },
};

/**
 * Diff context state for provider
 */
export interface DiffContextState {
  activeDiff: InvoiceDiff | null;
  versionHistory: VersionHistoryItem[];
  isLoading: boolean;
  error: Error | null;
  renderConfig: DiffRenderConfig;
  fieldRegistry: FieldRegistry;
}

/**
 * Diff context actions
 */
export interface DiffContextActions {
  fetchActiveDiff: (invoiceId: string) => Promise<void>;
  fetchVersionHistory: (invoiceId: string, limit?: number, offset?: number) => Promise<void>;
  createVersion: (invoiceId: string, snapshot: unknown, changeSummary?: string) => Promise<VersionCreateResponse>;
  approveInvoice: (invoiceId: string, attachmentUrl?: string) => Promise<void>;
  updateRenderConfig: (config: Partial<DiffRenderConfig>) => void;
  registerFields: (fields: FieldRegistry) => void;
  clearDiff: () => void;
}

/**
 * Combined diff context (state + actions)
 */
export type DiffContext = DiffContextState & DiffContextActions;
