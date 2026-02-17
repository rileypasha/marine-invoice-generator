import React from 'react'

/**
 * Performance optimization utilities for React components
 */

/**
 * Memoized component wrapper with display name preservation
 */
export function memoComponent<P extends object>(
  Component: React.ComponentType<P>,
  displayName?: string
): React.NamedExoticComponent<P> {
  const MemoizedComponent = React.memo(Component) as unknown as React.NamedExoticComponent<P>
  MemoizedComponent.displayName = displayName || Component.displayName || Component.name
  return MemoizedComponent
}

/**
 * Deep comparison function for React.memo
 * Use sparingly - shallow comparison is usually sufficient
 */
export function deepCompare<P>(prevProps: P, nextProps: P): boolean {
  return JSON.stringify(prevProps) === JSON.stringify(nextProps)
}

/**
 * Shallow comparison for objects (React.memo default behavior)
 */
export function shallowCompare<P extends Record<string, any>>(
  prevProps: P,
  nextProps: P
): boolean {
  const prevKeys = Object.keys(prevProps)
  const nextKeys = Object.keys(nextProps)

  if (prevKeys.length !== nextKeys.length) {
    return false
  }

  return prevKeys.every(key => prevProps[key] === nextProps[key])
}

/**
 * Custom comparison function for array props
 */
export function arrayPropsCompare<P extends { data?: any[] }>(
  prevProps: P,
  nextProps: P
): boolean {
  // If array references are the same, no re-render needed
  if (prevProps.data === nextProps.data) {
    return true
  }

  // If one is undefined, they're different
  if (!prevProps.data || !nextProps.data) {
    return false
  }

  // If lengths differ, they're different
  if (prevProps.data.length !== nextProps.data.length) {
    return false
  }

  // Compare other props shallowly
  const otherPropsMatch = Object.keys(prevProps).every(key => {
    if (key === 'data') return true
    return prevProps[key as keyof P] === nextProps[key as keyof P]
  })

  return otherPropsMatch
}

/**
 * Performance monitoring wrapper component
 */
interface PerformanceMonitorProps {
  id: string
  children: React.ReactNode
  enabled?: boolean
}

export function PerformanceMonitor({
  id,
  children,
  enabled = process.env.NODE_ENV === 'development',
}: PerformanceMonitorProps) {
  React.useEffect(() => {
    if (!enabled) return

    const startTime = performance.now()

    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime

      if (duration > 16) { // Slower than 60fps (16.67ms per frame)
        console.warn(`[Performance] Component ${id} took ${duration.toFixed(2)}ms to render`)
      }
    }
  })

  return <>{children}</>
}

/**
 * Debounce hook for expensive operations
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

/**
 * Throttle hook for frequent updates
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value)
  const lastRan = React.useRef(Date.now())

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Date.now() - lastRan.current >= interval) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, interval - (Date.now() - lastRan.current))

    return () => clearTimeout(timeoutId)
  }, [value, interval])

  return throttledValue
}

/**
 * Lazy state initialization for expensive computations
 */
export function useLazyState<T>(
  initializer: () => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  return React.useState<T>(initializer)
}

/**
 * Memoized callback with dependencies
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = React.useRef(callback)

  React.useEffect(() => {
    callbackRef.current = callback
  })

  return React.useCallback(((...args) => callbackRef.current(...args)) as T, [])
}
