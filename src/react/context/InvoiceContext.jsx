/**
 * InvoiceContext - React Context for invoice state management
 * Replaces vanilla InvoiceState.js with React patterns
 */
import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { TaxCalculator } from '../../utils/pure/taxCalculator.js';

const InvoiceContext = createContext();

// Action types
const ACTIONS = {
  SET_VESSEL: 'SET_VESSEL',
  SET_CUSTOMER: 'SET_CUSTOMER',
  SET_SCOPE: 'SET_SCOPE',
  SET_NOTES: 'SET_NOTES',
  ADD_LINE_ITEM: 'ADD_LINE_ITEM',
  UPDATE_LINE_ITEM: 'UPDATE_LINE_ITEM',
  REMOVE_LINE_ITEM: 'REMOVE_LINE_ITEM',
  SET_FULL_STATE: 'SET_FULL_STATE',
  SET_INVOICE_ID: 'SET_INVOICE_ID',
  SET_EDIT_MODE: 'SET_EDIT_MODE',
  RESET_STATE: 'RESET_STATE'
};

// Initial state
const initialState = {
  vessel: {
    name: '',
    weight: '',
    beam: ''
  },
  customer: {
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  },
  scope: {
    markupRate: '2.5',
    isTaxable: false,
    lineItems: []
  },
  // Compatibility layer for legacy code
  services: {
    lineItems: []
  },
  notes: {
    comments: []
  },
  // Metadata
  currentInvoiceId: null,
  isEditMode: false
};

// Reducer function
const invoiceReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_VESSEL:
      return {
        ...state,
        vessel: { ...state.vessel, ...action.payload }
      };

    case ACTIONS.SET_CUSTOMER:
      return {
        ...state,
        customer: { ...state.customer, ...action.payload }
      };

    case ACTIONS.SET_SCOPE:
      const newScope = { ...state.scope, ...action.payload };
      return {
        ...state,
        scope: newScope,
        // Update compatibility layer
        services: { lineItems: newScope.lineItems }
      };

    case ACTIONS.SET_NOTES:
      return {
        ...state,
        notes: { ...state.notes, ...action.payload }
      };

    case ACTIONS.ADD_LINE_ITEM:
      const newLineItems = [...state.scope.lineItems, action.payload];
      return {
        ...state,
        scope: {
          ...state.scope,
          lineItems: newLineItems
        },
        services: { lineItems: newLineItems }
      };

    case ACTIONS.UPDATE_LINE_ITEM:
      const updatedLineItems = state.scope.lineItems.map(item =>
        item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
      );
      return {
        ...state,
        scope: {
          ...state.scope,
          lineItems: updatedLineItems
        },
        services: { lineItems: updatedLineItems }
      };

    case ACTIONS.REMOVE_LINE_ITEM:
      const filteredLineItems = state.scope.lineItems.filter(item => item.id !== action.payload);
      return {
        ...state,
        scope: {
          ...state.scope,
          lineItems: filteredLineItems
        },
        services: { lineItems: filteredLineItems }
      };

    case ACTIONS.SET_FULL_STATE:
      const newState = { ...initialState, ...action.payload };
      // Ensure compatibility layer is updated
      if (newState.scope?.lineItems) {
        newState.services = { lineItems: newState.scope.lineItems };
      }
      return newState;

    case ACTIONS.SET_INVOICE_ID:
      return {
        ...state,
        currentInvoiceId: action.payload
      };

    case ACTIONS.SET_EDIT_MODE:
      return {
        ...state,
        isEditMode: action.payload
      };

    case ACTIONS.RESET_STATE:
      return {
        ...initialState,
        currentInvoiceId: null,
        isEditMode: false
      };

    default:
      return state;
  }
};

