import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { Label } from '../ui/label.jsx';

export const PromptModal = ({
  isOpen,
  onClose,
  mode = 'prompt', // 'prompt', 'alert', 'confirm'
  options = {}
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const config = {
    title: mode === 'prompt' ? 'Enter Name' : mode === 'alert' ? 'Alert' : 'Confirm',
    placeholder: 'Enter name...',
    defaultValue: '',
    message: '',
    confirmText: mode === 'prompt' ? 'Save' : mode === 'alert' ? 'OK' : 'Continue',
    cancelText: 'Cancel',
    ...options
  };

  useEffect(() => {
    if (isOpen) {
      setInputValue(config.defaultValue || '');
      if (mode === 'prompt' && inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 100);
      }
    }
  }, [isOpen, config.defaultValue, mode]);

  const handleConfirm = () => {
    if (mode === 'prompt') {
      const value = inputValue.trim();
      onClose?.(value || null);
    } else if (mode === 'alert') {
      onClose?.(true);
    } else if (mode === 'confirm') {
      onClose?.(true);
    }
  };

  const handleCancel = () => {
    if (mode === 'prompt') {
      onClose?.(null);
    } else if (mode === 'confirm') {
      onClose?.(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (mode === 'alert') {
        handleConfirm();
      } else {
        handleCancel();
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, inputValue, mode]);

  return (
    <Dialog open={isOpen} onOpenChange={mode === 'alert' ? handleConfirm : handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          {config.message && (
            <DialogDescription>{config.message}</DialogDescription>
          )}
        </DialogHeader>

        {mode === 'prompt' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-input">Name</Label>
              <Input
                id="prompt-input"
                ref={inputRef}
                type="text"
                placeholder={config.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
        )}

        {mode !== 'prompt' && config.message && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {config.message}
            </p>
          </div>
        )}

        <DialogFooter>
          {mode !== 'alert' && (
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              {config.cancelText}
            </Button>
          )}

          <Button
            onClick={handleConfirm}
            variant={mode === 'confirm' ? 'default' : 'default'}
          >
            {config.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PromptModal;