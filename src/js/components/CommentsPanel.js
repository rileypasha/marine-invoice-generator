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
      console.error('❌ CommentsPanel: Cannot initialize, some elements are missing');
      return false;
    }
    
    return true;
  }
  
  update() {
    if (!this.initElements()) return;
    
    const state = this.state.getState();
    const comments = state.notes?.comments || [];
    
    if (comments.length === 0) {
      this.showNoComments();
      return;
    }
    
    this.hideNoComments();
    this.renderComments(comments);
  }
  
  showNoComments() {
    this.noComments.style.display = 'block';
    this.commentsList.innerHTML = '';
  }
  
  hideNoComments() {
    this.noComments.style.display = 'none';
  }
  
  renderComments(comments) {
    this.commentsList.innerHTML = '';
    
    comments.forEach(comment => {
      const commentElement = this.createCommentElement(comment);
      this.commentsList.appendChild(commentElement);
    });
  }
  
  createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment-item';
    commentDiv.setAttribute('data-comment-id', comment.id);
    
    const currentUser = this.userManager.getCurrentUser();
    const canReply = currentUser && currentUser.role === 'master';
    
    commentDiv.innerHTML = `
      <div class="comment-header">
        <div class="comment-author">${this.escapeHtml(comment.author)}</div>
        <div class="comment-timestamp">${formatTimeAgo(new Date(comment.timestamp))}</div>
      </div>
      <div class="comment-text">${this.escapeHtml(comment.text).replace(/\n/g, '<br>')}</div>
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
    const replyBtn = commentElement.querySelector('.reply-btn');
    const submitReplyBtn = commentElement.querySelector('.submit-reply-btn');
    const cancelReplyBtn = commentElement.querySelector('.cancel-reply-btn');
    const replyInput = commentElement.querySelector('.reply-input');
    const replyContainer = commentElement.querySelector('.reply-input-container');
    
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
      
      this.state.updateState({
        notes: {
          ...currentState.notes,
          comments: comments
        }
      });
      
      // Hide reply input
      this.hideReplyInput(commentId);
      
      console.log('💬 Added reply to comment:', commentId, reply);
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}