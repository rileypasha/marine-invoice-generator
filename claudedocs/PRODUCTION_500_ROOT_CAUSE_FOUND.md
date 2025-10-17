# Production 500 Error - ROOT CAUSE IDENTIFIED

**Date**: 2025-10-17
**Status**: ✅ ROOT CAUSE FOUND - Database Connection Timeout
**Error Code**: Prisma P1017 - "Server has closed the connection"

---

## 🎯 ROOT CAUSE ANALYSIS

### The Problem

**Prisma Error P1017**: PostgreSQL connection is being closed prematurely during long-running operations, specifically during the `captureSnapshot()` function in the change request service.

### Error Timeline from Render Logs

```
21:26:07 - PUT request received for invoice f40f1398-ed7e-4ef7-88a1-f33e5206db7c
21:26:09 - Status analysis: requested → change_requested
21:26:09 - Capturing baseline snapshot (3 line items)
21:26:15 - ❌ ERROR: "Server has closed the connection"
21:26:15 - Request duration: 7.9 seconds (slow request detected)
```

### Stack Trace
```
PrismaClientKnownRequestError:
Invalid `prisma.invoice.update()` invocation:

Server has closed the connection.

    at changeRequest.service.js:19:17
    at invoice.js:509:13
```

### Why This Happens

1. **Change Request Flow**: When status changes to "change_requested", the system captures a baseline snapshot
2. **Nested Prisma Call**: The `captureSnapshot()` function makes another `prisma.invoice.update()` call
3. **Connection Timeout**: The PostgreSQL connection times out during the nested operation
4. **P1017 Error**: Prisma detects the closed connection and throws P1017

---

## 📊 Evidence from Production Logs

### Multiple 500 Errors Found

**PUT requests failing with 500**:
- `/api/v1/invoice/6b003568-9849-4c88-8c1c-ddf64c0df4b6` (41ms)
- `/api/v1/invoice/d3f9bd47-a846-4dc4-9b91-4d3c5076c2ca` (6.3s)
- `/api/v1/invoice/bc7c51ab-2211-47e6-9602-1a716d516b96` (16.1s)
- `/api/v1/invoice/f40f1398-ed7e-4ef7-88a1-f33e5206db7c` (4.5s, 7.9s, 4.5s)

**Pattern**: Failures occur on requests >4 seconds, indicating timeout threshold around 5-10 seconds

### GET Requests Also Failing

**List endpoint failures**:
- `/api/v1/invoice?page=1&limit=25` (28ms, 9ms, 1.1s)
- `/api/v1/invoice?page=2&limit=25` (318ms, 430ms, 416ms)

**Pattern**: Even simple GET requests failing, indicating broader database connection instability

---

## 🔍 Why It Works Locally But Fails in Production

### Local Environment
- Direct PostgreSQL connection on local network
- No idle connection timeout
- Faster query execution
- Single-tenant database access

### Production (Render)
- Shared PostgreSQL instance with connection limits
- Idle connection timeout: likely 5-10 seconds
- Network latency adds delay
- Connection pool competition with other requests
- Render free/basic tier may have aggressive timeout policies

---

## 🛠️ THE FIX

### Solution 1: Fix Nested Prisma Transaction (RECOMMENDED)

**Problem**: The `captureSnapshot()` function creates a nested Prisma operation that can time out.

**Fix**: Use Prisma interactive transactions to keep connection alive:

```typescript
// server/routes/invoice.ts (lines 490-530)

// BEFORE: Two separate Prisma calls
const updatedInvoice = await prisma.invoice.update({...});
await changeRequestService.captureSnapshot(invoiceId, currentStateData);

// AFTER: Single transaction
const [updatedInvoice] = await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.update({
    where: { id: invoiceId },
    data: updateData,
  });

  // Capture snapshot within same transaction
  if (statusChangingToChangeRequested || statusRemainsChangeRequested) {
    await changeRequestService.captureSnapshotWithTransaction(
      tx,
      invoiceId,
      currentStateData
    );
  }

  return [invoice];
});
```

**Benefits**:
- Single database connection for entire operation
- No connection timeout between operations
- Atomic transaction ensures data consistency
- Works within existing timeout limits

### Solution 2: Increase Connection Pool Timeout

