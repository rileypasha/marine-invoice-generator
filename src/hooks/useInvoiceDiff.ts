import { useState, useCallback, useEffect } from 'react';
import {
  InvoiceDiff,
  VersionHistoryItem,
  DiffRenderConfig,
  FieldRegistry,
  INVOICE_FIELD_REGISTRY,
  VersionCreateResponse,
  ActiveDiffResponse,
  VersionHistoryResponse,
} from '../types/diff.types';

/**
 * API client for invoice diff endpoints
 */
const API_BASE_URL = '/api/v1/invoice';

/**
 * Fetch wrapper with error handling
 */
async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook options
 */
export interface UseInvoiceDiffOptions {
  autoFetch?: boolean; // Auto-fetch active diff on mount
  initialRenderConfig?: Partial<DiffRenderConfig>;
  initialFieldRegistry?: FieldRegistry;
}

/**
 * Hook return value
 */
export interface UseInvoiceDiffReturn {
  // State
  activeDiff: InvoiceDiff | null;
  versionHistory: VersionHistoryItem[];
  isLoading: boolean;
  error: Error | null;
  renderConfig: DiffRenderConfig;
  fieldRegistry: FieldRegistry;

  // Actions
  fetchActiveDiff: (invoiceId: string) => Promise<void>;
  fetchVersionHistory: (invoiceId: string, limit?: number, offset?: number) => Promise<void>;
  createVersion: (invoiceId: string, snapshot: unknown, changeSummary?: string) => Promise<VersionCreateResponse>;
  approveInvoice: (invoiceId: string, attachmentUrl?: string) => Promise<void>;
  updateRenderConfig: (config: Partial<DiffRenderConfig>) => void;
  registerFields: (fields: FieldRegistry) => void;
  clearDiff: () => void;
  clearError: () => void;
}

/**
 * Custom hook for invoice diff management
 *
 * Provides:
 * - Active diff retrieval for change-requested invoices
 * - Version history fetching with pagination
 * - Version creation with automatic diff generation
 * - Invoice approval workflow
 * - Configurable diff rendering options
 * - Field registry management for human-readable labels
 *
 * @param invoiceId - Invoice ID to track (optional, can be provided later)
 * @param options - Hook configuration options
 * @returns Diff state and actions
 */
export function useInvoiceDiff(
  invoiceId?: string,
  options: UseInvoiceDiffOptions = {}
): UseInvoiceDiffReturn {
  const {
    autoFetch = false,
    initialRenderConfig = {},
    initialFieldRegistry = INVOICE_FIELD_REGISTRY,
  } = options;

  // State
  const [activeDiff, setActiveDiff] = useState<InvoiceDiff | null>(null);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [renderConfig, setRenderConfig] = useState<DiffRenderConfig>({
    showLineNumbers: false,
    showPaths: false,
    enableCollapse: true,
    highlightChanges: true,
    ...initialRenderConfig,
  });
  const [fieldRegistry, setFieldRegistry] = useState<FieldRegistry>(initialFieldRegistry);

  /**
   * Fetch active diff for change-requested invoice
   */
  const fetchActiveDiff = useCallback(async (invoiceIdParam: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchWithError<ActiveDiffResponse>(
        `${API_BASE_URL}/${invoiceIdParam}/diff`
      );

      setActiveDiff(data.diff);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch active diff');
      setError(error);
      console.error('Error fetching active diff:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch version history with pagination
   */
  const fetchVersionHistory = useCallback(
    async (invoiceIdParam: string, limit = 50, offset = 0) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchWithError<VersionHistoryResponse>(
          `${API_BASE_URL}/${invoiceIdParam}/history?limit=${limit}&offset=${offset}`
        );

        setVersionHistory(data.history);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch version history');
        setError(error);
        console.error('Error fetching version history:', error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Create new version with diff tracking
   */
  const createVersion = useCallback(
    async (
      invoiceIdParam: string,
      snapshot: unknown,
      changeSummary?: string
    ): Promise<VersionCreateResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const snapshotData =
          snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {};

        const data = await fetchWithError<VersionCreateResponse>(
          `${API_BASE_URL}/${invoiceIdParam}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...snapshotData,
              changeSummary,
            }),
          }
        );

        // Update active diff if new version was created
        if (!data.isNoOp && data.diff) {
          setActiveDiff(data.diff);
        }

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create version');
        setError(error);
        console.error('Error creating version:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Approve invoice and clear diffs
   */
  const approveInvoice = useCallback(async (invoiceIdParam: string, attachmentUrl?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await fetchWithError<{ message: string }>(
        `${API_BASE_URL}/${invoiceIdParam}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ attachmentUrl }),
        }
      );

      // Clear active diff on approval
      setActiveDiff(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve invoice');
      setError(error);
      console.error('Error approving invoice:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update render configuration
   */
  const updateRenderConfig = useCallback((config: Partial<DiffRenderConfig>) => {
    setRenderConfig((prev) => ({ ...prev, ...config }));
  }, []);

  /**
   * Register additional fields for diff rendering
   */
  const registerFields = useCallback((fields: FieldRegistry) => {
    setFieldRegistry((prev) => ({ ...prev, ...fields }));
  }, []);

  /**
   * Clear active diff
   */
  const clearDiff = useCallback(() => {
    setActiveDiff(null);
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Auto-fetch active diff on mount if enabled
   */
  useEffect(() => {
    if (autoFetch && invoiceId) {
      fetchActiveDiff(invoiceId);
    }
  }, [autoFetch, invoiceId, fetchActiveDiff]);

  return {
    // State
    activeDiff,
    versionHistory,
    isLoading,
    error,
    renderConfig,
    fieldRegistry,

    // Actions
    fetchActiveDiff,
    fetchVersionHistory,
    createVersion,
    approveInvoice,
    updateRenderConfig,
    registerFields,
    clearDiff,
    clearError,
  };
}

/**
 * Helper: Check if invoice has pending changes
 */
export function hasPendingChanges(diff: InvoiceDiff | null): boolean {
  return diff !== null && diff.changeCount > 0;
}

/**
 * Helper: Get human-readable field label
 */
export function getFieldLabel(path: string, registry: FieldRegistry): string {
  return registry[path]?.label || path.split('/').pop() || 'Unknown Field';
}

/**
 * Helper: Format field value for display
 */
export function formatFieldValue(
  path: string,
  value: unknown,
  registry: FieldRegistry
): string {
  const field = registry[path];

  if (field?.formatter) {
    return field.formatter(value);
  }

  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}
