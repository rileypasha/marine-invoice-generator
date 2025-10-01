import React, { createContext, useContext, ReactNode } from 'react';
import { useInvoiceDiff, UseInvoiceDiffOptions, UseInvoiceDiffReturn } from '../hooks/useInvoiceDiff';

/**
 * Diff context for invoice change tracking
 *
 * Provides centralized state management for:
 * - Active diffs for change-requested invoices
 * - Version history with pagination
 * - Version creation and approval workflows
 * - Configurable diff rendering options
 */
const DiffContext = createContext<UseInvoiceDiffReturn | undefined>(undefined);

/**
 * Provider props
 */
export interface DiffProviderProps {
  children: ReactNode;
  invoiceId?: string;
  options?: UseInvoiceDiffOptions;
}

/**
 * DiffProvider component
 *
 * Wraps invoice pages to provide diff state and actions.
 * Uses the useInvoiceDiff hook internally for state management.
 *
 * @example
 * ```tsx
 * <DiffProvider invoiceId={invoiceId} options={{ autoFetch: true }}>
 *   <InvoiceForm />
 *   <ChangesSummary />
 * </DiffProvider>
 * ```
 */
export function DiffProvider({ children, invoiceId, options }: DiffProviderProps) {
  const diffState = useInvoiceDiff(invoiceId, options);

  return <DiffContext.Provider value={diffState}>{children}</DiffContext.Provider>;
}

/**
 * Hook to access diff context
 *
 * Must be used within a DiffProvider component.
 *
 * @throws Error if used outside DiffProvider
 * @returns Diff state and actions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { activeDiff, fetchActiveDiff } = useDiffContext();
 *
 *   useEffect(() => {
 *     fetchActiveDiff(invoiceId);
 *   }, [invoiceId]);
 *
 *   if (activeDiff) {
 *     return <DiffRenderer diff={activeDiff} />;
 *   }
 *
 *   return null;
 * }
 * ```
 */
export function useDiffContext(): UseInvoiceDiffReturn {
  const context = useContext(DiffContext);

  if (context === undefined) {
    throw new Error('useDiffContext must be used within a DiffProvider');
  }

  return context;
}

/**
 * Optional: Hook to safely access diff context
 *
 * Returns undefined if used outside DiffProvider instead of throwing.
 * Useful for components that can work with or without diff context.
 *
 * @returns Diff context or undefined
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const diffContext = useDiffContextOptional();
 *
 *   // Only show diff UI if context is available
 *   if (diffContext?.activeDiff) {
 *     return <DiffRenderer diff={diffContext.activeDiff} />;
 *   }
 *
 *   return <RegularView />;
 * }
 * ```
 */
export function useDiffContextOptional(): UseInvoiceDiffReturn | undefined {
  return useContext(DiffContext);
}