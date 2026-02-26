import { useEffect, useRef } from 'react';
import { apiRequest, API_ENDPOINTS } from '../config/api';

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between keep-alive pings
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'pointermove'] as const;

/**
 * Sends periodic keep-alive pings to the server while the user is actively
 * interacting with the app, preventing session timeout during long form fills.
 *
 * Only pings when authenticated and user activity has been detected since the
 * last ping. Stops automatically when unmounted or user goes idle.
 */
export function useSessionKeepAlive(isAuthenticated: boolean): void {
  const lastActivityRef = useRef<number>(0);
  const lastPingRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isAuthenticated) return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    const interval = setInterval(() => {
      // Only ping if there has been activity since the last ping
      if (lastActivityRef.current > lastPingRef.current) {
        lastPingRef.current = Date.now();
        apiRequest(API_ENDPOINTS.AUTH.KEEP_ALIVE, { method: 'POST' }).catch(() => {
          // Silently ignore — 401s are handled globally by the API client
        });
      }
    }, PING_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      clearInterval(interval);
    };
  }, [isAuthenticated]);
}
