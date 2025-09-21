import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from '../ui/sheet.jsx';
import { Button } from '../ui/button.jsx';
import { cn } from '../../lib/utils.js';

export const MobileMenu = ({
  children,
  triggerClassName,
  contentClassName,
  side = 'left',
  size = 'default',
  title = 'Menu',
  showTitle = true,
  enableSwipeToClose = true,
  onOpenChange,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragCurrentX, setDragCurrentX] = useState(0);
  const contentRef = useRef(null);
  const touchStartRef = useRef(null);

  const handleOpenChange = useCallback((open) => {
    setIsOpen(open);
    onOpenChange?.(open);
  }, [onOpenChange]);

  // Touch/swipe handlers for mobile gesture support
  const handleTouchStart = useCallback((e) => {
    if (!enableSwipeToClose || !isOpen) return;

    const touch = e.touches[0];
    setDragStartX(touch.clientX);
    setDragCurrentX(touch.clientX);
    touchStartRef.current = touch.clientX;
    setIsDragging(true);
  }, [enableSwipeToClose, isOpen]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !enableSwipeToClose) return;

    const touch = e.touches[0];
    setDragCurrentX(touch.clientX);

    // Calculate drag distance
    const dragDistance = touch.clientX - dragStartX;

    // Only allow dragging in the direction that would close the menu
    const shouldUpdate = (side === 'left' && dragDistance < 0) ||
                        (side === 'right' && dragDistance > 0);

    if (shouldUpdate && contentRef.current) {
      // Apply transform for visual feedback
      const transform = side === 'left'
        ? `translateX(${Math.min(0, dragDistance)}px)`
        : `translateX(${Math.max(0, dragDistance)}px)`;
      contentRef.current.style.transform = transform;
    }
  }, [isDragging, enableSwipeToClose, dragStartX, side]);

  const handleTouchEnd = useCallback((e) => {
    if (!isDragging || !enableSwipeToClose) return;

    const dragDistance = dragCurrentX - dragStartX;
    const threshold = 100; // pixels to trigger close

    // Determine if swipe was sufficient to close
    const shouldClose = (side === 'left' && dragDistance < -threshold) ||
                       (side === 'right' && dragDistance > threshold);

    if (shouldClose) {
      handleOpenChange(false);
    }

    // Reset transform
    if (contentRef.current) {
      contentRef.current.style.transform = '';
    }

    setIsDragging(false);
    setDragStartX(0);
    setDragCurrentX(0);
    touchStartRef.current = null;
  }, [isDragging, enableSwipeToClose, dragCurrentX, dragStartX, side, handleOpenChange]);

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleOpenChange]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange} {...props}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex items-center justify-center p-2 md:hidden',
            triggerClassName
          )}
          aria-label="Open mobile menu"
        >
          {/* Hamburger Icon */}
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </Button>
      </SheetTrigger>

      <SheetContent
        ref={contentRef}
        side={side}
        size={size}
        className={cn(
          'flex flex-col',
          contentClassName
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {showTitle && (
          <SheetHeader className="mb-4">
            <SheetTitle>{title}</SheetTitle>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-4 h-6 w-6 p-0"
                aria-label="Close menu"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </SheetClose>
          </SheetHeader>
        )}

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Hook for mobile menu state management
export const useMobileMenu = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);
  const [isAnimating, setIsAnimating] = useState(false);

  const open = useCallback(() => {
    setIsAnimating(true);
    setIsOpen(true);
    setTimeout(() => setIsAnimating(false), 300); // Match CSS transition duration
  }, []);

  const close = useCallback(() => {
    setIsAnimating(true);
    setIsOpen(false);
    setTimeout(() => setIsAnimating(false), 300);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  return {
    isOpen,
    isAnimating,
    open,
    close,
    toggle,
    setIsOpen
  };
};

export default MobileMenu;