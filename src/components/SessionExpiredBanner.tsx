import React, { useEffect, useState } from 'react';
import authStore from '../stores/authStore';
import './SessionExpiredBanner.css';

export const SessionExpiredBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkAuthState = () => {
      setIsVisible(authStore.sessionExpired || (!authStore.isAuthenticated && pendingCount > 0));
    };

    const unsubscribe = authStore.subscribe(checkAuthState);
    
    // Check pending saves
    const checkPending = async () => {
      const { saveQueue } = await import('../lib/saveQueue');
      const stats = await saveQueue.getStats();
      setPendingCount(stats.total);
    };

    checkAuthState();
    checkPending();

    const interval = setInterval(checkPending, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [pendingCount]);

  const handleReauthenticate = () => {
    window.location.href = '/login?returnUrl=' + encodeURIComponent(window.location.pathname);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsVisible(authStore.sessionExpired);
    }, 30000); // Re-show after 30 seconds if still expired
  };

  if (!isVisible) return null;

  return (
    <div className="session-expired-banner" role="alert" aria-live="polite">
      <div className="banner-content">
        <div className="banner-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 1.944A8.056 8.056 0 1 0 18.056 10 8.065 8.065 0 0 0 10 1.944ZM10 0a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z"/>
            <path d="M10 5.556v5.555M10 14.444h.011"/>
          </svg>
        </div>
        
        <div className="banner-message">
          <strong>Session expired</strong>
          {pendingCount > 0 && (
            <span className="pending-count">
              {' '}— {pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="banner-description">
            Log in to save your changes to the server
          </span>
        </div>

        <div className="banner-actions">
          <button 
            className="btn-reauthenticate"
            onClick={handleReauthenticate}
            aria-label="Re-authenticate to save changes"
          >
            Re-authenticate
          </button>
          <button 
            className="btn-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};