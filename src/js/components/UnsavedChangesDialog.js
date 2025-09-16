/**
 * UnsavedChangesDialog - Accessible warning dialog for unsaved changes
 *
 * Features:
 * - WCAG 2.1 AA compliant
 * - Full keyboard navigation
 * - Focus trapping and management
 * - Screen reader support
 * - High contrast styling
 * - Multiple dialog types (navigation, logout, generic)
 */

export class UnsavedChangesDialog {
  constructor() {
    this.isOpen = false;
    this.resolvePromise = null;
    this.previousFocus = null;

    // Accessibility
    this.focusableElements = [];
    this.firstFocusable = null;
    this.lastFocusable = null;

    // Dialog content
    this.currentOptions = {};

    // Create modal structure
    this.createDialog();
    this.attachEventListeners();

    // ARIA live region for announcements
    this.createLiveRegion();
  }

  /**
   * Create the dialog structure with proper ARIA attributes
   */
  createDialog() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'unsaved-changes-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.style.display = 'none';

    // Create dialog container
    this.dialog = document.createElement('div');
    this.dialog.className = 'unsaved-changes-dialog';
    this.dialog.setAttribute('role', 'alertdialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'unsaved-dialog-title');
    this.dialog.setAttribute('aria-describedby', 'unsaved-dialog-description');

    // Create dialog content
    this.dialog.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h2 id="unsaved-dialog-title" class="dialog-title">Unsaved Changes</h2>
      </div>

      <div class="dialog-body">
        <p id="unsaved-dialog-description" class="dialog-description">
          You have unsaved changes that will be lost.
        </p>
        <div id="unsaved-dialog-details" class="dialog-details" aria-live="polite"></div>
      </div>

      <div class="dialog-footer">
        <div class="dialog-actions">
          <button
            id="unsaved-cancel-btn"
            class="dialog-btn dialog-btn-secondary"
            type="button">
            Cancel
          </button>
          <button
            id="unsaved-save-btn"
            class="dialog-btn dialog-btn-primary"
            type="button">
            Save Changes
          </button>
          <button
            id="unsaved-discard-btn"
            class="dialog-btn dialog-btn-danger"
            type="button">
            Discard Changes
          </button>
        </div>
      </div>
    `;

    // Append to overlay and body
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);

    // Get element references
    this.titleElement = document.getElementById('unsaved-dialog-title');
    this.descriptionElement = document.getElementById('unsaved-dialog-description');
    this.detailsElement = document.getElementById('unsaved-dialog-details');
    this.cancelBtn = document.getElementById('unsaved-cancel-btn');
    this.saveBtn = document.getElementById('unsaved-save-btn');
    this.discardBtn = document.getElementById('unsaved-discard-btn');

    // Add styles
    this.addStyles();
  }

  /**
   * Add CSS styles for accessibility and visual design
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .unsaved-changes-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .unsaved-changes-overlay.show {
        opacity: 1;
      }

      .unsaved-changes-dialog {
        background: var(--bg-color, #ffffff);
        color: var(--text-color, #333333);
        border-radius: 8px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.95);
        transition: transform 0.2s ease;
        border: 2px solid var(--border-color, #e5e7eb);
      }

      .unsaved-changes-overlay.show .unsaved-changes-dialog {
        transform: scale(1);
      }

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 24px 16px;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }

      .dialog-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        color: var(--warning-color, #f59e0b);
      }

      .dialog-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color, #111827);
      }

      .dialog-body {
        padding: 16px 24px;
      }

      .dialog-description {
        margin: 0 0 16px 0;
        font-size: 14px;
        line-height: 1.5;
        color: var(--text-secondary, #6b7280);
      }

      .dialog-details {
        background: var(--info-bg, #f3f4f6);
        border: 1px solid var(--info-border, #d1d5db);
        border-radius: 4px;
        padding: 12px;
        font-size: 13px;
        color: var(--text-secondary, #6b7280);
      }

      .dialog-details:empty {
        display: none;
      }

      .dialog-details ul {
        margin: 0;
        padding-left: 16px;
      }

      .dialog-footer {
        padding: 16px 24px 24px;
        border-top: 1px solid var(--border-color, #e5e7eb);
      }

      .dialog-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      .dialog-btn {
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.2s ease;
        min-width: 80px;
        position: relative;
        overflow: hidden;
      }

      .dialog-btn:focus {
        outline: 2px solid var(--focus-color, #3b82f6);
        outline-offset: 2px;
        z-index: 1;
      }

      .dialog-btn:focus:not(:focus-visible) {
        outline: none;
      }

      .dialog-btn-secondary {
        background: var(--bg-secondary, #f9fafb);
        color: var(--text-color, #374151);
        border-color: var(--border-color, #d1d5db);
      }

      .dialog-btn-secondary:hover {
        background: var(--bg-secondary-hover, #f3f4f6);
        border-color: var(--border-hover, #9ca3af);
      }

      .dialog-btn-primary {
        background: var(--primary-color, #3b82f6);
        color: white;
        border-color: var(--primary-color, #3b82f6);
      }

      .dialog-btn-primary:hover {
        background: var(--primary-hover, #2563eb);
        border-color: var(--primary-hover, #2563eb);
      }

      .dialog-btn-primary.loading {
        opacity: 0.8;
        cursor: not-allowed;
      }

      .dialog-btn-danger {
        background: var(--danger-color, #ef4444);
        color: white;
        border-color: var(--danger-color, #ef4444);
      }

      .dialog-btn-danger:hover {
        background: var(--danger-hover, #dc2626);
        border-color: var(--danger-hover, #dc2626);
      }

      .dialog-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Loading state */
      .dialog-btn.loading::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        margin: auto;
        border: 2px solid transparent;
        border-top-color: currentColor;
        border-radius: 50%;
        animation: button-loading-spinner 1s ease infinite;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
      }

      @keyframes button-loading-spinner {
        from { transform: rotate(0turn); }
        to { transform: rotate(1turn); }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .unsaved-changes-overlay {
          background: rgba(0, 0, 0, 0.9);
        }

        .unsaved-changes-dialog {
          border: 3px solid;
        }

        .dialog-btn {
          border-width: 2px;
        }

        .dialog-btn:focus {
          outline-width: 3px;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .unsaved-changes-overlay,
        .unsaved-changes-dialog,
        .dialog-btn {
          transition: none;
        }

        @keyframes button-loading-spinner {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      }

      /* Mobile responsive */
      @media (max-width: 640px) {
        .unsaved-changes-overlay {
          padding: 16px;
        }

        .dialog-actions {
          flex-direction: column-reverse;
        }

        .dialog-btn {
          width: 100%;
          justify-content: center;
        }
      }

      /* Screen reader only text */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Create ARIA live region for announcements
   */
  createLiveRegion() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.className = 'sr-only';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.id = 'unsaved-changes-announcements';
    document.body.appendChild(this.liveRegion);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close('cancel');
      }
    });

    // Button actions
    this.cancelBtn.addEventListener('click', () => {
      this.close('cancel');
    });

    this.saveBtn.addEventListener('click', () => {
      this.close('save');
    });

    this.discardBtn.addEventListener('click', () => {
      this.close('discard');
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          this.close('cancel');
          break;

        case 'Tab':
          this.handleTabKey(e);
          break;

        case 'Enter':
          // Allow default Enter behavior on buttons
          if (e.target.classList.contains('dialog-btn')) {
            return;
          }
          break;
      }
    });
  }

  /**
   * Handle Tab key for focus trapping
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleTabKey(e) {
    if (!this.firstFocusable || !this.lastFocusable) {
      this.updateFocusableElements();
    }

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable.focus();
      }
    }
  }

  /**
   * Update focusable elements for focus trapping
   */
  updateFocusableElements() {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    this.focusableElements = Array.from(
      this.dialog.querySelectorAll(focusableSelectors.join(', '))
    );

    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
  }

  /**
   * Show the dialog with specified options
   * @param {Object} options - Dialog configuration
   * @returns {Promise<string>} Promise that resolves to action taken
   */
  show(options = {}) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.currentOptions = {
        type: 'navigation', // navigation, logout, generic
        title: 'Unsaved Changes',
        message: 'You have unsaved changes that will be lost.',
        changes: [],
        showSave: true,
        showDiscard: true,
        saveText: 'Save Changes',
        discardText: 'Discard Changes',
        cancelText: 'Cancel',
        saveIcon: true,
        ...options
      };

      // Store current focus
      this.previousFocus = document.activeElement;

      // Update dialog content
      this.updateContent();

      // Show dialog
      this.isOpen = true;
      this.overlay.setAttribute('aria-hidden', 'false');
      this.overlay.style.display = 'flex';

      // Focus management
      requestAnimationFrame(() => {
        this.overlay.classList.add('show');
        this.updateFocusableElements();

        // Focus appropriate button based on context
        this.setInitialFocus();

        // Announce to screen readers
        this.announceDialog();
      });
    });
  }

  /**
   * Update dialog content based on options
   */
  updateContent() {
    const { title, message, changes, showSave, showDiscard, saveText, discardText, cancelText } = this.currentOptions;

    // Update title and message
    this.titleElement.textContent = title;
    this.descriptionElement.textContent = message;

    // Update details with changes
    if (changes && changes.length > 0) {
      this.detailsElement.innerHTML = `
        <p><strong>Changed sections:</strong></p>
        <ul>
          ${changes.map(change => `<li>${change}</li>`).join('')}
        </ul>
      `;
    } else {
      this.detailsElement.innerHTML = '';
    }

    // Update button visibility and text
    this.saveBtn.style.display = showSave ? 'inline-flex' : 'none';
    this.discardBtn.style.display = showDiscard ? 'inline-flex' : 'none';

    this.saveBtn.textContent = saveText;
    this.discardBtn.textContent = discardText;
    this.cancelBtn.textContent = cancelText;

    // Add loading state management to save button
    this.saveBtn.classList.remove('loading');
    this.saveBtn.disabled = false;
  }

  /**
   * Set initial focus based on dialog type and safety
   */
  setInitialFocus() {
    const { type } = this.currentOptions;

    // For dangerous actions, focus cancel for safety
    if (type === 'logout' || type === 'dangerous') {
      this.cancelBtn.focus();
    } else {
      // For normal navigation, focus the primary action (save)
      if (this.saveBtn.style.display !== 'none') {
        this.saveBtn.focus();
      } else {
        this.cancelBtn.focus();
      }
    }
  }

  /**
   * Announce dialog to screen readers
   */
  announceDialog() {
    const { title, message, changes } = this.currentOptions;

    let announcement = `${title}. ${message}`;

    if (changes && changes.length > 0) {
      announcement += ` Changed sections: ${changes.join(', ')}.`;
    }

    announcement += ' Use Tab to navigate between options.';

    this.liveRegion.textContent = announcement;

    // Clear announcement after screen reader has time to read it
    setTimeout(() => {
      this.liveRegion.textContent = '';
    }, 1000);
  }

  /**
   * Show save in progress state
   */
  showSaveInProgress() {
    this.saveBtn.classList.add('loading');
    this.saveBtn.disabled = true;
    this.saveBtn.textContent = 'Saving...';

    // Announce to screen readers
    this.announceMessage('Saving changes, please wait...');
  }

  /**
   * Hide save in progress state
   */
  hideSaveInProgress() {
    this.saveBtn.classList.remove('loading');
    this.saveBtn.disabled = false;
    this.saveBtn.textContent = this.currentOptions.saveText || 'Save Changes';
  }

  /**
   * Announce a message to screen readers
   * @param {string} message - Message to announce
   */
  announceMessage(message) {
    this.liveRegion.textContent = message;
    setTimeout(() => {
      this.liveRegion.textContent = '';
    }, 1000);
  }

  /**
   * Close the dialog
   * @param {string} action - Action taken (save, discard, cancel)
   */
  close(action) {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.overlay.classList.remove('show');

    // Hide after animation
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.overlay.setAttribute('aria-hidden', 'true');

      // Restore focus
      if (this.previousFocus && document.contains(this.previousFocus)) {
        this.previousFocus.focus();
      }

      // Resolve promise
      if (this.resolvePromise) {
        this.resolvePromise(action);
        this.resolvePromise = null;
      }

      // Reset state
      this.hideSaveInProgress();
      this.previousFocus = null;
    }, 200);
  }

  /**
   * Clean up the dialog
   */
  destroy() {
    this.close('cancel');

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    if (this.liveRegion && this.liveRegion.parentNode) {
      this.liveRegion.parentNode.removeChild(this.liveRegion);
    }
  }
}