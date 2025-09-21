import React from 'react';
import { InvoiceProvider, useInvoiceState, useInvoiceActions } from '../context/InvoiceContext.jsx';

/**
 * Simplified root provider component that wraps the entire invoice application
 * Provides pure React Context without legacy compatibility
 */
export function InvoiceAppProvider({ children }) {
  return (
    <InvoiceProvider>
      {children}
    </InvoiceProvider>
  );
}

/**
 * Higher-order component to wrap legacy components with React Context access
 */
export function withInvoiceContext(WrappedComponent) {
  return function InvoiceContextWrapper(props) {
    const state = useInvoiceState();
    const actions = useInvoiceActions();

    return (
      <WrappedComponent
        {...props}
        invoiceState={state}
        invoiceActions={actions}
      />
    );
  };
}

export default InvoiceAppProvider;