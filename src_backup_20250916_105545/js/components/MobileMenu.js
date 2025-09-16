/**
 * Mobile Menu Component
 * Handles mobile navigation and responsive behavior
 */
export class MobileMenu {
  constructor() {
    this.isOpen = false;
    this.sidebar = null;
    this.overlay = null;
    this.toggleBtn = null;
    this.init();
  }

  init() {
    this.createElements();
    this.attachEventListeners();
    this.handleResize();
  }

  createElements() {
    // Create mobile menu toggle button
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.className = 'mobile-menu-toggle mobile-only';
    this.toggleBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12h18M3 6h18M3 18h18"/>
      </svg>
    `;
    this.toggleBtn.setAttribute('aria-label', 'Toggle menu');
    document.body.appendChild(this.toggleBtn);

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'mobile-overlay';
    document.body.appendChild(this.overlay);

    // Get sidebar
    this.sidebar = document.querySelector('.app-sidebar');
  }

  attachEventListeners() {
    // Toggle button click
    this.toggleBtn.addEventListener('click', () => this.toggle());

    // Overlay click
    this.overlay.addEventListener('click', () => this.close());

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Handle swipe gestures
    this.initSwipeGestures();

    // Handle resize
    window.addEventListener('resize', () => this.handleResize());

    // Close menu when clicking on sidebar links (for navigation)
    if (this.sidebar) {
      this.sidebar.addEventListener('click', (e) => {
        if (e.target.matches('.invoice-item, .new-invoice-btn')) {
          if (window.innerWidth <= 768) {
            this.close();
          }
        }
      });
    }
  }

  initSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      this.handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
    }, { passive: true });
  }

  handleSwipe(startX, endX, startY, endY) {
    const diffX = endX - startX;
    const diffY = endY - startY;
    const threshold = 50;
    const restraint = 100;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    // Check if swipe is more horizontal than vertical
    if (absX > absY && absX > threshold && absY < restraint) {
      if (diffX > 0 && startX < 50) {
        // Swipe right from left edge - open menu
        this.open();
      } else if (diffX < 0 && this.isOpen) {
        // Swipe left - close menu
        this.close();
      }
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!this.sidebar) return;
    
    this.isOpen = true;
    this.sidebar.classList.add('mobile-open');
    this.overlay.classList.add('active');
    this.toggleBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (!this.sidebar) return;
    
    this.isOpen = false;
    this.sidebar.classList.remove('mobile-open');
    this.overlay.classList.remove('active');
    this.toggleBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12h18M3 6h18M3 18h18"/>
      </svg>
    `;
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  handleResize() {
    // Close menu if resizing to desktop
    if (window.innerWidth > 768 && this.isOpen) {
      this.close();
    }

    // Show/hide toggle button based on screen size
    if (window.innerWidth <= 768) {
      this.toggleBtn.style.display = 'block';
    } else {
      this.toggleBtn.style.display = 'none';
    }
  }

  destroy() {
    if (this.toggleBtn) {
      this.toggleBtn.remove();
    }
    if (this.overlay) {
      this.overlay.remove();
    }
  }
}