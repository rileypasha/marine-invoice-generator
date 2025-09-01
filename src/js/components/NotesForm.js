export class NotesForm {
  constructor(state, userManager) {
    console.log('📝 Initializing NotesForm component...');
    this.state = state;
    this.userManager = userManager;
    this.initElements();
    this.attachEventListeners();
    
    console.log('✅ NotesForm component initialized successfully');
  }
  
  initElements() {
    this.newCommentText = document.getElementById('new-comment-text');
    this.addCommentBtn = document.getElementById('add-comment-btn');
    this.cancelCommentBtn = document.getElementById('cancel-comment-btn');
    
    if (!this.newCommentText || !this.addCommentBtn || !this.cancelCommentBtn) {
      console.error('❌ NotesForm: Cannot initialize, some elements are missing');
      return false;
    }
    
    return true;
  }
  
  attachEventListeners() {
    if (!this.initElements()) return;
    
    this.addCommentBtn.addEventListener('click', () => {
      this.addComment();
    });
    
    this.cancelCommentBtn.addEventListener('click', () => {
      this.cancelComment();
    });
    
    // Auto-expand textarea and show/hide cancel button
    this.newCommentText.addEventListener('focus', () => {
      this.expandCommentInput();
    });
    
    this.newCommentText.addEventListener('blur', (e) => {
      // Don't collapse if clicking on add or cancel button
      if (!e.relatedTarget || (!e.relatedTarget.matches('#add-comment-btn') && !e.relatedTarget.matches('#cancel-comment-btn'))) {
        if (!this.newCommentText.value.trim()) {
          this.collapseCommentInput();
        }
      }
    });
    
    // Enter key to add comment (Shift+Enter for new line)
    this.newCommentText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.addComment();
      }
    });
  }
  
  expandCommentInput() {
    this.newCommentText.style.minHeight = '80px';
    this.cancelCommentBtn.style.display = 'inline-flex';
  }
  
  collapseCommentInput() {
    this.newCommentText.style.minHeight = '36px';
    this.cancelCommentBtn.style.display = 'none';
  }
  
  addComment() {
    const text = this.newCommentText.value.trim();
    if (!text) return;
    
    const currentUser = this.userManager.getCurrentUser();
    const author = currentUser ? currentUser.name : 'Anonymous';
    const authorEmail = currentUser ? currentUser.email : '';
    
    const comment = {
      id: Date.now().toString(),
      text: text,
      author: author,
      authorEmail: authorEmail,
      timestamp: new Date().toISOString(),
      replies: []
    };
    
    // Add to state
    const currentState = this.state.getState();
    const updatedComments = [...(currentState.notes?.comments || []), comment];
    
    this.state.updateState({
      notes: {
        ...currentState.notes,
        comments: updatedComments
      }
    });
    
    // Clear input and collapse
    this.newCommentText.value = '';
    this.collapseCommentInput();
    
    console.log('📝 Added new comment:', comment);
  }
  
  cancelComment() {
    this.newCommentText.value = '';
    this.collapseCommentInput();
  }
}