/**
 * useNavigationProtection - React hook for preventing navigation with unsaved changes
 * Replaces vanilla NavigationProtection.js with React patterns
 */
import { useEffect, useCallback, useRef } from 'react';

export const useNavigationProtection = (hasUnsavedChanges) => {
  const unloadListenerRef = useRef(null);
  const popStateListenerRef = useRef(null);

  /**
   * Handle beforeunload event (page refresh, close, external navigation)
   */
  const handleBeforeUnload = useCallback((event) => {
    if (hasUnsavedChanges) {
      // Standard beforeunload handling
      event.preventDefault();
      event.returnValue = ''; // Chrome requires this

      // Some browsers show custom message, others use default
      return 'You have unsaved changes. Are you sure you want to leave?';
    }
  }, [hasUnsavedChanges]);

  /**
   * Handle popstate event (browser back/forward)
   */
  const handlePopState = useCallback((event) => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave this page?'
      );

      if (!confirmLeave) {
        // Push the current state back to prevent navigation
        window.history.pushState(null, null, window.location.href);
        event.preventDefault();
        return;
      }
    }
  }, [hasUnsavedChanges]);

  /**
   * Intercept link clicks for internal navigation
   */
  const handleLinkClick = useCallback((event) => {
    if (!hasUnsavedChanges) return;

    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');

    // Only intercept internal navigation links
    if (href && (href.startsWith('/') || href.startsWith('#') || href.includes(window.location.origin))) {
      event.preventDefault();

      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave this page?'
      );

      if (confirmLeave) {
        // Allow navigation by manually changing location
        if (href.startsWith('#')) {
          window.location.hash = href;
        } else {
          window.location.href = href;
        }
      }
    }
  }, [hasUnsavedChanges]);

  /**
   * Show confirmation dialog for unsaved changes
   */
  const confirmNavigation = useCallback((message = 'You have unsaved changes. Are you sure you want to leave?') => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  }, [hasUnsavedChanges]);

  /**
   * Programmatically navigate with unsaved changes check
   */
  const navigateWithCheck = useCallback((destination, force = false) => {
    if (force || !hasUnsavedChanges || confirmNavigation()) {
      window.location.href = destination;
      return true;
    }
    return false;
  }, [hasUnsavedChanges, confirmNavigation]);

  // Set up event listeners
  useEffect(() => {
    // Create bound references for cleanup
    unloadListenerRef.current = handleBeforeUnload;
    popStateListenerRef.current = handlePopState;

    // Add event listeners
    window.addEventListener('beforeunload', unloadListenerRef.current);
    window.addEventListener('popstate', popStateListenerRef.current);
    document.addEventListener('click', handleLinkClick);

    // Cleanup function
    return () => {
      if (unloadListenerRef.current) {
        window.removeEventListener('beforeunload', unloadListenerRef.current);
      }
      if (popStateListenerRef.current) {
        window.removeEventListener('popstate', popStateListenerRef.current);
      }
      document.removeEventListener('click', handleLinkClick);
    };
  }, [handleBeforeUnload, handlePopState, handleLinkClick]);

  return {
    confirmNavigation,
    navigateWithCheck
  };
};

export default useNavigationProtection;