/**
 * Invoices Entry Point - Initialize invoice directory page
 */

import '../styles/invoices-page.css';
import { InvoicesIndex } from './components/InvoicesIndex.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing Invoices Directory...');

  try {
    // Check authentication
    const authResult = await checkAuthentication();
    if (!authResult.valid) {
      console.log('🚫 Authentication failed, redirecting to login...');
      window.location.href = '/';
      return;
    }

    console.log('✅ Authentication validated:', authResult.user.email);

    // Initialize InvoicesIndex component
    const invoicesIndex = new InvoicesIndex();

    // Make available globally for pagination and other interactions
    window.invoicesIndex = invoicesIndex;

    console.log('✅ Invoices Directory initialized successfully');

  } catch (error) {
    console.error('❌ Error initializing Invoices Directory:', error);
    showError('Failed to initialize invoice directory');
  }
});

async function checkAuthentication() {
  try {
    // Check localStorage first
    const storedUser = localStorage.getItem('marine_invoice_user');
    const storedSession = localStorage.getItem('marine_invoice_session');

    if (!storedUser || !storedSession) {
      return { valid: false, reason: 'No stored authentication data' };
    }

    const user = JSON.parse(storedUser);
    const session = JSON.parse(storedSession);

    // Basic validation
    if (!user.id || !user.email) {
      return { valid: false, reason: 'Invalid user data' };
    }

    // Check session age
    const sessionAge = Date.now() - session.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      return { valid: false, reason: 'Session expired' };
    }

    // Try to validate with server
    try {
      const response = await fetch('/api/simple-auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const serverAuth = await response.json();
        if (serverAuth.authenticated) {
          return { valid: true, user: serverAuth.user || user };
        }
      }
    } catch (serverError) {
      console.warn('Server auth check failed, using localStorage:', serverError.message);
    }

    // Fallback to localStorage
    return { valid: true, user };

  } catch (error) {
    console.error('Authentication check error:', error);
    return { valid: false, reason: 'Authentication error' };
  }
}

function showError(message) {
  const container = document.getElementById('invoices-page');
  if (container) {
    container.innerHTML = `
      <div class="invoices-page-container">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h3>Error</h3>
          <p>${message}</p>
          <button class="btn btn--primary" onclick="window.location.reload()">
            Retry
          </button>
        </div>
      </div>
    `;
  }
}