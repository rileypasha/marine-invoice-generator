import React, { useEffect } from 'react';
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

export const ConfirmModal = ({
  isOpen,
  onClose,
  options = {}
}) => {
  const config = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger', // 'danger', 'warning', 'info'
    ...options
  };

  const handleConfirm = () => {
    onClose?.(true);
  };

  const handleCancel = () => {
    onClose?.(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        // In single-button mode, Escape acts like clicking the action button
        if (!config.cancelText) {
          handleConfirm();
        } else {
          handleCancel();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, config.cancelText]);

  const getVariant = () => {
    switch (config.type) {
      case 'danger':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getIcon = () => {
    switch (config.type) {
      case 'danger':
        return (
          <div className="flex-shrink-0 w-6 h-6 text-red-500" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="flex-shrink-0 w-6 h-6 text-amber-500" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
        );
      case 'info':
        return (
          <div className="flex-shrink-0 w-6 h-6 text-blue-500" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleCancel}>
      <AlertDialogContent
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <AlertDialogHeader>
          {getIcon()}
          <AlertDialogTitle id="confirm-title">
            {config.title}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription id="confirm-message">
          {config.message}
        </AlertDialogDescription>

        <AlertDialogFooter>
          {config.cancelText && (
            <AlertDialogCancel onClick={handleCancel}>
              {config.cancelText}
            </AlertDialogCancel>
          )}

          <AlertDialogAction
            variant={getVariant()}
            onClick={handleConfirm}
            autoFocus={!config.cancelText || config.type !== 'danger'}
          >
            {config.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmModal;