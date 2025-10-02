/**
 * Mobile Components - Centralized exports
 * All mobile-first UI components for the marine invoice app
 */

export { BottomNav } from './BottomNav';
export { FAB } from './FAB';
export { DetailSheet } from './DetailSheet';
export { RequestCard, RequestCardSkeleton } from './RequestCard';

// Re-export hooks for convenience
export { useResponsive, getCurrentBreakpoint, isMobileDevice, isPWADevice } from '../../hooks/useResponsive';
export type { Breakpoint, Orientation } from '../../hooks/useResponsive';

export { useGestures, usePullToRefresh, usePinchZoom, hapticFeedback } from '../../hooks/useGestures';
