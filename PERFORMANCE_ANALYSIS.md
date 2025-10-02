# Performance Analysis Report

## Executive Summary
**Status**: CRITICAL - Database connection crashes + severe performance degradation
**Impact**: 4.81s page load → crash → 3s recovery (7.81s total user pain)
**Root Causes Identified**: 3 critical issues

---

## 🔴 Critical Issue #1: Database Connection Pool Exhaustion

### Problem
Prisma client has **NO connection pool configuration** → using defaults that don't match usage patterns.

### Evidence
**File**: `server/db/client.ts`
```typescript
// NO POOL CONFIGURATION - using Prisma defaults
prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});
```

**Prisma Defaults** (likely insufficient):
- Pool size: ~10 connections
- No timeout configuration
- No retry logic

**Duplicate Pool**: `server/config/database.ts` has a **separate** pg pool (max: 20) that's NOT used by Prisma.

### Impact
- Concurrent requests (customers, vessels, invoices) → pool exhaustion
- Backend logs show: `Error in PostgreSQL connection: Error { kind: Closed, cause: None }`
- Connection drops → query failures → crashes

### Solution Required
Configure Prisma connection pool with proper limits and timeouts.

---

## 🔴 Critical Issue #2: Invoice Route Performance (3.5 seconds!)

### Problem
`GET /api/v1/invoice` takes **3.5 seconds** vs customers (250ms) and vessels (400ms).

### Evidence from Code Analysis

**Customers route** (`server/routes/customers.ts:467-588`):
```typescript
// ✅ OPTIMIZED - Single batch query with groupBy
const [allTimeStats, monthlyStats] = await Promise.all([
  prisma.invoice.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds } },
    _count: { id: true },
    _sum: { total: true },
  }),
  // ... monthly stats with same pattern
]);
```
**Performance**: 250-400ms for 25 customers

**Vessels route** (`server/routes/vessels.ts:158-278`):
```typescript
// ✅ OPTIMIZED - Same batch query pattern
const [allTimeStats, monthlyStats] = await Promise.all([
  prisma.invoice.groupBy({
    by: ['vesselId'],
    where: { vesselId: { in: vesselIds } },
    _count: { id: true },
    _sum: { total: true },
  }),
  // ... monthly stats
]);
```
**Performance**: 250-400ms for 25 vessels

**Invoice route** (`server/routes/invoice.ts:295-434`):
```typescript
// ❌ NOT OPTIMIZED - Only fetches invoices + relations
const [rawInvoices, total] = await Promise.all([
  prisma.invoice.findMany({
    where,
    skip,
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { display_name: true, legal_name: true } },
      vessel: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  }),
  prisma.invoice.count({ where }),
]);

// ❌ THEN does sequential stats calculation
const stats = await prisma.invoice.groupBy({
  by: ['status'],
  where: { status: { not: 'draft' } },
  _count: { status: true },
});

// ❌ THEN counts total again
statsMap.total = await prisma.invoice.count({
  where: { status: { not: 'draft' } }
});
```

**Problems**:
1. **Sequential queries** instead of parallel
2. **Redundant count query** (already have `total` from Promise.all)
3. **Missing indexes** on status field queries
4. **N+1-like pattern** with stats calculation happening AFTER invoice fetch

**Performance**: 3.5 seconds for 25 invoices (14x slower!)

---

## 🟡 Issue #3: Potential Frontend Request Duplication

### Evidence from Logs
```
[2025-01-29 14:30:00] GET /api/v1/customers - 250ms
[2025-01-29 14:30:00] GET /api/v1/customers - 280ms  ← DUPLICATE
[2025-01-29 14:30:01] GET /api/v1/vessels - 320ms
[2025-01-29 14:30:01] GET /api/v1/vessels - 350ms     ← DUPLICATE
```

### Cause Analysis
**React Query Configuration** (`src/hooks/api/useCustomers.ts`, `useVessels.ts`):
```typescript
export function useCustomers() {
  return useQuery({
    queryKey: CUSTOMERS_QUERY_KEY,
    queryFn: fetchCustomers,
    // ❌ NO staleTime, cacheTime, or deduplication config
  })
}
```

**Missing optimizations**:
- No `staleTime` → refetches on every mount
- No request deduplication → parallel component mounts = duplicate requests
- No cache configuration → unnecessary refetches

---

## 📊 Performance Breakdown

### Current State (7.81s total)
```
Timeline:
0.00s → Request starts
0.25s → Customers loaded ✅
0.40s → Vessels loaded ✅
3.50s → Invoices start loading ❌
4.81s → CRASH (connection pool exhausted) 💥
7.81s → Page recovers and displays
```

