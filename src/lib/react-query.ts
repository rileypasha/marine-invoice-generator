import { QueryClient, QueryClientConfig } from '@tanstack/react-query'

/**
 * Global React Query client configuration optimized for mobile performance
 *
 * Mobile-first optimizations:
 * - Aggressive caching to reduce network requests on slow connections
 * - Request deduplication to prevent parallel fetches
 * - Smart retry logic with exponential backoff
 * - Prefetching disabled to save bandwidth
 * - Network-aware stale time (shorter on fast connections)
 */

// Detect network quality for adaptive configuration
function getNetworkQuality(): 'slow' | 'fast' {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return 'fast'
  }

  const connection = (navigator as any).connection
  const effectiveType = connection?.effectiveType

  // Slow: 2G, slow-2g
  // Fast: 3G, 4G, 5G
  return effectiveType === '2g' || effectiveType === 'slow-2g' ? 'slow' : 'fast'
}

// Network-aware configuration
const networkQuality = getNetworkQuality()
const isSlow2G = networkQuality === 'slow'

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Mobile-optimized stale time
      // Slow network: Keep data fresh longer (2 min) to reduce requests
      // Fast network: Shorter stale time (30s) for fresher data
      staleTime: isSlow2G ? 2 * 60 * 1000 : 30_000,

      // Extended garbage collection time for better caching
      // Mobile users often navigate back/forth - keep data cached longer
      gcTime: 10 * 60 * 1000, // 10 minutes

      // Smart retry logic
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }

        // Retry up to 2 times on 5xx or network errors
        return failureCount < 2
      },

      // Exponential backoff for retries (better for mobile networks)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // CRITICAL: Prevents duplicate requests that cause database pool exhaustion
      refetchOnWindowFocus: false,

      // Refetch on reconnect (important for mobile users with spotty connections)
      refetchOnReconnect: true,

      // Don't refetch on mount if data is still fresh
      refetchOnMount: false,

      // Network mode: online-first with offline fallback
      networkMode: 'offlineFirst',

      // Placeholder data while loading (better UX on slow networks)
      placeholderData: undefined, // Can be customized per query

      // Structure sharing for better performance
      structuralSharing: true,

      // Disable prefetching by default (save bandwidth on mobile)
      refetchInterval: false,
      refetchIntervalInBackground: false,
    },

    mutations: {
      // Retry mutations on network errors only
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }

        // Retry once on 5xx or network errors
        return failureCount < 1
      },

      // Exponential backoff for mutation retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),

      // Network mode
      networkMode: 'offlineFirst',
    },
  },
}

export const queryClient = new QueryClient(queryClientConfig)

// Monitor network changes and adjust query client behavior
if (typeof navigator !== 'undefined' && 'connection' in navigator) {
  const connection = (navigator as any).connection

  connection?.addEventListener('change', () => {
    const newQuality = getNetworkQuality()
    const isNowSlow = newQuality === 'slow'

    // Update default stale time based on network quality
    queryClient.setDefaultOptions({
      queries: {
        staleTime: isNowSlow ? 2 * 60 * 1000 : 30_000,
      },
    })

    console.log(`Network changed to ${newQuality}, adjusted query caching`)
  })
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network restored, invalidating queries')
    // Invalidate all queries when coming back online
    queryClient.invalidateQueries()
  })

  window.addEventListener('offline', () => {
    console.log('Network lost, entering offline mode')
  })
}

/**
 * Prefetch a query for improved perceived performance
 * Use sparingly on mobile to save bandwidth
 */
export async function prefetchQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  options?: { staleTime?: number }
) {
  // Only prefetch on fast networks
  if (isSlow2G) {
    console.log('Skipping prefetch on slow network')
    return
  }

  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: options?.staleTime ?? 30_000,
  })
}

/**
 * Preload critical data for route transitions
 */
export function preloadRouteData(route: 'requests' | 'contacts' | 'vessels') {
  if (isSlow2G) return

  switch (route) {
    case 'requests':
      // Prefetch requests list
      prefetchQuery(['requests'], async () => {
        const response = await fetch('/api/invoice')
        return response.json()
      })
      break

    case 'contacts':
      // Prefetch contacts list
      prefetchQuery(['customers'], async () => {
        const response = await fetch('/api/customers')
        return response.json()
      })
      break

    case 'vessels':
      // Prefetch vessels list
      prefetchQuery(['vessels'], async () => {
        const response = await fetch('/api/vessels')
        return response.json()
      })
      break
  }
}
