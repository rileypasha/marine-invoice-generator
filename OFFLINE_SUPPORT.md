# Offline Support & Advanced Caching Documentation

## Overview

This implementation provides comprehensive offline support for the Marine Invoice application with:
- **IndexedDB caching** for persistent data storage (up to 50MB)
- **Request queueing** with exponential backoff retry
- **Optimistic UI updates** for instant feedback
- **Conflict resolution** when local and server data diverge
- **Service Worker** with network-first strategy and cache fallback
- **Network status monitoring** with connection quality detection

## Architecture

### 1. IndexedDB Cache Layer (`src/db/cache.ts`)

**Purpose**: Persistent storage for API data with CRUD operations

**Schema**:
```typescript
{
  requests: CachedRequest[]      // Last 500 requests
  customers: CachedCustomer[]    // Last 1000 customers
  vessels: CachedVessel[]        // Last 500 vessels
  invoices: CachedInvoice[]      // Last 500 invoices
  metadata: { key: string, value: any, timestamp: number }[]
}
```

**Key Features**:
- Automatic storage limits to prevent quota issues
- Query filtering by customer, status, date range
- Sync status tracking (`synced` | `pending` | `conflict`)
- Automatic pruning of entries >30 days old
- Persistent storage permission request (iOS/Safari support)

**Example Usage**:
```typescript
import { putItem, queryRequests, getCacheStats } from '@/db/cache'

// Store a request
await putItem('requests', {
  id: '123',
  customerId: 'abc',
  status: 'draft',
  // ... other fields
})

// Query filtered requests
const draftRequests = await queryRequests({ status: 'draft' })

// Get cache statistics
const stats = await getCacheStats()
console.log(`${stats.counts.total} items cached, ${stats.pending.total} pending sync`)
```

### 2. Offline Queue (`src/db/queue.ts`)

**Purpose**: Queue failed mutations for retry when connection is restored

**Features**:
- Exponential backoff retry (1s → 2s → 4s → ... max 60s)
- Max 5 retry attempts before marking as failed
- Background sync registration (where supported)
- Conflict detection and storage for manual resolution
- Auto-retry on network reconnect

**Queue Item Structure**:
```typescript
{
  id: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: any
  timestamp: number
  retries: number
  status: 'pending' | 'retrying' | 'failed' | 'conflict'
}
```

**Example Usage**:
```typescript
import { enqueueRequest, processQueue, getQueueStats } from '@/db/queue'

// Queue a failed request
await enqueueRequest('POST', '/api/requests', { name: 'New Request' })

// Process queue (retry pending)
const result = await processQueue()
console.log(`${result.succeeded} succeeded, ${result.failed} failed`)

// Get queue status
const stats = await getQueueStats()
console.log(`${stats.pending} pending, ${stats.conflicts} conflicts`)
```

### 3. TanStack Query Offline Plugin (`src/utils/offline-plugin.ts`)

**Purpose**: Integrate offline support with React Query

**Configuration**:
```typescript
import { getQueryClient } from '@/utils/offline-plugin'

const queryClient = getQueryClient({
  persistQueries: true,
  maxAge: 30 * 60 * 1000, // 30 minutes
  onOnline: () => console.log('Back online!'),
  onOffline: () => console.log('Gone offline!'),
})
```

**Query Client Features**:
- Network-first with cache fallback (`networkMode: 'offlineFirst'`)
- Automatic cache persistence to IndexedDB
- Cache hydration on app start
- Optimistic mutation support
- Network-aware retry logic

**Cache Hydration**:
```typescript
import { hydrateFromCache } from '@/utils/offline-plugin'

// On app startup
const stats = await hydrateFromCache(queryClient)
console.log(`Hydrated ${stats.requests} requests, ${stats.customers} customers`)
```

### 4. Network Status Hook (`src/hooks/useNetworkStatus.ts`)

**Purpose**: Monitor network status and manage offline queue

**Hook API**:
```typescript
const {
  online,              // boolean: online status
  effectiveType,       // '2g' | '3g' | '4g' | '5g'
  downlink,           // number: Mbps
  rtt,                // number: round trip time (ms)
  isPending,          // boolean: has pending changes
  pendingCount,       // number: count of pending items
  conflictCount,      // number: count of conflicts
  retryPending,       // function: manually retry queue
  isRetrying,         // boolean: currently retrying
} = useNetworkStatus()
```

**Connection Quality Hook**:
```typescript
const { quality, description } = useConnectionQuality()
// quality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline'
// description: Human-readable connection status
```

**Bandwidth Estimate**:
```typescript
const { downlink, estimate } = useBandwidthEstimate()
// estimate: 'fast' | 'moderate' | 'slow' | 'unknown'
```

### 5. Offline Banner Component (`src/components/OfflineBanner.tsx`)

**Purpose**: Visual indicator of offline status and pending changes

