/**
 * Shared Sidebar Configuration
 * Basic sidebar configuration functionality for consistent navigation
 */

export function configureSidebar(activePage = null) {
  try {
    // Set active navigation state
    if (activePage) {
      const navItems = document.querySelectorAll('.sidebar-nav a, .nav-item');
      navItems.forEach(item => {
        item.classList.remove('active', 'current');
        if (item.getAttribute('data-page') === activePage ||
            item.getAttribute('href')?.includes(activePage)) {
          item.classList.add('active');
        }
      });
    }

    // Setup mobile menu toggle if it exists
    const mobileToggle = document.querySelector('[data-mobile-toggle]');
    const sidebar = document.querySelector('.sidebar, .page-sidebar');

    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Close sidebar on outside click for mobile
    document.addEventListener('click', (e) => {
      if (sidebar && window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !mobileToggle?.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });

  } catch (error) {
    console.warn('Sidebar configuration failed:', error);
  }
}

export default configureSidebar;