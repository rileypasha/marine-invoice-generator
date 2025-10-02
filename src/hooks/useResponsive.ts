import { useState, useEffect, useCallback } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

interface ResponsiveState {
  breakpoint: Breakpoint;
  orientation: Orientation;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPWA: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
}

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

const getBreakpoint = (width: number): Breakpoint => {
  if (width <= MOBILE_MAX) return 'mobile';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
};

const getOrientation = (width: number, height: number): Orientation => {
  return width > height ? 'landscape' : 'portrait';
};

const isPWAMode = (): boolean => {
  // Check if running in standalone PWA mode
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

/**
 * Hook for responsive design utilities
 * Provides breakpoint detection, orientation, and PWA mode
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const breakpoint = getBreakpoint(width);
    const orientation = getOrientation(width, height);
    const isPWA = isPWAMode();

    return {
      breakpoint,
      orientation,
      isMobile: breakpoint === 'mobile',
      isTablet: breakpoint === 'tablet',
      isDesktop: breakpoint === 'desktop',
      isPWA,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      width,
      height,
    };
  });

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const breakpoint = getBreakpoint(width);
    const orientation = getOrientation(width, height);
    const isPWA = isPWAMode();

    setState({
      breakpoint,
      orientation,
      isMobile: breakpoint === 'mobile',
      isTablet: breakpoint === 'tablet',
      isDesktop: breakpoint === 'desktop',
      isPWA,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      width,
      height,
    });
  }, []);

  useEffect(() => {
    // Debounce resize events for performance
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  return state;
}

/**
 * Utility function to get current breakpoint (can be used outside components)
 */
export const getCurrentBreakpoint = (): Breakpoint => {
  return getBreakpoint(window.innerWidth);
};

/**
 * Utility function to check if mobile
 */
export const isMobileDevice = (): boolean => {
  return window.innerWidth <= MOBILE_MAX;
};

/**
 * Utility function to check if PWA mode
 */
export const isPWADevice = (): boolean => {
  return isPWAMode();
};