**Components**:
- `<OfflineBanner />` - Full banner with sync status and retry button
- `<OfflineBannerCompact />` - Minimal space version
- `<OfflineBadge />` - Toolbar badge indicator

**Features**:
- Auto-shows when offline or has pending changes
- Manual retry button
- Dismissible (auto-reappears when offline)
- Smooth slide animations
- Success confirmation after sync

**Example Usage**:
```tsx
import { OfflineBanner, OfflineBadge } from '@/components/OfflineBanner'

function App() {
  return (
    <>
      <OfflineBanner />
      <nav>
        {/* ... */}
        <OfflineBadge />
      </nav>
    </>
  )
}
```

### 6. Optimistic Mutations (`src/hooks/api/useOptimisticMutations.ts`)

**Purpose**: Instant UI updates with rollback on error

**Available Hooks**:
```typescript
// Create request with optimistic update
const createRequest = useCreateRequest()
await createRequest.mutateAsync({ name: 'New Request' })

// Update request status
const updateStatus = useUpdateRequestStatus()
await updateStatus.mutateAsync({ id: '123', status: 'approved' })

// Delete request
const deleteRequest = useDeleteRequest()
await deleteRequest.mutateAsync('123')

// Similarly for customers and vessels
const createCustomer = useCreateCustomer()
const updateCustomer = useUpdateCustomer()
const createVessel = useCreateVessel()
```

**Custom Optimistic Mutation**:
```typescript
import { useOptimisticMutation } from '@/hooks/api/useOptimisticMutations'

const mutation = useOptimisticMutation({
  mutationFn: async (data) => {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  queryKey: ['/api/endpoint'],
  method: 'POST',
  url: '/api/endpoint',
  optimisticUpdate: (oldData, newItem) => {
    return oldData ? [newItem, ...oldData] : [newItem]
  },
})
```

### 7. Conflict Resolution (`src/components/ConflictResolution.tsx`)

**Purpose**: UI for resolving data conflicts

**Components**:
- `<ConflictResolutionModal />` - Full resolution UI
- `<ConflictBadge />` - Toolbar indicator

**Resolution Options**:
1. **Keep Local** - Use your changes, overwrite server
2. **Keep Server** - Discard your changes, use server version
3. **Merge Both** - Combine local and server (simple merge strategy)

**Example Usage**:
```tsx
import { ConflictResolutionModal } from '@/components/ConflictResolution'

function App() {
  return (
    <>
      {/* ... */}
      <ConflictResolutionModal />
    </>
  )
}
```

### 8. Print Offline Queue (`src/utils/print-offline.ts`)

**Purpose**: Queue print requests when offline

**API**:
```typescript
import { printWithOfflineSupport } from '@/utils/print-offline'

const result = await printWithOfflineSupport(
  'invoice',
  'invoice-123',
  { includeNotes: true },
  cachedInvoiceData, // For preview
  printFunction
)

if (result.queued) {
  console.log('Will print when online:', result.requestId)
}
```

**Auto-Processing**:
```typescript
import { setupAutoPrint } from '@/utils/print-offline'

const cleanup = setupAutoPrint(printFunction, 60000) // Check every minute

// Later: cleanup()
```

## Service Worker (`public/sw.js`)

**Caching Strategy**:
- **API Routes**: Network-first with cache fallback
- **Static Assets**: Cache-first with network fallback

**Background Sync**:
- Automatically syncs queue when online
- Registered with tag: `'queue-sync'`

**Cache Names**:
- `marine-invoice-v1` - Static assets
- `marine-invoice-runtime-v1` - Dynamic API responses

## Integration Guide

### 1. Initial Setup (Already Done)

The main app has been configured with offline support:

```tsx
// src/main.tsx
import { registerServiceWorker } from './utils/service-worker-registration'
import { requestPersistentStorage, pruneOldEntries } from './db/cache'
import { setupAutoRetry } from './db/queue'

async function initializeOfflineSupport() {
  await requestPersistentStorage()
  await pruneOldEntries()
  setupAutoRetry(30000)
  await registerServiceWorker()
}

initializeOfflineSupport()
```

```tsx
// src/App.tsx
import { OfflineBanner } from './components/OfflineBanner'
import { hydrateFromCache } from './utils/offline-plugin'

function App() {
  useEffect(() => {
    hydrateFromCache(queryClient)
  }, [])

  return (
    <>
      <OfflineBanner />
      {/* ... */}
    </>
  )
}
```

### 2. Using Optimistic Mutations

Replace standard mutations with optimistic versions:

```tsx
// Before
const mutation = useMutation({
  mutationFn: async (data) => {
    const res = await fetch('/api/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return res.json()
  },
})

// After
import { useCreateRequest } from '@/hooks/api/useOptimisticMutations'

const createRequest = useCreateRequest()
```

### 3. Adding Offline Support to Custom Queries

