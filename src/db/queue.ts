/**
 * Offline Queue System
 *
 * Manages failed API requests for retry when connection is restored.
 * Handles conflicts, exponential backoff, and optimistic updates.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface QueuedRequest {
  id: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
  headers?: Record<string, string>
  timestamp: number
  retries: number
  lastRetryAt?: number
  error?: string
  optimisticId?: string // For optimistic UI updates
  status: 'pending' | 'retrying' | 'failed' | 'conflict'
}

interface QueueDB extends DBSchema {
  queue: {
    key: string
    value: QueuedRequest
    indexes: {
      'by-timestamp': number
      'by-status': string
      'by-method': string
    }
  }
  conflicts: {
    key: string
    value: {
      id: string
      queuedRequest: QueuedRequest
      serverResponse: unknown
      timestamp: number
      resolved: boolean
    }
  }
}

const QUEUE_DB_NAME = 'marine-invoice-queue'
const QUEUE_DB_VERSION = 1

// Retry configuration
const MAX_RETRIES = 5
const INITIAL_BACKOFF = 1000 // 1 second
const MAX_BACKOFF = 60000 // 60 seconds
const BACKOFF_MULTIPLIER = 2

let queueDbInstance: IDBPDatabase<QueueDB> | null = null

/**
 * Initialize queue database
 */
async function getQueueDB(): Promise<IDBPDatabase<QueueDB>> {
  if (queueDbInstance) return queueDbInstance

  queueDbInstance = await openDB<QueueDB>(QUEUE_DB_NAME, QUEUE_DB_VERSION, {
    upgrade(db) {
      // Queue store
      if (!db.objectStoreNames.contains('queue')) {
        const queueStore = db.createObjectStore('queue', { keyPath: 'id' })
        queueStore.createIndex('by-timestamp', 'timestamp')
        queueStore.createIndex('by-status', 'status')
        queueStore.createIndex('by-method', 'method')
      }

      // Conflicts store
      if (!db.objectStoreNames.contains('conflicts')) {
        db.createObjectStore('conflicts', { keyPath: 'id' })
      }
    },
  })

  return queueDbInstance
}

/**
 * Add a request to the queue
 */
export async function enqueueRequest(
  method: QueuedRequest['method'],
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
  optimisticId?: string
): Promise<string> {
  const db = await getQueueDB()

  const request: QueuedRequest = {
    id: crypto.randomUUID(),
    method,
    url,
    body,
    headers,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
    optimisticId,
  }

  await db.add('queue', request)

  return request.id
}

/**
 * Get all pending requests
 */
export async function getPendingRequests(): Promise<QueuedRequest[]> {
  const db = await getQueueDB()
  const all = await db.getAllFromIndex('queue', 'by-status', 'pending')
  const retrying = await db.getAllFromIndex('queue', 'by-status', 'retrying')

  return [...all, ...retrying].sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const db = await getQueueDB()

  const [pending, retrying, failed, conflicts] = await Promise.all([
    db.getAllFromIndex('queue', 'by-status', 'pending'),
    db.getAllFromIndex('queue', 'by-status', 'retrying'),
    db.getAllFromIndex('queue', 'by-status', 'failed'),
    db.getAll('conflicts'),
  ])

  return {
    pending: pending.length,
    retrying: retrying.length,
    failed: failed.length,
    conflicts: conflicts.filter(c => !c.resolved).length,
    total: pending.length + retrying.length + failed.length,
  }
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(retries: number): number {
  const delay = Math.min(
    INITIAL_BACKOFF * Math.pow(BACKOFF_MULTIPLIER, retries),
    MAX_BACKOFF
  )

  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1)
  return Math.floor(delay + jitter)
}

/**
 * Check if a request is ready to retry
 */
function isReadyToRetry(request: QueuedRequest): boolean {
  if (request.retries >= MAX_RETRIES) return false
  if (!request.lastRetryAt) return true

  const backoff = calculateBackoff(request.retries)
  const timeSinceLastRetry = Date.now() - request.lastRetryAt

  return timeSinceLastRetry >= backoff
}

/**
 * Process queue - attempt to retry pending requests
 */
