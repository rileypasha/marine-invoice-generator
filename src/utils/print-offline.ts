/**
 * Offline Print Queue
 *
 * Queues print requests when offline and retries with fresh data
 * when connection is restored.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface PrintRequest {
  id: string
  type: 'invoice' | 'request' | 'customer' | 'vessel'
  entityId: string
  options?: {
    includeNotes?: boolean
    includeHistory?: boolean
    format?: 'pdf' | 'html'
  }
  timestamp: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  cachedData?: unknown // Fallback data for preview
}

interface PrintQueueDB extends DBSchema {
  printQueue: {
    key: string
    value: PrintRequest
    indexes: {
      'by-timestamp': number
      'by-status': string
      'by-type': string
    }
  }
}

const PRINT_DB_NAME = 'marine-invoice-print-queue'
const PRINT_DB_VERSION = 1

let printDbInstance: IDBPDatabase<PrintQueueDB> | null = null

/**
 * Initialize print queue database
 */
async function getPrintDB(): Promise<IDBPDatabase<PrintQueueDB>> {
  if (printDbInstance) return printDbInstance

  printDbInstance = await openDB<PrintQueueDB>(PRINT_DB_NAME, PRINT_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('printQueue')) {
        const store = db.createObjectStore('printQueue', { keyPath: 'id' })
        store.createIndex('by-timestamp', 'timestamp')
        store.createIndex('by-status', 'status')
        store.createIndex('by-type', 'type')
      }
    },
  })

  return printDbInstance
}

/**
 * Queue a print request
 */
export async function queuePrintRequest(
  type: PrintRequest['type'],
  entityId: string,
  options?: PrintRequest['options'],
  cachedData?: unknown
): Promise<string> {
  const db = await getPrintDB()

  const request: PrintRequest = {
    id: crypto.randomUUID(),
    type,
    entityId,
    options,
    timestamp: Date.now(),
    status: 'pending',
    cachedData,
  }

  await db.add('printQueue', request)

  return request.id
}

/**
 * Get all pending print requests
 */
export async function getPendingPrintRequests(): Promise<PrintRequest[]> {
  const db = await getPrintDB()
  const pending = await db.getAllFromIndex('printQueue', 'by-status', 'pending')
  return pending.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get print queue statistics
 */
export async function getPrintQueueStats() {
  const db = await getPrintDB()

  const [pending, processing, failed] = await Promise.all([
    db.getAllFromIndex('printQueue', 'by-status', 'pending'),
    db.getAllFromIndex('printQueue', 'by-status', 'processing'),
    db.getAllFromIndex('printQueue', 'by-status', 'failed'),
  ])

  return {
    pending: pending.length,
    processing: processing.length,
    failed: failed.length,
    total: pending.length + processing.length,
  }
}

/**
 * Process print queue - attempt to print pending requests
 */
export async function processPrintQueue(
  printFn: (type: string, entityId: string, options?: any) => Promise<void>
): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const db = await getPrintDB()
  const pending = await getPendingPrintRequests()

  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const request of pending) {
    processed++

    try {
      // Update status to processing
      await db.put('printQueue', {
        ...request,
        status: 'processing',
      })

      // Attempt to print with fresh data
      await printFn(request.type, request.entityId, request.options)

      // Mark as completed
      await db.put('printQueue', {
        ...request,
        status: 'completed',
      })

      succeeded++

      // Clean up completed after 1 hour
      setTimeout(async () => {
        await db.delete('printQueue', request.id)
      }, 60 * 60 * 1000)
    } catch (error) {
      // Mark as failed
      await db.put('printQueue', {
        ...request,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      failed++
    }
  }

  return { processed, succeeded, failed }
}

/**
 * Retry a failed print request
 */
export async function retryPrintRequest(requestId: string): Promise<void> {
  const db = await getPrintDB()
  const request = await db.get('printQueue', requestId)

  if (!request) {
    throw new Error(`Print request ${requestId} not found`)
  }

  // Reset to pending
  await db.put('printQueue', {
    ...request,
    status: 'pending',
    error: undefined,
  })
}

/**
 * Cancel a print request
 */
export async function cancelPrintRequest(requestId: string): Promise<void> {
  const db = await getPrintDB()
  await db.delete('printQueue', requestId)
}

/**
 * Clear all print requests
 */
export async function clearPrintQueue(): Promise<void> {
  const db = await getPrintDB()
  await db.clear('printQueue')
}

/**
 * Clear completed print requests
 */
export async function clearCompletedPrints(): Promise<void> {
  const db = await getPrintDB()
  const completed = await db.getAllFromIndex('printQueue', 'by-status', 'completed')

  const tx = db.transaction('printQueue', 'readwrite')
  await Promise.all([...completed.map(req => tx.store.delete(req.id)), tx.done])
}

/**
 * Print with offline support
 *
 * If online: prints immediately
 * If offline: queues for later and shows preview with cached data
 */
export async function printWithOfflineSupport(
  type: PrintRequest['type'],
  entityId: string,
  options?: PrintRequest['options'],
  cachedData?: unknown,
  printFn?: (type: string, entityId: string, options?: any) => Promise<void>
): Promise<{
  success: boolean
  queued: boolean
  requestId?: string
  message: string
}> {
  if (navigator.onLine && printFn) {
    // Try to print immediately
    try {
      await printFn(type, entityId, options)
      return {
        success: true,
        queued: false,
        message: 'Printed successfully',
      }
    } catch (error) {
      // Fall through to queue
      console.warn('Print failed, queuing:', error)
    }
  }

  // Queue for later
  const requestId = await queuePrintRequest(type, entityId, options, cachedData)

  return {
    success: false,
    queued: true,
    requestId,
    message: navigator.onLine
      ? 'Print queued - will retry with fresh data'
      : 'Print queued - will print when online',
  }
}

/**
 * Preview print using cached data
 */
export async function previewPrintOffline(
  requestId: string,
  previewFn: (data: unknown, options?: any) => void
): Promise<void> {
  const db = await getPrintDB()
  const request = await db.get('printQueue', requestId)

  if (!request) {
    throw new Error(`Print request ${requestId} not found`)
  }

  if (!request.cachedData) {
    throw new Error('No cached data available for preview')
  }

  previewFn(request.cachedData, request.options)
}

/**
 * Auto-process print queue on network reconnect
 */
export function setupAutoPrint(
  printFn: (type: string, entityId: string, options?: any) => Promise<void>,
  interval = 60000 // 1 minute
): () => void {
  let intervalId: number | null = null

  const startInterval = () => {
    if (intervalId !== null) return

    intervalId = window.setInterval(async () => {
      if (navigator.onLine) {
        const stats = await getPrintQueueStats()
        if (stats.pending > 0) {
          await processPrintQueue(printFn)
        }
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
    await processPrintQueue(printFn)
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
