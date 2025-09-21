/**
 * useUnsavedChanges - React hook for managing unsaved changes detection
 * Consolidates functionality from 3 vanilla UnsavedChangesManager versions
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export const useUnsavedChanges = (initialState = null) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [baselineState, setBaselineState] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const debounceTimerRef = useRef(null);
  const listenersRef = useRef([]);

  // Configuration
  const DEBOUNCE_DELAY = 300;
  const SESSION_KEY = 'marine_invoice_unsaved_changes';

  /**
   * Calculate hash for state comparison
   */
  const calculateStateHash = useCallback((state) => {
    if (!state) return '';

    try {
      const normalized = normalizeState(state);
      const str = JSON.stringify(normalized);

      let hash = 0;
      if (str.length === 0) return hash;

      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }

      return hash;
    } catch (error) {
      console.error('Error calculating state hash:', error);
      return '';
    }
  }, []);

  /**
   * Normalize state for consistent comparison
   */
  const normalizeState = useCallback((state) => {
    if (!state || typeof state !== 'object') return state;

    const canonical = {};
    const sortedKeys = Object.keys(state).sort();

    for (const key of sortedKeys) {
      const value = state[key];

      if (value === null || value === undefined) {
        canonical[key] = null;
      } else if (Array.isArray(value)) {
        canonical[key] = value.map(item => normalizeState(item));
      } else if (typeof value === 'object') {
        canonical[key] = normalizeState(value);
      } else if (typeof value === 'string') {
        canonical[key] = value.trim();
      } else if (typeof value === 'number') {
        canonical[key] = Math.round(value * 100) / 100;
      } else {
        canonical[key] = value;
      }
    }

    return canonical;
  }, []);

  /**
   * Detect changes between current and baseline state
   */
  const detectChanges = useCallback((currentState) => {
    if (!isInitialized || !baselineState) {
      return;
    }

    const currentHash = calculateStateHash(currentState);
    const baselineHash = calculateStateHash(baselineState);
    const hasChanges = currentHash !== baselineHash;

    if (hasChanges !== hasUnsavedChanges) {
      console.log(`🔄 Unsaved changes: ${hasChanges ? 'YES' : 'NO'}`);
      setHasUnsavedChanges(hasChanges);

      // Notify listeners
      const changeData = {
        hasUnsavedChanges: hasChanges,
        changesSummary: getChangesSummary(currentState)
      };

      listenersRef.current.forEach(listener => {
        try {
          listener(changeData);
        } catch (error) {
          console.error('Error in unsaved changes listener:', error);
        }
      });

      // Update page title
      updatePageTitle(hasChanges);

      // Persist to session storage
      persistUnsavedState(hasChanges, currentState);
    }
  }, [isInitialized, baselineState, hasUnsavedChanges, calculateStateHash]);

  /**
   * Get summary of what changed
   */
  const getChangesSummary = useCallback((currentState) => {
    if (!hasUnsavedChanges || !baselineState || !currentState) {
      return { hasChanges: false, changes: [] };
    }

    const changes = [];

    try {
      // Check vessel changes
      if (hasVesselChanges(currentState, baselineState)) {
        changes.push('Vessel details');
      }

      // Check customer changes
      if (hasCustomerChanges(currentState, baselineState)) {
        changes.push('Customer information');
      }

      // Check scope changes
      if (hasScopeChanges(currentState, baselineState)) {
        changes.push('Services and line items');
      }

      // Check notes changes
      if (hasNotesChanges(currentState, baselineState)) {
        changes.push('Notes and comments');
      }

      return { hasChanges: changes.length > 0, changes };
    } catch (error) {
      console.error('Error generating changes summary:', error);
      return { hasChanges: hasUnsavedChanges, changes: ['Unknown changes'] };
    }
  }, [hasUnsavedChanges, baselineState]);

  /**
   * Check for vessel changes
   */
  const hasVesselChanges = (current, saved) => {
    const currentVessel = current.vessel || {};
    const savedVessel = saved.vessel || {};

    return (
      currentVessel.name !== savedVessel.name ||
      currentVessel.vesselName !== savedVessel.vesselName ||
      currentVessel.type !== savedVessel.type ||
      currentVessel.length !== savedVessel.length ||
      currentVessel.location !== savedVessel.location
    );
  };

  /**
   * Check for customer changes
   */
  const hasCustomerChanges = (current, saved) => {
    const currentCustomer = current.customer || {};
    const savedCustomer = saved.customer || {};

    return (
      currentCustomer.customerName !== savedCustomer.customerName ||
      currentCustomer.email !== savedCustomer.email ||
      currentCustomer.phone !== savedCustomer.phone ||
      currentCustomer.address !== savedCustomer.address
    );
  };

  /**
   * Check for scope changes
   */
  const hasScopeChanges = (current, saved) => {
    const currentScope = current.scope || {};
    const savedScope = saved.scope || {};

    const currentItems = currentScope.lineItems || [];
    const savedItems = savedScope.lineItems || [];

    if (currentItems.length !== savedItems.length) return true;

    for (let i = 0; i < currentItems.length; i++) {
      const currentItem = currentItems[i];
      const savedItem = savedItems[i];

      if (
        currentItem.description !== savedItem.description ||
        currentItem.amount !== savedItem.amount ||
        currentItem.tax !== savedItem.tax
      ) {
        return true;
      }
    }

    return false;
  };

  /**
   * Check for notes changes
   */
  const hasNotesChanges = (current, saved) => {
    const currentNotes = current.notes || {};
    const savedNotes = saved.notes || {};

    return (
      currentNotes.workNotes !== savedNotes.workNotes ||
      currentNotes.internalNotes !== savedNotes.internalNotes
    );
  };

  /**
   * Update page title to show unsaved changes indicator
   */
  const updatePageTitle = useCallback((hasChanges) => {
    try {
      const baseTitle = 'Marine Group - Invoice Generator';
      document.title = hasChanges ? '● ' + baseTitle : baseTitle;
    } catch (error) {
      console.error('Error updating page title:', error);
    }
  }, []);

  /**
   * Persist unsaved state to session storage
   */
  const persistUnsavedState = useCallback((hasChanges, state) => {
    try {
      if (hasChanges) {
        const data = {
          hasChanges,
          state,
          timestamp: Date.now()
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      console.error('Error persisting unsaved state:', error);
    }
  }, []);

  /**
   * Check state with debouncing
   */
  const checkState = useCallback((currentState) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      detectChanges(currentState);
    }, DEBOUNCE_DELAY);
  }, [detectChanges]);

  /**
   * Establish baseline state (mark as saved)
   */
  const establishBaseline = useCallback((state) => {
    console.log('🔧 Establishing baseline state');

    const normalizedState = normalizeState(state);
    setBaselineState(normalizedState);
    setHasUnsavedChanges(false);
    setIsInitialized(true);

    // Clear session storage
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }

    updatePageTitle(false);
  }, [normalizeState, updatePageTitle]);

  /**
   * Reset for new invoice
   */
  const reset = useCallback(() => {
    console.log('🔄 Resetting unsaved changes state');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setBaselineState(null);
    setHasUnsavedChanges(false);
    setIsInitialized(false);

    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }

    updatePageTitle(false);
  }, [updatePageTitle]);

  /**
   * Subscribe to change notifications
   */
  const subscribe = useCallback((listener) => {
    if (typeof listener !== 'function') {
      console.warn('Invalid listener: must be a function');
      return () => {};
    }

    listenersRef.current.push(listener);

    // Immediately call with current state
    listener({
      hasUnsavedChanges,
      changesSummary: getChangesSummary(baselineState)
    });

    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== listener);
    };
  }, [hasUnsavedChanges, getChangesSummary, baselineState]);

  /**
   * Force check for changes
   */
  const forceCheck = useCallback((currentState) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    detectChanges(currentState);
  }, [detectChanges]);

  // Initialize with baseline if provided
  useEffect(() => {
    if (initialState && !isInitialized) {
      establishBaseline(initialState);
    }
  }, [initialState, isInitialized, establishBaseline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      listenersRef.current = [];
    };
  }, []);

  return {
    hasUnsavedChanges,
    checkState,
    establishBaseline,
    reset,
    subscribe,
    forceCheck,
    getChangesSummary: () => getChangesSummary(baselineState)
  };
};

export default useUnsavedChanges;