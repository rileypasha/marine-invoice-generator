import { useState, useEffect, useRef } from 'react';
import { useInvoiceState, useInvoiceActions } from '../context/InvoiceContext.jsx';

/**
 * React hook to manage unsaved changes tracking and warning
 * Replaces the legacy UnsavedChangesManager with pure React state management
 */
export function useUnsavedChanges() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedState, setLastSavedState] = useState(null);
  const state = useInvoiceState();
  const actions = useInvoiceActions();
  const isInitialMount = useRef(true);

  // Track state changes to detect unsaved changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!state) return;

    // Compare current state with last saved state
    const currentStateString = JSON.stringify({
      vessel: state.vessel,
      customer: state.customer,
      scope: state.scope,
      services: state.services
    });

    const lastSavedString = JSON.stringify(lastSavedState);

    if (currentStateString !== lastSavedString) {
      setHasUnsavedChanges(true);
    }
  }, [state, lastSavedState]);

  // Mark changes as saved
  const markAsSaved = () => {
    if (state) {
      setLastSavedState({
        vessel: state.vessel,
        customer: state.customer,
        scope: state.scope,
        services: state.services
      });
      setHasUnsavedChanges(false);
    }
  };

  // Reset unsaved changes tracking
  const resetUnsavedChanges = () => {
    setHasUnsavedChanges(false);
    setLastSavedState(null);
  };

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    hasUnsavedChanges,
    markAsSaved,
    resetUnsavedChanges
  };
}

export default useUnsavedChanges;