import React, { useState, useRef } from 'react';
import { Button, Textarea, Avatar, AvatarFallback, AvatarImage } from '../magic/index';

interface LongPressCommentProps {
  /** Callback when comment is submitted with text and target element */
  onCommentAdd: (text: string, targetElement: HTMLElement) => void;
  /** Optional callback when modal closes */
  onClose?: () => void;
  /** Children elements to wrap with long-press detection */
  children: React.ReactNode;
  /** Custom class names for the container */
  className?: string;
  /** Comment number badge to display */
  commentNumber?: number;
  /** Whether this element is highlighted */
  isHighlighted?: boolean;
  /** Data attribute for service ID */
  'data-service-id'?: string;
  /** Total number of existing comments (to calculate next badge number) */
  totalComments?: number;
  /** Current user's name for avatar */
  userName?: string;
  /** Current user's email for avatar fallback */
  userEmail?: string;
  /** Current user's avatar image URL */
  userAvatar?: string;
}

/**
 * LongPressComment Component
 *
 * Wraps invoice preview content to detect long-press gestures on mobile.
 * On long-press (500ms), triggers haptic feedback and shows a comment modal.
 * Prevents native iOS context menu from appearing.
 */
// Helper function to get initials from name or email
const getInitials = (nameOrEmail?: string): string => {
  if (!nameOrEmail) return '?';

  // If it's an email, use the part before @
  if (nameOrEmail.includes('@')) {
    const emailPart = nameOrEmail.split('@')[0];
    return emailPart.substring(0, 2).toUpperCase();
  }

  // If it's a name, get first letters of first two words
  const words = nameOrEmail.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return nameOrEmail.substring(0, 2).toUpperCase();
};

