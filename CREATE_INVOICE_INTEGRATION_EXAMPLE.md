# CreateInvoice.tsx Integration Example

This document shows how to integrate the visual diff system into the CreateInvoice.tsx edit mode.

## Pattern 1: Show Previous Value Below Input (Recommended)

```tsx
import { buildDiffIndex, ChangedValue, DiffIndex } from '../components/invoices/ChangedValue';
import { cn } from '../lib/utils';

// Inside CreateInvoice component:
const diffIndex: DiffIndex = useMemo(() => {
  return buildDiffIndex(invoice?.diff);
}, [invoice?.diff]);

// For each editable field:
<div className="space-y-2">
  <Label htmlFor="customerName">Customer Name</Label>
  <Input
    id="customerName"
    value={customerName}
    onChange={(e) => setCustomerName(e.target.value)}
  />
  {invoice?.status === 'change_requested' && getDelta(diffIndex, '/customerName') && (
    <div className="text-xs text-muted-foreground px-2 py-1 bg-yellow-50 rounded border-l-2 border-yellow-500">
      <span className="font-medium">Previous:</span>{' '}
      <ChangedValue
        path="/customerName"
        value={getDelta(diffIndex, '/customerName')?.value}
        diff={diffIndex}
        status={invoice.status}
      />
    </div>
  )}
</div>
```

## Pattern 2: Side-by-Side Comparison

```tsx
<div className="grid grid-cols-2 gap-4">
  {/* Current Value (Editable) */}
  <div className="space-y-2">
    <Label htmlFor="total">Total</Label>
    <Input
      id="total"
      type="number"
      value={total}
      onChange={(e) => setTotal(e.target.value)}
      className="font-semibold"
    />
  </div>

  {/* Previous Value (Read-only) */}
  {invoice?.status === 'change_requested' && getDelta(diffIndex, '/total') && (
    <div className="space-y-2">
      <Label className="text-muted-foreground">Previous Total</Label>
      <div className="px-3 py-2 bg-gray-50 rounded border text-sm">
        <ChangedValue
          path="/total"
          value={formatCurrency(getDelta(diffIndex, '/total')?.value)}
          diff={diffIndex}
          status={invoice.status}
        />
      </div>
    </div>
  )}
</div>
```

## Pattern 3: Inline Badge Next to Label

```tsx
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Label htmlFor="vesselName">Vessel Name</Label>
    {invoice?.status === 'change_requested' && getDelta(diffIndex, '/vesselName') && (
      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
        Changed
      </Badge>
    )}
  </div>
  <Input
    id="vesselName"
    value={vesselName}
    onChange={(e) => setVesselName(e.target.value)}
  />
  {invoice?.status === 'change_requested' && getDelta(diffIndex, '/vesselName') && (
    <p className="text-xs text-muted-foreground">
      Was: <span className="font-medium">{getDelta(diffIndex, '/vesselName')?.value}</span>
    </p>
  )}
</div>
```

## Pattern 4: Collapsible Changes Panel (For busy forms)

```tsx
import { ChevronDown, ChevronRight } from 'lucide-react';

const [showChanges, setShowChanges] = useState(false);

// At top of form:
{invoice?.status === 'change_requested' && invoice.diff?.length > 0 && (
  <Card className="border-yellow-200 bg-yellow-50">
    <CardHeader>
      <button
        onClick={() => setShowChanges(!showChanges)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <CardTitle className="text-yellow-900">
            Pending Changes
          </CardTitle>
          <CardDescription>
            {invoice.diff.length} field{invoice.diff.length !== 1 ? 's' : ''} modified
          </CardDescription>
        </div>
        {showChanges ? (
          <ChevronDown className="w-5 h-5 text-yellow-700" />
        ) : (
          <ChevronRight className="w-5 h-5 text-yellow-700" />
        )}
      </button>
    </CardHeader>
    {showChanges && (
      <CardContent className="space-y-2">
        {invoice.diff.map((op, idx) => (
          <div key={idx} className="text-sm">
            <span className="font-medium">{getFieldLabel(op.path)}:</span>{' '}
            <ChangedValue
              path={op.path}
              value={/* get current value */}
              diff={diffIndex}
              status={invoice.status}
            />
          </div>
        ))}
      </CardContent>
    )}
  </Card>
)}
```

## Pattern 5: Line Items in Edit Mode

```tsx
{lineItems.map((item, index) => {
  const itemDiffOp = invoice?.status === 'change_requested' && diffIndex
    ? getLineItemOp(diffIndex, index)
    : undefined;

  return (
    <div
      key={item.id || index}
      className={cn(
        'grid grid-cols-4 gap-4 p-4 border rounded',
        itemDiffOp && 'border-l-4',
        itemDiffOp?.op === 'add' && 'bg-green-50 border-green-500',
        itemDiffOp?.op === 'remove' && 'bg-red-50 border-red-500',
        itemDiffOp?.op === 'replace' && 'bg-yellow-50 border-yellow-500'
      )}
    >
      {/* Description Input */}
      <div className="space-y-1">
        <Label>Description</Label>
        <Input
          value={item.description}
          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
        />
        {itemDiffOp && getDelta(diffIndex, `/lineItems/${index}/description`) && (
          <p className="text-xs text-muted-foreground">
            Was: <span className="line-through text-red-600">
              {getDelta(diffIndex, `/lineItems/${index}/description`)?.value}
            </span>
          </p>
        )}
      </div>

      {/* Cost Input */}
      <div className="space-y-1">
        <Label>Cost</Label>
        <Input
          type="number"
          value={item.cost}
          onChange={(e) => updateLineItem(index, 'cost', e.target.value)}
        />
        {itemDiffOp && getDelta(diffIndex, `/lineItems/${index}/cost`) && (
          <p className="text-xs text-muted-foreground">
            Was: <span className="line-through text-red-600">
              {formatCurrency(getDelta(diffIndex, `/lineItems/${index}/cost`)?.value)}
            </span>
          </p>
        )}
      </div>

      {/* More fields... */}
    </div>
  );
})}
```