export const InvoiceProvider = ({ children }) => {
  const [state, dispatch] = useReducer(invoiceReducer, initialState);
  const listenersRef = useRef([]);
  const lineItemIdCounterRef = useRef(0);

  // Notify listeners when state changes
  useEffect(() => {
    listenersRef.current.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in invoice state listener:', error);
      }
    });
  }, [state]);

  // Action creators
  const setVessel = useCallback((vesselData) => {
    dispatch({ type: ACTIONS.SET_VESSEL, payload: vesselData });
  }, []);

  const setCustomer = useCallback((customerData) => {
    dispatch({ type: ACTIONS.SET_CUSTOMER, payload: customerData });
  }, []);

  const setScope = useCallback((scopeData) => {
    dispatch({ type: ACTIONS.SET_SCOPE, payload: scopeData });
  }, []);

  const setNotes = useCallback((notesData) => {
    dispatch({ type: ACTIONS.SET_NOTES, payload: notesData });
  }, []);

  const addLineItem = useCallback((item) => {
    const newItem = {
      id: ++lineItemIdCounterRef.current,
      description: '',
      amount: 0,
      tax: false,
      ...item
    };
    dispatch({ type: ACTIONS.ADD_LINE_ITEM, payload: newItem });
    return newItem;
  }, []);

  const updateLineItem = useCallback((id, updates) => {
    dispatch({ type: ACTIONS.UPDATE_LINE_ITEM, payload: { id, updates } });
  }, []);

  const removeLineItem = useCallback((id) => {
    dispatch({ type: ACTIONS.REMOVE_LINE_ITEM, payload: id });
  }, []);

  const setState = useCallback((newState) => {
    dispatch({ type: ACTIONS.SET_FULL_STATE, payload: newState });
  }, []);

  const setCurrentInvoiceId = useCallback((id) => {
    dispatch({ type: ACTIONS.SET_INVOICE_ID, payload: id });
  }, []);

  const setEditMode = useCallback((isEditMode) => {
    dispatch({ type: ACTIONS.SET_EDIT_MODE, payload: isEditMode });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_STATE });
    lineItemIdCounterRef.current = 0;
  }, []);

  // Legacy compatibility methods
  const getState = useCallback(() => state, [state]);

  const getCurrentInvoiceId = useCallback(() => state.currentInvoiceId, [state.currentInvoiceId]);

  const getIsEditMode = useCallback(() => state.isEditMode, [state.isEditMode]);

  const subscribe = useCallback((listener) => {
    if (typeof listener !== 'function') {
      console.warn('Invalid listener: must be a function');
      return () => {};
    }

    listenersRef.current.push(listener);

    // Immediately call with current state
    listener(state);

    // Return unsubscribe function
    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== listener);
    };
  }, [state]);

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const lineItems = state.scope.lineItems || [];
    const markupRate = parseFloat(state.scope.markupRate) || 0;
    const isTaxable = state.scope.isTaxable;

    let subtotal = 0;
    let taxAmount = 0;

    lineItems.forEach(item => {
      const amount = parseFloat(item.amount) || 0;
      subtotal += amount;

      if (item.tax && isTaxable) {
        taxAmount += TaxCalculator.calculateTax(amount);
      }
    });

    const markup = subtotal * (markupRate / 100);
    const total = subtotal + markup + taxAmount;

    return {
      subtotal,
      markup,
      taxAmount,
      total,
      markupRate
    };
  }, [state.scope.lineItems, state.scope.markupRate, state.scope.isTaxable]);

  // Validation
  const validateState = useCallback(() => {
    const errors = [];

    // Vessel validation
    if (!state.vessel.name?.trim()) {
      errors.push('Vessel name is required');
    }

    // Customer validation
    if (!state.customer.customerName?.trim()) {
      errors.push('Customer name is required');
    }

    // Line items validation
    if (!state.scope.lineItems || state.scope.lineItems.length === 0) {
      errors.push('At least one line item is required');
    }

    state.scope.lineItems?.forEach((item, index) => {
      if (!item.description?.trim()) {
        errors.push(`Line item ${index + 1}: Description is required`);
      }
      if (!item.amount || item.amount <= 0) {
        errors.push(`Line item ${index + 1}: Amount must be greater than 0`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [state]);

  const value = {
    // State
    state,
    vessel: state.vessel,
    customer: state.customer,
    scope: state.scope,
    services: state.services, // Compatibility
    notes: state.notes,
    currentInvoiceId: state.currentInvoiceId,
    isEditMode: state.isEditMode,

    // Actions
    setVessel,
    setCustomer,
    setScope,
    setNotes,
    addLineItem,
    updateLineItem,
    removeLineItem,
    setState,
    setCurrentInvoiceId,
    setEditMode,
    resetState,

    // Legacy compatibility
    getState,
    getCurrentInvoiceId,
    getIsEditMode,
    subscribe,

    // Utilities
    calculateTotals,
    validateState
  };

  return (
    <InvoiceContext.Provider value={value}>
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoice = () => {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoice must be used within an InvoiceProvider');
  }
  return context;
};

export default InvoiceContext;