export function LongPressComment({
  onCommentAdd,
  onClose,
  children,
  className = '',
  commentNumber,
  isHighlighted,
  'data-service-id': dataServiceId,
  totalComments = 0,
  userName,
  userEmail,
  userAvatar
}: LongPressCommentProps) {
  // State to control modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for comment text
  const [commentText, setCommentText] = useState('');

  // Calculate the next badge number when adding a new comment
  const displayBadgeNumber = commentNumber !== undefined ? commentNumber : (isModalOpen ? totalComments + 1 : undefined);

  // Ref to track long-press timer
  const longPressTimerRef = useRef<number | null>(null);

  // Ref to track if touch has moved (to prevent false positives)
  const hasTouchMovedRef = useRef(false);

  // Ref to track the target element that was long-pressed
  const targetElementRef = useRef<HTMLElement | null>(null);

  // Ref to the wrapper div
  const wrapperRef = useRef<HTMLDivElement>(null);

  // State to store modal position (captured once when modal opens)
  const [modalPosition, setModalPosition] = useState<{ top: string; left: string } | null>(null);

  /**
   * Handle touch start - Begin long-press timer
   * Prevents native iOS context menu from appearing
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent native iOS pop-up/context menu
    e.preventDefault();

    // Store the target element
    targetElementRef.current = wrapperRef.current;

    // Reset movement flag
    hasTouchMovedRef.current = false;

    // Start 500ms timer for long-press detection
    longPressTimerRef.current = window.setTimeout(() => {
      // Only trigger if touch hasn't moved
      if (!hasTouchMovedRef.current) {
        handleLongPressConfirmed();
      }
    }, 500);
  };

  /**
   * Handle touch move - Cancel long-press if finger moves
   * Prevents accidental triggers while scrolling
   */
  const handleTouchMove = () => {
    // Mark that touch has moved
    hasTouchMovedRef.current = true;

    // Clear the long-press timer
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  /**
   * Handle touch end - Cancel long-press if finger is lifted early
   */
  const handleTouchEnd = () => {
    // Clear the long-press timer if still active
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  /**
   * Handle confirmed long-press
   * Triggers haptic feedback and opens comment modal
   */
  const handleLongPressConfirmed = () => {
    // Trigger subtle haptic feedback (50ms vibration)
    // Conditional check to prevent errors on unsupported browsers
    if ('vibrate' in navigator) {
      navigator.vibrate([50]);
    }

    // Capture the position once when modal opens
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const modalHeight = 300; // Approximate height of modal
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Position modal above if there's not enough space below but there is above
      const positionAbove = spaceBelow < modalHeight && spaceAbove > modalHeight;

      setModalPosition({
        top: positionAbove
          ? `${rect.top + window.scrollY - modalHeight - 8}px`
          : `${rect.bottom + window.scrollY + 8}px`,
        left: '50%'
      });
    }

    // Open the comment modal
    setIsModalOpen(true);
  };

  /**
   * Handle modal close
   * Resets comment text and closes modal
   */
  const handleCancel = () => {
    setCommentText('');
    setIsModalOpen(false);
    setModalPosition(null);
    onClose?.();
  };

  /**
   * Handle comment submission
   * Calls parent callback with comment text and target element
   */
  const handleAddComment = () => {
    if (commentText.trim() && targetElementRef.current) {
      onCommentAdd(commentText.trim(), targetElementRef.current);
      setCommentText('');
      setIsModalOpen(false);
      setModalPosition(null);
    }
  };

  return (
    <>
      {/* Main container with long-press detection and optional highlight */}
      <div
        ref={wrapperRef}
        data-service-id={dataServiceId}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative select-none [-webkit-touch-callout:none] ${
          isHighlighted || isModalOpen ? 'rounded-lg border-2 border-blue-500 bg-blue-500/5 z-[10000]' : ''
        } ${className}`}
        style={isModalOpen ? { position: 'relative', zIndex: 10000 } : undefined}
      >
        {/* Comment number badge - iPhone notification style inside border */}
        {(isHighlighted || isModalOpen) && displayBadgeNumber !== undefined && (
          <div className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white shadow-lg z-[100]">
            {displayBadgeNumber}
          </div>
        )}

        {children}
      </div>

      {/* Comment Modal - Positioned below line item */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          {/* Subtle backdrop blur */}
          <div className="absolute inset-0 backdrop-blur-[2px] bg-black/[0.02] pointer-events-auto" onClick={handleCancel} />

          <div
            className="absolute w-full max-w-sm pointer-events-auto"
            style={{
              top: modalPosition?.top || '50%',
              left: modalPosition?.left || '50%',
              transform: 'translateX(-50%)'
            }}
          >
            {/* Modal content - compact floating size */}
            <div
              className="relative w-full bg-white rounded-2xl shadow-2xl transform transition-transform duration-300 ease-out"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                const textarea = document.activeElement as HTMLTextAreaElement;
                if (textarea && textarea.tagName === 'TEXTAREA') {
                  textarea.blur();
                }
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Modal header - compact */}
            <div
              className="px-4 pt-4 pb-3 border-b border-slate-200 flex items-center justify-between"
              onClick={() => {
                const textarea = document.activeElement as HTMLTextAreaElement;
                if (textarea && textarea.tagName === 'TEXTAREA') {
                  textarea.blur();
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {userAvatar && <AvatarImage src={userAvatar} alt={userName || userEmail || 'User'} />}
                  <AvatarFallback>{getInitials(userName || userEmail)}</AvatarFallback>
                </Avatar>
                <h2 className="text-base font-semibold text-slate-900">Add a Comment</h2>
              </div>
              {displayBadgeNumber !== undefined && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white shadow-lg">
                  {displayBadgeNumber}
                </div>
              )}
            </div>

            {/* Modal body - compact */}
            <div className="p-4 space-y-3">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Type your comment here..."
                className="min-h-[80px] resize-none w-full touch-auto text-sm"
                autoFocus
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />

              {/* Action buttons - compact */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancel();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancel();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddComment();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddComment();
                  }}
                  disabled={!commentText.trim()}
                  className="flex-1 bg-[#1e3a5f] hover:bg-[#2a4a7c] text-white disabled:bg-slate-300 disabled:text-slate-500"
                >
                  Add Comment
                </Button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
