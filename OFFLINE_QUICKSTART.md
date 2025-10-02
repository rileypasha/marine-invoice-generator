# Offline Support - Quick Start Guide

## 🚀 Getting Started (5 minutes)

The offline support is **already integrated** into your app. No additional setup required!

### What You Get Out of the Box

✅ **Automatic offline caching** - App works without internet after first load
✅ **Smart request queueing** - Changes sync automatically when online
✅ **Visual indicators** - Offline banner shows connection status
✅ **Optimistic updates** - Instant UI feedback, even offline
✅ **Conflict resolution** - UI to handle data conflicts
✅ **Print queue** - Queue print jobs when offline

---

## 📱 User Experience

### 1. First Load (Online)
```
→ App loads normally
→ Data cached in IndexedDB
→ Service worker registered
→ "Ready to work offline" in console
```

### 2. Going Offline
```
→ Offline banner appears at top
→ Shows "You are offline" message
→ App continues to work normally
→ Data loads from cache
```

### 3. Making Changes Offline
```
→ Click "Create Request" or edit data
→ UI updates instantly ⚡
→ Request queued in background
→ "Syncing..." indicator shown
→ Banner shows "1 change pending"
```

### 4. Coming Back Online
```
→ Banner updates: "1 change pending"
→ "Sync Now" button appears
→ Auto-retry starts (or click button)
→ Success: "All changes synced" ✅
→ Banner auto-dismisses
```

### 5. Handling Conflicts
```
→ Modal appears: "Data Conflict Detected"
→ Shows your changes vs. server changes
→ Choose resolution:
   • Keep My Changes
   • Use Server Version
   • Merge Both
→ Conflict resolved, queue continues
```

---

## 💻 Developer Usage

### Quick Integration Examples

#### 1. Use Optimistic Mutations (Recommended)

```typescript
import { useCreateRequest } from '@/hooks/api/useOptimisticMutations'

function CreateRequestForm() {
  const createRequest = useCreateRequest()

  const handleSubmit = async (data) => {
    // UI updates instantly, queued if offline
    await createRequest.mutateAsync(data)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
      <button disabled={createRequest.isPending}>
        {createRequest.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  )
}
```

#### 2. Monitor Network Status

```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

function MyComponent() {
  const { online, isPending, pendingCount } = useNetworkStatus()

  return (
    <div>
      {!online && <p>You are offline</p>}
      {isPending && <p>{pendingCount} changes pending sync</p>}
    </div>
  )
}
```

#### 3. Access Cache Directly

```typescript
import { queryRequests, getCacheStats } from '@/db/cache'

// Get cached requests
const cachedRequests = await queryRequests({ status: 'draft' })

// Check cache size
const stats = await getCacheStats()
console.log(`${stats.counts.total} items, ${stats.pending.total} pending`)
```

#### 4. Manual Queue Management

```typescript
import { processQueue, getQueueStats } from '@/db/queue'

// Check queue
const stats = await getQueueStats()
console.log(`${stats.pending} requests pending`)

// Manually process
const result = await processQueue()
console.log(`${result.succeeded} synced, ${result.failed} failed`)
```

---

## 🎨 UI Components

### Offline Banner (Already Added)

Shows automatically when offline or has pending changes:

```tsx
import { OfflineBanner } from '@/components/OfflineBanner'

// Already in App.tsx - no action needed
<OfflineBanner />
```

### Conflict Resolution Modal

Auto-shows when conflicts detected:

```tsx
import { ConflictResolutionModal } from '@/components/ConflictResolution'

// Add to your app if you want conflict UI
<ConflictResolutionModal />
```

### Offline Badge (Optional)

Compact indicator for toolbar:

```tsx
import { OfflineBadge } from '@/components/OfflineBanner'

<nav>
  {/* ... other nav items ... */}
  <OfflineBadge />
</nav>
```

---

## 🧪 Testing Offline Mode

### Method 1: Chrome DevTools (Easiest)

1. Open DevTools (F12)
2. Go to **Network** tab
3. Select **Offline** from throttling dropdown
4. Refresh page → App loads from cache ✅
5. Make changes → Queued for sync ✅
6. Go back **Online** → Auto-syncs ✅

### Method 2: Airplane Mode

1. Enable airplane mode on your device
2. App continues to work
3. Make changes (queued)
4. Disable airplane mode
5. Changes sync automatically

### Method 3: Service Worker

1. DevTools → **Application** → **Service Workers**
2. Check **Offline** checkbox
3. Test offline functionality
4. Uncheck to go back online

---

## 📊 Monitoring & Debugging

### Check Cache Status

```typescript
import { getCacheStats } from '@/db/cache'

const stats = await getCacheStats()
console.log('Cache stats:', {
  total: stats.counts.total,
  pending: stats.pending.total,
  lastSync: stats.lastSync,
})
```

### Check Queue Status

```typescript
import { getQueueStats } from '@/db/queue'

const stats = await getQueueStats()
console.log('Queue stats:', {
  pending: stats.pending,
  retrying: stats.retrying,
  failed: stats.failed,
  conflicts: stats.conflicts,
})
```