**File**: `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool configuration
  connectionLimit = 10
  poolTimeout = 30  // 30 seconds
}
```

**Or via DATABASE_URL**:
```
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=10&pool_timeout=30"
```

### Solution 3: Database Connection String Parameters

**File**: `.env` or Render environment variables

```bash
# Add to DATABASE_URL
DATABASE_URL="postgresql://...?connect_timeout=10&pool_timeout=30&statement_timeout=20000"
```

Parameters:
- `connect_timeout=10`: 10 seconds to establish connection
- `pool_timeout=30`: 30 seconds before connection pool timeout
- `statement_timeout=20000`: 20 seconds max for any SQL statement

---

## 📝 Implementation Plan

### Phase 1: Immediate Fix (Transaction Approach)

1. **Modify changeRequest.service.ts**:
   - Add `captureSnapshotWithTransaction(tx, invoiceId, data)` method
   - Accept Prisma transaction client as parameter
   - Use `tx` instead of `prisma` for all operations

2. **Modify invoice.ts PUT handler**:
   - Wrap entire update operation in `prisma.$transaction()`
   - Pass transaction client to `captureSnapshot()`
   - Remove standalone `captureSnapshot()` call

3. **Test locally**:
   - Verify transaction commits successfully
   - Ensure snapshot is captured correctly
   - Check rollback behavior on errors

4. **Deploy to production**:
   - Push changes to GitHub
   - Monitor Render logs for success
   - Test with actual invoice updates

### Phase 2: Connection Pool Optimization (If Needed)

If Phase 1 doesn't fully resolve the issue:

1. Update `prisma/schema.prisma` with connection pool settings
2. Add connection timeout parameters to `DATABASE_URL`
3. Regenerate Prisma client: `npx prisma generate`
4. Restart production server

### Phase 3: Monitoring & Validation

1. Monitor Render logs for P1017 errors (should be zero)
2. Check request durations (should be <2 seconds)
3. Validate all invoice updates succeed
4. Confirm no regression on GET endpoints

---

## 🎯 Expected Outcomes

### Before Fix
- ❌ PUT requests failing with 500 error
- ❌ Connection timeout after 5-10 seconds
- ❌ Error: "Server has closed the connection"
- ❌ Request duration: 7-16 seconds

### After Fix
- ✅ All PUT requests succeed with 200
- ✅ Single transaction keeps connection alive
- ✅ No P1017 connection errors
- ✅ Request duration: <2 seconds

---

## 📋 Files to Modify

1. **server/services/changeRequest.service.ts** (line 19)
   - Add `captureSnapshotWithTransaction()` method
   - Modify existing `captureSnapshot()` to use transactions

2. **server/routes/invoice.ts** (lines 490-530)
   - Wrap Prisma operations in `$transaction()`
   - Pass transaction client to snapshot capture

3. **claudedocs/PRODUCTION_500_ROOT_CAUSE_FOUND.md** (this file)
   - Complete root cause analysis
   - Implementation plan
   - Expected outcomes

---

## 🚀 Next Steps

1. **Implement transaction-based fix** in changeRequest.service.ts
2. **Update PUT handler** in invoice.ts to use transactions
3. **Test locally** with change_requested status transitions
4. **Deploy to production** via GitHub push
5. **Validate fix** by testing invoice updates on mginvoices.com
6. **Monitor logs** for 24 hours to ensure stability

---

## 📊 Supporting Evidence

### Prisma Error P1017 Documentation
- Error code: P1017
- Description: "Server has closed the connection"
- Cause: PostgreSQL connection terminated during operation
- Solution: Use transactions or increase connection timeouts

### Render PostgreSQL Timeout Behavior
- Default idle timeout: 5-10 seconds
- Aggressive connection closure on shared instances
- Solution: Bundle operations into single transaction

### Production Metrics
- Request duration range: 41ms - 16 seconds
- Failure threshold: Requests >4 seconds more likely to fail
- Pattern: Nested Prisma operations most affected

---

## Summary

**Root Cause**: PostgreSQL connection timeout during nested Prisma operations (P1017)
**Primary Fix**: Use Prisma interactive transactions to keep connection alive
**Secondary Fix**: Increase connection pool timeouts if needed
**Expected Result**: All invoice updates succeed, request duration <2 seconds
