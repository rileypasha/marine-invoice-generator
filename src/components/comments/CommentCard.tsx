import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../magic/index';

interface CommentCardProps {
  name: string;
  timestampISO: string;
  avatarUrl?: string;
  text: string;
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
  onReply?: (text: string) => void;
  onHighlight?: (commentId: string | null) => void;
  isHighlighted?: boolean;
  commentId?: string;
  isReply?: boolean;
}

/**
 * Formats a Date to "h:mm AM/PM Today" or "h:mm AM/PM MMM D" format
 */
function formatNiceTs(timestampISO: string): string {
  const date = new Date(timestampISO);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (isToday) {
    return `${time} Today`;
  }

  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${time} ${month} ${day}`;
}

/**
 * CommentMenu - Kebab menu component for edit/delete actions
 */
function CommentMenu({
  onEdit,
  onDelete
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 hover:bg-slate-200 rounded transition-colors">
          <MoreVertical className="h-4 w-4 text-slate-600" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Edit2 className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * CommentCard - Enhanced comment component with kebab menu, inline reply, and edit mode
 *
 * Key features:
 * - Avatar positioned inside the card at top-left (28×28px)
 * - Name width matches timestamp width exactly (enforced via refs)
 * - ResizeObserver + window resize listener for responsive width syncing
 * - Kebab menu (top-right) with Edit and Delete options
 * - Inline reply input (appears inside card on click)
 * - Edit mode (inline textarea with Save/Cancel buttons)
 * - Message body aligned with text column (no extra indent)
 * - Timestamp format: "h:mm AM/PM Today" or "h:mm AM/PM MMM D"
 */
export function CommentCard({
  name,
  timestampISO,
  avatarUrl,
  text,
  onEdit,
  onDelete,
  onReply,
  onHighlight,
  isHighlighted,
  commentId,
  isReply = false
}: CommentCardProps) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplyButtons, setShowReplyButtons] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  // Width sync logic
  useEffect(() => {
    const sync = () => {
      const w = timeRef.current?.offsetWidth ?? 0;
      if (nameRef.current && w) nameRef.current.style.width = `${w}px`;
    };
    const ro = new ResizeObserver(sync);
    if (timeRef.current) ro.observe(timeRef.current);
    window.addEventListener('resize', sync);
    sync();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);

  const ts = formatNiceTs(timestampISO);

  const handleCardClick = () => {
    // Only show reply input if not editing AND reply input isn't already shown
    if (!isEditing && onReply && !showReplyInput) {
      setShowReplyInput(true);
    }
  };

  const handleReplyInputFocus = () => {
    setShowReplyButtons(true);
  };

  const handleReplySubmit = () => {
    if (replyText.trim() && onReply) {
      onReply(replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
      setShowReplyButtons(false);
    }
  };

  const handleReplyCancel = () => {
    setReplyText('');
    setShowReplyInput(false);
    setShowReplyButtons(false);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditText(text);
  };

  const handleEditSave = () => {
    if (editText.trim() && onEdit) {
      onEdit(editText.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditText(text);
  };

  const handleDeleteClick = () => {
    if (onDelete) {
      onDelete();
    }
  };

  return (
    <>
      <div
        className={`relative rounded-2xl border bg-slate-50 p-3 transition-all duration-200 cursor-pointer ${
          isHighlighted
            ? 'shadow-md -translate-y-0.5'
            : 'shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-slate-100'
        }`}
        onMouseEnter={() => commentId && onHighlight?.(commentId)}
        onMouseLeave={() => onHighlight?.(null)}
        onClick={handleCardClick}
      >
      {/* Kebab menu - absolute position top-right */}
      {(onEdit || onDelete) && (
        <div className="absolute right-2 top-2">
          <CommentMenu
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
          />
        </div>
      )}

      {/* Avatar + Name/Timestamp + Message */}
      <div className="flex items-start gap-3">
        <img
          src={avatarUrl || '/default-avatar.png'}
          alt=""
          className="h-7 w-7 rounded-full"
        />
        <div className="flex-1">
          {/* Name/timestamp with width sync */}
          <div className="flex flex-col leading-tight">
            <span
              ref={nameRef}
              className="text-sm font-semibold tracking-tight leading-tight text-slate-900 truncate"
              title={name}
            >
              {name}
            </span>
            <span
              ref={timeRef}
              className="text-[11px] text-slate-500 leading-tight tabular-nums"
            >
              {ts}
            </span>
          </div>

          {/* Message body or edit mode */}
          {isEditing ? (
            <div className="mt-2">
              <textarea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditCancel}
                  className="text-slate-900"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleEditSave}
                  className="bg-[#1e3a5f] hover:bg-[#16304d] text-white"
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-800">{text}</div>
          )}

          {/* Inline reply input (click-to-show) */}
          {onReply && !isEditing && showReplyInput && (
            <div className="mt-2">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={handleReplyInputFocus}
                placeholder="Reply"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              {showReplyButtons && (
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReplyCancel();
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReplySubmit();
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-[#1e3a5f] hover:bg-[#16304d] rounded-lg transition-colors"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </>
  );
}
