export class PromptModal {
  constructor() {
    this.modal = null;
    this.resolve = null;
    this.reject = null;
    this.createModal();
  }

  createModal() {
    // Create modal HTML
    const modalHtml = `
      <div class="prompt-modal-overlay" style="display: none;">
        <div class="prompt-modal">
          <div class="prompt-modal-header">
            <h3 class="prompt-modal-title">Enter Name</h3>
          </div>
          <div class="prompt-modal-body">
            <input type="text" class="prompt-modal-input" placeholder="Enter name..." />
          </div>
          <div class="prompt-modal-footer">
            <button class="btn btn-secondary prompt-modal-cancel">Cancel</button>
            <button class="btn btn-primary prompt-modal-confirm">Save</button>
          </div>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = document.querySelector('.prompt-modal-overlay');
    this.input = this.modal.querySelector('.prompt-modal-input');
    this.confirmBtn = this.modal.querySelector('.prompt-modal-confirm');
    this.cancelBtn = this.modal.querySelector('.prompt-modal-cancel');

    this.setupEventListeners();
    this.addStyles();
  }

  setupEventListeners() {
    // Cancel button
    this.cancelBtn.addEventListener('click', () => {
      // For confirm dialogs, return false; for prompts return null
      const isConfirm = this.input.style.display === 'none' && this.cancelBtn.style.display !== 'none';
      this.close(isConfirm ? false : null);
    });

    // Confirm button
    this.confirmBtn.addEventListener('click', () => {
      // For confirm dialogs, return true; for prompts return the input value
      const isConfirm = this.input.style.display === 'none' && this.cancelBtn.style.display !== 'none';
      if (isConfirm) {
        this.close(true);
      } else {
        const value = this.input.value.trim();
        this.close(value || null);
      }
    });

    // Enter key
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = this.input.value.trim();
        this.close(value || null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close(null);
      }
    });

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close(null);
      }
    });
  }

  addStyles() {
    // Add CSS if not already added
    if (!document.querySelector('#prompt-modal-styles')) {
      const styles = `
        <style id="prompt-modal-styles">
          .prompt-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
          }

          .prompt-modal {
            background: var(--background-color, #1a1a1a);
            border: 1px solid var(--border-color, #333);
            border-radius: 8px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          }

          .prompt-modal-header {
            padding: 20px 20px 10px 20px;
            border-bottom: 1px solid var(--border-color, #333);
          }

          .prompt-modal-title {
            margin: 0;
            color: var(--text-color, #fff);
            font-size: 18px;
            font-weight: 600;
          }

          .prompt-modal-body {
            padding: 20px;
          }

          .prompt-modal-input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--border-color, #333);
            border-radius: 4px;
            background: var(--input-background, #2a2a2a);
            color: var(--text-color, #fff);
            font-size: 14px;
            box-sizing: border-box;
          }

          .prompt-modal-input:focus {
            outline: none;
            border-color: #19c37d;
            box-shadow: 0 0 0 2px rgba(25, 195, 125, 0.2);
          }

          .prompt-modal-footer {
            padding: 10px 20px 20px 20px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
          }

          .prompt-modal-footer .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
          }

          .prompt-modal-footer .btn-secondary {
            background: var(--secondary-color, #444);
            color: var(--text-color, #fff);
          }

          .prompt-modal-footer .btn-secondary:hover {
            background: var(--secondary-hover, #555);
          }

          .prompt-modal-footer .btn-primary {
            background: #19c37d;
            color: white;
          }

          .prompt-modal-footer .btn-primary:hover {
            background: #1a7f5a;
          }
        </style>
      `;
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  show(title = 'Enter Name', placeholder = 'Enter name...', defaultValue = '') {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      // Update modal content
      this.modal.querySelector('.prompt-modal-title').textContent = title;
      this.input.placeholder = placeholder;
      this.input.value = defaultValue;

      // Show input and cancel button for prompt mode
      this.input.style.display = 'block';
      this.cancelBtn.style.display = 'inline-block';
      this.confirmBtn.textContent = 'Save';
      
      // Hide message div if it exists
      if (this.messageDiv) {
        this.messageDiv.style.display = 'none';
      }

      // Show modal
      this.modal.style.display = 'flex';
      
      // Focus input after a short delay
      setTimeout(() => {
        this.input.focus();
        this.input.select();
      }, 100);
    });
  }

  showAlert(title = 'Alert', message = '') {
    return new Promise((resolve) => {
      this.resolve = resolve;

      // Update modal content for alert mode
      this.modal.querySelector('.prompt-modal-title').textContent = title;
      this.input.style.display = 'none'; // Hide input for alert
      this.cancelBtn.style.display = 'none'; // Hide cancel button for alert
      this.confirmBtn.textContent = 'OK';

      // Show message in place of input
      if (!this.messageDiv) {
        this.messageDiv = document.createElement('div');
        this.messageDiv.className = 'prompt-modal-message';
        this.messageDiv.style.cssText = `
          padding: 12px 0;
          color: var(--text-color, #fff);
          font-size: 14px;
          line-height: 1.4;
        `;
        this.modal.querySelector('.prompt-modal-body').appendChild(this.messageDiv);
      }
      this.messageDiv.textContent = message;
      this.messageDiv.style.display = 'block';

      // Show modal
      this.modal.style.display = 'flex';
      
      // Focus OK button
      setTimeout(() => {
        this.confirmBtn.focus();
      }, 100);
    });
  }

  showConfirm(title = 'Confirm', message = '') {
    return new Promise((resolve) => {
      this.resolve = resolve;

      // Update modal content for confirm mode
      this.modal.querySelector('.prompt-modal-title').textContent = title;
      this.input.style.display = 'none'; // Hide input for confirm
      this.cancelBtn.style.display = 'inline-block'; // Show cancel button
      this.confirmBtn.textContent = 'Continue';
      this.cancelBtn.textContent = 'Cancel';

      // Show message in place of input
      if (!this.messageDiv) {
        this.messageDiv = document.createElement('div');
        this.messageDiv.className = 'prompt-modal-message';
        this.messageDiv.style.cssText = `
          padding: 12px 0;
          color: var(--text-color, #fff);
          font-size: 14px;
          line-height: 1.4;
        `;
        this.modal.querySelector('.prompt-modal-body').appendChild(this.messageDiv);
      }
      this.messageDiv.textContent = message;
      this.messageDiv.style.display = 'block';

      // Show modal
      this.modal.style.display = 'flex';
      
      // Focus confirm button
      setTimeout(() => {
        this.confirmBtn.focus();
      }, 100);
    });
  }

  close(value) {
    this.modal.style.display = 'none';
    
    if (this.resolve) {
      this.resolve(value);
      this.resolve = null;
      this.reject = null;
    }
  }

  destroy() {
    if (this.modal) {
      this.modal.remove();
    }
    const styles = document.querySelector('#prompt-modal-styles');
    if (styles) {
      styles.remove();
    }
  }
}