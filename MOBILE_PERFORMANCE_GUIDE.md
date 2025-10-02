# Mobile Performance Optimization Guide

## Overview

This document outlines the comprehensive mobile performance optimizations implemented for the Marine Group invoice management application. The goal is to achieve **Lighthouse mobile score ≥90** with smooth 60fps performance on mid-tier mobile devices (iPhone SE 2020).

## Performance Budgets

### Bundle Size Targets
- **Initial bundle**: <500KB (gzipped)
- **Per-route chunks**: <150KB (gzipped)
- **Vendor chunks**: <300KB total (gzipped)

### Web Vitals Targets
| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | <2.5s | 2.5s-4.0s | ≥4.0s |
| **FID** (First Input Delay) | <100ms | 100ms-300ms | ≥300ms |
| **CLS** (Cumulative Layout Shift) | <0.1 | 0.1-0.25 | ≥0.25 |
| **FCP** (First Contentful Paint) | <1.8s | 1.8s-3.0s | ≥3.0s |
| **TTI** (Time to Interactive) | <2.5s | 2.5s-5.0s | ≥5.0s |
| **TBT** (Total Blocking Time) | <300ms | 300ms-600ms | ≥600ms |

### Runtime Performance
- **Frame rate**: 60fps (16.67ms per frame)
- **Input latency**: <50ms
- **Scroll performance**: No jank, <16ms per scroll frame
- **Memory usage**: <100MB JavaScript heap

## Implemented Optimizations

### 1. Build Optimizations (vite.config.ts)

#### Manual Code Splitting
- **React Core** (`react-core`): React, ReactDOM, Scheduler (most stable, best caching)
- **Router** (`react-router`): React Router bundle
- **UI Components** (`ui-radix`, `ui-icons`, `ui-motion`): Radix UI, Lucide icons, Framer Motion
- **Data Libraries** (`data-query`, `data-virtual`, `data-table`): TanStack Query, Virtual, Table
- **Route-based chunks**: Automatic splitting by page (`page-invoicespage`, `page-customers`, etc.)
- **Feature-based chunks**: Split by feature directory (`feature-requests`, `feature-vessels`, etc.)

#### Compression
- **Brotli compression**: Better than gzip (~20% smaller)
- **Gzip fallback**: For older browsers
- **Threshold**: 10KB (only compress files >10KB)

#### Tree Shaking
```typescript
treeshake: {
  moduleSideEffects: 'no-external',
  propertyReadSideEffects: false,
  unknownGlobalSideEffects: false,
}
```

#### Asset Optimization
- Images → `assets/images/[name]-[hash][extname]`
- Fonts → `assets/fonts/[name]-[hash][extname]`
- CSS code splitting enabled per route
- Terser minification with 2 passes

### 2. HTML Optimizations (index.html)

#### Critical CSS Inlined
- System font stack (zero load time)
- Loading spinner styles
- Layout stability rules
- Dark mode support
- Reduced motion support

#### Resource Hints
```html
<link rel="preconnect" href="http://127.0.0.1:3001" crossorigin />
<link rel="dns-prefetch" href="http://127.0.0.1:3001" />
<link rel="modulepreload" href="/src/main.tsx" />
```

#### Web Vitals Monitoring
- Inline performance observers for LCP, FID, CLS
- Logged to console in development
- Ready for analytics integration in production

### 3. Performance Monitoring (src/utils/performance-monitoring.ts)

#### Features
- **Web Vitals tracking**: LCP, FID, CLS, FCP, TTFB, TTI, TBT
- **Long Task detection**: Identifies tasks >50ms blocking main thread
- **Frame rate monitoring**: Tracks 60fps performance via requestAnimationFrame
- **Memory monitoring**: JavaScript heap usage tracking
- **Interaction tracking**: Detects slow interactions >100ms
- **Analytics reporting**: Sends data to `/api/analytics/performance` (10% sampling)

#### Usage
```typescript
import { initPerformanceMonitoring, markPerformance, measurePerformance } from './utils/performance-monitoring'

// Initialize (already done in App.tsx)
initPerformanceMonitoring({
  enableLogging: true,
  reportToAnalytics: false,
  samplingRate: 0.1,
})

// Mark custom events
markPerformance('data-fetch-start')
// ... fetch data ...
markPerformance('data-fetch-end')

// Measure duration
measurePerformance('data-fetch', 'data-fetch-start', 'data-fetch-end')
```

