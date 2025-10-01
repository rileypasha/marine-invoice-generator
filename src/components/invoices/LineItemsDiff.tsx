import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { PatchOperation } from '../../types/diff.types';
import { DiffIndex } from './ChangedValue';

/**
 * Line item with optional diff metadata
 */
export interface DiffableLineItem {
  id?: string;
  [key: string]: unknown;
}

/**
 * LineItemsDiff component props
 */
export interface LineItemsDiffProps<T extends DiffableLineItem> {
  /** Array of line items to render */
  items: T[];
  /** Diff index for change lookup */
  diff?: DiffIndex;
  /** Invoice status */
  status?: string;
  /** Render function for each item */
  renderItem: (item: T, index: number, diffOp?: PatchOperation) => ReactNode;
  /** Get unique key for each item */
  getItemKey: (item: T, index: number) => string;
  /** CSS class for the container */
  className?: string;
}

/**
 * LineItemsDiff component
 *
 * Renders a list of line items with row-level highlighting for changes.
 * Works with the ChangedValue component for field-level diffs within items.
 *
 * Visual indicators:
 * - Added rows: Green background
 * - Removed rows: Red background
 * - Changed rows: Yellow/amber background
 * - Unchanged rows: Normal background
 *
 * @example
 * ```tsx
 * <LineItemsDiff
 *   items={invoice.lineItems}
 *   diff={diffIndex}
 *   status={invoice.status}
 *   renderItem={(item, index) => (
 *     <div className="grid grid-cols-4 gap-4">
 *       <ChangedValue path={`/lineItems/${index}/description`} value={item.description} diff={diffIndex} status={status} />
 *       <ChangedValue path={`/lineItems/${index}/quantity`} value={item.quantity} diff={diffIndex} status={status} />
 *     </div>
 *   )}
 *   getItemKey={(item, index) => item.id || `item-${index}`}
 * />
 * ```
 */
export function LineItemsDiff<T extends DiffableLineItem>({
  items,
  diff,
  status,
  renderItem,
  getItemKey,
  className,
}: LineItemsDiffProps<T>) {
  const shouldShowDiff = status === 'change_requested' && diff && diff.size > 0;

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = getItemKey(item, index);
        const itemPath = `/lineItems/${index}`;
        const itemDiffOp = shouldShowDiff ? diff.get(itemPath) : undefined;

        // Determine background color based on operation
        const bgClass = getItemBackgroundClass(itemDiffOp);

        return (
          <div
            key={key}
            className={cn(
              'transition-colors',
              bgClass,
              itemDiffOp && 'border-l-4',
              itemDiffOp?.op === 'add' && 'border-green-500',
              itemDiffOp?.op === 'remove' && 'border-red-500',
              itemDiffOp?.op === 'replace' && 'border-yellow-500'
            )}
            role={itemDiffOp ? 'listitem' : undefined}
            aria-label={itemDiffOp ? `${itemDiffOp.op} item` : undefined}
          >
            {renderItem(item, index, itemDiffOp)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Get background class for item based on diff operation
 */
function getItemBackgroundClass(diffOp?: PatchOperation): string {
  if (!diffOp) {
    return '';
  }

  switch (diffOp.op) {
    case 'add':
      return 'bg-green-50 hover:bg-green-100';
    case 'remove':
      return 'bg-red-50 hover:bg-red-100 opacity-75';
    case 'replace':
      return 'bg-yellow-50 hover:bg-yellow-100';
    default:
      return '';
  }
}

/**
 * Helper: Check if any line items have changes
 */
export function hasLineItemChanges(diff?: DiffIndex): boolean {
  if (!diff) return false;

  for (const path of diff.keys()) {
    if (path.startsWith('/lineItems/')) {
      return true;
    }
  }

  return false;
}

/**
 * Helper: Get line item operation by index
 * Checks both /lineItems/{index} and /services/- paths
 */
export function getLineItemOp(diff: DiffIndex, index: number): PatchOperation | undefined {
  // First check the specific index path
  const lineItemOp = diff.get(`/lineItems/${index}`);
  if (lineItemOp) {
    return lineItemOp;
  }

  // Check for services array path (backend uses /services/-)
  const servicesOp = diff.get(`/services/${index}`);
  if (servicesOp) {
    return servicesOp;
  }

  // Check for wildcard path (new items use /services/-)
  const wildcardOp = diff.get('/services/-');
  if (wildcardOp) {
    return wildcardOp;
  }

  return undefined;
}

/**
 * Helper: Check if specific line item field has changed
 */
export function hasLineItemFieldChange(
  diff: DiffIndex,
  itemIndex: number,
  fieldName: string
): boolean {
  const fieldPath = `/lineItems/${itemIndex}/${fieldName}`;
  return diff.has(fieldPath);
}