# Visual Diff Rendering Integration

## Overview

Frontend visual diff rendering system for invoice requests with "change_requested" status has been implemented. The system provides inline change visualization with color-coded indicators for added, removed, and modified values.

## Components Created

### 1. **ChangedValue Component** (`src/components/invoices/ChangedValue.tsx`)

Lightweight inline component that wraps field displays to show visual diffs.

**Features:**
- O(1) lookup using diff index (Map-based)
- Three diff states:
  - **Added**: Green bold with "+" prefix (`text-green-600`)
  - **Removed**: Red bold strikethrough with "−" prefix (`text-red-600`)
  - **Changed**: Shows old value (red strike) → new value (green)
- Only renders diffs when `status === 'change_requested'` AND diff exists
- Two render modes: `inline` (default) and `block` for multi-line content
- Fully accessible with ARIA labels and semantic HTML

**API:**
```tsx
<ChangedValue
  path="/customerName"          // JSON Pointer path
  value={invoice.customerName}  // Current value
  diff={diffIndex}              // Diff index (Map)
  status={invoice.status}       // Invoice status
  renderMode="inline"           // Optional: 'inline' | 'block'
/>
```

**Helper Functions:**
- `buildDiffIndex(patch)` - Convert PatchOperation[] to Map for O(1) lookup
- `getDelta(index, path)` - Get diff operation for a specific path
- `hasChangeRequestedStatus(status)` - Check if status indicates changes

### 2. **LineItemsDiff Component** (`src/components/invoices/LineItemsDiff.tsx`)

Handles array-level diffs with row-level highlighting for line items.

**Features:**
- Row-level background colors:
  - Added: `bg-green-50` with `border-green-500`
  - Removed: `bg-red-50` with `border-red-500` and opacity
  - Modified: `bg-yellow-50` with `border-yellow-500`
- Works with ChangedValue for field-level diffs within rows
- Generic type support for any item type

**Helper Functions:**
- `getLineItemOp(diff, index)` - Get operation for specific line item
- `hasLineItemChanges(diff)` - Check if any line items have changes
- `hasLineItemFieldChange(diff, index, field)` - Check specific field change

## Integration into InvoiceView.tsx

### Updates Made:

1. **Interface Updates:**
   - Added `'change_requested'` to status union type
   - Added `diff?: PatchOperation[]` to Invoice interface

2. **Imports:**
```tsx
import { buildDiffIndex, ChangedValue, DiffIndex } from '../components/invoices/ChangedValue';
import { getLineItemOp } from '../components/invoices/LineItemsDiff';
import { cn } from '../lib/utils';
```

3. **Diff Index Building:**
```tsx
const diffIndex: DiffIndex = useMemo(() => {
  return buildDiffIndex(invoice?.diff);
}, [invoice?.diff]);
```

4. **Status Badge Enhancement:**
```tsx
<Badge
  variant="outline"
  className={cn(
    'capitalize',
    invoice.status === 'change_requested' && 'border-amber-500 text-amber-700 bg-amber-50'
  )}
>
  {invoice.status === 'change_requested' ? 'Changes Requested' : invoice.status}
  {invoice.status === 'change_requested' && invoice.diff?.length > 0 && (
    <span className="ml-1 text-xs">({invoice.diff.length})</span>
  )}
</Badge>
```

5. **Field-Level Wrapping:**

All key fields now wrapped with `<ChangedValue>`:
- Title (`/title`)
- Customer info (`/customerName`, `/customerEmail`, `/customerPhone`)
- Vessel info (`/vesselName`, `/vesselWeight`, `/vesselBeam`)
- Financial totals (`/subtotal`, `/taxAmount`, `/total`, `/grossProfit`, `/profitPercent`)
- Notes (`/notes` with `renderMode="block"`)

6. **Line Items with Row-Level Highlighting:**

```tsx
servicesSummary.services.map((service, index) => {
  const itemDiffOp = invoice.status === 'change_requested' && diffIndex
    ? getLineItemOp(diffIndex, index)
    : undefined;

  return (
    <div
      className={cn(
        'grid grid-cols-[...] items-center border-t px-4 py-3',
        itemDiffOp && 'border-l-4',
        itemDiffOp?.op === 'add' && 'bg-green-50 border-green-500',
        itemDiffOp?.op === 'remove' && 'bg-red-50 border-red-500 opacity-75',
        itemDiffOp?.op === 'replace' && 'bg-yellow-50 border-yellow-500'
      )}
    >
      {/* Field-level ChangedValue components for each column */}
    </div>
  );
})
```