### 4. Image Optimization (src/utils/image-optimization.tsx)

#### OptimizedImage Component
```tsx
<OptimizedImage
  src="/images/logo.png"
  alt="Company Logo"
  width={200}
  height={100}
  responsive // Generates 1x, 2x, 3x srcSet
  lazy // Intersection Observer lazy loading
  priority // Disable lazy, preload image
  placeholder="data:image/jpeg;base64,..." // Blur-up effect
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

#### Features
- **Modern formats**: AVIF (best), WebP (good), fallback to original
- **Responsive images**: Automatic srcSet for 1x, 2x, 3x densities
- **Lazy loading**: Intersection Observer with 50px rootMargin
- **Blur-up placeholder**: Base64 thumbnails for smooth loading
- **Layout stability**: Width/height attributes prevent CLS
- **Preloading**: Priority images preloaded via `<link rel="preload">`

### 5. Route Optimizations (src/App.tsx)

#### Code Splitting
All routes lazy loaded with React.lazy:
```typescript
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))
const Customers = lazy(() => import('./pages/Customers'))
const Vessels = lazy(() => import('./pages/Vessels'))
```

#### Prefetching Strategies
1. **On page load** (2s delay): Prefetch critical routes (Invoices, Contacts)
2. **On hover/touchstart**: Prefetch route when user hovers over link
3. **Network-aware**: Skip prefetch on slow 2G connections

```typescript
// Automatic prefetching on link hover
function RoutePrefetcher() {
  useEffect(() => {
    const handleLinkHover = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a')
      if (link?.href.startsWith('/requests')) {
        prefetchRoute(() => import('./pages/InvoicesPage'))
      }
    }
    document.addEventListener('mouseover', handleLinkHover)
  }, [])
}
```

#### Error Boundaries
- **ChunkErrorBoundary**: Handles code splitting failures (prompts reload)
- **RouteErrorBoundary**: Catches route-level errors with fallback UI
- **ErrorBoundary**: Generic error boundary with dev mode details

### 6. React Query Optimizations (src/lib/react-query.ts)

#### Network-Aware Configuration
```typescript
// Detect 2G vs 4G/5G
const networkQuality = getNetworkQuality()

const config = {
  staleTime: networkQuality === 'slow' ? 2 * 60 * 1000 : 30_000,
  gcTime: 10 * 60 * 1000, // Extended cache time
  retry: (failureCount, error) => {
    // Don't retry 4xx errors
    if (error?.status >= 400 && error?.status < 500) return false
    return failureCount < 2
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  networkMode: 'offlineFirst',
}
```

#### Dynamic Adaptation
- Monitors network quality changes
- Adjusts stale time automatically
- Invalidates queries when coming back online
- Skips prefetching on slow networks

### 7. Input Debouncing (src/hooks/useDebounce.ts)

#### Hooks Available
```typescript
// Debounce a value
const debouncedSearch = useDebounce(searchTerm, 300)

// Debounce a callback
const debouncedFilter = useDebouncedCallback((term) => {
  performFilter(term)
}, 300)

// Throttle a callback (max once per interval)
const throttledScroll = useThrottledCallback(() => {
  handleScroll()
}, 100)

// Debounced state
const [search, debouncedSearch, setSearch] = useDebouncedState('', 300)

// Async debounced callback with loading state
const { callback, isLoading } = useDebouncedAsync(async (term) => {
  await searchAPI(term)
}, 300)

// Leading edge debounce (execute immediately, prevent rapid re-clicks)
const handleClick = useLeadingDebounce(() => {
  submitForm()
}, 300)
```

## Performance Testing

### Build Analysis
```bash
npm run build
# Opens dist/stats.html with bundle visualization
```

### Lighthouse Testing
```bash
# Mobile test
lighthouse http://localhost:3000 --preset=perf --view \
  --emulated-form-factor=mobile \
  --throttling.cpuSlowdownMultiplier=4

# Desktop test
lighthouse http://localhost:3000 --preset=perf --view \
  --emulated-form-factor=desktop \
  --throttling.cpuSlowdownMultiplier=1
```

### Performance Monitoring
```typescript
import { logPerformanceReport } from './utils/performance-monitoring'

// Log comprehensive report to console
logPerformanceReport()
```

## Best Practices for Developers

### 1. Component Optimization
```typescript
// ✅ Memoize expensive components
const ExpensiveRow = React.memo(({ data }) => {
  return <div>{/* Complex rendering */}</div>
})

// ✅ Use useMemo for expensive calculations
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value)
}, [data])

