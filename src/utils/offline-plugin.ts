/**
 * TanStack Query Offline Plugin
 *
 * Provides offline persistence, cache hydration, and optimistic updates
 * integrated with IndexedDB cache layer.
 */

import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import {
  bulkPutItems,
  getAllItems,
  putItem,
  updateSyncStatus,
  setMetadata,
} from '../db/cache'
import { enqueueRequest, setupAutoRetry } from '../db/queue'

interface OfflinePluginOptions {
  persistQueries?: boolean
  maxAge?: number // Max age in ms before cache is considered stale
  onOnline?: () => void
  onOffline?: () => void
}

const DEFAULT_OPTIONS: Required<OfflinePluginOptions> = {
  persistQueries: true,
  maxAge: 30 * 60 * 1000, // 30 minutes
  onOnline: () => {},
  onOffline: () => {},
}

/**
 * Create offline-capable QueryClient with persistence
 */
export function createOfflineQueryClient(
  options: OfflinePluginOptions = {}
): QueryClient {
  const config = { ...DEFAULT_OPTIONS, ...options }

  // Query cache with persistence
  const queryCache = new QueryCache({
    onSuccess: async (data, query) => {
      if (!config.persistQueries) return

      // Persist successful queries to IndexedDB
      const queryKey = query.queryKey
      if (shouldPersistQuery(queryKey)) {
        await persistQueryData(queryKey, data)
      }
    },
  })

  // Mutation cache with offline queue
  const mutationCache = new MutationCache({
    onSuccess: async (data, variables, context, mutation) => {
      // Update sync timestamp
      await setMetadata('lastSyncTime', Date.now())
    },
    onError: async (error, variables, context, mutation) => {
      // If offline or network error, queue the mutation
      if (!navigator.onLine || isNetworkError(error)) {
        const mutationMeta = mutation.options.meta as any
        if (mutationMeta?.queueOffline) {
          await queueMutation(mutation.options, variables)
        }
      }
    },
  })

  const queryClient = new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        // Network-first with cache fallback
        networkMode: 'offlineFirst',
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          // Don't retry if offline
          if (!navigator.onLine) return false
          // Retry up to 1 time for network errors
          return failureCount < 1 && isNetworkError(error)
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: (failureCount, error) => {
          if (!navigator.onLine) return false
          return failureCount < 1 && isNetworkError(error)
        },
      },
    },
  })

  // Setup auto-retry on reconnect
  setupAutoRetry(30000)

  return queryClient
}

/**
 * Determine if a query should be persisted
 */
function shouldPersistQuery(queryKey: unknown[]): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false

  const route = String(queryKey[0])

  // Persist main data routes
  return (
    route.includes('/api/requests') ||
    route.includes('/api/customers') ||
    route.includes('/api/vessels') ||
    route.includes('/api/invoices')
  )
}

/**
 * Get store name from query key
 */
function getStoreFromQueryKey(
  queryKey: unknown[]
): 'requests' | 'customers' | 'vessels' | 'invoices' | null {
  const route = String(queryKey[0])

  if (route.includes('/api/requests')) return 'requests'
  if (route.includes('/api/customers')) return 'customers'
  if (route.includes('/api/vessels')) return 'vessels'
  if (route.includes('/api/invoices')) return 'invoices'

  return null
}

/**
 * Persist query data to IndexedDB
 */
async function persistQueryData(queryKey: unknown[], data: unknown): Promise<void> {
  const store = getStoreFromQueryKey(queryKey)
  if (!store) return

  try {
    if (Array.isArray(data)) {
      // Bulk insert for list queries
      await bulkPutItems(store, data as any[])
    } else if (data && typeof data === 'object') {
      // Single item insert
      await putItem(store, data as any)
    }

    await setMetadata(`last-${store}-sync`, Date.now())
  } catch (error) {
    console.warn('Failed to persist query data:', error)
  }
}

/**
 * Queue a failed mutation for retry
 */
async function queueMutation(mutationOptions: any, variables: unknown): Promise<void> {
  const meta = mutationOptions.meta || {}
  const method = meta.method || 'POST'
  const url = meta.url || ''

  if (!url) {
    console.warn('Cannot queue mutation without URL')
    return
  }

  try {
    await enqueueRequest(method, url, variables, {
      'Content-Type': 'application/json',
    })
  } catch (error) {
    console.error('Failed to queue mutation:', error)
  }
}

