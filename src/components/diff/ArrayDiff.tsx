import React, { memo, useState } from 'react';
import { PatchOperation, FieldRegistry } from '../../types/diff.types';
import { formatFieldValue } from '../../hooks/useInvoiceDiff';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * ArrayDiff component props
 */
export interface ArrayDiffProps {
  operations: PatchOperation[];
  arrayPath: string;
  fieldRegistry: FieldRegistry;
  className?: string;
  itemLabel?: string; // e.g., "Line Item", "Service"
  collapsible?: boolean;
}

/**
 * Array item change type
 */
interface ArrayItemChange {
  index: number;
  operation: 'add' | 'remove' | 'replace';
  oldValue?: unknown;
  newValue?: unknown;
  fieldChanges?: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

/**
 * ArrayDiff component
 *
 * Specialized component for rendering diffs of array fields (e.g., line items).
 * Handles array-specific operations:
 * - Item additions
 * - Item removals
 * - Item modifications (field-level changes within items)
 * - Array reordering
 *
 * Accessibility features:
 * - Collapsible sections with keyboard navigation
 * - ARIA labels for array operations
 * - Semantic HTML for list structure
 * - Clear visual indicators for operations
 *
 * @example
 * ```tsx
 * <ArrayDiff
 *   operations={patchOperations.filter(op => op.path.startsWith('/lineItems'))}
 *   arrayPath="/lineItems"
 *   fieldRegistry={INVOICE_FIELD_REGISTRY}
 *   itemLabel="Line Item"
 *   collapsible={true}
 * />
 * ```
 */
export const ArrayDiff = memo<ArrayDiffProps>(function ArrayDiff({
  operations,
  arrayPath,
  fieldRegistry,
  className,
  itemLabel = 'Item',
  collapsible = true,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Parse array operations into structured changes
  const arrayChanges = parseArrayOperations(operations, arrayPath);

  if (arrayChanges.length === 0) {
    return null;
  }

  // Count operations by type
  const addCount = arrayChanges.filter((c) => c.operation === 'add').length;
  const removeCount = arrayChanges.filter((c) => c.operation === 'remove').length;
  const modifyCount = arrayChanges.filter((c) => c.operation === 'replace').length;

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={cn('border rounded-lg overflow-hidden', className)}
      role="region"
      aria-label={`${itemLabel} changes`}
    >
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className={cn(
          'w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors',
          !collapsible && 'cursor-default'
        )}
        aria-expanded={isExpanded}
        aria-controls={`array-diff-${arrayPath}`}
        disabled={!collapsible}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <span aria-hidden="true">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </span>
          )}
          <span className="font-medium text-sm text-gray-900">
            {itemLabel} Changes
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {addCount > 0 && (
            <span className="text-green-700 font-medium">
              +{addCount} added
            </span>
          )}
          {removeCount > 0 && (
            <span className="text-red-700 font-medium">
              −{removeCount} removed
            </span>
          )}
          {modifyCount > 0 && (
            <span className="text-yellow-700 font-medium">
              {modifyCount} modified
            </span>
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div
          id={`array-diff-${arrayPath}`}
          className="divide-y divide-gray-200"
          role="list"
        >
          {arrayChanges.map((change, idx) => (
            <ArrayItemDiff
              key={`${change.index}-${idx}`}
              change={change}
              itemLabel={itemLabel}
              fieldRegistry={fieldRegistry}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * ArrayItemDiff component props
 */
interface ArrayItemDiffProps {
  change: ArrayItemChange;
  itemLabel: string;
  fieldRegistry: FieldRegistry;
}

/**
 * ArrayItemDiff component
 *
 * Renders a single array item change with field-level details.
 */
const ArrayItemDiff = memo<ArrayItemDiffProps>(function ArrayItemDiff({
  change,
  itemLabel,
  fieldRegistry,
}) {
  const { index, operation, oldValue, newValue, fieldChanges } = change;

  return (
    <div
      className={cn(
        'p-3 border-l-4',
        operation === 'add' && 'border-green-500 bg-green-50',
        operation === 'remove' && 'border-red-500 bg-red-50',
        operation === 'replace' && 'border-yellow-500 bg-yellow-50'
      )}
      role="listitem"
      aria-label={`${itemLabel} ${index + 1} ${operation}`}
    >
      {/* Item Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">
          {itemLabel} #{index + 1}
        </span>
        <span
          className={cn(
            'text-xs font-semibold px-2 py-1 rounded',
            operation === 'add' && 'bg-green-200 text-green-800',
            operation === 'remove' && 'bg-red-200 text-red-800',
            operation === 'replace' && 'bg-yellow-200 text-yellow-800'
          )}
        >
          {operation === 'add' && 'Added'}
          {operation === 'remove' && 'Removed'}
          {operation === 'replace' && 'Modified'}
        </span>
      </div>

      {/* Item Content */}
      {operation === 'remove' && oldValue && (
        <div className="text-sm" role="deletion">
          <div className="flex items-start gap-2">
            <span className="text-red-600 font-bold flex-shrink-0 select-none">
              −
            </span>
            <del className="text-red-700 line-through">
              {renderItemValue(oldValue)}
            </del>
          </div>
        </div>
      )}

      {operation === 'add' && newValue && (
        <div className="text-sm" role="insertion">
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold flex-shrink-0 select-none">
              +
            </span>
            <ins className="text-green-700 no-underline">
              {renderItemValue(newValue)}
            </ins>
          </div>
        </div>
      )}

      {operation === 'replace' && fieldChanges && fieldChanges.length > 0 && (
        <div className="space-y-2">
          {fieldChanges.map((fieldChange, idx) => (
            <div key={idx} className="text-sm">
              <div className="font-medium text-gray-700 mb-1">
                {fieldChange.field}
              </div>
              <div className="flex flex-col gap-1 pl-3">
                {fieldChange.oldValue !== undefined && (
                  <div className="flex items-start gap-2" role="deletion">
                    <span className="text-red-600 font-bold flex-shrink-0 select-none">
                      −
                    </span>
                    <del className="text-red-700 line-through">
                      {String(fieldChange.oldValue)}
                    </del>
                  </div>
                )}
                {fieldChange.newValue !== undefined && (
                  <div className="flex items-start gap-2" role="insertion">
                    <span className="text-green-600 font-bold flex-shrink-0 select-none">
                      +
                    </span>
                    <ins className="text-green-700 no-underline">
                      {String(fieldChange.newValue)}
                    </ins>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Helper: Parse array operations into structured changes
 */
function parseArrayOperations(
  operations: PatchOperation[],
  arrayPath: string
): ArrayItemChange[] {
  const changes: ArrayItemChange[] = [];
  const arrayPattern = new RegExp(`^${arrayPath.replace(/\//g, '\\/')}\\/\\d+`);

  operations.forEach((op) => {
    if (!arrayPattern.test(op.path)) {
      return;
    }

    // Extract index from path (e.g., /lineItems/0 -> 0)
    const pathParts = op.path.split('/').filter((p) => p);
    const indexStr = pathParts[1]; // Assuming arrayPath is /lineItems
    const index = parseInt(indexStr, 10);

    if (isNaN(index)) {
      return;
    }

    // Determine if this is a whole-item operation or field-level
    const isWholeItem = pathParts.length === 2; // e.g., /lineItems/0

    if (isWholeItem) {
      // Whole item add/remove/replace
      changes.push({
        index,
        operation: op.op as 'add' | 'remove' | 'replace',
        oldValue: op.op === 'remove' || op.op === 'replace' ? op.value : undefined,
        newValue: op.op === 'add' || op.op === 'replace' ? op.value : undefined,
      });
    } else {
      // Field-level change within item
      const field = pathParts.slice(2).join('.');

      // Find or create change record for this index
      let itemChange = changes.find((c) => c.index === index && c.operation === 'replace');

      if (!itemChange) {
        itemChange = {
          index,
          operation: 'replace',
          fieldChanges: [],
        };
        changes.push(itemChange);
      }

      if (!itemChange.fieldChanges) {
        itemChange.fieldChanges = [];
      }

      itemChange.fieldChanges.push({
        field,
        oldValue: op.op === 'remove' ? op.value : undefined,
        newValue: op.op === 'add' || op.op === 'replace' ? op.value : undefined,
      });
    }
  });

  // Sort by index
  changes.sort((a, b) => a.index - b.index);

  return changes;
}

/**
 * Helper: Render item value as string
 */
function renderItemValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    // For objects, render key fields
    const obj = value as Record<string, unknown>;
    const keys = ['description', 'name', 'title', 'quantity', 'price'];
    const relevantFields = keys
      .filter((key) => obj[key] !== undefined)
      .map((key) => `${key}: ${obj[key]}`)
      .join(', ');

    return relevantFields || JSON.stringify(value, null, 2);
  }

  return String(value);
}