// ✅ Use useCallback for event handlers passed to memoized components
const handleClick = useCallback((id: string) => {
  console.log('Clicked:', id)
}, [])
```

### 2. Search/Filter Implementation
```typescript
// ✅ Debounce search input
const [search, debouncedSearch, setSearch] = useDebouncedState('', 300)

// Query only triggers on debounced value
const { data } = useQuery(['search', debouncedSearch], () =>
  searchAPI(debouncedSearch)
)

return <input value={search} onChange={e => setSearch(e.target.value)} />
```

### 3. List Virtualization
For lists >50 items, use TanStack Virtual:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50, // Row height
  overscan: 5, // Render 5 items above/below viewport
})
```

### 4. Image Usage
```typescript
// ✅ Use OptimizedImage for all images
<OptimizedImage
  src="/images/photo.jpg"
  alt="Description"
  width={800}
  height={600}
  lazy // Enable lazy loading
  responsive // Generate srcSet
/>

// ✅ Priority images (above fold)
<OptimizedImage
  src="/images/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority // Disable lazy, preload
/>
```

### 5. Route Data Prefetching
```typescript
import { preloadRouteData } from './lib/react-query'

// In navigation component
<Link
  to="/requests"
  onMouseEnter={() => preloadRouteData('requests')}
  onTouchStart={() => preloadRouteData('requests')}
>
  Requests
</Link>
```

## Monitoring Dashboard

### Key Metrics to Track
1. **Bundle size**: Monitor via `dist/stats.html` after build
2. **Lighthouse scores**: Run weekly, track trends
3. **Real User Monitoring**:
   - Average LCP, FID, CLS
   - 95th percentile load times
   - Long task frequency
   - Slow interaction counts

### Analytics Integration
Performance data is sent to `/api/analytics/performance` with 10% sampling:
```typescript
{
  vitals: { lcp, fid, cls, fcp, ttfb, tti, tbt },
  longTasksCount: number,
  averageFps: number,
  currentHeapSize: number,
  slowInteractionsCount: number,
  timestamp: number
}
```

## Troubleshooting

### Bundle Too Large
1. Check `dist/stats.html` for large dependencies
2. Review manual chunks in `vite.config.ts`
3. Consider lazy loading heavy features
4. Remove unused dependencies

### Slow Page Load
1. Check Network tab for blocking resources
2. Verify code splitting is working (multiple small chunks)
3. Check if prefetching is enabled on slow networks (should be disabled)
4. Review React Query cache settings

### Jank/Dropped Frames
1. Open Performance monitor (`logPerformanceReport()`)
2. Check for long tasks >50ms
3. Profile with React DevTools Profiler
4. Add memoization to expensive components
5. Implement virtualization for long lists

### High Memory Usage
1. Check performance monitor heap size
2. Review component cleanup (useEffect return functions)
3. Check for memory leaks in event listeners
4. Verify React Query garbage collection is working

## Future Improvements

### Potential Enhancements
1. **Service Worker caching**: Cache API responses offline
2. **Intersection Observer for tables**: Only render visible rows
3. **Progressive Web App**: Full offline support, install prompt
4. **Image optimization pipeline**: Automated WebP/AVIF generation at build time
5. **Bundle analysis CI**: Fail builds if bundle exceeds budget
6. **Synthetic monitoring**: Automated Lighthouse tests on every deploy

### Experimental Features to Watch
1. **React Server Components**: Zero-bundle components
2. **Partial Hydration**: Only hydrate interactive parts
3. **Resumability (Qwik)**: Instant TTI
4. **Import Maps**: Better dependency management
5. **Native CSS Nesting**: Smaller CSS bundles

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Performance Scoring](https://web.dev/performance-scoring/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit#optimizing-performance)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [TanStack Query Performance](https://tanstack.com/query/latest/docs/react/guides/performance)
