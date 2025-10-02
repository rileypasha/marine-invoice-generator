/**
 * IndexedDB Cache Layer
 *
 * Provides persistent storage for API data with CRUD operations,
 * filtering, and bulk operations for offline support.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

// Schema types
export interface CachedRequest {
  id: string
  customerId: string
  vesselId: string | null
  status: 'draft' | 'submitted' | 'approved' | 'declined'
  submittedAt: string | null
  requestedServices: string[]
  notes: string | null
  createdAt: string
  updatedAt: string
  _timestamp: number
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface CachedCustomer {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  address: string | null
  createdAt: string
  updatedAt: string
  _timestamp: number
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface CachedVessel {
  id: string
  name: string
  vesselType: string | null
  length: number | null
  beam: number | null
  draft: number | null
  customerId: string
  createdAt: string
  updatedAt: string
  _timestamp: number
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface CachedInvoice {
  id: string
  invoiceNumber: string
  customerId: string
  vesselId: string | null
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  subtotal: number
  tax: number
  total: number
  issueDate: string
  dueDate: string | null
  paidDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  _timestamp: number
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

// IndexedDB schema definition
interface CacheDB extends DBSchema {
  requests: {
    key: string
    value: CachedRequest
    indexes: {
      'by-customer': string
      'by-status': string
      'by-timestamp': number
      'by-sync-status': string
    }
  }
  customers: {
    key: string
    value: CachedCustomer
    indexes: {
      'by-timestamp': number
      'by-sync-status': string
    }
  }
  vessels: {
    key: string
    value: CachedVessel
    indexes: {
      'by-customer': string
      'by-timestamp': number
      'by-sync-status': string
    }
  }
  invoices: {
    key: string
    value: CachedInvoice
    indexes: {
      'by-customer': string
      'by-status': string
      'by-timestamp': number
      'by-sync-status': string
    }
  }
  metadata: {
    key: string
    value: {
      key: string
      value: unknown
      timestamp: number
    }
  }
}

const DB_NAME = 'marine-invoice-cache'
const DB_VERSION = 1

// Limits to prevent excessive storage usage
const LIMITS = {
  requests: 500,
  customers: 1000,
  vessels: 500,
  invoices: 500,
}

// Database instance singleton
let dbInstance: IDBPDatabase<CacheDB> | null = null

/**
 * Initialize and open the IndexedDB database
 */
async function getDB(): Promise<IDBPDatabase<CacheDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<CacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Requests store
      if (!db.objectStoreNames.contains('requests')) {
        const requestStore = db.createObjectStore('requests', { keyPath: 'id' })
        requestStore.createIndex('by-customer', 'customerId')
        requestStore.createIndex('by-status', 'status')
        requestStore.createIndex('by-timestamp', '_timestamp')
        requestStore.createIndex('by-sync-status', '_syncStatus')
      }

      // Customers store
      if (!db.objectStoreNames.contains('customers')) {
        const customerStore = db.createObjectStore('customers', { keyPath: 'id' })
        customerStore.createIndex('by-timestamp', '_timestamp')
        customerStore.createIndex('by-sync-status', '_syncStatus')
      }

      // Vessels store
      if (!db.objectStoreNames.contains('vessels')) {
        const vesselStore = db.createObjectStore('vessels', { keyPath: 'id' })
        vesselStore.createIndex('by-customer', 'customerId')
        vesselStore.createIndex('by-timestamp', '_timestamp')
        vesselStore.createIndex('by-sync-status', '_syncStatus')
      }

      // Invoices store
      if (!db.objectStoreNames.contains('invoices')) {
        const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' })
        invoiceStore.createIndex('by-customer', 'customerId')
        invoiceStore.createIndex('by-status', 'status')
        invoiceStore.createIndex('by-timestamp', '_timestamp')
        invoiceStore.createIndex('by-sync-status', '_syncStatus')
      }

      // Metadata store for cache info
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

// Generic CRUD operations
type StoreName = 'requests' | 'customers' | 'vessels' | 'invoices'
type CachedItem = CachedRequest | CachedCustomer | CachedVessel | CachedInvoice

/**
 * Get a single item by ID
 */
export async function getItem<T extends CachedItem>(
  store: StoreName,
  id: string
): Promise<T | undefined> {
  const db = await getDB()
  return db.get(store, id) as Promise<T | undefined>
}

/**
 * Get all items from a store
 */
export async function getAllItems<T extends CachedItem>(
  store: StoreName
): Promise<T[]> {
  const db = await getDB()
  return db.getAll(store) as Promise<T[]>
}