export async function processQueue(
  fetchFn: typeof fetch = fetch
): Promise<{
  processed: number
  succeeded: number
  failed: number
  conflicts: number
}> {
  const db = await getQueueDB()
  const pending = await getPendingRequests()

  let processed = 0
  let succeeded = 0
  let failed = 0
  let conflicts = 0

  for (const request of pending) {
    if (!isReadyToRetry(request)) continue

    processed++

    try {
      // Update status to retrying
      await db.put('queue', {
        ...request,
        status: 'retrying',
        lastRetryAt: Date.now(),
        retries: request.retries + 1,
      })

      // Attempt the request
      const response = await fetchFn(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
      })

      if (response.ok) {
        // Success - remove from queue
        await db.delete('queue', request.id)
        succeeded++
      } else if (response.status === 409) {
        // Conflict - store for manual resolution
        const serverResponse = await response.json()
        await handleConflict(request, serverResponse)
        conflicts++
      } else if (response.status >= 400 && response.status < 500) {
        // Client error - mark as failed (don't retry)
        const errorText = await response.text()
        await db.put('queue', {
          ...request,
          status: 'failed',
          error: `HTTP ${response.status}: ${errorText}`,
        })
        failed++
      } else {
        // Server error - keep retrying
        if (request.retries >= MAX_RETRIES) {
          await db.put('queue', {
            ...request,
            status: 'failed',
            error: `Max retries exceeded. Last error: HTTP ${response.status}`,
          })
          failed++
        } else {
          await db.put('queue', {
            ...request,
            status: 'pending',
          })
        }
      }
    } catch (error) {
      // Network error - keep retrying
      if (request.retries >= MAX_RETRIES) {
        await db.put('queue', {
          ...request,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        failed++
      } else {
        await db.put('queue', {
          ...request,
          status: 'pending',
        })
      }
    }
  }

  return { processed, succeeded, failed, conflicts }
}

/**
 * Handle conflict - store for manual resolution
 */
async function handleConflict(
  request: QueuedRequest,
  serverResponse: unknown
): Promise<void> {
  const db = await getQueueDB()

  await db.put('conflicts', {
    id: request.id,
    queuedRequest: request,
    serverResponse,
    timestamp: Date.now(),
    resolved: false,
  })

  // Update request status
  await db.put('queue', {
    ...request,
    status: 'conflict',
  })
}

/**
 * Get unresolved conflicts
 */
export async function getConflicts() {
  const db = await getQueueDB()
  const all = await db.getAll('conflicts')
  return all.filter(c => !c.resolved)
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'keep-local' | 'keep-server' | 'merge',
  mergedData?: unknown
): Promise<void> {
  const db = await getQueueDB()
  const conflict = await db.get('conflicts', conflictId)

  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`)
  }

  // Mark conflict as resolved
  await db.put('conflicts', {
    ...conflict,
    resolved: true,
  })

  // Remove from queue
  await db.delete('queue', conflictId)

  // Handle resolution based on strategy
  if (resolution === 'keep-local') {
    // Re-queue the request with force flag
    const request = conflict.queuedRequest
    await enqueueRequest(
      request.method,
      request.url,
      request.body,
      { ...request.headers, 'X-Force-Update': 'true' },
      request.optimisticId
    )
  } else if (resolution === 'merge' && mergedData) {
    // Queue merged data
    const request = conflict.queuedRequest
    await enqueueRequest(
      request.method,
      request.url,
      mergedData,
      request.headers,
      request.optimisticId
    )
  }
  // For 'keep-server', we just remove from queue (already done above)
}

/**
 * Retry a specific failed request
 */
export async function retryRequest(requestId: string): Promise<void> {
  const db = await getQueueDB()
  const request = await db.get('queue', requestId)

  if (!request) {
    throw new Error(`Request ${requestId} not found`)
  }

  // Reset to pending status
  await db.put('queue', {
    ...request,
    status: 'pending',
    retries: 0,
    lastRetryAt: undefined,
    error: undefined,
  })
}

/**
 * Remove a request from the queue
 */
export async function removeFromQueue(requestId: string): Promise<void> {
  const db = await getQueueDB()
  await db.delete('queue', requestId)
}

/**
 * Clear all requests from the queue
 */
export async function clearQueue(): Promise<void> {
  const db = await getQueueDB()
  await db.clear('queue')
}

/**
 * Clear resolved conflicts
 */
export async function clearResolvedConflicts(): Promise<void> {
  const db = await getQueueDB()
  const conflicts = await db.getAll('conflicts')
  const resolved = conflicts.filter(c => c.resolved)

  const tx = db.transaction('conflicts', 'readwrite')
  await Promise.all([
    ...resolved.map(c => tx.store.delete(c.id)),
    tx.done,
  ])
}

/**
 * Register background sync (if supported)
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.sync.register('queue-sync')
    return true
  } catch (error) {
    console.warn('Background sync registration failed:', error)
    return false
  }
}

/**
 * Auto-process queue on network reconnect
 */
export function setupAutoRetry(interval = 30000): () => void {
  let intervalId: number | null = null

  const startInterval = () => {
    if (intervalId !== null) return

    intervalId = window.setInterval(async () => {
      if (navigator.onLine) {
        await processQueue()
      }
    }, interval)
  }

  const stopInterval = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }

  // Start interval
  startInterval()

  // Listen for online events
  const handleOnline = async () => {
    await processQueue()
    startInterval()
  }

  const handleOffline = () => {
    stopInterval()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Return cleanup function
  return () => {
    stopInterval()
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
