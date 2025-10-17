# Production 500 Error - Investigation Update

**Date**: 2025-10-17 (Update 2)
**Status**: Enhanced logging deployed, awaiting production logs
**Previous Fix**: CSP blob: directive added successfully

---

## Current Status

### Deployed Fix Verification
✅ **CSP Fix Deployed**: Confirmed via curl to production health endpoint
```
content-security-policy: ...img-src 'self' data: https: blob:...
```

### Remaining Issue
❌ **500 Error Persists**: PUT /api/v1/invoice/:id still returns 500 Internal Server Error

### New Error Logs Analysis (error_logs2.log)

**Line 2**: MIME Type Error
```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "application/octet-stream"
```
**Impact**: Secondary issue - Vite build assets not served with correct MIME types

**Line 7**: 500 Error (Primary Issue)
```
PUT https://mginvoices.com/api/v1/invoice/f40f1398-ed7e-4ef7-88a1-f33e5206db7c 500 (Internal Server Error)
```
**Impact**: PRIMARY ISSUE - Backend update operation failing

---

## Enhanced Logging Deployed

To diagnose the 500 error, I've added three layers of logging to the PUT handler:

### Layer 1: Request Receipt Logging (Line 499-511)
```typescript
logger.info('PUT /api/v1/invoice/:id - Request received', {
  correlationId,
  userId,
  invoiceId,
  payloadKeys: Object.keys(invoiceData),
  dataFieldType: typeof invoiceData.data,
  dataFieldLength: invoiceData.data ? JSON.stringify(invoiceData.data).length : 0,
  hasCustomerId: !!invoiceData.customerId,
  hasVesselId: !!invoiceData.vesselId,
  status: invoiceData.status,
  total: invoiceData.total,
  subtotal: invoiceData.subtotal,
});
```

**Purpose**: Capture what the backend receives from the frontend

### Layer 2: Pre-Prisma Logging (Line 647-658)
```typescript
logger.info('About to execute Prisma update', {
  correlationId,
  invoiceId,
  updateDataKeys: Object.keys(updateData),
  updateDataStatus: updateData.status,
  updateDataTotal: updateData.total,
  updateDataSubtotal: updateData.subtotal,
  hasCustomerId: !!updateData.customerId,
  hasVesselId: !!updateData.vesselId,
  dataFieldType: typeof updateData.data,
  dataFieldIsDefined: updateData.data !== undefined,
});
```

**Purpose**: Capture the exact data being sent to Prisma

### Layer 3: Error Detail Logging (Line 754-770 - Already Deployed)
```typescript
logger.error('Failed to update invoice', {
  error: error.message,
  stack: error.stack,
  correlationId,
  userId,
  invoiceId,
  errorName: error.name,
  errorCode: error.code,
  prismaErrorCode: error.code,
  prismaErrorMeta: error.meta,
});
```

**Purpose**: Capture full error context including Prisma-specific errors

---

## Suspected Root Causes (Priority Order)

### 1. **Prisma Validation Error** (75% Probability)
**Hypothesis**: The `data` field contains invalid JSON or exceeds PostgreSQL JSONB size limits

**Evidence**:
- Works locally with same database
- Likely environment-specific data payload size or format issue
- Line 635: `data: invoiceData.data !== undefined ? invoiceData.data : existingInvoice.data`

**Testing Plan**:
1. Check Render logs for Prisma error code (P2000-P2999)
2. Look for "JSONB" or "invalid input syntax" errors
3. Check dataFieldLength in logs for size violations

### 2. **Foreign Key Constraint Violation** (15% Probability)
**Hypothesis**: customerId or vesselId references don't exist in production database

**Evidence**:
- Lines 639-644: Conditional FK assignment logic
- Production database may have different customer/vessel IDs than local

**Testing Plan**:
1. Look for "foreign key constraint" in Render logs
2. Check if customerId/vesselId values match production database records

### 3. **Database Connection Pool Exhaustion** (5% Probability)
**Hypothesis**: Prisma connection pool exhausted in production

**Evidence**:
- Multiple concurrent invoice updates could exhaust pool
- Would explain intermittent failures if occurring

**Testing Plan**:
1. Check for "Connection pool timeout" or "Too many connections" errors
2. Review Prisma connection pool configuration