/**
 * Put (insert or update) an item
 */
export async function putItem<T extends CachedItem>(
  store: StoreName,
  item: Omit<T, '_timestamp' | '_syncStatus'>
): Promise<void> {
  const db = await getDB()

  const cachedItem = {
    ...item,
    _timestamp: Date.now(),
    _syncStatus: 'synced' as const,
  } as T

  await db.put(store, cachedItem as any)

  // Enforce storage limits
  await enforceLimit(store)
}

/**
 * Put multiple items in bulk (more efficient than individual puts)
 */
export async function bulkPutItems<T extends CachedItem>(
  store: StoreName,
  items: Omit<T, '_timestamp' | '_syncStatus'>[]
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(store, 'readwrite')

  const timestamp = Date.now()
  const promises = items.map(item => {
    const cachedItem = {
      ...item,
      _timestamp: timestamp,
      _syncStatus: 'synced' as const,
    } as T
    return tx.store.put(cachedItem as any)
  })

  await Promise.all([...promises, tx.done])

  // Enforce storage limits
  await enforceLimit(store)
}

/**
 * Delete an item by ID
 */
export async function deleteItem(store: StoreName, id: string): Promise<void> {
  const db = await getDB()
  await db.delete(store, id)
}

/**
 * Clear all items from a store
 */
export async function clearStore(store: StoreName): Promise<void> {
  const db = await getDB()
  await db.clear(store)
}

/**
 * Clear all stores (complete cache reset)
 */
export async function clearAllStores(): Promise<void> {
  const db = await getDB()
  const stores: StoreName[] = ['requests', 'customers', 'vessels', 'invoices']

  await Promise.all(stores.map(store => db.clear(store)))
  await db.clear('metadata')
}

/**
 * Enforce item count limits by removing oldest entries
 */
async function enforceLimit(store: StoreName): Promise<void> {
  const db = await getDB()
  const limit = LIMITS[store]

  const count = await db.count(store)
  if (count <= limit) return

  // Get items sorted by timestamp (oldest first)
  const items = await db.getAllFromIndex(store, 'by-timestamp')
  const toDelete = items.slice(0, count - limit)

  const tx = db.transaction(store, 'readwrite')
  await Promise.all([
    ...toDelete.map(item => tx.store.delete((item as any).id)),
    tx.done,
  ])
}

// Query operations with filters

export interface RequestFilters {
  customerId?: string
  status?: CachedRequest['status']
  fromDate?: string
  toDate?: string
  syncStatus?: CachedRequest['_syncStatus']
}

/**
 * Query requests with optional filters
 */
export async function queryRequests(
  filters: RequestFilters = {}
): Promise<CachedRequest[]> {
  const db = await getDB()
  let items: CachedRequest[]

  // Use index if single filter provided
  if (filters.customerId && Object.keys(filters).length === 1) {
    items = await db.getAllFromIndex('requests', 'by-customer', filters.customerId)
  } else if (filters.status && Object.keys(filters).length === 1) {
    items = await db.getAllFromIndex('requests', 'by-status', filters.status)
  } else if (filters.syncStatus && Object.keys(filters).length === 1) {
    items = await db.getAllFromIndex('requests', 'by-sync-status', filters.syncStatus)
  } else {
    // Multiple filters - get all and filter in memory
    items = await db.getAll('requests')
  }

  // Apply additional filters
  return items.filter(item => {
    if (filters.customerId && item.customerId !== filters.customerId) return false
    if (filters.status && item.status !== filters.status) return false
    if (filters.syncStatus && item._syncStatus !== filters.syncStatus) return false
    if (filters.fromDate && item.createdAt < filters.fromDate) return false
    if (filters.toDate && item.createdAt > filters.toDate) return false
    return true
  })
}

export interface InvoiceFilters {
  customerId?: string
  status?: CachedInvoice['status']
  fromDate?: string
  toDate?: string
  syncStatus?: CachedInvoice['_syncStatus']
}

/**
 * Query invoices with optional filters
 */
