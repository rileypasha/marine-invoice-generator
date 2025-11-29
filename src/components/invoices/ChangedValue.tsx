import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { PatchOperation } from '../../types/diff.types';
import { isChangeRequested } from '../../utils/status';

/**
 * Diff index for O(1) lookup of field changes by path
 */
export type DiffIndex = Map<string, PatchOperation>;

/**
 * Build diff index from patch operations for fast lookup
 */
export function buildDiffIndex(patch: PatchOperation[] | null | undefined): DiffIndex {
  const index = new Map<string, PatchOperation>();

  if (!patch || !Array.isArray(patch)) {
    return index;
  }

  patch.forEach((op) => {
    index.set(op.path, op);
  });

  return index;
}

/**
 * Get delta from diff index
 */
export function getDelta(index: DiffIndex, path: string): PatchOperation | undefined {
  return index.get(path);
}

/**
 * ChangedValue component props
 */
export interface ChangedValueProps {
  /** JSON Pointer path (e.g., "/customerName", "/total") */
  path: string;
  /** Current value to display */
  value: ReactNode;
  /** Diff index for change lookup */
  diff?: DiffIndex;
  /** Invoice status */
  status?: string;
  /** Render mode: inline for single-line fields, block for multi-line */
  renderMode?: 'inline' | 'block';
  /** Optional label for the field */
  label?: string;
  /** Optional className override */
  className?: string;
  /** Force highlight as new item (for array items where parent knows it's new) */
  isNewItem?: boolean;
}

/**
 * ChangedValue component
 *
 * Wraps field displays to show visual diffs when status is "change_requested".
 *
 * Visual indicators:
 * - Added: Green bold text with "+" prefix
 * - Removed: Red bold text with strikethrough and "−" prefix
 * - Changed: Shows old value (red strike) → new value (green)
 * - Unchanged: Normal display
 *
 * Only applies styling when status === 'change_requested' AND diff is present.
 *
 * @example
 * ```tsx
 * <ChangedValue
 *   path="/customerName"
 *   value={invoice.customerName}
 *   diff={diffIndex}
 *   status={invoice.status}
 * />
 * ```
 */
export function ChangedValue({
  path,
  value,
  diff,
  status,
  renderMode = 'inline',
  label,
  className,
  isNewItem,
}: ChangedValueProps) {
  // Only show diff if status indicates change requested (handles both variants) and diff exists
  const shouldShowDiff = isChangeRequested(status) && diff && diff.size > 0;

  const renderBaseValue = () => (
    className ? <span className={className}>{value}</span> : <>{value}</>
  );

  // If the parent indicates this is a new item, show it as added
  if (shouldShowDiff && isNewItem) {
    return (
      <AddedValue value={value} renderMode={renderMode} className={className} />
    );
  }

  if (!shouldShowDiff) {
    return renderBaseValue();
  }

  const delta = getDelta(diff, path);

  // No change for this field
  if (!delta) {
    return renderBaseValue();
  }

  const { op } = delta;

  // Added field
  if (op === 'add') {
    return (
      <AddedValue value={value} renderMode={renderMode} className={className} />
    );
  }

  // Removed field
  if (op === 'remove') {
    return (
      <RemovedValue value={delta.value} renderMode={renderMode} className={className} />
    );
  }

  // Changed field (replace)
  if (op === 'replace') {
    return (
      <ChangedValueDisplay
        oldValue={delta.value}
        newValue={value}
        renderMode={renderMode}
        className={className}
      />
    );
  }

  return <>{value}</>;
}

/**
 * AddedValue component - Green bold for new values
 */
export function AddedValue({
  value,
  renderMode = 'inline',
  className,
}: {
  value: ReactNode;
  renderMode?: 'inline' | 'block';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-semibold text-green-600',
        renderMode === 'inline' ? 'inline-flex items-center gap-1' : 'flex items-start gap-2',
        className
      )}
      role="insertion"
      aria-label={`Added: ${value}`}
    >
      <span className="select-none" aria-hidden="true">+</span>
      <ins className="no-underline">{value}</ins>
    </span>
  );
}

/**
 * RemovedValue component - Red bold strikethrough for removed values
 */
export function RemovedValue({
  value,
  renderMode = 'inline',
  className,
}: {
  value: ReactNode;
  renderMode?: 'inline' | 'block';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-semibold text-red-600 line-through',
        renderMode === 'inline' ? 'inline-flex items-center gap-1' : 'flex items-start gap-2',
        className
      )}
      role="deletion"
      aria-label={`Removed: ${value}`}
    >
      <span className="select-none" aria-hidden="true">−</span>
      <del>{value}</del>
    </span>
  );
}

/**
 * ChangedValueDisplay component - Shows old → new
 */
function ChangedValueDisplay({
  oldValue,
  newValue,
  renderMode = 'inline',
  className,
}: {
  oldValue: unknown;
  newValue: ReactNode;
  renderMode?: 'inline' | 'block';
  className?: string;
}) {
  const formattedOldValue = formatValue(oldValue);

  if (renderMode === 'block') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <span
          className="font-semibold text-red-600 line-through flex items-start gap-2"
          role="deletion"
          aria-label={`Old value: ${formattedOldValue}`}
        >
          <span className="select-none" aria-hidden="true">−</span>
          <del>{formattedOldValue}</del>
        </span>
        <span
          className="font-semibold text-green-600 flex items-start gap-2"
          role="insertion"
          aria-label={`New value: ${newValue}`}
        >
          <span className="select-none" aria-hidden="true">+</span>
          <ins className="no-underline">{newValue}</ins>
        </span>
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2 flex-wrap', className)}>
      <span
        className="font-semibold text-red-600 line-through inline-flex items-center gap-1"
        role="deletion"
        aria-label={`Old value: ${formattedOldValue}`}
      >
        <span className="select-none" aria-hidden="true">−</span>
        <del>{formattedOldValue}</del>
      </span>
      <span className="text-gray-400" aria-hidden="true">→</span>
      <span
        className="font-semibold text-green-600 inline-flex items-center gap-1"
        role="insertion"
        aria-label={`New value: ${newValue}`}
      >
        <span className="select-none" aria-hidden="true">+</span>
        <ins className="no-underline">{newValue}</ins>
      </span>
    </span>
  );
}

/**
 * Helper: Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Helper: Check if status indicates changes are present
 * @deprecated Use isChangeRequested from '../../utils/status' instead
 */
export function hasChangeRequestedStatus(status?: string): boolean {
  return isChangeRequested(status);
}
