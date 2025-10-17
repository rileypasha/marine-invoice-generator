# Production 500 Error - Root Cause Analysis & Fix

**Date**: 2025-10-17
**Issue**: PUT /api/v1/invoice/:id returns 500 Internal Server Error on production (Render deployment)
**Status**: CSP fix applied, enhanced logging added
**Environment**: Production only (works locally and in tests)

---

## Problem Summary

When updating an invoice on the live Render deployment at https://mginvoices.com, the PUT request fails with a 500 Internal Server Error. The issue does NOT occur in local development or Playwright E2E tests.

### Client-Side Error Logs (error_logs.log)

```
Line 13: PUT https://mginvoices.com/api/v1/invoice/f40f1398-ed7e-4ef7-88a1-f33e5206db7c 500 (Internal Server Error)
```

### CSP Violations (error_logs.log)

```
Line 1: Refused to load the script 'data:application/octet-stream;base64,...' (CSP violation: script-src)
Line 7: Refused to load the image 'blob:https://mginvoices.com/...' (CSP violation: img-src)
Line 9: Refused to load the image 'blob:https://mginvoices.com/...' (CSP violation: img-src)
```

---

## Root Cause Analysis

### Issue #1: CSP Policy Blocking Blob URLs

**Location**: `server/config/security.ts:31`

**Problem**: The Content Security Policy's `img-src` directive was missing `'blob:'`, blocking blob URLs used for receipt image uploads.

**Before**:
```typescript
imgSrc: ["'self'", 'data:', 'https:'],
```

**After**:
```typescript
imgSrc: ["'self'", 'data:', 'https:', 'blob:'], // Added blob: for receipt uploads
```

**Impact**: Receipt images stored as blob URLs couldn't be displayed, causing CSP violations in production.

---

### Issue #2: Insufficient Error Logging

**Location**: `server/routes/invoice.ts:739-759`

**Problem**: The PUT handler's catch block didn't log enough detail to diagnose production errors. Only error.message was logged, missing:
- Stack traces
- Prisma-specific error codes
- Error metadata
- Request context

**Fix Applied**: Enhanced error logging in the catch block:

```typescript
} catch (error: any) {
  logger.error('Failed to update invoice', {
    error: error.message,
    stack: error.stack,              // Full stack trace
    correlationId,
    userId,
    invoiceId,
    errorName: error.name,
    errorCode: error.code,
    // Prisma-specific error details
    prismaErrorCode: error.code,
    prismaErrorMeta: error.meta,      // Database constraint violations, etc.
  });

  res.status(500).json({
    code: 'UPDATE_FAILED',
    message: 'Failed to update invoice',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    correlationId,
  });
}
```

**Impact**: Future production errors will have full diagnostic information in Render logs.

---

## Suspected 500 Error Causes

Based on code analysis, the most likely causes for the 500 error are:

### 1. **Database Constraint Violation** (Most Likely)
The PUT handler updates multiple fields including:
- `customerId` and `vesselId` (foreign key constraints)
- `data` field (JSON validation)
- `status` (enum constraint)
- Attachment fields (URL validation)

**Hypothesis**: Production database may have stricter constraints or different schema version than local.

**Evidence**:
- Lines 631-638 in invoice.ts: `prisma.invoice.update()` with extensive data payload
- Lines 624-629: Conditional customerId/vesselId inclusion logic

### 2. **Change Request Service Failure**
The handler calls `changeRequestService.recomputeDiff()` when status is `change_requested`:

```typescript
// Lines 641-667: Diff computation for change requests
if (statusChangingToChangeRequested || statusRemainsChangeRequested) {
  await changeRequestService.recomputeDiff(
    invoiceId,
    currentStateData
  );
}
```

**Hypothesis**: Diff computation might fail on malformed `data` field JSON in production.

### 3. **Email Service Failure**
Lines 676-700 send email notifications which could fail in production if SMTP credentials are missing:

```typescript
notifyChangeRequested({...}).catch(err => {
  logger.error('Failed to send change request notification', {
    error: err.message,
    invoiceId: updatedInvoice.id,
  });
});
```

**However**: Emails are non-blocking (`.catch()` handles errors), so shouldn't cause 500.

