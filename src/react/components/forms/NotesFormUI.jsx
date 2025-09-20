import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Button,
  Textarea,
  Badge,
  Avatar,
  AvatarFallback
} from '../index.js';

const NotesFormUI = ({
  notesData = {},
  onNotesChange,
  onAddComment,
  currentUser = null,
  isLoading = false
}) => {
  const { generalNotes = '', comments = [] } = notesData;
  const [newComment, setNewComment] = useState('');
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);

  const handleGeneralNotesChange = (value) => {
    if (onNotesChange) {
      onNotesChange({
        ...notesData,
        generalNotes: value
      });
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment = {
      id: Date.now(),
      text: newComment.trim(),
      author: currentUser?.name || 'Anonymous',
      authorEmail: currentUser?.email || '',
      timestamp: new Date().toISOString(),
      replies: []
    };

    if (onAddComment) {
      onAddComment(comment);
    }

    setNewComment('');
    setIsCommentExpanded(false);
  };

  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAuthorInitials = (authorName) => {
    if (!authorName) return 'A';
    return authorName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">

      {/* General Notes Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General Notes</CardTitle>
          <CardDescription>
            Add special instructions, terms, or additional information for this invoice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="general-notes">Notes</Label>
            <Textarea
              id="general-notes"
              placeholder="Enter any special notes, instructions, or terms for this invoice..."
              value={generalNotes}
              onChange={(e) => handleGeneralNotesChange(e.target.value)}
              disabled={isLoading}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              These notes will appear on the final invoice document
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Comments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comments & Discussion</CardTitle>
          <CardDescription>
            Internal comments for team collaboration (not shown on final invoice)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Add New Comment */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-comment">Add Comment</Label>
              <Textarea
                id="new-comment"
                placeholder={isCommentExpanded ? "Type your comment here... (Press Enter to post, Shift+Enter for new line)" : "Click to add a comment..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onFocus={() => setIsCommentExpanded(true)}
                onKeyDown={handleCommentKeyDown}
                disabled={isLoading}
                rows={isCommentExpanded ? 3 : 1}
                className="resize-none transition-all duration-200"
              />
            </div>

            {isCommentExpanded && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isLoading}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
                  </svg>
                  Add Comment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewComment('');
                    setIsCommentExpanded(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Comments List */}
          {comments.length > 0 ? (
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">
                  Comments ({comments.length})
                </h4>
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {getAuthorInitials(comment.author)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(comment.timestamp)}
                          </span>
                          {comment.authorEmail === currentUser?.email && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground border-t">
              <svg className="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">No comments yet</p>
              <p className="text-xs">Start a discussion with your team</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-blue-900">Tips</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• General notes will appear on the printed invoice</li>
                <li>• Comments are for internal team communication only</li>
                <li>• Use Shift+Enter to create line breaks in comments</li>
                <li>• Comments are automatically saved when added</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotesFormUI;