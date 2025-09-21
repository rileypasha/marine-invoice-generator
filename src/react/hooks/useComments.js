import { useState, useCallback } from 'react';

export const useComments = (state) => {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    if (!state) return;

    try {
      setError(null);
      const currentState = state.getState();
      const commentsData = currentState.notes?.comments || [];
      setComments(commentsData);
    } catch (err) {
      console.error('Error refreshing comments:', err);
      setError('Failed to load comments');
    }
  }, [state]);

  const addComment = useCallback(async (comment) => {
    if (!state) return;

    try {
      setIsLoading(true);
      setError(null);

      const currentState = state.getState();
      const existingComments = currentState.notes?.comments || [];
      const newComments = [...existingComments, comment];

      state.updateNotes({
        comments: newComments
      });

      setComments(newComments);
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Failed to add comment');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  const updateComment = useCallback(async (commentId, updatedData) => {
    if (!state) return;

    try {
      setIsLoading(true);
      setError(null);

      const currentState = state.getState();
      const existingComments = [...(currentState.notes?.comments || [])];
      const commentIndex = existingComments.findIndex(c => c.id === commentId);

      if (commentIndex !== -1) {
        existingComments[commentIndex] = {
          ...existingComments[commentIndex],
          ...updatedData
        };

        state.updateNotes({
          comments: existingComments
        });

        setComments(existingComments);
      }
    } catch (err) {
      console.error('Error updating comment:', err);
      setError('Failed to update comment');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  const deleteComment = useCallback(async (commentId) => {
    if (!state) return;

    try {
      setIsLoading(true);
      setError(null);

      const currentState = state.getState();
      const existingComments = [...(currentState.notes?.comments || [])];
      const filteredComments = existingComments.filter(c => c.id !== commentId);

      state.updateNotes({
        comments: filteredComments
      });

      setComments(filteredComments);
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError('Failed to delete comment');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  const addReply = useCallback(async (commentId, reply) => {
    if (!state) return;

    try {
      setIsLoading(true);
      setError(null);

      const currentState = state.getState();
      const existingComments = [...(currentState.notes?.comments || [])];
      const commentIndex = existingComments.findIndex(c => c.id === commentId);

      if (commentIndex !== -1) {
        if (!existingComments[commentIndex].replies) {
          existingComments[commentIndex].replies = [];
        }
        existingComments[commentIndex].replies.push(reply);

        state.updateNotes({
          comments: existingComments
        });

        setComments(existingComments);
      }
    } catch (err) {
      console.error('Error adding reply:', err);
      setError('Failed to add reply');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  return {
    comments,
    isLoading,
    error,
    addComment,
    updateComment,
    deleteComment,
    addReply,
    refresh
  };
};