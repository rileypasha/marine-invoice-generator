import React, { memo } from 'react';
import { InvoiceDiff } from '../../types/diff.types';
import { useDiffContext } from '../../contexts/DiffContext';
import { FieldDiffList } from './FieldDiff';
import { ArrayDiff } from './ArrayDiff';
import { NestedObjectDiff, hasNestedObjectChanges } from './NestedObjectDiff';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';

/**
 * ChangesSummary component props
 */
export interface ChangesSummaryProps {
  invoiceId?: string;
  className?: string;
  autoFetch?: boolean;
  showEmpty?: boolean;
}

/**
 * ChangesSummary component
 *
 * Comprehensive changes summary card that displays:
 * - Change statistics and metadata
 * - Categorized field changes
 * - Array diffs for line items
 * - Nested object diffs for customer/vessel
 * - Actor information and timestamps
 *
 * Automatically fetches active diff from context or directly via invoiceId.
 *
 * Accessibility features:
 * - WCAG 2.1 AA compliant colors
 * - Semantic HTML structure
 * - ARIA live regions for status updates
 * - Keyboard navigation support
 *
 * @example
 * ```tsx
 * // With DiffProvider
 * <DiffProvider invoiceId={invoiceId}>
 *   <ChangesSummary />
 * </DiffProvider>
 *
 * // Standalone
 * <ChangesSummary invoiceId={invoiceId} autoFetch={true} />
 * ```
 */
export const ChangesSummary = memo<ChangesSummaryProps>(function ChangesSummary({
  invoiceId,
  className,
  autoFetch = true,
  showEmpty = false,
}) {
  const diffContext = useDiffContext();
  const { activeDiff, isLoading, error, fetchActiveDiff, fieldRegistry } = diffContext;

  // Auto-fetch diff if invoiceId provided
  React.useEffect(() => {
    if (autoFetch && invoiceId && !activeDiff && !isLoading) {
      fetchActiveDiff(invoiceId);
    }
  }, [autoFetch, invoiceId, activeDiff, isLoading, fetchActiveDiff]);

  // Handle loading state
  if (isLoading) {
    return (
      <div
        className={cn('border rounded-lg p-6 bg-white', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 text-gray-600">
          <Clock className="w-5 h-5 animate-spin" />
          <span>Loading changes...</span>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div
        className={cn('border border-red-300 rounded-lg p-6 bg-red-50', className)}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900 mb-1">
              Failed to Load Changes
            </h3>
            <p className="text-sm text-red-700">
              {error.message || 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle no changes
  if (!activeDiff) {
    if (!showEmpty) {
      return null;
    }

    return (
      <div
        className={cn('border border-green-300 rounded-lg p-6 bg-green-50', className)}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-green-900 mb-1">
              No Pending Changes
            </h3>
            <p className="text-sm text-green-700">
              This invoice has no uncommitted changes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render changes summary
  return (
    <ChangesSummaryContent
      diff={activeDiff}
      fieldRegistry={fieldRegistry}
      className={className}
    />
  );
});

/**
 * ChangesSummaryContent component props
 */
interface ChangesSummaryContentProps {
  diff: InvoiceDiff;
  fieldRegistry: any;
  className?: string;
}

/**
 * ChangesSummaryContent component
 *
 * Renders the actual changes content with all diffs.
 */
const ChangesSummaryContent = memo<ChangesSummaryContentProps>(function ChangesSummaryContent({
  diff,
  fieldRegistry,
  className,
}) {
  const { summary, patch, fromRevision, toRevision, createdAt } = diff;

  // Separate patch operations by type
  const fieldChanges = summary.fields.filter(
    (f) => !f.path.match(/\/lineItems\/\d+/) && !f.path.match(/\/customer\//) && !f.path.match(/\/vessel\//)
  );

  const lineItemOps = patch.filter((op) => op.path.match(/\/lineItems\/\d+/));
  const customerOps = patch.filter((op) => op.path.startsWith('/customer/'));
  const vesselOps = patch.filter((op) => op.path.startsWith('/vessel/'));

  return (
    <div
      className={cn('border rounded-lg overflow-hidden bg-white', className)}
      role="article"
      aria-label="Invoice changes summary"
    >
      {/* Header */}
      <div className="bg-yellow-50 border-b border-yellow-200 p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-yellow-900 mb-1">
              Pending Changes
            </h2>
            <p className="text-sm text-yellow-700">
              {summary.totalChanges} change{summary.totalChanges !== 1 ? 's' : ''} pending approval
            </p>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-3 pt-3 border-t border-yellow-200 flex flex-wrap gap-x-4 gap-y-1 text-xs text-yellow-800">
          {toRevision && (
            <span>
              Version: {toRevision.revisionNumber}
            </span>
          )}
          {toRevision?.actorName && (
            <span>
              By: {toRevision.actorName}
            </span>
          )}
          <span>
            {new Date(createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Changes by Category */}
      <div className="p-4 space-y-4">
        {/* Category Overview */}
        {(summary.categories.customer || summary.categories.vessel || summary.categories.items || summary.categories.pricing || summary.categories.metadata) && (
          <div className="flex flex-wrap gap-2 pb-2 border-b">
            {summary.categories.customer && (
              <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">
                {summary.categories.customer} Customer
              </span>
            )}
            {summary.categories.vessel && (
              <span className="text-xs font-medium px-2 py-1 rounded bg-purple-100 text-purple-800">
                {summary.categories.vessel} Vessel
              </span>
            )}
            {summary.categories.items && (
              <span className="text-xs font-medium px-2 py-1 rounded bg-orange-100 text-orange-800">
                {summary.categories.items} Line Items
              </span>
            )}
            {summary.categories.pricing && (
              <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-800">
                {summary.categories.pricing} Pricing
              </span>
            )}
            {summary.categories.metadata && (
              <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-800">
                {summary.categories.metadata} Metadata
              </span>
            )}
          </div>
        )}

        {/* Customer Changes */}
        {hasNestedObjectChanges(patch, '/customer') && (
          <NestedObjectDiff
            operations={customerOps}
            objectPath="/customer"
            objectLabel="Customer"
            fieldRegistry={fieldRegistry}
          />
        )}

        {/* Vessel Changes */}
        {hasNestedObjectChanges(patch, '/vessel') && (
          <NestedObjectDiff
            operations={vesselOps}
            objectPath="/vessel"
            objectLabel="Vessel"
            fieldRegistry={fieldRegistry}
          />
        )}

        {/* Line Items Changes */}
        {lineItemOps.length > 0 && (
          <ArrayDiff
            operations={lineItemOps}
            arrayPath="/lineItems"
            itemLabel="Line Item"
            fieldRegistry={fieldRegistry}
          />
        )}

        {/* Field Changes */}
        {fieldChanges.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Field Changes
            </h3>
            <FieldDiffList
              changes={fieldChanges}
              fieldRegistry={fieldRegistry}
            />
          </div>
        )}
      </div>
    </div>
  );
});