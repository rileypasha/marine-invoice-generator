import React, { memo } from 'react';
import { FieldChange, FieldRegistry } from '../../types/diff.types';
import { getFieldLabel, formatFieldValue } from '../../hooks/useInvoiceDiff';
import { cn } from '../../lib/utils';

/**
 * FieldDiff component props
 */
export interface FieldDiffProps {
  change: FieldChange;
  fieldRegistry: FieldRegistry;
  className?: string;
  showPath?: boolean;
}

/**
 * FieldDiff component
 *
 * Renders a single field change with visual diff styling:
 * - Removed values: Red text with strikethrough + "−" prefix
 * - Added values: Green text + "+" prefix
 * - Changed values: Shows both old (removed) and new (added)
 *
 * Accessibility features:
 * - Semantic HTML (<del>, <ins>)
 * - ARIA labels for screen readers
 * - Visible symbols (not color-only)
 * - High contrast colors (WCAG 2.1 AA compliant)
 *
 * @example
 * ```tsx
 * <FieldDiff
 *   change={{
 *     field: 'customerName',
 *     path: '/customerName',
 *     oldValue: 'John Doe',
 *     newValue: 'Jane Smith',
 *     operation: 'replace'
 *   }}
 *   fieldRegistry={INVOICE_FIELD_REGISTRY}
 * />
 * ```
 */
export const FieldDiff = memo<FieldDiffProps>(function FieldDiff({
  change,
  fieldRegistry,
  className,
  showPath = false,
}) {
  const { field, path, oldValue, newValue, operation } = change;
  const fieldLabel = getFieldLabel(path, fieldRegistry);

  // Format values for display
  const formattedOldValue = formatFieldValue(path, oldValue, fieldRegistry);
  const formattedNewValue = formatFieldValue(path, newValue, fieldRegistry);

  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-l-2 pl-3 py-2',
        operation === 'add' && 'border-green-500',
        operation === 'remove' && 'border-red-500',
        operation === 'replace' && 'border-yellow-500',
        className
      )}
      role="article"
      aria-label={`Field change: ${fieldLabel}`}
    >
      {/* Field Label */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-gray-700">
          {fieldLabel}
        </span>
        {showPath && (
          <code className="text-xs text-gray-500 font-mono bg-gray-100 px-1 rounded">
            {path}
          </code>
        )}
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
 * FieldDiffList component
 *
 * Renders a list of field changes with proper grouping and organization.
 *
 * @example
 * ```tsx
 * <FieldDiffList
 *   changes={diff.summary.fields}
 *   fieldRegistry={INVOICE_FIELD_REGISTRY}
 *   groupByCategory={true}
 * />
 * ```
 */
export interface FieldDiffListProps {
  changes: FieldChange[];
  fieldRegistry: FieldRegistry;
  className?: string;
  showPaths?: boolean;
  groupByCategory?: boolean;
}

export const FieldDiffList = memo<FieldDiffListProps>(function FieldDiffList({
  changes,
  fieldRegistry,
  className,
  showPaths = false,
  groupByCategory = false,
}) {
  if (changes.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-4">
        No changes detected
      </div>
    );
  }

  // Group changes by category if requested
  if (groupByCategory) {
    const groupedChanges = groupChangesByCategory(changes);

    return (
      <div className={cn('flex flex-col gap-6', className)} role="list">
        {Object.entries(groupedChanges).map(([category, categoryChanges]) => (
          <div key={category} role="listitem">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 capitalize">
              {category} Changes ({categoryChanges.length})
            </h3>
            <div className="flex flex-col gap-2">
              {categoryChanges.map((change, index) => (
                <FieldDiff
                  key={`${change.path}-${index}`}
                  change={change}
                  fieldRegistry={fieldRegistry}
                  showPath={showPaths}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render ungrouped list
  return (
    <div className={cn('flex flex-col gap-2', className)} role="list">
      {changes.map((change, index) => (
        <FieldDiff
          key={`${change.path}-${index}`}
          change={change}
          fieldRegistry={fieldRegistry}
          showPath={showPaths}
        />
      ))}
    </div>
  );
});

/**
 * Helper: Group changes by category
 */
function groupChangesByCategory(changes: FieldChange[]): Record<string, FieldChange[]> {
  const groups: Record<string, FieldChange[]> = {
    customer: [],
    vessel: [],
    items: [],
    pricing: [],
    metadata: [],
  };

  changes.forEach((change) => {
    if (change.path.includes('customer')) {
      groups.customer.push(change);
    } else if (change.path.includes('vessel')) {
      groups.vessel.push(change);
    } else if (change.path.match(/lineItems|items|services/i)) {
      groups.items.push(change);
    } else if (change.path.match(/total|subtotal|tax|profit|price|amount/i)) {
      groups.pricing.push(change);
    } else {
      groups.metadata.push(change);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}