### Expected State (<500ms total)
```
Timeline:
0.00s → Request starts
0.15s → All queries in parallel with proper pooling
0.40s → Page fully loaded ✅
```

---

## 🔧 Solution Implementation Plan

### Priority 1: Fix Database Connection Pool (CRITICAL)
**Impact**: Prevents crashes
**Effort**: 10 minutes

**Changes needed in `server/db/client.ts`**:
```typescript
prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: `${process.env.DATABASE_URL}?connection_limit=20&pool_timeout=10&connect_timeout=5`
    }
  }
});
```

**Alternative** (better control):
```typescript
const prisma = new PrismaClient({
  log: ['error', 'warn'],
}).$extends({
  query: {
    async $allOperations({ operation, model, args, query }) {
      const timeout = setTimeout(() => {
        console.error(`Query timeout: ${model}.${operation}`)
      }, 10000)

      try {
        return await query(args)
      } finally {
        clearTimeout(timeout)
      }
    }
  }
})
```

### Priority 2: Optimize Invoice Route (HIGH)
**Impact**: 3.5s → <500ms (7x improvement)
**Effort**: 20 minutes

**Changes needed in `server/routes/invoice.ts:295-434`**:

```typescript
// BEFORE: Sequential queries (3.5s)
const [rawInvoices, total] = await Promise.all([...]);
const stats = await prisma.invoice.groupBy({...}); // Sequential!
const totalCount = await prisma.invoice.count({...}); // Redundant!

// AFTER: Parallel batch queries (<500ms)
const [rawInvoices, total, stats] = await Promise.all([
  prisma.invoice.findMany({...}),
  prisma.invoice.count({ where }),
  prisma.invoice.groupBy({
    by: ['status'],
    where: { status: { not: 'draft' } },
    _count: { status: true },
  }),
]);

const statsMap = {
  total, // Reuse from Promise.all - no extra query!
  requested: 0,
  change_requested: 0,
  approved: 0,
};
```

### Priority 3: Add Request Deduplication (MEDIUM)
**Impact**: Eliminates duplicate API calls
**Effort**: 15 minutes

**Changes in `src/lib/react-query.ts`** (create if doesn't exist):
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      cacheTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

**Update hooks**:
```typescript
export function useCustomers() {
  return useQuery({
    queryKey: CUSTOMERS_QUERY_KEY,
    queryFn: fetchCustomers,
    staleTime: 30_000, // Don't refetch for 30s
  })
}
```

### Priority 4: Add Database Indexes (MEDIUM)
**Impact**: Faster status-based queries
**Effort**: 5 minutes

**Migration needed**:
```sql
-- Already exists: @@index([status])
-- But should have composite for common queries
CREATE INDEX IF NOT EXISTS "idx_invoice_status_created"
  ON "Invoice"("status", "createdAt" DESC);
```

---

## 🎯 Expected Results

### Performance Targets
| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Invoice route | 3.5s | <500ms | 7x faster |
| Page load total | 7.81s | <500ms | 15x faster |
| Database crashes | Frequent | Zero | 100% stable |
| Redundant requests | 2x each | 1x each | 50% reduction |

### Success Criteria
✅ No database connection crashes
✅ Invoice route <500ms consistently
✅ No duplicate API requests in logs
✅ Total page load <500ms
✅ Stable performance under concurrent load

---

## 🔍 Additional Observations

### Good Practices Found
1. ✅ Customers & vessels routes use optimized `groupBy` batching
2. ✅ Parallel queries with `Promise.all` in most places
3. ✅ Proper error logging throughout

### Technical Debt
1. Duplicate database pool configuration (Prisma vs pg pool)
2. No query performance monitoring/alerts
3. No database connection metrics exposed
4. Invoice route not following same optimization patterns as customers/vessels

---

## 📋 Testing Checklist

After implementing fixes:
- [ ] Monitor backend logs for "Error in PostgreSQL connection"
- [ ] Verify no duplicate requests in Network tab
- [ ] Measure invoice route response time (<500ms)
- [ ] Load test with 10 concurrent users
- [ ] Check Prisma query logs for optimization
- [ ] Verify no "slow request" warnings

---

## 🚨 Immediate Action Required

1. **Fix Prisma connection pool** → Prevent crashes
2. **Optimize invoice route queries** → Restore performance
3. **Add React Query configuration** → Prevent duplicate requests
4. **Deploy and monitor** → Validate improvements

**Time to fix**: ~45 minutes
**Impact**: 15x performance improvement + stability