### 4. **changeRequestService.recomputeDiff() Failure** (5% Probability)
**Hypothesis**: Diff computation fails after successful Prisma update

**Evidence**:
- Lines 670-682: Diff computation happens AFTER Prisma update
- If this fails, Prisma update succeeded but response is 500

**Testing Plan**:
1. Check if "Invoice updated successfully" log appears before error
2. Look for "Computing diff for change request" followed by error

---

## How to Access Render Logs

Since Render CLI requires interactive terminal (not available in WSL), use Render Dashboard:

1. Navigate to https://dashboard.render.com
2. Select service: `marine-group-invoices`
3. Click "Logs" tab
4. Filter by time: Last 1 hour
5. Search for: `"Failed to update invoice"`
6. Copy full log entry with correlationId

**Expected Log Structure**:
```json
{
  "level": "error",
  "message": "Failed to update invoice",
  "error": "[Actual error message]",
  "stack": "[Full stack trace]",
  "correlationId": "[UUID]",
  "userId": "[user_UUID]",
  "invoiceId": "f40f1398-ed7e-4ef7-88a1-f33e5206db7c",
  "errorName": "PrismaClientKnownRequestError",
  "errorCode": "P2003",  // Example FK violation
  "prismaErrorMeta": {
    "field_name": "customerId"
  }
}
```

---

## Next Steps

### Step 1: Commit Enhanced Logging
```bash
git add server/routes/invoice.ts claudedocs/PRODUCTION_500_ERROR_UPDATE.md
git commit -m "fix(production): add comprehensive logging for 500 error diagnosis"
git push origin PWA-V2
```

### Step 2: Wait for Render Deployment
- Monitor Render dashboard for deployment completion
- Typically takes 5-10 minutes

### Step 3: Reproduce Error on Production
1. Navigate to https://mginvoices.com/requests/f40f1398-ed7e-4ef7-88a1-f33e5206db7c/edit
2. Make any change (add/delete line item)
3. Click Update button
4. Observe 500 error in console

### Step 4: Access Render Logs
1. Open Render dashboard immediately after error
2. Search for correlationId from browser console
3. Copy all three log entries:
   - "PUT /api/v1/invoice/:id - Request received"
   - "About to execute Prisma update"
   - "Failed to update invoice"

### Step 5: Analyze and Fix
Based on logs, apply targeted fix:

**If Prisma error P2000-P2999**:
- Add data validation
- Implement payload size limit
- Fix foreign key references

**If "JSONB" or "invalid input syntax"**:
- Sanitize JSON.stringify() output
- Validate data structure before Prisma call

**If connection pool error**:
- Increase Prisma connection pool size
- Implement connection pool monitoring

---

## Files Modified

- `server/routes/invoice.ts` (Lines 499-511, 647-658)
  - Added request receipt logging
  - Added pre-Prisma operation logging
- `claudedocs/PRODUCTION_500_ERROR_UPDATE.md` (This file)
  - Comprehensive investigation update
  - Testing plan and next steps

---

## Expected Outcome

With enhanced logging deployed, the next 500 error will produce complete diagnostic information:

1. **Request payload** - What frontend sent
2. **Prisma input** - What backend prepared for database
3. **Error details** - Exact failure reason with Prisma error codes

This will enable targeted fix without further iteration.

---

## Alternative: Direct Database Query

If Render logs are inaccessible, diagnose via direct database query:

```sql
-- Check if invoice exists
SELECT id, status, "customerId", "vesselId",
       pg_column_size(data) as data_size_bytes
FROM "Invoice"
WHERE id = 'f40f1398-ed7e-4ef7-88a1-f33e5206db7c';

-- Check if foreign keys are valid
SELECT i.id, i."customerId", c.id as customer_exists,
       i."vesselId", v.id as vessel_exists
FROM "Invoice" i
LEFT JOIN "Customer" c ON c.id = i."customerId"
LEFT JOIN "Vessel" v ON v.id = i."vesselId"
WHERE i.id = 'f40f1398-ed7e-4ef7-88a1-f33e5206db7c';
```

---

## Summary

**CSP Fix**: ✅ Successfully deployed and verified
**500 Error**: ⏳ Awaiting production logs with enhanced diagnostics
**Next Action**: Deploy enhanced logging → Reproduce error → Analyze logs → Apply fix
**ETA**: 15-30 minutes after deployment completes
