// For future React integration when ready
// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import { EnhancedSidebar } from './EnhancedSidebar.js';

const PATH_TO_NAV = {
  '/app': 'invoices',
  '/invoices': 'invoices',
  '/customers': 'customers',
  '/vessels': 'vessels'
};

function resolveActiveNav(explicitKey) {
  if (explicitKey) {
    return explicitKey;
  }
  const currentPath = window.location.pathname.replace(/\/$/, '');
  return PATH_TO_NAV[currentPath] || 'invoices';
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('marine_invoice_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse stored user:', error);
    return null;
  }
}

function normalizeName(user) {
  return user?.name || user?.email || 'User';
}

// Enhanced sidebar initialization function (Vanilla JS implementation)
export function initializeEnhancedSidebar(activeKey, options = {}) {
  const { manageAuth = true } = options;
  const resolvedKey = resolveActiveNav(activeKey);

  // Check if we should render the enhanced sidebar
  const existingSidebar = document.querySelector('.sidebar');
  const shouldUseEnhanced = window.location.pathname === '/app' || window.innerWidth <= 768;

  if (shouldUseEnhanced && existingSidebar) {
    console.log('🚀 Initializing Enhanced Sidebar...');

    // Add enhanced CSS classes and functionality to existing sidebar
    enhanceExistingSidebar(existingSidebar, resolvedKey);

    return true; // Indicate enhanced sidebar was used
  }

  return false; // Fall back to original implementation
}

// Function to enhance the existing sidebar with modern responsive features
function enhanceExistingSidebar(sidebar, activeKey) {
  // Add enhanced classes to existing sidebar
  sidebar.classList.add('enhanced-sidebar', 'transition-all', 'duration-300', 'ease-in-out');

  // Add mobile menu functionality
  setupMobileMenu(sidebar, activeKey);

  // Add collapse/expand functionality for desktop
  setupDesktopToggle(sidebar);

  // Enhance navigation items with better styling and interactions
  enhanceNavigationItems(sidebar, activeKey);

  console.log('✅ Enhanced sidebar setup complete');
}

// Setup mobile menu functionality
function setupMobileMenu(sidebar, activeKey) {
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    // Create mobile menu button if it doesn't exist
    if (!document.querySelector('.mobile-menu-button')) {
      const mobileButton = document.createElement('button');
      mobileButton.className = 'mobile-menu-button fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 md:hidden';
      mobileButton.innerHTML = `
        <svg class="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      `;
      mobileButton.setAttribute('aria-label', 'Open navigation menu');

      // Add mobile overlay for sidebar drawer
      const overlay = document.createElement('div');
      overlay.className = 'mobile-sidebar-overlay fixed inset-0 z-40 bg-black bg-opacity-50 hidden';

      document.body.appendChild(mobileButton);
      document.body.appendChild(overlay);

      // Mobile sidebar positioning
      sidebar.classList.add('fixed', 'top-0', 'left-0', 'h-full', 'w-64', 'z-50', 'transform', '-translate-x-full', 'md:translate-x-0', 'md:relative', 'md:w-auto');

      // Button click handler
      mobileButton.addEventListener('click', () => {
        const isOpen = !sidebar.classList.contains('-translate-x-full');
        if (isOpen) {
          sidebar.classList.add('-translate-x-full');
          overlay.classList.add('hidden');
        } else {
          sidebar.classList.remove('-translate-x-full');
          overlay.classList.remove('hidden');
        }
      });

      // Overlay click handler to close
      overlay.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
      });
    }
  }
}

// Setup desktop toggle functionality
function setupDesktopToggle(sidebar) {
  // Add toggle button to sidebar header if it doesn't exist
  const header = sidebar.querySelector('.sidebar__header');
  if (header && !header.querySelector('.sidebar-toggle')) {
    const toggleButton = document.createElement('button');
    toggleButton.className = 'sidebar-toggle p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors hidden md:block ml-auto';
    toggleButton.innerHTML = `
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
      </svg>
    `;
    toggleButton.setAttribute('aria-label', 'Toggle sidebar');

    header.appendChild(toggleButton);

    // Toggle click handler
    toggleButton.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.contains('sidebar-collapsed');

      if (isCollapsed) {
        sidebar.classList.remove('sidebar-collapsed', 'w-16');
        sidebar.classList.add('w-64');
        toggleButton.innerHTML = `
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        `;
      } else {
        sidebar.classList.add('sidebar-collapsed', 'w-16');
        sidebar.classList.remove('w-64');
        toggleButton.innerHTML = `
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        `;
      }
    });
  }
}

// Enhance navigation items with better styling and interactions
function enhanceNavigationItems(sidebar, activeKey) {
  const navItems = sidebar.querySelectorAll('.sidebar__nav-item');

  navItems.forEach(item => {
    // Add enhanced styling classes
    item.classList.add('transition-all', 'duration-200', 'hover:bg-gray-100', 'rounded-lg', 'mx-2', 'my-1');

    // Add focus styles for accessibility
    item.addEventListener('focus', () => {
      item.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
    });

    item.addEventListener('blur', () => {
      item.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
    });

    // Add keyboard navigation
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });

    // Enhance active state styling
    if (item.classList.contains('sidebar__nav-item--active')) {
      item.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-200');
    }
  });
}

// Legacy function - maintained for backwards compatibility
export function configureSidebar(activeKey, options = {}) {
  // Try enhanced sidebar first
  if (initializeEnhancedSidebar(activeKey, options)) {
    return;
  }

  // Original implementation as fallback
  const { manageAuth = true } = options;
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) {
    return;
  }

  const navItems = sidebar.querySelectorAll('.sidebar__nav-item');
  const resolvedKey = resolveActiveNav(activeKey);

  navItems.forEach((item) => {
    item.classList.remove('sidebar__nav-item--active');
    if (!item.classList.contains('sidebar__nav-item--inactive')) {
      item.classList.add('sidebar__nav-item--inactive');
    }
  });

  const activeItem = sidebar.querySelector(`.sidebar__nav-item[data-nav="${resolvedKey}"]`);
  if (activeItem) {
    activeItem.classList.add('sidebar__nav-item--active');
    activeItem.classList.remove('sidebar__nav-item--inactive');
  }

  if (!manageAuth) {
    return;
  }

  const userSection = sidebar.querySelector('#user-section');
  const authSection = sidebar.querySelector('#auth-section');
  const userNameEl = sidebar.querySelector('#user-name');
  const userEmailEl = sidebar.querySelector('#user-email');
  const logoutBtn = sidebar.querySelector('#logout-btn');
  const signInBtn = sidebar.querySelector('#sign-in-btn');

  const storedUser = getStoredUser();

  if (storedUser) {
    if (userSection) {
      userSection.style.display = 'flex';
    }
    if (authSection) {
      authSection.style.display = 'none';
    }
    if (userNameEl) {
      userNameEl.textContent = normalizeName(storedUser);
    }
    if (userEmailEl) {
      userEmailEl.textContent = storedUser.email || '';
    }
  } else {
    if (userSection) {
      userSection.style.display = 'none';
    }
    if (authSection) {
      authSection.style.display = 'flex';
    }
  }

  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  if (logoutBtn) {
    logoutBtn.style.display = storedUser ? 'inline' : 'none';
  }
}
