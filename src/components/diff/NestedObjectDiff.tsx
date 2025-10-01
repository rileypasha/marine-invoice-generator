import React, { memo, useState } from 'react';
import { PatchOperation, FieldRegistry } from '../../types/diff.types';
import { formatFieldValue, getFieldLabel } from '../../hooks/useInvoiceDiff';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * NestedObjectDiff component props
 */
export interface NestedObjectDiffProps {
  operations: PatchOperation[];
  objectPath: string;
  objectLabel: string; // e.g., "Customer", "Vessel"
  fieldRegistry: FieldRegistry;
  className?: string;
  collapsible?: boolean;
}

/**
 * Nested field change
 */
interface NestedFieldChange {
  field: string;
  fullPath: string;
  operation: 'add' | 'remove' | 'replace';
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * NestedObjectDiff component
 *
 * Specialized component for rendering diffs of nested object fields
 * (e.g., customer information, vessel details).
 *
 * Features:
 * - Hierarchical display of nested field changes
 * - Collapsible sections for better organization
 * - Visual indicators for field-level changes
 * - Accessibility support with ARIA labels
 *
 * @example
 * ```tsx
 * <NestedObjectDiff
 *   operations={patchOperations.filter(op => op.path.startsWith('/customer'))}
 *   objectPath="/customer"
 *   objectLabel="Customer"
 *   fieldRegistry={INVOICE_FIELD_REGISTRY}
 *   collapsible={true}
 * />
 * ```
 */
export const NestedObjectDiff = memo<NestedObjectDiffProps>(function NestedObjectDiff({
  operations,
  objectPath,
  objectLabel,
  fieldRegistry,
  className,
  collapsible = true,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Parse nested object operations
  const fieldChanges = parseNestedOperations(operations, objectPath);

  if (fieldChanges.length === 0) {
    return null;
  }

  // Count changes by type
  const addCount = fieldChanges.filter((c) => c.operation === 'add').length;
  const removeCount = fieldChanges.filter((c) => c.operation === 'remove').length;
  const modifyCount = fieldChanges.filter((c) => c.operation === 'replace').length;

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={cn('border rounded-lg overflow-hidden', className)}
      role="region"
      aria-label={`${objectLabel} changes`}
    >
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className={cn(
          'w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors',
          !collapsible && 'cursor-default'
        )}
        aria-expanded={isExpanded}
        aria-controls={`nested-diff-${objectPath}`}
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
            {objectLabel} Changes
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
          id={`nested-diff-${objectPath}`}
          className="p-3 space-y-2"
          role="list"
        >
          {fieldChanges.map((change, idx) => (
            <NestedFieldDiff
              key={`${change.fullPath}-${idx}`}
              change={change}
              fieldRegistry={fieldRegistry}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * NestedFieldDiff component props
 */
interface NestedFieldDiffProps {
  change: NestedFieldChange;
  fieldRegistry: FieldRegistry;
}

/**
 * NestedFieldDiff component
 *
 * Renders a single nested field change.
 */
const NestedFieldDiff = memo<NestedFieldDiffProps>(function NestedFieldDiff({
  change,
  fieldRegistry,
}) {
  const { field, fullPath, operation, oldValue, newValue } = change;

  // Get field label (fallback to field name if not in registry)
  const fieldLabel = getFieldLabel(fullPath, fieldRegistry) || field;

  // Format values
  const formattedOldValue = formatFieldValue(fullPath, oldValue, fieldRegistry);
  const formattedNewValue = formatFieldValue(fullPath, newValue, fieldRegistry);

  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-l-2 pl-3 py-2',
        operation === 'add' && 'border-green-500',
        operation === 'remove' && 'border-red-500',
        operation === 'replace' && 'border-yellow-500'
      )}
      role="listitem"
      aria-label={`Field change: ${fieldLabel}`}
    >
      {/* Field Label */}
      <div className="font-medium text-sm text-gray-700">
        {fieldLabel}
      </div>

      {/* Value Changes */}
      <div className="flex flex-col gap-1">
        {/* Removed or Changed (old value) */}
        {(operation === 'remove' || operation === 'replace') && oldValue !== undefined && (
          <div
            className="flex items-start gap-2"
            role="deletion"
            aria-label={`Removed value: ${formattedOldValue}`}
          >
            <span
              className="text-red-600 font-bold flex-shrink-0 select-none"
              aria-hidden="true"
            >
              −
            </span>
            <del className="text-red-700 line-through break-all">
              {formattedOldValue}
            </del>
          </div>
        )}

        {/* Added or Changed (new value) */}
        {(operation === 'add' || operation === 'replace') && newValue !== undefined && (
          <div
            className="flex items-start gap-2"
            role="insertion"
            aria-label={`Added value: ${formattedNewValue}`}
          >
            <span
              className="text-green-600 font-bold flex-shrink-0 select-none"
              aria-hidden="true"
            >
              +
            </span>
            <ins className="text-green-700 no-underline break-all">
              {formattedNewValue}
            </ins>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Helper: Parse nested object operations
 */
function parseNestedOperations(
  operations: PatchOperation[],
  objectPath: string
): NestedFieldChange[] {
  const changes: NestedFieldChange[] = [];
  const objectPattern = new RegExp(`^${objectPath.replace(/\//g, '\\/')}\\/`);

  operations.forEach((op) => {
    if (!objectPattern.test(op.path)) {
      return;
    }

    // Extract field name from path (e.g., /customer/name -> name)
    const pathParts = op.path.split('/').filter((p) => p);
    const field = pathParts.slice(1).join('.'); // Skip the object name itself

    if (!field) {
      return;
    }

    changes.push({
      field,
      fullPath: op.path,
      operation: op.op as 'add' | 'remove' | 'replace',
      oldValue: op.op === 'remove' ? op.value : undefined,
      newValue: op.op === 'add' || op.op === 'replace' ? op.value : undefined,
    });
  });

  return changes;
}

/**
 * Helper: Check if operations include nested object changes
 */
export function hasNestedObjectChanges(
  operations: PatchOperation[],
  objectPath: string
): boolean {
  const objectPattern = new RegExp(`^${objectPath.replace(/\//g, '\\/')}\\/`);
  return operations.some((op) => objectPattern.test(op.path));
}