## Helper Functions to Add

```tsx
import { getDelta } from '../components/invoices/ChangedValue';

/**
 * Get human-readable field label from path
 */
const getFieldLabel = (path: string): string => {
  const labels: Record<string, string> = {
    '/customerName': 'Customer Name',
    '/customerEmail': 'Customer Email',
    '/vesselName': 'Vessel Name',
    '/total': 'Total',
    '/subtotal': 'Subtotal',
    '/notes': 'Notes',
    // ... add more as needed
  };
  return labels[path] || path.split('/').pop() || 'Field';
};

/**
 * Check if a specific field has changed
 */
const hasFieldChanged = (diffIndex: DiffIndex, path: string): boolean => {
  return getDelta(diffIndex, path) !== undefined;
};

/**
 * Get all changed field paths
 */
const getChangedFields = (diffIndex: DiffIndex): string[] => {
  return Array.from(diffIndex.keys());
};

/**
 * Count total changes
 */
const getChangeCount = (diffIndex: DiffIndex): number => {
  return diffIndex.size;
};
```

## Complete Example Component Snippet

```tsx
import React, { useState, useMemo } from 'react';
import { buildDiffIndex, ChangedValue, getDelta, DiffIndex } from '../components/invoices/ChangedValue';
import { getLineItemOp } from '../components/invoices/LineItemsDiff';
import { cn } from '../lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/magic/index';

interface CreateInvoiceProps {
  invoice?: Invoice;
  onSave: (data: InvoiceData) => void;
}

export function CreateInvoice({ invoice, onSave }: CreateInvoiceProps) {
  // Build diff index
  const diffIndex: DiffIndex = useMemo(() => {
    return buildDiffIndex(invoice?.diff);
  }, [invoice?.diff]);

  // Form state
  const [customerName, setCustomerName] = useState(invoice?.customerName || '');
  const [vesselName, setVesselName] = useState(invoice?.vesselName || '');
  const [total, setTotal] = useState(invoice?.total || 0);

  // Show changes indicator
  const hasChanges = invoice?.status === 'change_requested' && diffIndex.size > 0;

  return (
    <div className="space-y-6">
      {/* Change Alert Banner */}
      {hasChanges && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900 flex items-center gap-2">
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                Changes Requested
              </Badge>
              <span className="text-sm font-normal">
                {diffIndex.size} field{diffIndex.size !== 1 ? 's' : ''} modified
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="customerName">Customer Name</Label>
            {hasChanges && getDelta(diffIndex, '/customerName') && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                Modified
              </Badge>
            )}
          </div>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className={cn(
              hasChanges && getDelta(diffIndex, '/customerName') && 'border-yellow-500'
            )}
          />
          {hasChanges && getDelta(diffIndex, '/customerName') && (
            <div className="text-xs text-muted-foreground px-2 py-1 bg-yellow-50 rounded">
              <span className="font-medium">Previous:</span>{' '}
              <span className="line-through text-red-600">
                {getDelta(diffIndex, '/customerName')?.value as string}
              </span>
            </div>
          )}
        </div>

        {/* Vessel Name */}
        <div className="space-y-2">
          <Label htmlFor="vesselName">Vessel Name</Label>
          <Input
            id="vesselName"
            value={vesselName}
            onChange={(e) => setVesselName(e.target.value)}
          />
          {hasChanges && getDelta(diffIndex, '/vesselName') && (
            <p className="text-xs text-muted-foreground">
              Was: <span className="line-through text-red-600">
                {getDelta(diffIndex, '/vesselName')?.value as string}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button onClick={() => onSave({ customerName, vesselName, total })}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
```

## Styling Recommendations

### Field-Level Indicators
```css
/* Input with change indicator */
.border-yellow-500 {
  border-color: rgb(234 179 8);
}

/* Previous value display */
.bg-yellow-50 {
  background-color: rgb(254 252 232);
}

/* Changed badge */
.text-yellow-700 {
  color: rgb(161 98 7);
}
```

### Accessibility
```tsx
// Add aria-label for changed fields
<Input
  aria-label={hasFieldChanged(diffIndex, '/customerName')
    ? 'Customer Name (modified)'
    : 'Customer Name'
  }
  aria-describedby={hasFieldChanged(diffIndex, '/customerName')
    ? 'customerName-change'
    : undefined
  }
/>

{hasFieldChanged(diffIndex, '/customerName') && (
  <div id="customerName-change" className="text-xs" role="note">
    Previous value: {getDelta(diffIndex, '/customerName')?.value}
  </div>
)}
```

## Best Practices

1. **Don't overwhelm the user** - Consider collapsible sections for many changes
2. **Make inputs stand out** - Use border colors or badges to highlight changed fields
3. **Show previous values** - Help users understand what changed
4. **Maintain editability** - Don't block editing with diff overlays
5. **Clear visual hierarchy** - Current value should be most prominent
6. **Provide context** - Show which fields changed and why
7. **Support keyboard navigation** - Ensure all interactions are keyboard accessible

## Common Pitfalls to Avoid

❌ Don't disable inputs based on diff status
❌ Don't show diffs inline inside input values
❌ Don't use color-only indicators (add icons/badges)
❌ Don't hide the current editable value
✅ Show diffs alongside or below inputs
✅ Use clear visual separators
✅ Maintain form usability
✅ Provide clear "previous value" labels