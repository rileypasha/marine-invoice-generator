/**
 * Service Worker
 *
 * Provides offline support with caching strategies and background sync.
 */

const CACHE_NAME = 'marine-invoice-v2'
const RUNTIME_CACHE = 'marine-invoice-runtime-v2'

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
]

// API routes to cache
const API_ROUTES = [
  '/api/requests',
  '/api/customers',
  '/api/vessels',
  '/api/invoices',
]

/**
 * Install event - cache static assets
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS)
    })
  )

  // Activate immediately
  self.skipWaiting()
})

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => caches.delete(name))
      )
    })
  )

  // Take control of all clients immediately
  self.clients.claim()
})

/**
 * Fetch event - network first with cache fallback
 */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }

  // API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request))
    return
  }

  // Static assets - cache first with network fallback
  event.respondWith(cacheFirstWithNetwork(request))
})

/**
 * Network first with cache fallback strategy
 */
async function networkFirstWithCache(request) {
  try {
    const networkResponse = await fetch(request)

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    // Network failed - try cache
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      // Add custom header to indicate stale data
      const headers = new Headers(cachedResponse.headers)
      headers.set('X-Cache-Status', 'stale')

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      })
    }

    // No cache - return error
    return new Response(
      JSON.stringify({
        error: 'Network request failed and no cache available',
        offline: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * Cache first with network fallback strategy
 */
async function cacheFirstWithNetwork(request) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    // Return offline page if available
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    })
  }
}

/**
 * Background sync event
 */
self.addEventListener('sync', event => {
  if (event.tag === 'queue-sync') {
    event.waitUntil(syncQueue())
  }
})

/**
 * Sync offline queue
 */
async function syncQueue() {
  try {
    // Open IndexedDB and process queue
    const db = await openIndexedDB()
    const queue = await getQueueFromDB(db)

    for (const request of queue) {
      try {
        await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        })

        // Remove from queue on success
        await removeFromQueueDB(db, request.id)
      } catch (error) {
        console.error('Background sync failed for request:', request.id, error)
      }
    }
  } catch (error) {
    console.error('Background sync error:', error)
  }
}

/**
 * Message event - handle commands from main thread
 */
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches())
  }
})

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys()
  return Promise.all(cacheNames.map(name => caches.delete(name)))
}

/**
 * Helper: Open IndexedDB
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('marine-invoice-queue', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Helper: Get queue from IndexedDB
 */
function getQueueFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readonly')
    const store = transaction.objectStore('queue')
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Helper: Remove from queue
 */
function removeFromQueueDB(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readwrite')
    const store = transaction.objectStore('queue')
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