export async function queryInvoices(
  filters: InvoiceFilters = {}
): Promise<CachedInvoice[]> {
  const db = await getDB()
  let items: CachedInvoice[]

  if (filters.customerId && Object.keys(filters).length === 1) {
    items = await db.getAllFromIndex('invoices', 'by-customer', filters.customerId)
  } else if (filters.status && Object.keys(filters).length === 1) {
    items = await db.getAllFromIndex('invoices', 'by-status', filters.status)
  } else if (filters.syncStatus && Object.keys(filters).length === 1) {
    items = await db.getAllFromIndex('invoices', 'by-sync-status', filters.syncStatus)
  } else {
    items = await db.getAll('invoices')
  }

  return items.filter(item => {
    if (filters.customerId && item.customerId !== filters.customerId) return false
    if (filters.status && item.status !== filters.status) return false
    if (filters.syncStatus && item._syncStatus !== filters.syncStatus) return false
    if (filters.fromDate && item.issueDate < filters.fromDate) return false
    if (filters.toDate && item.issueDate > filters.toDate) return false
    return true
  })
}

/**
 * Query vessels by customer
 */
export async function queryVesselsByCustomer(
  customerId: string
): Promise<CachedVessel[]> {
  const db = await getDB()
  return db.getAllFromIndex('vessels', 'by-customer', customerId)
}

/**
 * Get items with pending sync status
 */
export async function getPendingItems(store: StoreName): Promise<CachedItem[]> {
  const db = await getDB()
  return db.getAllFromIndex(store, 'by-sync-status', 'pending')
}

/**
 * Update sync status for an item
 */
export async function updateSyncStatus(
  store: StoreName,
  id: string,
  status: 'synced' | 'pending' | 'conflict'
): Promise<void> {
  const db = await getDB()
  const item = await db.get(store, id)

  if (!item) return

  await db.put(store, {
    ...item,
    _syncStatus: status,
    _timestamp: Date.now(),
  })
}

// Metadata operations

/**
 * Store metadata (last sync time, etc.)
 */
export async function setMetadata(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('metadata', {
    key,
    value,
    timestamp: Date.now(),
  })
}

/**
 * Get metadata value
 */
export async function getMetadata<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  const result = await db.get('metadata', key)
  return result?.value as T | undefined
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  const db = await getDB()

  const [requestCount, customerCount, vesselCount, invoiceCount] = await Promise.all([
    db.count('requests'),
    db.count('customers'),
    db.count('vessels'),
    db.count('invoices'),
  ])

  const [pendingRequests, pendingCustomers, pendingVessels, pendingInvoices] =
    await Promise.all([
      db.getAllFromIndex('requests', 'by-sync-status', 'pending'),
      db.getAllFromIndex('customers', 'by-sync-status', 'pending'),
      db.getAllFromIndex('vessels', 'by-sync-status', 'pending'),
      db.getAllFromIndex('invoices', 'by-sync-status', 'pending'),
    ])

  const lastSync = await getMetadata<number>('lastSyncTime')

  return {
    counts: {
      requests: requestCount,
      customers: customerCount,
      vessels: vesselCount,
      invoices: invoiceCount,
      total: requestCount + customerCount + vesselCount + invoiceCount,
    },
    limits: LIMITS,
    pending: {
      requests: pendingRequests.length,
      customers: pendingCustomers.length,
      vessels: pendingVessels.length,
      invoices: pendingInvoices.length,
      total:
        pendingRequests.length +
        pendingCustomers.length +
        pendingVessels.length +
        pendingInvoices.length,
    },
    lastSync: lastSync ? new Date(lastSync) : null,
  }
}

/**
 * Prune old entries (>30 days)
 */
export async function pruneOldEntries(): Promise<number> {
  const db = await getDB()
  const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
  const stores: StoreName[] = ['requests', 'customers', 'vessels', 'invoices']

  let totalDeleted = 0

  for (const storeName of stores) {
    const items = await db.getAllFromIndex(storeName, 'by-timestamp')
    const toDelete = items.filter(item => item._timestamp < cutoffTime)

    if (toDelete.length > 0) {
      const tx = db.transaction(storeName, 'readwrite')
      await Promise.all([
        ...toDelete.map(item => tx.store.delete((item as any).id)),
        tx.done,
      ])
      totalDeleted += toDelete.length
    }
  }

  return totalDeleted
}

/**
 * Request persistent storage permission
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false
  }

  const isPersisted = await navigator.storage.persisted()
  if (isPersisted) return true

  return await navigator.storage.persist()
}

/**
 * Estimate storage usage
 */
export async function estimateStorageUsage(): Promise<{
  usage: number
  quota: number
  percentage: number
}> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, percentage: 0 }
  }

  const estimate = await navigator.storage.estimate()
  const usage = estimate.usage || 0
  const quota = estimate.quota || 0
  const percentage = quota > 0 ? (usage / quota) * 100 : 0

  return { usage, quota, percentage }
}
