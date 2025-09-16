import React, { useState, useCallback, useEffect } from 'react';
import { useInvoice } from '../contexts/InvoiceContext';
import { Invoice, InvoiceState, SaveButtonProps } from '../types/invoice';

/**
 * Smart SaveButton Component
 *
 * This component solves the core UX problem where users editing existing invoices
 * were forced to create new invoices instead of updating the existing ones.
 *
 * The button intelligently:
 * - Shows "Save" for new invoices (creates new)
 * - Shows "Update" for existing invoices (saves changes)
 * - Shows "Save Changes" for modified invoices
 * - Disables for finalized invoices
 * - Provides visual feedback for different states
 */
export const SaveButton: React.FC<SaveButtonProps> = ({
  invoice: overrideInvoice,
  onSave,
  onError,
  disabled = false,
  children
}) => {
  const { smartSave, currentInvoice, loading } = useInvoice();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  // Use override invoice or current context invoice
  const invoice = overrideInvoice || currentInvoice;

  // Determine save action and button state
  const getSaveAction = useCallback(() => {
    if (!invoice) {
      return {
        action: 'create',
        label: 'Save Invoice',
        canSave: true,
        description: 'Create new invoice'
      };
    }

    switch (invoice.state) {
      case InvoiceState.SAVED:
        return {
          action: 'no-action',
          label: 'Saved',
          canSave: false,
          description: 'Invoice is up to date'
        };

      case InvoiceState.MODIFIED:
        return {
          action: 'update',
          label: 'Save Changes',
          canSave: true,
          description: 'Update existing invoice'
        };

      case InvoiceState.FINALIZED:
        return {
          action: 'cannot-save',
          label: 'Finalized',
          canSave: false,
          description: 'Invoice is finalized and cannot be changed'
        };

      default:
        return {
          action: 'unknown',
          label: 'Save',
          canSave: false,
          description: 'Unknown invoice state'
        };
    }
  }, [invoice]);

  const saveAction = getSaveAction();

  // Handle save operation
  const handleSave = useCallback(async () => {
    if (!saveAction.canSave || disabled || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      let savedInvoice: Invoice;

      if (invoice) {
        // Update existing invoice using smart save
        savedInvoice = await smartSave({
          id: invoice.id,
          title: invoice.title,
          data: invoice.data,
          metadata: invoice.metadata
        });
      } else {
        // This would be called from a form component that provides the data
        throw new Error('No invoice data to save. SaveButton should be used with invoice context or override.');
      }

      setLastSaveTime(new Date());

      // Notify parent component
      if (onSave) {
        onSave(savedInvoice);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save invoice';

      if (onError) {
        onError(errorMessage);
      } else {
        console.error('Save error:', errorMessage);
        // You might want to show a toast notification here
      }
    } finally {
      setIsSaving(false);
    }
  }, [invoice, smartSave, saveAction.canSave, disabled, isSaving, onSave, onError]);

  // Auto-save indicator
  const showSaveIndicator = lastSaveTime && (Date.now() - lastSaveTime.getTime()) < 3000;

  // Button styling based on state
  const getButtonClassName = () => {
    const baseClasses = 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200';

    if (disabled || !saveAction.canSave) {
      return `${baseClasses} text-gray-400 bg-gray-100 cursor-not-allowed`;
    }

    if (isSaving || loading) {
      return `${baseClasses} text-blue-700 bg-blue-100 cursor-wait`;
    }

    switch (saveAction.action) {
      case 'create':
        return `${baseClasses} text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;

      case 'update':
        return `${baseClasses} text-white bg-orange-600 hover:bg-orange-700 focus:ring-orange-500`;

      case 'no-action':
        return `${baseClasses} text-green-700 bg-green-100 cursor-default`;

      case 'cannot-save':
        return `${baseClasses} text-gray-500 bg-gray-200 cursor-not-allowed`;

      default:
        return `${baseClasses} text-gray-500 bg-gray-200 cursor-not-allowed`;
    }
  };

  // Button content
  const getButtonContent = () => {
    if (children) {
      return children;
    }

    if (isSaving || loading) {
      return (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Saving...
        </>
      );
    }

    if (showSaveIndicator && saveAction.action === 'no-action') {
      return (
        <>
          <svg className="mr-2 h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
          Saved
        </>
      );
    }

    return saveAction.label;
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled || !saveAction.canSave || isSaving || loading}
        className={getButtonClassName()}
        title={saveAction.description}
        aria-label={`${saveAction.label}: ${saveAction.description}`}
      >
        {getButtonContent()}
      </button>

      {/* Success indicator */}
      {showSaveIndicator && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
          Saved at {lastSaveTime.toLocaleTimeString()}
        </div>
      )}

      {/* Invoice state indicator */}
      {invoice && (
        <div className="mt-1 text-xs text-gray-500 text-center">
          {invoice.state === InvoiceState.MODIFIED && (
            <span className="text-orange-600">• Unsaved changes</span>
          )}
          {invoice.state === InvoiceState.SAVED && (
            <span className="text-green-600">• Up to date</span>
          )}
          {invoice.state === InvoiceState.FINALIZED && (
            <span className="text-gray-600">• Finalized</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * SaveButtonForm Component
 *
 * A variant of SaveButton that works with form data instead of context invoice
 * Useful for forms that haven't yet created an invoice
 */
interface SaveButtonFormProps extends Omit<SaveButtonProps, 'invoice'> {
  formData: {
    title?: string;
    data?: any;
    metadata?: any;
  };
  existingInvoiceId?: string;
}

export const SaveButtonForm: React.FC<SaveButtonFormProps> = ({
  formData,
  existingInvoiceId,
  onSave,
  onError,
  disabled = false,
  children
}) => {
  const { smartSave } = useInvoice();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (disabled || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const savedInvoice = await smartSave({
        id: existingInvoiceId,
        title: formData.title,
        data: formData.data,
        metadata: formData.metadata
      });

      if (onSave) {
        onSave(savedInvoice);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save invoice';

      if (onError) {
        onError(errorMessage);
      } else {
        console.error('Save error:', errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  }, [formData, existingInvoiceId, smartSave, disabled, isSaving, onSave, onError]);

  const buttonLabel = existingInvoiceId ? 'Update Invoice' : 'Save Invoice';

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={disabled || isSaving}
      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
        disabled || isSaving
          ? 'bg-gray-400 cursor-not-allowed'
          : existingInvoiceId
            ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
      }`}
    >
      {isSaving ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Saving...
        </>
      ) : (
        children || buttonLabel
      )}
    </button>
  );
};

export default SaveButton;