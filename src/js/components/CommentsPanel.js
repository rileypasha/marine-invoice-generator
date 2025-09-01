import { formatTimeAgo } from '../utils/formatters.js';

export class CommentsPanel {
  constructor(state, userManager) {
    console.log('💬 Initializing CommentsPanel component...');
    this.state = state;
    this.userManager = userManager;
    this.initElements();
    
    console.log('📡 Subscribing to state changes...');
    this.state.subscribe(() => {
      console.log('💬 CommentsPanel received state update, calling update()...');
      this.update();
    });
    
    console.log('🎨 Calling initial update...');
    this.update();
    console.log('✅ CommentsPanel component initialized successfully');
  }
  
  initElements() {
    this.commentsList = document.getElementById('comments-list');
    this.noComments = document.getElementById('no-comments');
    
    if (!this.commentsList || !this.noComments) {
      console.warn('⚠️ CommentsPanel: Comments panel elements not found in DOM, skipping initialization');
      return false;
    }
    
    return true;
  }
  
  update() {
    // Always try to re-initialize elements in case they weren't available during construction
    this.commentsList = document.getElementById('comments-list');
    this.noComments = document.getElementById('no-comments');
    
    console.log('💬 CommentsPanel.update() called');
    console.log('  - commentsList found:', !!this.commentsList);
    console.log('  - noComments found:', !!this.noComments);
    
    if (!this.commentsList) {
      console.log('  - Skipping update, commentsList not available');
      return;
    }
    
    const state = this.state.getState();
    const comments = state.notes?.comments || [];
    
    console.log('  - State notes:', state.notes);
    console.log('  - Comments count:', comments.length);
    console.log('  - Comments:', comments);
    
    if (comments.length === 0) {
      console.log('  - Showing no comments message');
      this.showNoComments();
      return;
    }
    
    console.log('  - Rendering comments');
    this.hideNoComments();
    this.renderComments(comments);
  }
  
  showNoComments() {
    if (this.noComments) {
      this.noComments.style.display = 'block';
    }
    this.commentsList.innerHTML = '';
  }
  
  hideNoComments() {
    if (this.noComments) {
      this.noComments.style.display = 'none';
    }
  }
  
  renderComments(comments) {
    console.log('💬 renderComments called with:', comments.length, 'comments');
    this.commentsList.innerHTML = '';
    
    comments.forEach((comment, index) => {
      console.log(`💬 Rendering comment ${index}:`, comment);
      const commentElement = this.createCommentElement(comment);
      this.commentsList.appendChild(commentElement);
      console.log(`💬 Comment ${index} added to DOM`);
    });
    
    console.log('💬 renderComments completed');
  }
  
  createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment-item';
    commentDiv.setAttribute('data-comment-id', comment.id);
    
    const currentUser = this.userManager.getCurrentUser();
    const canReply = currentUser && currentUser.role === 'master';
    const canEditDelete = currentUser && (currentUser.email === comment.authorEmail || currentUser.role === 'master');
    
