import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInvoice } from '../../context/InvoiceContext.jsx';
import { formatTimeAgo } from '../../../js/utils/formatters.js';

// Import Magic UI components
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { Label } from '../ui/label.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Badge } from '../ui/badge.jsx';
import { Separator } from '../ui/separator.jsx';
import { Textarea } from '../ui/textarea.jsx';
import {
  MessageSquare,
  Plus,
  Send,
  Edit2,
  Trash2,
  Reply,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  User
} from 'lucide-react';

// Mock user context - in production this would come from a proper auth context
const useUser = () => {
  // This should be replaced with actual user context
  return {
    currentUser: {
      id: '1',
      name: 'Current User',
      email: 'user@example.com',
      role: 'master'
    }
  };
};

const CommentInput = ({ onAddComment, expanded, onExpand, onCollapse }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAddComment(text.trim());
    setText('');
    onCollapse();
  };

  const handleCancel = () => {
    setText('');
    onCollapse();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [expanded]);

  return (
    <div className="space-y-3">
      <Label htmlFor="new-comment" className="text-sm font-medium">
        Add Comment
      </Label>
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          id="new-comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={onExpand}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment..."
          className={`transition-all duration-200 ${expanded ? 'min-h-[80px]' : 'min-h-[36px]'}`}
          rows={expanded ? 3 : 1}
        />

        {expanded && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!text.trim()}
            >
              <Send className="h-3 w-3 mr-1" />
              Add Comment
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const CommentItem = ({ comment, onEdit, onDelete, onReply, canEdit, canReply }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [replyText, setReplyText] = useState('');

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    onEdit(comment.id, editText.trim());
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(comment.text);
    setIsEditing(false);
  };

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
    setIsReplying(false);
  };

  const handleCancelReply = () => {
    setReplyText('');
    setIsReplying(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleReplyKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    } else if (e.key === 'Escape') {
      handleCancelReply();
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium text-sm">{comment.author}</div>
            <div className="text-xs text-muted-foreground">
              {formatTimeAgo(new Date(comment.timestamp))}
              {comment.edited && (
                <span className="ml-1 text-muted-foreground">(edited)</span>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 p-0"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(comment.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="min-h-[60px]"
            rows={2}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSaveEdit} disabled={!editText.trim()}>
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm whitespace-pre-wrap">{comment.text}</div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 space-y-2 border-l-2 border-muted pl-4">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-medium text-sm">{reply.author}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatTimeAgo(new Date(reply.timestamp))}
                  </span>
                </div>
              </div>
              <div className="text-sm whitespace-pre-wrap ml-8">{reply.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {canReply && (
        <div className="space-y-2">
          {!isReplying ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsReplying(true)}
              className="text-xs"
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          ) : (
            <div className="space-y-2 ml-6">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleReplyKeyDown}
                placeholder="Write a reply..."
                className="min-h-[60px]"
                rows={2}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSubmitReply} disabled={!replyText.trim()}>
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelReply}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CommentsList = ({ comments, onEdit, onDelete, onReply, currentUser }) => {
  if (!comments || comments.length === 0) {
    return (
      <Alert>
        <MessageSquare className="h-4 w-4" />
        <AlertDescription>
          No comments yet. Add the first comment above.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const canEdit = currentUser &&
          (currentUser.email === comment.authorEmail || currentUser.role === 'master');
        const canReply = currentUser && currentUser.role === 'master';

        return (
          <CommentItem
            key={comment.id}
            comment={comment}
            onEdit={onEdit}
            onDelete={onDelete}
            onReply={onReply}
            canEdit={canEdit}
            canReply={canReply}
          />
        );
      })}
    </div>
  );
};

export const NotesFormReact = () => {
  const { state, actions } = useInvoice();
  const { currentUser } = useUser();
  const [inputExpanded, setInputExpanded] = useState(false);

  // Get current comments from context
  const comments = state.notes?.comments || [];

  // Save comment to database
  const saveCommentToDatabase = useCallback(async (comment) => {
    try {
      // Get current invoice from sidebar or state
      const currentInvoiceId = state.currentInvoiceId;
      if (!currentInvoiceId) {
        console.log('📝 No current invoice found, cannot save comment');
        return;
      }

      console.log('💾 Saving comment to invoice:', currentInvoiceId);

      const response = await fetch(`/api/invoices/${currentInvoiceId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          comment: comment.text,
          author: comment.author,
          authorEmail: comment.authorEmail,
          timestamp: comment.timestamp
        })
      });

      if (response.ok) {
        console.log('✅ Comment saved to database successfully');
      } else {
        console.warn('⚠️ Failed to save comment:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Error saving comment:', error);
    }
  }, [state.currentInvoiceId]);

  const handleAddComment = useCallback((text) => {
    if (!currentUser) {
      console.warn('⚠️ No current user, cannot add comment');
      return;
    }

    const comment = {
      id: Date.now().toString(),
      text,
      author: currentUser.name,
      authorEmail: currentUser.email,
      timestamp: new Date().toISOString(),
      replies: []
    };

    // Update state
    const updatedComments = [...comments, comment];
    actions.updateNotes({ comments: updatedComments });

    // Save to database
    saveCommentToDatabase(comment);

    console.log('📝 Added new comment:', comment);
  }, [currentUser, comments, actions, saveCommentToDatabase]);

  const handleEditComment = useCallback((commentId, newText) => {
    const updatedComments = comments.map(comment =>
      comment.id === commentId
        ? {
            ...comment,
            text: newText,
            edited: true,
            editedAt: new Date().toISOString()
          }
        : comment
    );

    actions.updateNotes({ comments: updatedComments });
    console.log('📝 Comment edited:', commentId);
  }, [comments, actions]);

  const handleDeleteComment = useCallback((commentId) => {
    // Simple confirmation for now - in production, use a proper modal
    if (window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      const filteredComments = comments.filter(comment => comment.id !== commentId);
      actions.updateNotes({ comments: filteredComments });
      console.log('📝 Comment deleted:', commentId);
    }
  }, [comments, actions]);

  const handleReplyToComment = useCallback((commentId, replyText) => {
    if (!currentUser || currentUser.role !== 'master') {
      console.warn('Only master accounts can reply to comments');
      return;
    }

    const reply = {
      id: Date.now().toString(),
      text: replyText,
      author: currentUser.name,
      authorEmail: currentUser.email,
      timestamp: new Date().toISOString()
    };

    const updatedComments = comments.map(comment =>
      comment.id === commentId
        ? {
            ...comment,
            replies: [...(comment.replies || []), reply]
          }
        : comment
    );

    actions.updateNotes({ comments: updatedComments });
    console.log('📝 Added reply to comment:', commentId, reply);
  }, [currentUser, comments, actions]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Notes & Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <CommentInput
          onAddComment={handleAddComment}
          expanded={inputExpanded}
          onExpand={() => setInputExpanded(true)}
          onCollapse={() => setInputExpanded(false)}
        />

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Comments ({comments.length})
            </h3>
            {comments.length > 0 && (
              <Badge variant="outline">
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <CommentsList
            comments={comments}
            onEdit={handleEditComment}
            onDelete={handleDeleteComment}
            onReply={handleReplyToComment}
            currentUser={currentUser}
          />
        </div>

        {comments.length > 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              All comments are synchronized with the invoice.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default NotesFormReact;