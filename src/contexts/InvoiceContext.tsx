import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import {
  Invoice,
  InvoiceState,
  InvoiceContextValue,
  InvoiceContextState,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  SmartSaveRequest,
  InvoiceListQuery,
  InvoiceResponse,
  InvoiceListResponse,
  DashboardSummary,
  InvoiceEvent,
  InvoiceEventHandler
} from '../types/invoice';

// API configuration
const API_BASE = '/api/v3/invoices';

// Context state management with reducer
type InvoiceAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_INVOICE'; payload: Invoice | null }
  | { type: 'SET_INVOICE_LIST'; payload: Invoice[] }
  | { type: 'SET_SUMMARY'; payload: { [key in InvoiceState]: number } }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
  | { type: 'REMOVE_INVOICE'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialState: InvoiceContextState = {
  currentInvoice: null,
  invoiceList: [],
  loading: false,
  error: null,
  summary: null
};

function invoiceReducer(state: InvoiceContextState, action: InvoiceAction): InvoiceContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'SET_CURRENT_INVOICE':
      return { ...state, currentInvoice: action.payload };

    case 'SET_INVOICE_LIST':
      return { ...state, invoiceList: action.payload };

    case 'SET_SUMMARY':
      return { ...state, summary: action.payload };

    case 'ADD_INVOICE':
      return {
        ...state,
        invoiceList: [action.payload, ...state.invoiceList]
      };

    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoiceList: state.invoiceList.map(invoice =>
          invoice.id === action.payload.id ? action.payload : invoice
        ),
        currentInvoice: state.currentInvoice?.id === action.payload.id
          ? action.payload
          : state.currentInvoice
      };

    case 'REMOVE_INVOICE':
      return {
        ...state,
        invoiceList: state.invoiceList.filter(invoice => invoice.id !== action.payload),
        currentInvoice: state.currentInvoice?.id === action.payload ? null : state.currentInvoice
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// Context creation
const InvoiceContext = createContext<InvoiceContextValue | undefined>(undefined);

// Event handling for invoice lifecycle events
const invoiceEventHandlers: InvoiceEventHandler[] = [];

export function addInvoiceEventHandler(handler: InvoiceEventHandler) {
  invoiceEventHandlers.push(handler);
}

export function removeInvoiceEventHandler(handler: InvoiceEventHandler) {
  const index = invoiceEventHandlers.indexOf(handler);
  if (index > -1) {
    invoiceEventHandlers.splice(index, 1);
  }
}

function emitInvoiceEvent(event: InvoiceEvent) {
  invoiceEventHandlers.forEach(handler => {
    try {
      handler(event);
    } catch (error) {
      console.error('Error in invoice event handler:', error);
    }
  });
}

// Provider component
interface InvoiceProviderProps {
  children: ReactNode;
}

export function InvoiceProvider({ children }: InvoiceProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(invoiceReducer, initialState);

  // Error handling utility
  const handleError = useCallback((error: any, context: string) => {
    console.error(`Invoice ${context} error:`, error);
    const message = error.response?.data?.error?.message || error.message || `Failed to ${context}`;
    dispatch({ type: 'SET_ERROR', payload: message });
    throw new Error(message);
  }, []);

  // API utilities
  const apiRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include' // Include cookies for authentication
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }, []);

  // Smart Save - the main UX improvement
  const smartSave = useCallback(async (data: SmartSaveRequest): Promise<Invoice> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response: InvoiceResponse = await apiRequest(`${API_BASE}/smart-save`, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      const invoice = response.invoice;

      // Update state based on action taken
      if (response.action === 'CREATED') {
        dispatch({ type: 'ADD_INVOICE', payload: invoice });
        emitInvoiceEvent({
          type: 'created',
          invoice,
          timestamp: new Date().toISOString()
        });
      } else if (response.action === 'UPDATED') {
        dispatch({ type: 'UPDATE_INVOICE', payload: invoice });
        emitInvoiceEvent({
          type: 'updated',
          invoice,
          timestamp: new Date().toISOString()
        });
      }

      dispatch({ type: 'SET_CURRENT_INVOICE', payload: invoice });
      dispatch({ type: 'SET_LOADING', payload: false });

      return invoice;
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return handleError(error, 'smart save');
    }
  }, [apiRequest, handleError]);

  // Individual CRUD operations
  const createInvoice = useCallback(async (data: CreateInvoiceRequest): Promise<Invoice> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response: InvoiceResponse = await apiRequest(API_BASE, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      const invoice = response.invoice;
      dispatch({ type: 'ADD_INVOICE', payload: invoice });
      dispatch({ type: 'SET_CURRENT_INVOICE', payload: invoice });
      dispatch({ type: 'SET_LOADING', payload: false });

      emitInvoiceEvent({
        type: 'created',
        invoice,
        timestamp: new Date().toISOString()
      });

      return invoice;
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return handleError(error, 'create invoice');
    }
  }, [apiRequest, handleError]);

  const loadInvoice = useCallback(async (id: string): Promise<Invoice> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response: InvoiceResponse = await apiRequest(`${API_BASE}/${id}`);
      const invoice = response.invoice;

      dispatch({ type: 'SET_CURRENT_INVOICE', payload: invoice });
      dispatch({ type: 'SET_LOADING', payload: false });

      return invoice;
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return handleError(error, 'load invoice');
    }
  }, [apiRequest, handleError]);

  const saveInvoice = useCallback(async (invoice?: Invoice): Promise<Invoice> => {
    const targetInvoice = invoice || state.currentInvoice;

    if (!targetInvoice) {
      throw new Error('No invoice to save');
    }

    // Use smart save for current invoice workflow
    return smartSave({
      id: targetInvoice.id,
      title: targetInvoice.title,
      data: targetInvoice.data,
      metadata: targetInvoice.metadata
    });
  }, [state.currentInvoice, smartSave]);

  const updateInvoice = useCallback(async (id: string, data: UpdateInvoiceRequest): Promise<Invoice> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response: InvoiceResponse = await apiRequest(`${API_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });

      const invoice = response.invoice;
      dispatch({ type: 'UPDATE_INVOICE', payload: invoice });
      dispatch({ type: 'SET_LOADING', payload: false });

      emitInvoiceEvent({
        type: 'updated',
        invoice,
        timestamp: new Date().toISOString()
      });

      return invoice;
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return handleError(error, 'update invoice');
    }
  }, [apiRequest, handleError]);

  const deleteInvoice = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await apiRequest(`${API_BASE}/${id}`, {
        method: 'DELETE'
      });

      dispatch({ type: 'REMOVE_INVOICE', payload: id });
      dispatch({ type: 'SET_LOADING', payload: false });

      emitInvoiceEvent({
        type: 'deleted',
        invoice: state.invoiceList.find(inv => inv.id === id)!,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return handleError(error, 'delete invoice');
    }
  }, [apiRequest, handleError, state.invoiceList]);

  const cloneInvoice = useCallback(async (id: string, newTitle?: string): Promise<Invoice> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response: InvoiceResponse = await apiRequest(`${API_BASE}/${id}/clone`, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle })
      });

      const invoice = response.invoice;
      dispatch({ type: 'ADD_INVOICE', payload: invoice });
      dispatch({ type: 'SET_CURRENT_INVOICE', payload: invoice });
      dispatch({ type: 'SET_LOADING', payload: false });

      emitInvoiceEvent({
        type: 'cloned',
        invoice,
        timestamp: new Date().toISOString()
      });

      return invoice;
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return handleError(error, 'clone invoice');
    }
  }, [apiRequest, handleError]);

  const finalizeInvoice = useCallback(async (id: string): Promise<Invoice> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response: InvoiceResponse = await apiRequest(`${API_BASE}/${id}/finalize`, {
        method: 'POST'
      });

      const invoice = response.invoice;
      dispatch({ type: 'UPDATE_INVOICE', payload: invoice });
      dispatch({ type: 'SET_LOADING', payload: false });

      emitInvoiceEvent({
        type: 'finalized',
        invoice,
        timestamp: new Date().toISOString()
      });

      return invoice;
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return handleError(error, 'finalize invoice');
    }
  }, [apiRequest, handleError]);

  // List operations
  const loadInvoiceList = useCallback(async (query: InvoiceListQuery = {}): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const queryParams = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });

      const url = `${API_BASE}?${queryParams}`;
      const response: InvoiceListResponse = await apiRequest(url);

      dispatch({ type: 'SET_INVOICE_LIST', payload: response.invoices });
      dispatch({ type: 'SET_SUMMARY', payload: response.summary });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      handleError(error, 'load invoice list');
    }
  }, [apiRequest, handleError]);

  const refreshInvoiceList = useCallback(async (): Promise<void> => {
    return loadInvoiceList();
  }, [loadInvoiceList]);

  // Dashboard operations
  const loadDashboardSummary = useCallback(async (): Promise<void> => {
    try {
      const response: DashboardSummary = await apiRequest(`${API_BASE}/dashboard/summary`);
      dispatch({ type: 'SET_SUMMARY', payload: response.summary.countByState });
    } catch (error) {
      handleError(error, 'load dashboard summary');
    }
  }, [apiRequest, handleError]);

  // State management
  const setCurrentInvoice = useCallback((invoice: Invoice | null) => {
    dispatch({ type: 'SET_CURRENT_INVOICE', payload: invoice });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Context value
  const contextValue: InvoiceContextValue = {
    // State
    ...state,

    // Actions
    createInvoice,
    loadInvoice,
    saveInvoice,
    updateInvoice,
    deleteInvoice,
    cloneInvoice,
    finalizeInvoice,
    smartSave,
    loadInvoiceList,
    refreshInvoiceList,
    setCurrentInvoice,
    clearError,
    loadDashboardSummary
  };

  return (
    <InvoiceContext.Provider value={contextValue}>
      {children}
    </InvoiceContext.Provider>
  );
}

// Hook for using the context
export function useInvoice(): InvoiceContextValue {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoice must be used within an InvoiceProvider');
  }
  return context;
}

// Specialized hooks for specific use cases
export function useCurrentInvoice() {
  const { currentInvoice, loading, error, setCurrentInvoice } = useInvoice();
  return { currentInvoice, loading, error, setCurrentInvoice };
}

export function useInvoiceList() {
  const { invoiceList, loading, error, summary, loadInvoiceList, refreshInvoiceList } = useInvoice();
  return { invoiceList, loading, error, summary, loadInvoiceList, refreshInvoiceList };
}

export function useSmartSave() {
  const { smartSave, loading, error } = useInvoice();
  return { smartSave, loading, error };
}