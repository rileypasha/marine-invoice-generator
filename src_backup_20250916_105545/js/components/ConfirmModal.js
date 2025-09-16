export class ConfirmModal {
  constructor() {
    this.isOpen = false;
    this.resolvePromise = null;
    this.createModal();
  }
  
  createModal() {
    // Create modal overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'confirm-modal-overlay';
    this.overlay.style.display = 'none';
    
    // Create modal content
    this.modal = document.createElement('div');
    this.modal.className = 'confirm-modal';
    
    this.modal.innerHTML = `
      <div class="confirm-modal-header">
        <h3 class="confirm-modal-title" id="confirm-title">Confirm Action</h3>
      </div>
      <div class="confirm-modal-body">
        <p class="confirm-modal-message" id="confirm-message">Are you sure you want to proceed?</p>
      </div>
      <div class="confirm-modal-footer">
        <button class="confirm-modal-btn confirm-cancel-btn" id="confirm-cancel">Cancel</button>
        <button class="confirm-modal-btn confirm-action-btn" id="confirm-action">Confirm</button>
      </div>
    `;
    
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
    
    // Get references to elements
    this.titleElement = document.getElementById('confirm-title');
    this.messageElement = document.getElementById('confirm-message');
    this.cancelBtn = document.getElementById('confirm-cancel');
    this.actionBtn = document.getElementById('confirm-action');
    
    // Attach event listeners
    this.attachEventListeners();
  }
  
  attachEventListeners() {
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(false);
      }
    });
    
    // Close on cancel
    this.cancelBtn.addEventListener('click', () => {
      this.close(false);
    });
    
    // Confirm on action button
    this.actionBtn.addEventListener('click', () => {
      this.close(true);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        // In single-button mode, Escape acts like clicking the action button
        if (this.cancelBtn.style.display === 'none') {
          this.close(true);
        } else {
          this.close(false);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.close(true);
      }
    });
  }
  
  /**
   * Show confirmation modal
   * @param {Object} options - Modal configuration
   * @param {string} options.title - Modal title
   * @param {string} options.message - Modal message
   * @param {string} options.confirmText - Confirm button text
   * @param {string} options.cancelText - Cancel button text
   * @param {string} options.type - Modal type ('danger', 'warning', 'info')
   * @returns {Promise<boolean>} Promise that resolves to true/false
   */
  show(options = {}) {
    const {
      title = 'Confirm Action',
      message = 'Are you sure you want to proceed?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      type = 'danger'
    } = options;
    
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.isOpen = true;
      
      // Set content
      this.titleElement.textContent = title;
      this.messageElement.textContent = message;
      this.actionBtn.textContent = confirmText;
      this.cancelBtn.textContent = cancelText;
      
      // Handle single-button mode (no cancel button)
      if (!cancelText) {
        this.cancelBtn.style.display = 'none';
      } else {
        this.cancelBtn.style.display = 'inline-flex';
      }
      
      // Set modal type
      this.modal.className = `confirm-modal confirm-modal-${type}`;
      
      // Show modal
      this.overlay.style.display = 'flex';
      
      // Focus the appropriate button
      if (!cancelText) {
        // Single button mode - always focus the action button
        this.actionBtn.focus();
      } else if (type === 'danger') {
        // Dangerous actions - focus cancel for safety
        this.cancelBtn.focus();
      } else {
        // Normal actions - focus the action button
        this.actionBtn.focus();
      }
      
      // Add animation
      requestAnimationFrame(() => {
        this.overlay.classList.add('show');
      });
    });
  }
  
  close(confirmed) {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    this.overlay.classList.remove('show');
    
    // Wait for animation to complete
    setTimeout(() => {
      this.overlay.style.display = 'none';
      if (this.resolvePromise) {
        this.resolvePromise(confirmed);
        this.resolvePromise = null;
      }
    }, 200);
  }
  
  destroy() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}