/**
 * Customers Entry Point - Initialize customer directory page
 */
import { CustomersPage } from './components/CustomersPage.js';

// Initialize customers page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Initializing Customer Directory...');

  // Check authentication
  const storedUser = localStorage.getItem('marine_invoice_user');
  if (!storedUser) {
    console.log('🚫 User not authenticated, redirecting...');
    window.location.href = '/';
    return;
  }

  try {
    const user = JSON.parse(storedUser);
    console.log('✅ User authenticated:', user.email);

    // Initialize customers page
    window.customersPage = new CustomersPage({
      containerId: 'customers-page'
    });

    console.log('✅ Customer Directory initialized');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    window.location.href = '/';
  }
});

// Add mobile menu toggle if needed
function toggleMobileMenu() {
  const sidebar = document.querySelector('.page-sidebar');
  sidebar.classList.toggle('page-sidebar--open');
}

// Add click outside to close mobile menu
document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.page-sidebar');
  const isClickInside = sidebar.contains(e.target);

  if (!isClickInside && window.innerWidth <= 1024) {
    sidebar.classList.remove('page-sidebar--open');
  }
});

// Export for global access
window.toggleMobileMenu = toggleMobileMenu;