/**
 * Check if error is network-related
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors are typically TypeErrors
    return error.message.includes('fetch') || error.message.includes('network')
  }

  if (error && typeof error === 'object' && 'status' in error) {
    // Treat 5xx and network timeout errors as network errors
    const status = (error as any).status
    return status >= 500 || status === 0
  }

  return false
}

/**
 * Hydrate query client from IndexedDB cache
 */
export async function hydrateFromCache(
  queryClient: QueryClient
): Promise<{
  requests: number
  customers: number
  vessels: number
  invoices: number
}> {
  const stats = {
    requests: 0,
    customers: 0,
    vessels: 0,
    invoices: 0,
  }

  try {
    // Hydrate requests
    const requests = await getAllItems('requests')
    if (requests.length > 0) {
      queryClient.setQueryData(['/api/requests'], requests)
      stats.requests = requests.length
    }

    // Hydrate customers
    const customers = await getAllItems('customers')
    if (customers.length > 0) {
      queryClient.setQueryData(['/api/customers'], customers)
      stats.customers = customers.length
    }

    // Hydrate vessels
    const vessels = await getAllItems('vessels')
    if (vessels.length > 0) {
      queryClient.setQueryData(['/api/vessels'], vessels)
      stats.vessels = vessels.length
    }

    // Hydrate invoices
    const invoices = await getAllItems('invoices')
    if (invoices.length > 0) {
      queryClient.setQueryData(['/api/invoices'], invoices)
      stats.invoices = invoices.length
    }

    console.log('Cache hydrated:', stats)
  } catch (error) {
    console.error('Failed to hydrate from cache:', error)
  }

  return stats
}

/**
 * Create optimistic mutation helper
 */
export function createOptimisticMutation<TData, TVariables>({
  mutationFn,
  onMutate,
  onError,
  onSuccess,
  queryKey,
  updateFn,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>
  queryKey: unknown[]
  updateFn: (oldData: TData[] | undefined, variables: TVariables) => TData[]
  onMutate?: (variables: TVariables) => Promise<any> | any
  onError?: (error: unknown, variables: TVariables, context: any) => void
  onSuccess?: (data: TData, variables: TVariables, context: any) => void
}) {
  return {
    mutationFn,
    meta: {
      queueOffline: true,
    },
    onMutate: async (variables: TVariables) => {
      // Call custom onMutate
      const customContext = onMutate ? await onMutate(variables) : undefined

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData[]>(queryKey)

      // Optimistically update
      queryClient.setQueryData<TData[]>(queryKey, old => updateFn(old, variables))

      return { previousData, customContext }
    },
    onError: (error: unknown, variables: TVariables, context: any) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }

      // Call custom onError
      if (onError) {
        onError(error, variables, context?.customContext)
      }
    },
    onSuccess: (data: TData, variables: TVariables, context: any) => {
      // Call custom onSuccess
      if (onSuccess) {
        onSuccess(data, variables, context?.customContext)
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  }
}

/**
 * Mark data as stale if cache is old
 */
export async function checkCacheAge(
  queryClient: QueryClient,
  maxAge: number = 30 * 60 * 1000
): Promise<void> {
  const stores = ['requests', 'customers', 'vessels', 'invoices'] as const

  for (const store of stores) {
    const lastSync = await getMetadata<number>(`last-${store}-sync`)

    if (lastSync && Date.now() - lastSync > maxAge) {
      // Mark as stale
      queryClient.invalidateQueries({
        queryKey: [`/api/${store}`],
      })
    }
  }
}

/**
 * Get metadata helper (re-export from cache)
 */
async function getMetadata<T>(key: string): Promise<T | undefined> {
  const { getMetadata: getCacheMetadata } = await import('../db/cache')
  return getCacheMetadata<T>(key)
}

// Create singleton query client
let queryClient: QueryClient | null = null

/**
 * Get or create the global query client
 */
export function getQueryClient(options?: OfflinePluginOptions): QueryClient {
  if (!queryClient) {
    queryClient = createOfflineQueryClient(options)
  }
  return queryClient
}

/**
 * Reset the query client (useful for testing)
 */
export function resetQueryClient(): void {
  queryClient = null
}
