import { useRef, useEffect, useCallback } from 'react';

interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  threshold?: number; // Minimum distance for swipe (default 50px)
  longPressDelay?: number; // Delay for long press (default 500ms)
}

/**
 * Hook for handling touch gestures
 */
export function useGestures<T extends HTMLElement = HTMLDivElement>(
  config: GestureConfig
) {
  const ref = useRef<T>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const threshold = config.threshold || 50;
  const longPressDelay = config.longPressDelay || 500;

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // Start long press timer
      if (config.onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          // Trigger haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          config.onLongPress?.();
        }, longPressDelay);
      }
    },
    [config, longPressDelay]
  );

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves finger
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      clearLongPressTimer();

      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) >= threshold) {
          if (deltaX > 0) {
            config.onSwipeRight?.();
          } else {
            config.onSwipeLeft?.();
          }
          // Trigger haptic feedback
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) >= threshold) {
          if (deltaY > 0) {
            config.onSwipeDown?.();
          } else {
            config.onSwipeUp?.();
          }
          // Trigger haptic feedback
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        }
      }

      touchStartRef.current = null;
    },
    [config, threshold, clearLongPressTimer]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      clearLongPressTimer();
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, clearLongPressTimer]);

  return ref;
}

/**
 * Hook for pull-to-refresh gesture
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const ref = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;

    // Only allow pull-to-refresh at top of scroll
    if (
      deltaY > 0 &&
      ref.current &&
      ref.current.scrollTop === 0 &&
      !isRefreshingRef.current
    ) {
      // Could add visual feedback here (e.g., show refresh indicator)
    }
  }, []);

  const handleTouchEnd = useCallback(
    async (e: TouchEvent) => {
      const currentY = e.changedTouches[0].clientY;
      const deltaY = currentY - startYRef.current;

      // Trigger refresh if pulled down more than 80px from top
      if (
        deltaY > 80 &&
        ref.current &&
        ref.current.scrollTop === 0 &&
        !isRefreshingRef.current
      ) {
        isRefreshingRef.current = true;

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        try {
          await onRefresh();
        } finally {
          isRefreshingRef.current = false;
        }
      }
    },
    [onRefresh]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return ref;
}

/**
 * Utility to trigger haptic feedback
 */
export const hapticFeedback = (
  pattern: number | number[] = 10
): void => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

/**
 * Hook for detecting pinch-to-zoom gesture
 */
export function usePinchZoom(
  onZoomIn?: () => void,
  onZoomOut?: () => void
) {
  const ref = useRef<HTMLDivElement>(null);
  const initialDistanceRef = useRef<number>(0);

  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      initialDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault(); // Prevent default zoom behavior
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const delta = currentDistance - initialDistanceRef.current;

        if (Math.abs(delta) > 50) {
          if (delta > 0) {
            onZoomIn?.();
          } else {
            onZoomOut?.();
          }
          initialDistanceRef.current = currentDistance;
        }
      }
    },
    [onZoomIn, onZoomOut]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchStart, handleTouchMove]);

  return ref;
}
