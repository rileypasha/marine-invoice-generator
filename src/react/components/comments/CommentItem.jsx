import React, { useState, useCallback } from 'react';
import { formatTimeAgo } from '../../../js/utils/formatters.js';
import { Button } from '../ui/button.jsx';
import { Textarea } from '../ui/textarea.jsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog.jsx';
import { CommentReply } from './CommentReply.jsx';
import { cn } from '../../lib/utils.js';

export const CommentItem = ({
  comment,
  currentUser,
  onEdit,
  onDelete,
  onReply,
  className,
  ...props
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEditDelete = currentUser && (
    currentUser.email === comment.authorEmail ||
    currentUser.role === 'master'
  );
  const canReply = currentUser && currentUser.role === 'master';

  const handleStartEdit = useCallback(() => {
    setEditText(comment.text);
    setIsEditing(true);
  }, [comment.text]);

  const handleCancelEdit = useCallback(() => {
    setEditText(comment.text);
    setIsEditing(false);
  }, [comment.text]);

  const handleSaveEdit = useCallback(async () => {
    const trimmedText = editText.trim();
    if (!trimmedText) {
      alert('Comment cannot be empty. Please enter some text or cancel editing.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onEdit(comment.id, trimmedText);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [editText, onEdit, comment.id]);

  const handleStartReply = useCallback(() => {
    setReplyText('');
    setIsReplying(true);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyText('');
    setIsReplying(false);
  }, []);

  const handleSubmitReply = useCallback(async () => {
    const trimmedText = replyText.trim();
    if (!trimmedText) return;

    setIsSubmitting(true);
    try {
      await onReply(comment.id, trimmedText);
      setReplyText('');
      setIsReplying(false);
    } catch (error) {
      console.error('Failed to add reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [replyText, onReply, comment.id]);

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleReplyKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    } else if (e.key === 'Escape') {
      handleCancelReply();
    }
  }, [handleSubmitReply, handleCancelReply]);

  const formatCommentText = (text) => {
    return text.replace(/\n/g, '<br>');
  };

  return (
    <div
      className={cn('comment-item border rounded-lg p-4 space-y-3', className)}
      {...props}
    >
      {/* Comment Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{comment.author}</span>
            <span className="text-sm text-muted-foreground">
              {formatTimeAgo(new Date(comment.timestamp))}
              {comment.edited && (
                <span className="ml-1 italic">(edited)</span>
              )}
            </span>
          </div>
        </div>

        {canEditDelete && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartEdit}
              disabled={isEditing || isSubmitting}
              className="h-8 w-8 p-0"
              title="Edit comment"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  title="Delete comment"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="3,6 5,6 21,6" />
                    <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2" />
                  </svg>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this comment? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(comment.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Comment Content */}
      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleEditKeyDown}
            rows={3}
            disabled={isSubmitting}
            autoFocus
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to save, Escape to cancel
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editText.trim() || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="text-foreground whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: formatCommentText(comment.text)
          }}
        />
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 space-y-2 border-l-2 border-muted pl-4">
          {comment.replies.map((reply) => (
            <CommentReply
              key={reply.id}
              reply={reply}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}

      {/* Reply Section */}
      {canReply && (
        <div className="space-y-3">
          {!isReplying ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartReply}
              disabled={isSubmitting}
            >
              Reply
            </Button>
          ) : (
            <div className="ml-6 space-y-3">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleReplyKeyDown}
                placeholder="Write a reply..."
                rows={2}
                disabled={isSubmitting}
                autoFocus
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Press Enter to submit, Escape to cancel
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelReply}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitReply}
                    disabled={!replyText.trim() || isSubmitting}
                  >
                    {isSubmitting ? 'Replying...' : 'Reply'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentItem;