# Root Cause Analysis: Invoice System 500 Errors

## INVESTIGATION STATUS: Phase 1 - Evidence Collection

### CRITICAL FINDINGS

#### 🔍 **Problem 1: Server 500 Errors on Invoice Operations**

**Evidence from analysis files:**
- User `test@marinegroupbw.com` with session ID `f1d69663-63cb-475f-9625-6655dfd56f73`
- GET `/api/invoices/user` returns 500 Internal Server Error
- POST `/api/v2/invoice/save` returns 500 with foreign key constraint violations

**Root Cause Identified:**
From `production-500-error-analysis.js`:
- Auth middleware in `invoiceV2.js` hardcodes `userId: "test-user-1"`
- Database has user with ID `f1d69663-63cb-475f-9625-6655dfd56f73`
- Foreign key constraint violations occur when trying to save with wrong userId

**Specific Issue Location:**
- File: `server/routes/invoiceV2.js`
- Lines: 16-21 in `requireAuthOrTestUser` middleware
- Problem: Hardcoded userId instead of actual database ID

#### 🔍 **Problem 2: Missing Invoices After Sign-in**

**Evidence Pattern:**
```
✅ SERVER SESSION VALID: {id: 'f1d69663-63cb-475f-9625-6655dfd56f73', email: 'test@marinegroupbw.com', …}
🔄 Syncing invoices from server for: test@marinegroupbw.com
GET https://mginvoices.com/api/invoices/user 500 (Internal Server Error)
❌ Failed to sync from server: 500
🔍 getSavedItems: Found 0 total invoices in localStorage
⚠️ No invoices showing for user: test@marinegroupbw.com
```

**Analysis:**
- Server session is valid with correct user ID
- However, server API endpoints are failing with 500 errors
- Client falls back to localStorage but finds 0 items
- User sees empty invoice list despite having saved invoices

#### 🔍 **Problem 3: Baseline Logic Issues**

**Evidence Pattern:**
```
🎯 CORRECT FIX: Establish baseline AFTER invoice loads, not before
🔧 PHASE 2 FIX: Skipping initial markAsSaved - will be called after invoice load
🔧 PHASE 3 BASELINE: Setting baseline for new invoice
🔍 PHASE 1 BASELINE: State marked as saved … Baseline hash: 982717477
```

**Issue:**
- Baseline established before invoice fully loads
- Causes false dirty state detection
- Results in incorrect "unsaved changes" prompts

### DEPLOYMENT CONTEXT

This repository appears to be:
- Client-side code that connects to remote server `mginvoices.com`
- Contains analysis/debugging scripts pointing to server issues
- Uses environment variable `DATABASE_URL` suggesting local development setup
- Server endpoints are deployed remotely but experiencing the identified FK constraint issues

### IMMEDIATE ACTION REQUIRED

**Server-Side Fix (Remote deployment):**
The critical fix is in the remote server codebase:
```javascript
// In server/routes/invoiceV2.js, lines 16-21
// WRONG:
req.user = {
  id: "test-user-1",  // This causes FK constraint violations
  email: "test@marinegroupbw.com"
}

// CORRECT:
req.user = {
  id: "f1d69663-63cb-475f-9625-6655dfd56f73",  // Actual database user ID
  email: "test@marinegroupbw.com"
}
```

**Client-Side Hardening:**
While the server fix resolves the root cause, we need client-side resilience:
1. Graceful fallback when server 500s
2. Preserve localStorage when server fails
3. Clear user messaging about server issues
4. Defer baseline establishment until post-load

### NEXT STEPS

1. **Phase 1**: Locate client-side invoice management code in this repository
2. **Phase 2**: Implement graceful 500 error handling
3. **Phase 3**: Fix baseline establishment timing
4. **Phase 4**: Test and validate fixes
5. **Phase 5**: Document server-side fixes needed for deployment

### BLOCKING QUESTIONS

- Is the server code in a separate repository?
- How do we deploy server-side fixes to mginvoices.com?
- Are there any client-side workarounds for the 500 errors we can implement immediately?

## EVIDENCE FILES ANALYZED

- `debug-user-invoices-500.js` - Detailed investigation of user/invoice mismatch
- `production-500-error-analysis.js` - Root cause analysis with specific line numbers
- `package.json` - Application structure and deployment scripts
- `.env` - Configuration pointing to both local and remote setups
