import React, { useState, useEffect, useCallback } from 'react';
import { formatTimeAgo } from '../../../js/utils/formatters.js';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card.jsx';
import { Button } from '../ui/button.jsx';
import { Textarea } from '../ui/textarea.jsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog.jsx';
import { CommentItem } from './CommentItem.jsx';
import { useComments } from '../../hooks/useComments.js';

export const CommentsPanel = ({
  state,
  userManager,
  className,
  showTitle = true,
  ...props
}) => {
  const [mounted, setMounted] = useState(false);
  const {
    comments,
    isLoading,
    error,
    addComment,
    updateComment,
    deleteComment,
    addReply,
    refresh
  } = useComments(state);

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setMounted(true);
    if (userManager) {
      setCurrentUser(userManager.getCurrentUser());
    }
  }, [userManager]);

  // Subscribe to state changes
  useEffect(() => {
    if (!state || !mounted) return;

    const unsubscribe = state.subscribe(() => {
      refresh();
    });

    // Initial load
    refresh();

    return unsubscribe;
  }, [state, mounted, refresh]);

  const handleAddComment = useCallback(async (text) => {
    if (!currentUser) return;

    const comment = {
      id: Date.now().toString(),
      text: text.trim(),
      author: currentUser.name,
      authorEmail: currentUser.email,
      timestamp: new Date().toISOString(),
      replies: []
    };

    await addComment(comment);
  }, [currentUser, addComment]);

  const handleEditComment = useCallback(async (commentId, newText) => {
    const updatedData = {
      text: newText.trim(),
      edited: true,
      editedAt: new Date().toISOString()
    };

    await updateComment(commentId, updatedData);
  }, [updateComment]);

  const handleDeleteComment = useCallback(async (commentId) => {
    await deleteComment(commentId);
  }, [deleteComment]);

  const handleAddReply = useCallback(async (commentId, text) => {
    if (!currentUser || currentUser.role !== 'master') return;

    const reply = {
      id: Date.now().toString(),
      text: text.trim(),
      author: currentUser.name,
      authorEmail: currentUser.email,
      timestamp: new Date().toISOString()
    };

    await addReply(commentId, reply);
  }, [currentUser, addReply]);

  if (!mounted) {
    return null;
  }

  return (
    <Card className={className} {...props}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
      )}

      <CardContent>
        {error && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No comments yet</p>
            <p className="text-sm">Be the first to add a comment!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUser={currentUser}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                onReply={handleAddReply}
              />
            ))}
          </div>
        )}

        {/* Add Comment Section */}
        {currentUser && (
          <AddCommentForm onSubmit={handleAddComment} />
        )}
      </CardContent>
    </Card>
  );
};

// Component for adding new comments
const AddCommentForm = ({ onSubmit }) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedText = text.trim();
    if (!trimmedText) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmedText);
      setText('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 pt-4 border-t">
      <div className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          rows={3}
          disabled={isSubmitting}
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Press Ctrl+Enter to submit
          </p>
          <Button
            type="submit"
            size="sm"
            disabled={!text.trim() || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default CommentsPanel;