    commentDiv.innerHTML = `
      <div class="comment-header">
        <div class="comment-author">${this.escapeHtml(comment.author)}</div>
        <div class="comment-timestamp">
          ${formatTimeAgo(new Date(comment.timestamp))}
          ${comment.edited ? '<span class="edited-indicator">(edited)</span>' : ''}
        </div>
        ${canEditDelete ? `
          <div class="comment-menu">
            <button class="edit-comment-btn" data-comment-id="${comment.id}" title="Edit comment">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="delete-comment-btn" data-comment-id="${comment.id}" title="Delete comment">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
      <div class="comment-text" data-comment-id="${comment.id}">${this.escapeHtml(comment.text).replace(/\n/g, '<br>')}</div>
      <div class="edit-comment-container" style="display: none;" data-comment-id="${comment.id}">
        <textarea class="edit-comment-input" rows="3">${this.escapeHtml(comment.text)}</textarea>
        <div class="edit-comment-actions">
          <button class="save-edit-btn" data-comment-id="${comment.id}">Save</button>
          <button class="cancel-edit-btn" data-comment-id="${comment.id}">Cancel</button>
        </div>
      </div>
      ${comment.replies && comment.replies.length > 0 ? this.renderReplies(comment.replies) : ''}
      ${canReply ? `
        <div class="comment-actions">
          <button class="reply-btn" data-comment-id="${comment.id}">Reply</button>
        </div>
        <div class="reply-input-container" style="display: none;" data-comment-id="${comment.id}">
          <textarea class="reply-input" placeholder="Write a reply..." rows="2"></textarea>
          <div class="reply-actions">
            <button class="submit-reply-btn" data-comment-id="${comment.id}">Reply</button>
            <button class="cancel-reply-btn" data-comment-id="${comment.id}">Cancel</button>
          </div>
        </div>
      ` : ''}
    `;
    
    // Attach event listeners for this comment
    this.attachCommentEventListeners(commentDiv, comment.id);
    
    return commentDiv;
  }
  
  renderReplies(replies) {
    if (!replies || replies.length === 0) return '';
    
    const repliesHtml = replies.map(reply => `
      <div class="comment-reply">
        <div class="comment-header">
          <div class="comment-author">${this.escapeHtml(reply.author)}</div>
          <div class="comment-timestamp">${formatTimeAgo(new Date(reply.timestamp))}</div>
        </div>
        <div class="comment-text">${this.escapeHtml(reply.text).replace(/\n/g, '<br>')}</div>
      </div>
    `).join('');
    
    return `<div class="comment-replies">${repliesHtml}</div>`;
  }
  
  attachCommentEventListeners(commentElement, commentId) {
    // Reply functionality
    const replyBtn = commentElement.querySelector('.reply-btn');
    const submitReplyBtn = commentElement.querySelector('.submit-reply-btn');
    const cancelReplyBtn = commentElement.querySelector('.cancel-reply-btn');
    const replyInput = commentElement.querySelector('.reply-input');
    const replyContainer = commentElement.querySelector('.reply-input-container');
    
    // Edit/Delete functionality
    const editBtn = commentElement.querySelector('.edit-comment-btn');
    const deleteBtn = commentElement.querySelector('.delete-comment-btn');
    const saveEditBtn = commentElement.querySelector('.save-edit-btn');
    const cancelEditBtn = commentElement.querySelector('.cancel-edit-btn');
    const editInput = commentElement.querySelector('.edit-comment-input');
    
    if (replyBtn) {
      replyBtn.addEventListener('click', () => {
        this.showReplyInput(commentId);
      });
    }
    
    if (submitReplyBtn) {
      submitReplyBtn.addEventListener('click', () => {
        this.submitReply(commentId);
      });
    }
    
    if (cancelReplyBtn) {
      cancelReplyBtn.addEventListener('click', () => {
        this.hideReplyInput(commentId);
      });
    }
    
    if (replyInput) {
      replyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submitReply(commentId);
        } else if (e.key === 'Escape') {
          this.hideReplyInput(commentId);
        }
      });
    }
    
    // Edit comment functionality
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.showEditComment(commentId);
      });
    }
    
    if (saveEditBtn) {
      saveEditBtn.addEventListener('click', () => {
        this.saveEditComment(commentId);
      });
    }
    
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        this.hideEditComment(commentId);
      });
    }
    
    if (editInput) {
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          this.saveEditComment(commentId);
        } else if (e.key === 'Escape') {
          this.hideEditComment(commentId);
        }
      });
    }
    
    // Delete comment functionality
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.deleteComment(commentId);
      });
    }
  }
  
  showReplyInput(commentId) {
    const replyContainer = document.querySelector(`.reply-input-container[data-comment-id="${commentId}"]`);
    const replyInput = replyContainer?.querySelector('.reply-input');
    
    if (replyContainer && replyInput) {
      replyContainer.style.display = 'block';
      replyInput.focus();
    }
  }
  
  hideReplyInput(commentId) {
    const replyContainer = document.querySelector(`.reply-input-container[data-comment-id="${commentId}"]`);
    const replyInput = replyContainer?.querySelector('.reply-input');
    
    if (replyContainer && replyInput) {
      replyContainer.style.display = 'none';
      replyInput.value = '';
    }
  }
  
  submitReply(commentId) {
    const replyInput = document.querySelector(`.reply-input-container[data-comment-id="${commentId}"] .reply-input`);
    if (!replyInput) return;
    
    const text = replyInput.value.trim();
    if (!text) return;
    
    const currentUser = this.userManager.getCurrentUser();
    if (!currentUser || currentUser.role !== 'master') {
      console.warn('Only master accounts can reply to comments');
      return;
    }
    
    const reply = {
      id: Date.now().toString(),
      text: text,
      author: currentUser.name,
      authorEmail: currentUser.email,
      timestamp: new Date().toISOString()
    };
    
    // Update state
    const currentState = this.state.getState();
    const comments = [...(currentState.notes?.comments || [])];
    const commentIndex = comments.findIndex(c => c.id === commentId);
    
    if (commentIndex !== -1) {
      if (!comments[commentIndex].replies) {
        comments[commentIndex].replies = [];
      }
      comments[commentIndex].replies.push(reply);
      
      this.state.updateNotes({
        comments: comments
      });
      
      // Hide reply input
      this.hideReplyInput(commentId);
      
      console.log('💬 Added reply to comment:', commentId, reply);
    }
  }
  
  showEditComment(commentId) {
    const commentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
    const commentText = commentElement?.querySelector(`.comment-text[data-comment-id="${commentId}"]`);
    const editContainer = commentElement?.querySelector(`.edit-comment-container[data-comment-id="${commentId}"]`);
    
    if (commentText && editContainer) {
      commentText.style.display = 'none';
      editContainer.style.display = 'block';
      
      const editInput = editContainer.querySelector('.edit-comment-input');
      if (editInput) {
        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);
      }
    }
  }
  
  hideEditComment(commentId) {
    const commentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
    const commentText = commentElement?.querySelector(`.comment-text[data-comment-id="${commentId}"]`);
    const editContainer = commentElement?.querySelector(`.edit-comment-container[data-comment-id="${commentId}"]`);
    
    if (commentText && editContainer) {
      commentText.style.display = 'block';
      editContainer.style.display = 'none';
    }
  }
  
  saveEditComment(commentId) {
    const commentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
    const editInput = commentElement?.querySelector('.edit-comment-input');
    
    if (!editInput) return;
    
    const newText = editInput.value.trim();
    if (!newText) {
      alert('Comment cannot be empty');
      return;
    }
    
    // Update state
    const currentState = this.state.getState();
    const comments = [...(currentState.notes?.comments || [])];
    const commentIndex = comments.findIndex(c => c.id === commentId);
    
    if (commentIndex !== -1) {
      comments[commentIndex] = {
        ...comments[commentIndex],
        text: newText,
        edited: true,
        editedAt: new Date().toISOString()
      };
      
      this.state.updateNotes({
        comments: comments
      });
      
      console.log('💬 Comment edited:', commentId);
    }
  }
  
  deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    // Update state
    const currentState = this.state.getState();
    const comments = [...(currentState.notes?.comments || [])];
    const filteredComments = comments.filter(c => c.id !== commentId);
    
    this.state.updateNotes({
      comments: filteredComments
    });
    
    console.log('💬 Comment deleted:', commentId);
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}