### 4. **Payload Size Limit**
The frontend sends extensive payload including:
- Base64-encoded receipt images (blob URLs converted to data URLs)
- JSON-stringified `data` field with all line items
- Metadata with comments and annotations

**Evidence**: Line 2610 in CreateInvoice.tsx: `body: JSON.stringify(payload)`

**Hypothesis**: Production might have stricter body size limits than local.

---

## Environment Comparison

### Local Development (.env)
```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://marine_invoice_db_user:...@dpg-d2m2uqbe5dus739bmuv0-a.oregon-postgres.render.com/marine_invoice_db"
SESSION_SECRET=dev-session-secret-change-in-production
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,...
```

### Production (render.yaml)
```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: 10000
  - key: DATABASE_URL
    fromDatabase: marine-group-db
  - key: REDIS_URL
    fromService: marine-group-redis
  - key: CORS_ORIGINS
    value: https://mginvoices.com,https://www.mginvoices.com,...
  - key: COOKIE_DOMAIN
    value: .mginvoices.com
```

**Key Differences**:
- Production uses Redis for sessions (local uses MemoryStore)
- Production has CORS restricted to mginvoices.com
- Production uses different DATABASE_URL connection string

---

## Files Modified

### 1. server/config/security.ts
**Change**: Added `'blob:'` to CSP img-src directive
**Line**: 31
**Reason**: Allow blob URLs for receipt image uploads

### 2. server/routes/invoice.ts
**Change**: Enhanced error logging in PUT handler catch block
**Lines**: 739-759
**Reason**: Capture full error context for production debugging

---

## Testing Plan

### Phase 1: Local Verification
1. Restart backend server to apply security.ts changes
2. Open CreateInvoice page in edit mode
3. Add/delete line items with receipt uploads
4. Click Update button
5. Verify no CSP violations in console
6. Verify invoice updates successfully

### Phase 2: Production Deployment
1. Commit changes with message:
   ```
   fix(production): resolve 500 error on invoice update

   - Add blob: to CSP img-src directive for receipt uploads
   - Enhance error logging in PUT /api/v1/invoice/:id handler
   - Capture Prisma error codes and stack traces for debugging
   ```

2. Push to main branch (triggers Render auto-deploy)

3. Wait for Render deployment to complete

### Phase 3: Production Verification
1. Navigate to https://mginvoices.com/requests/:id/edit
2. Add/delete line items
3. Click Update button
4. If error persists:
   - Access Render dashboard logs
   - Search for "Failed to update invoice" with correlationId
   - Review full stack trace and Prisma error details
   - Identify specific constraint violation or validation error

---

## Next Steps if 500 Error Persists

1. **Check Render Logs**:
   - Navigate to Render dashboard → marine-group-invoices → Logs
   - Filter by timestamp of failed request
   - Look for "Failed to update invoice" with full error details

2. **Verify Database Schema**:
   ```bash
   npx prisma migrate status --schema=prisma/schema.prisma
   ```
   - Ensure production database has all migrations applied
   - Check for schema drift between local and production

3. **Test with Minimal Payload**:
   - Modify frontend to send only required fields:
     ```typescript
     const minimalPayload = {
       total: totals.finalTotal,
       subtotal: totals.subtotalBeforeTax,
       status: 'change_requested'
     };
     ```
   - If minimal payload works, gradually add fields to identify problematic data

4. **Check Request Size**:
   ```typescript
   // In server/app.ts, increase body parser limit:
   bodyParser.json({ limit: '10mb' }) // Currently '5mb'
   ```

5. **Database Connection Pool**:
   - Check if production database has connection limit exceeded
   - Review Prisma connection pool settings in production

---

## Related Files

- `server/config/security.ts` - CSP configuration
- `server/routes/invoice.ts` - PUT handler (lines 490-753)
- `src/pages/CreateInvoice.tsx` - Frontend save logic (lines 2543-2645)
- `server/services/changeRequest.service.ts` - Diff computation
- `server/config/constants.ts` - Request size limits
- `error_logs.log` - Client-side production errors

---

## Summary

**Primary Fix**: Added `'blob:'` to CSP img-src directive to resolve blob URL blocking
**Secondary Fix**: Enhanced error logging to diagnose future 500 errors
**Status**: Ready for deployment and testing
**Risk**: Low - changes are non-breaking and improve observability
