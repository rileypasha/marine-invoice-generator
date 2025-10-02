/**
 * Debounce Hooks for Performance Optimization
 *
 * Provides React hooks for debouncing values and callbacks to reduce
 * unnecessary re-renders and API calls during user input.
 *
 * @module useDebounce
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Debounce a value - delays updating until user stops typing
 *
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 *
 * @example
 * ```tsx
 * function SearchComponent() {
 *   const [searchTerm, setSearchTerm] = useState('')
 *   const debouncedSearch = useDebounce(searchTerm, 300)
 *
 *   // API call only triggers after user stops typing for 300ms
 *   useEffect(() => {
 *     if (debouncedSearch) {
 *       searchAPI(debouncedSearch)
 *     }
 *   }, [debouncedSearch])
 *
 *   return <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
 * }
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set up timeout to update debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clear timeout if value changes before delay completes
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Debounce a callback function
 *
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced callback function
 *
 * @example
 * ```tsx
 * function FilterComponent() {
 *   const debouncedFilter = useDebouncedCallback(
 *     (term: string) => {
 *       console.log('Filtering:', term)
 *       // Perform expensive filtering operation
 *     },
 *     300
 *   )
 *
 *   return <input onChange={e => debouncedFilter(e.target.value)} />
 * }
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  // Update callback ref if it changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  )
}

/**
 * Throttle a callback function - ensures function runs at most once per interval
 *
 * @param callback - Function to throttle
 * @param limit - Minimum time between calls in milliseconds (default: 300ms)
 * @returns Throttled callback function
 *
 * @example
 * ```tsx
 * function ScrollComponent() {
 *   const handleScroll = useThrottledCallback(
 *     () => {
 *       console.log('Scroll position:', window.scrollY)
 *     },
 *     100 // Only log at most once per 100ms
 *   )
 *
 *   useEffect(() => {
 *     window.addEventListener('scroll', handleScroll)
 *     return () => window.removeEventListener('scroll', handleScroll)
 *   }, [handleScroll])
 *
 *   return <div>Scroll me!</div>
 * }
 * ```
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 300
): (...args: Parameters<T>) => void {
  const lastRan = useRef<number>(0)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()

      if (now - lastRan.current >= limit) {
        callbackRef.current(...args)
        lastRan.current = now
      }
    },
    [limit]
  )
}

/**
 * Debounced state hook - combines useState with debouncing
 *
 * @param initialValue - Initial state value
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns [value, debouncedValue, setValue]
 *
 * @example
 * ```tsx
 * function SearchBox() {
 *   const [search, debouncedSearch, setSearch] = useDebouncedState('', 300)
 *
 *   // Render with immediate value, query with debounced value
 *   return (
 *     <>
 *       <input value={search} onChange={e => setSearch(e.target.value)} />
 *       <SearchResults query={debouncedSearch} />
 *     </>
 *   )
 * }
 * ```
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialValue)
  const debouncedValue = useDebounce(value, delay)

  return [value, debouncedValue, setValue]
}

/**
 * Debounced async callback with loading state
 *
 * @param asyncCallback - Async function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Object with { callback, isLoading, error }
 *
 * @example
 * ```tsx
 * function AsyncSearchComponent() {
 *   const { callback: search, isLoading } = useDebouncedAsync(
 *     async (term: string) => {
 *       const results = await fetchSearchResults(term)
 *       setResults(results)
 *     },
 *     300
 *   )
 *
 *   return (
 *     <>
 *       <input onChange={e => search(e.target.value)} />
 *       {isLoading && <Spinner />}
 *     </>
 *   )
 * }
 * ```
 */
export function useDebouncedAsync<T extends (...args: any[]) => Promise<any>>(
  asyncCallback: T,
  delay: number = 300
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(asyncCallback)

  useEffect(() => {
    callbackRef.current = asyncCallback
  }, [asyncCallback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const callback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      setError(null)

      timeoutRef.current = setTimeout(async () => {
        setIsLoading(true)
        try {
          await callbackRef.current(...args)
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Unknown error'))
        } finally {
          setIsLoading(false)
        }
      }, delay)
    },
    [delay]
  )

  return { callback, isLoading, error }
}

/**
 * Leading edge debounce - executes immediately, then waits
 * Useful for button clicks that should execute immediately but prevent rapid re-clicks
 *
 * @param callback - Function to debounce
 * @param delay - Delay before allowing next execution (default: 300ms)
 * @returns Debounced callback
 */
export function useLeadingDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const canExecute = useRef(true)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (canExecute.current) {
        callbackRef.current(...args)
        canExecute.current = false

        timeoutRef.current = setTimeout(() => {
          canExecute.current = true
        }, delay)
      }
    },
    [delay]
  )
}
