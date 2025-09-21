import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '../ui/alert-dialog.jsx';

export const UnsavedChangesDialog = ({
  isOpen,
  onClose,
  options = {}
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const config = {
    type: 'navigation',
    title: 'Unsaved Changes',
    message: 'You have unsaved changes that will be lost.',
    changes: [],
    showSave: true,
    showDiscard: true,
    saveText: 'Save Changes',
    discardText: 'Discard Changes',
    cancelText: 'Cancel',
    ...options
  };

  const handleAction = async (action) => {
    if (action === 'save') {
      setIsLoading(true);
      try {
        await onClose?.(action);
      } finally {
        setIsLoading(false);
      }
    } else {
      onClose?.(action);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleAction('cancel');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <AlertDialog open={isOpen} onOpenChange={() => handleAction('cancel')}>
      <AlertDialogContent
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-description"
      >
        <AlertDialogHeader>
          <div
            className="flex-shrink-0 w-6 h-6 text-amber-500"
            aria-hidden="true"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <AlertDialogTitle id="unsaved-dialog-title">
            {config.title}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription id="unsaved-dialog-description">
          {config.message}
        </AlertDialogDescription>

        {config.changes && config.changes.length > 0 && (
          <div className="bg-muted border border-border rounded-md p-3 mb-4">
            <p className="text-sm font-medium mb-2">Changed sections:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {config.changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleAction('cancel')}>
            {config.cancelText}
          </AlertDialogCancel>

          {config.showDiscard && (
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleAction('discard')}
            >
              {config.discardText}
            </AlertDialogAction>
          )}

          {config.showSave && (
            <AlertDialogAction
              onClick={() => handleAction('save')}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </div>
              ) : (
                config.saveText
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UnsavedChangesDialog;