```tsx
import { useQuery } from '@tanstack/react-query'
import { getAllItems } from '@/db/cache'

function useRequests() {
  return useQuery({
    queryKey: ['/api/requests'],
    queryFn: async () => {
      // Try network first
      try {
        const response = await fetch('/api/requests')
        return response.json()
      } catch (error) {
        // Fallback to cache if offline
        if (!navigator.onLine) {
          return getAllItems('requests')
        }
        throw error
      }
    },
  })
}
```

### 4. Monitoring Cache & Queue

```tsx
import { getCacheStats } from '@/db/cache'
import { getQueueStats } from '@/db/queue'

function DebugPanel() {
  const [cacheStats, setCacheStats] = useState(null)
  const [queueStats, setQueueStats] = useState(null)

  useEffect(() => {
    const update = async () => {
      setCacheStats(await getCacheStats())
      setQueueStats(await getQueueStats())
    }

    update()
    const interval = setInterval(update, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h3>Cache: {cacheStats?.counts.total} items</h3>
      <h3>Queue: {queueStats?.pending} pending</h3>
    </div>
  )
}
```

## Performance Considerations

### Storage Limits

- **IndexedDB**: ~50MB typical limit (browser-dependent)
- **Service Worker Cache**: No hard limit, but cleared under pressure
- **Configured Limits**:
  - Requests: 500 items
  - Customers: 1000 items
  - Vessels: 500 items
  - Invoices: 500 items

### Automatic Cleanup

- **Old Entries**: Auto-pruned after 30 days
- **Completed Queue Items**: Cleaned after 1 hour
- **Stale Cache**: Invalidated after 30 minutes

### Network Efficiency

- **Deduplication**: Parallel requests to same endpoint are deduped
- **Debouncing**: Network status changes debounced by 500ms
- **Batching**: Queue processed in batches, not individually

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |
| Network Info API | ✅ | ❌ | ❌ | ✅ |
| Persistent Storage | ✅ | ✅ | ⚠️ | ✅ |

⚠️ = Requires user interaction to grant

## Testing Offline Mode

### Chrome DevTools

1. Open DevTools → Network tab
2. Select "Offline" from throttling dropdown
3. Reload page → data loads from cache
4. Make changes → queued for sync
5. Go back online → queue automatically processes

### Manual Testing

```typescript
// Force offline
window.dispatchEvent(new Event('offline'))

// Force online
window.dispatchEvent(new Event('online'))

// Check queue
import { getQueueStats } from '@/db/queue'
console.log(await getQueueStats())

// Manually process queue
import { processQueue } from '@/db/queue'
console.log(await processQueue())
```

## Troubleshooting

### Cache Not Persisting

```typescript
// Check persistent storage
const isPersisted = await navigator.storage?.persisted()
console.log('Persistent:', isPersisted)

// Request permission
const granted = await navigator.storage?.persist()
console.log('Granted:', granted)
```

### Queue Not Processing

```typescript
// Check queue status
import { getPendingRequests } from '@/db/queue'
const pending = await getPendingRequests()
console.log('Pending:', pending)

// Manually retry
import { retryRequest } from '@/db/queue'
await retryRequest(pending[0].id)
```

### High Memory Usage

```typescript
// Check storage estimate
const estimate = await navigator.storage?.estimate()
console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`)

// Clear old entries
import { pruneOldEntries } from '@/db/cache'
const pruned = await pruneOldEntries()
console.log(`Pruned ${pruned} entries`)

// Clear cache completely (emergency)
import { clearAllStores } from '@/db/cache'
await clearAllStores()
```

## Future Enhancements

### Potential Improvements

1. **Delta Sync**: Only sync changed fields, not entire objects
2. **Conflict Auto-Resolution**: ML-based conflict resolution
3. **Selective Sync**: Let users choose what to sync
4. **Compression**: Compress cache data to save space
5. **Encryption**: Encrypt sensitive cached data
6. **P2P Sync**: Share data between devices via WebRTC

### Advanced Patterns

```typescript
// Custom sync strategy
import { setupAutoRetry } from '@/db/queue'

const cleanup = setupAutoRetry(async () => {
  // Custom processing logic
  const pending = await getPendingRequests()

  // Prioritize by timestamp
  pending.sort((a, b) => a.timestamp - b.timestamp)

  for (const request of pending) {
    // Custom retry logic
  }
}, 30000)
```

## Support & Debugging

### Enable Debug Logs

```typescript
// In main.tsx or App.tsx
if (import.meta.env.DEV) {
  localStorage.setItem('debug', 'offline:*')
}
```

### Monitor IndexedDB

Use browser DevTools → Application → IndexedDB to inspect:
- `marine-invoice-cache` database
- `marine-invoice-queue` database
- `marine-invoice-print-queue` database

### Service Worker Status

DevTools → Application → Service Workers shows:
- Registration status
- Update available
- Background sync status
- Cache contents