## Backend API Requirements

The backend should return diff data with the invoice when `status === 'change_requested'`:

```json
{
  "invoice": {
    "id": "...",
    "status": "change_requested",
    "customerName": "New Customer Name",
    "total": 5000,
    "diff": [
      {
        "op": "replace",
        "path": "/customerName",
        "value": "Old Customer Name"
      },
      {
        "op": "replace",
        "path": "/total",
        "value": 4500
      },
      {
        "op": "replace",
        "path": "/lineItems/0/description",
        "value": "Old Description"
      },
      {
        "op": "add",
        "path": "/lineItems/1",
        "value": { "description": "New Item", "cost": 500 }
      }
    ]
  }
}
```

**Diff Operation Structure (RFC-6902 JSON Patch):**
- `op`: 'add' | 'remove' | 'replace'
- `path`: JSON Pointer path (e.g., "/customerName", "/lineItems/0/description")
- `value`: The old value (for replace/remove) or new value (for add)

## Visual Design

### Color Scheme (WCAG 2.1 AA Compliant)

- **Added**: `text-green-600` with "+" prefix
- **Removed**: `text-red-600 line-through` with "−" prefix
- **Changed**: Red strikethrough → Gray arrow → Green value
- **Status Badge**: `border-amber-500 text-amber-700 bg-amber-50`

### Row-Level Backgrounds

- **Added Row**: `bg-green-50` with `border-l-4 border-green-500`
- **Removed Row**: `bg-red-50` with `border-l-4 border-red-500` and `opacity-75`
- **Modified Row**: `bg-yellow-50` with `border-l-4 border-yellow-500`

## Accessibility Features

- Semantic HTML: `<ins>`, `<del>` tags
- ARIA labels: `role="insertion"`, `role="deletion"`
- Screen reader support with descriptive labels
- Keyboard navigation support
- Not color-only (uses symbols + and −)
- High contrast colors meeting WCAG 2.1 AA standards

## Integration into CreateInvoice.tsx (TODO)

Similar integration pattern should be applied:

1. Add same imports and diff index building
2. Wrap editable field displays (not the inputs themselves)
3. Consider adding a "Show Changes" toggle if diff makes form too busy
4. Show diff alongside form fields in a non-intrusive way

**Example pattern for edit mode:**
```tsx
<div className="space-y-2">
  <Label>Customer Name</Label>
  <Input value={customerName} onChange={...} />
  {hasChangeRequestedStatus(invoice.status) && (
    <div className="text-xs text-muted-foreground">
      Previous: <ChangedValue path="/customerName" value={...} diff={diffIndex} status={status} />
    </div>
  )}
</div>
```

## Testing Checklist

- [ ] Verify green styling for added fields
- [ ] Verify red strikethrough for removed fields
- [ ] Verify old→new display for changed fields
- [ ] Verify no styling when status !== 'change_requested'
- [ ] Verify no styling when diff is null/empty
- [ ] Test line item row-level highlighting (green, red, yellow backgrounds)
- [ ] Test accessibility with screen readers
- [ ] Test keyboard navigation
- [ ] Verify status badge shows amber color and change count
- [ ] Test with various field types (strings, numbers, currency)
- [ ] Test block mode for multi-line content (notes)

## Performance Considerations

- Diff index uses Map for O(1) lookup performance
- Memoized with useMemo to prevent rebuilding on every render
- Minimal rendering overhead (only renders when status matches)
- No external dependencies beyond existing project libraries

## Files Modified/Created

### Created:
1. `/src/components/invoices/ChangedValue.tsx` - Main inline diff component
2. `/src/components/invoices/LineItemsDiff.tsx` - Array diff utilities

### Modified:
1. `/src/pages/InvoiceView.tsx` - Integrated diff rendering throughout

### Existing Infrastructure (Already Present):
- `/src/types/diff.types.ts` - Type definitions
- `/src/components/diff/` - Advanced diff components (FieldDiff, ArrayDiff, ChangesSummary)
- `/src/hooks/useInvoiceDiff.ts` - Diff management hook
- `/src/contexts/DiffContext.tsx` - Diff context provider

## Next Steps

1. Integrate into CreateInvoice.tsx for edit mode
2. Test with real backend data
3. Add "Show/Hide Changes" toggle if needed
4. Consider adding a summary panel showing total number of changes by category
5. Add unit tests for ChangedValue and LineItemsDiff components
6. Document backend API contract for diff data structure