### View in DevTools

**Application Tab**:
- **IndexedDB** → `marine-invoice-cache` → See cached data
- **IndexedDB** → `marine-invoice-queue` → See queued requests
- **Service Workers** → Check registration status
- **Cache Storage** → See cached assets

---

## 🔧 Configuration

### Adjust Cache Limits

Edit `src/db/cache.ts`:

```typescript
const LIMITS = {
  requests: 500,   // Increase if needed
  customers: 1000,
  vessels: 500,
  invoices: 500,
}
```

### Adjust Retry Strategy

Edit `src/db/queue.ts`:

```typescript
const MAX_RETRIES = 5          // Max retry attempts
const INITIAL_BACKOFF = 1000   // 1 second
const MAX_BACKOFF = 60000      // 60 seconds
```

### Adjust Auto-Retry Interval

Edit `src/main.tsx`:

```typescript
setupAutoRetry(30000) // 30 seconds (default)
setupAutoRetry(60000) // Change to 60 seconds
```

---

## 🐛 Common Issues & Solutions

### Issue: Cache Not Persisting

**Solution**: Request persistent storage permission

```typescript
import { requestPersistentStorage } from '@/db/cache'

const granted = await requestPersistentStorage()
if (!granted) {
  console.warn('Persistent storage not granted - cache may be cleared')
}
```

### Issue: Queue Not Auto-Syncing

**Solution**: Check if auto-retry is running

```typescript
// Should be in main.tsx (already added)
import { setupAutoRetry } from '@/db/queue'
setupAutoRetry(30000)
```

### Issue: Too Much Storage Used

**Solution**: Prune old entries

```typescript
import { pruneOldEntries } from '@/db/cache'

const pruned = await pruneOldEntries()
console.log(`Pruned ${pruned} old entries`)
```

### Issue: Service Worker Not Updating

**Solution**: Force update

```typescript
// In DevTools → Application → Service Workers
// Click "Update" or "Unregister" then refresh
```

---

## 📚 Additional Resources

- **Full Documentation**: See `OFFLINE_SUPPORT.md`
- **Implementation Details**: See `OFFLINE_IMPLEMENTATION_SUMMARY.md`
- **API Reference**: Check TypeScript types in source files

---

## ✅ Verification Checklist

Before deploying, verify:

- [ ] App loads offline after first visit
- [ ] Changes queue when offline
- [ ] Changes sync when online
- [ ] Offline banner shows/hides correctly
- [ ] Conflicts resolve properly
- [ ] Service worker registered
- [ ] IndexedDB databases created
- [ ] Cache stays under 50MB

---

## 🎯 Best Practices

### Do's ✅

- Use `useOptimisticMutations` hooks for instant feedback
- Show "Syncing..." indicators during mutations
- Handle offline state gracefully in UI
- Test offline mode regularly
- Monitor cache size in production

### Don'ts ❌

- Don't cache sensitive data (auth tokens, passwords)
- Don't assume network is always available
- Don't block UI while syncing
- Don't ignore conflict resolution
- Don't exceed browser storage quotas

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

1. **Build Production Bundle**
   ```bash
   npm run build
   ```

2. **Verify Service Worker**
   ```bash
   # Check dist/ for sw.js
   ls dist/sw.js
   ```

3. **Test Production Build**
   ```bash
   npm run preview
   # Test offline mode in preview
   ```

4. **Configure Server**
   - Enable CORS for service worker
   - Set `Cache-Control` headers
   - Configure `Service-Worker-Allowed` header

5. **Deploy & Monitor**
   - Deploy to production
   - Monitor error logs
   - Check IndexedDB usage
   - Verify background sync

---

## 💡 Tips & Tricks

### Tip 1: Prefetch Critical Data

```typescript
import { hydrateFromCache } from '@/utils/offline-plugin'

// On app load (already in App.tsx)
useEffect(() => {
  hydrateFromCache(queryClient)
}, [])
```

### Tip 2: Show Offline-Specific UI

```typescript
const { online } = useNetworkStatus()

return (
  <div>
    {online ? (
      <button onClick={syncNow}>Sync Now</button>
    ) : (
      <p>Changes will sync when online</p>
    )}
  </div>
)
```

### Tip 3: Handle Slow Networks

```typescript
const { quality } = useConnectionQuality()

if (quality === 'poor' || quality === 'slow') {
  // Show simplified UI, reduce animations
}
```

### Tip 4: Clear Cache on Logout

```typescript
import { clearAllStores } from '@/db/cache'
import { clearQueue } from '@/db/queue'

async function logout() {
  await clearAllStores()
  await clearQueue()
  // ... rest of logout logic
}
```

---

## 📞 Need Help?

Check the comprehensive documentation:
- `OFFLINE_SUPPORT.md` - Full feature documentation
- `OFFLINE_IMPLEMENTATION_SUMMARY.md` - Technical details
- Source code comments - TypeScript types and inline docs

Happy coding! 🎉
