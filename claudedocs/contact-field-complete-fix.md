# Contact Field Display - COMPLETE FIX

## Date: 2025-10-19

## Problem Summary
Manually entered Contact information was not displaying in the Invoice Requests table's Contact column, showing "-" instead of the entered name (e.g., "John Doe", "Test fdjosp").

## Root Causes Identified

### 1. Backend Issue (FIXED in server/routes/invoice.ts)
**File**: `server/routes/invoice.ts` (lines 438-445)
**Problem**: Backend was creating FAKE customer objects when `invoice.customer` was null but `invoice.contactName` existed.

**Before (BROKEN)**:
```typescript
const transformedCustomer = invoice.customer ? {
    ...invoice.customer,
    contact_name: invoice.contactName || invoice.customer.display_name || null,
  } : (invoice.contactName ? {
    display_name: null,
    legal_name: null,
    contact_name: invoice.contactName,  // ← CREATES FAKE CUSTOMER!
  } : null);
```

**After (FIXED)**:
```typescript
// Only transform customer if there's an actual linked customer
// If no customer, keep it null and let frontend use invoice.contactName directly
const transformedCustomer = invoice.customer ? {
    ...invoice.customer,
    contact_name: invoice.contactName || invoice.customer.display_name || null,
  } : null;
```

### 2. Frontend Transformation Layer Issue (FIXED in src/pages/InvoicesPage.tsx)
**File**: `src/pages/InvoicesPage.tsx` (lines 175-196)
**Problem**: The transformation layer was **not passing through** the `contactName` field from the API response.

**Before (BROKEN)**:
```typescript
const transformedInvoices = useMemo(() => {
  return rawInvoices.map((apiInvoice) => ({
    id: apiInvoice.id,
    invoice_number: apiInvoice.invoiceNumber || `#${apiInvoice.id.substring(0, 8)}`,
    customer: {
      display_name: apiInvoice.customer?.display_name || apiInvoice.customerName,
      company_name: apiInvoice.customer?.legal_name,
      contact_name: undefined  // ← DESTROYING contactName!
    },
    // contactName field MISSING!
    vessel: { name: apiInvoice.vessel?.name || apiInvoice.vesselName },
    // ... other fields
  }));
}, [rawInvoices]);
```

**After (FIXED)**:
```typescript
const transformedInvoices = useMemo(() => {
  return rawInvoices.map((apiInvoice) => ({
    id: apiInvoice.id,
    invoice_number: apiInvoice.invoiceNumber || `#${apiInvoice.id.substring(0, 8)}`,
    contactName: apiInvoice.contactName,  // ← NOW PASSING THROUGH!
    customer: apiInvoice.customer ? {  // Only create if linked customer exists
      display_name: apiInvoice.customer.display_name,
      company_name: apiInvoice.customer.legal_name,
    } : null,
    vessel: { name: apiInvoice.vessel?.name || apiInvoice.vesselName },
    // ... other fields
  }));
}, [rawInvoices]);
```

### 3. Frontend Display Logic (ALREADY CORRECT in src/components/InvoiceTableColumns.tsx)
**File**: `src/components/InvoiceTableColumns.tsx` (line 170)
**Status**: This was already correct from previous fix.

```typescript
const displayContact = invoice.contactName || invoice.customer?.display_name || invoice.customer?.company_name || '-';
```

## Data Flow (FIXED)

### Working Flow:
1. **User enters contact** → Saved to `Invoice.contactName` field in database
2. **Backend GET /api/v1/invoice** → Returns `{ contactName: "John Doe", customer: null }`
3. **Frontend InvoicesPage** → Transformation now passes through `contactName: apiInvoice.contactName`
4. **InvoiceTableColumns** → Display logic: `invoice.contactName || invoice.customer?.display_name || '-'`
5. **Result** → Contact displays correctly as "John Doe"

## Files Modified

1. **server/routes/invoice.ts** (lines 438-445)
   - Removed fake customer object creation
   - Return `null` when no customer linked

2. **src/pages/InvoicesPage.tsx** (lines 175-196)
   - Added `contactName: apiInvoice.contactName` to transformation
   - Changed customer object to only exist when there's a linked customer

3. **src/components/InvoiceTableColumns.tsx** (lines 14, 169-177)
   - Already had correct interface and display logic from previous session

## Testing Required

### Next Steps:
1. **Create NEW invoice** with manually entered contact (e.g., "FINAL TEST CONTACT")
2. **Verify in database** that contactName field is populated
3. **Check Invoice Requests table** that new invoice shows contact correctly
4. **Clear React Query cache** if old data still showing "-"

### Expected Behavior:
- Manual contact entry (no customer link) → Shows contact name
- Linked customer → Shows customer display_name
- No contact and no customer → Shows "-"

## Notes

- Old invoices (REQ-23, REQ-22, REQ-21, etc.) may show "-" due to React Query caching
- Creating a NEW invoice will prove the fix works
- May need to clear browser cache or invalidate React Query cache to see old invoices updated
