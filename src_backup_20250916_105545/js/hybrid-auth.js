/**
 * Hybrid Authentication Manager
 * Uses cookies when available, falls back to localStorage tokens
 */
class HybridAuth {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.tokenExpiry = localStorage.getItem('auth_token_expiry');
    this.user = null;
  }

  /**
   * Login with email - tries both cookie and token auth
   */
  async login(email, password = '') {
    try {
      // First try traditional cookie-based login
      const cookieResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const cookieData = await cookieResponse.json();
      
      // Check if session cookie was actually set
      const hasCookie = document.cookie.includes('connect.sid');
      
      if (cookieData.success && hasCookie) {
        console.log('✅ Cookie auth successful');
        this.user = cookieData.user;
        localStorage.setItem('auth_method', 'cookie');
        localStorage.setItem('marine_invoice_user', JSON.stringify(cookieData.user));
        return { success: true, user: cookieData.user, method: 'cookie' };
      }

      // If no cookie was set, try token auth
      console.log('⚠️ Cookie not set, trying token auth...');
      
      const tokenResponse = await fetch('/api/token-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.success) {
        console.log('✅ Token auth successful');
        this.token = tokenData.token;
        this.tokenExpiry = tokenData.expiresAt;
        this.user = tokenData.user;
        
        // Store in localStorage
        localStorage.setItem('auth_token', tokenData.token);
        localStorage.setItem('auth_token_expiry', tokenData.expiresAt);
        localStorage.setItem('auth_method', 'token');
        localStorage.setItem('marine_invoice_user', JSON.stringify(tokenData.user));
        
        return { success: true, user: tokenData.user, method: 'token' };
      }

      return { success: false, error: 'Login failed' };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check authentication status
   */
  async checkAuth() {
    try {
      // First check for cookie-based session
      const cookieResponse = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (cookieResponse.ok) {
        const data = await cookieResponse.json();
        console.log('✅ Cookie auth valid');
        this.user = data.user;
        localStorage.setItem('auth_method', 'cookie');
        return { authenticated: true, user: data.user, method: 'cookie' };
      }

      // Check for token auth
      if (this.token && this.tokenExpiry) {
        if (Number(this.tokenExpiry) < Date.now()) {
          console.log('⚠️ Token expired');
          this.clearToken();
          return { authenticated: false };
        }

        const tokenResponse = await fetch('/api/token-auth/verify', {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });

        if (tokenResponse.ok) {
          const data = await tokenResponse.json();
          console.log('✅ Token auth valid');
          this.user = data.user;
          localStorage.setItem('auth_method', 'token');
          return { authenticated: true, user: data.user, method: 'token' };
        }
      }

      // Check localStorage fallback
      const storedUser = localStorage.getItem('marine_invoice_user');
      if (storedUser) {
        console.log('⚠️ Using localStorage user (offline mode)');
        this.user = JSON.parse(storedUser);
        return { authenticated: true, user: this.user, method: 'localStorage' };
      }

      return { authenticated: false };

    } catch (error) {
      console.error('Auth check error:', error);
      return { authenticated: false, error: error.message };
    }
  }

  /**
   * Make authenticated API request
   */
  async fetch(url, options = {}) {
    const authMethod = localStorage.getItem('auth_method');
    
    if (authMethod === 'token' && this.token) {
      // Add token to headers
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`
      };
    } else {
      // Use cookies
      options.credentials = 'include';
    }

    return fetch(url, options);
  }

  /**
   * Logout
   */
  async logout() {
    try {
      if (this.token) {
        await fetch('/api/token-auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
      }

      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

    } catch (error) {
      console.error('Logout error:', error);
    }

    this.clearToken();
    this.clearLocalStorage();
  }

  clearToken() {
    this.token = null;
    this.tokenExpiry = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_expiry');
    localStorage.removeItem('auth_method');
  }

  clearLocalStorage() {
    localStorage.removeItem('marine_invoice_user');
    localStorage.removeItem('marine_invoice_session');
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Check if using token auth
   */
  isUsingToken() {
    return localStorage.getItem('auth_method') === 'token';
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HybridAuth;
}