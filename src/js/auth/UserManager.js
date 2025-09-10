export class UserManager {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this.storageKey = 'marine_invoice_user';
    this.sessionKey = 'marine_invoice_session';
    
    this.initTestUser();
    
    // Load user from storage and ensure server session
    this.initializeAuth();
  }
  
  async initializeAuth() {
    // Check if user explicitly logged out
    const explicitLogout = localStorage.getItem('marine_invoice_explicit_logout');
    if (explicitLogout === 'true') {
      console.log('🚫 User explicitly logged out - skipping auto-login');
      // Clear the flag after checking
      localStorage.removeItem('marine_invoice_explicit_logout');
      return;
    }
    
    // First try to load from storage
    await this.loadUserFromStorage();
    
    // Only auto-sign in test user in development (localhost)
    const isProduction = window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    
    // If still not authenticated, auto-sign in test user (for development ONLY)
    // But only if they didn't explicitly log out and we're not in production
    if (!this.isAuthenticated() && explicitLogout !== 'true' && !isProduction) {
      console.log('🧪 Development mode - attempting auto-login');
      await this.autoSignInTestUser();
    }
  }
  
  // Initialize a test user for development
  initTestUser() {
    const existingUsers = this.getAllUsers();
    const testEmail = 'test@marinegroup.com';
    
    // Only create if it doesn't exist
    if (!existingUsers.find(u => u.email === testEmail)) {
      const testUser = {
        id: 'test_user_123',
        email: testEmail,
        name: 'Marine Test User',
        hashedPassword: this.hashPassword('password123'),
        createdAt: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      const users = [...existingUsers, testUser];
      localStorage.setItem('marine_invoice_users', JSON.stringify(users));
      console.log('🧪 Test user created:', testEmail, '/ password123');
    }
  }
  
  // Subscribe to user state changes
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  notify() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }
  
  // Load user from localStorage if exists
  async loadUserFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      const session = localStorage.getItem(this.sessionKey);
      
      if (stored && session) {
        const userData = JSON.parse(stored);
        const sessionData = JSON.parse(session);
        
        // Check if session is still valid (24 hours)
        const now = new Date().getTime();
        if (now - sessionData.timestamp < 24 * 60 * 60 * 1000) {
          this.currentUser = userData;
          
          // CRITICAL: Re-establish server session if needed
          // Check if we have a valid server session
          try {
            const response = await fetch('/api/auth/me', {
              credentials: 'include'
            });
            
            if (!response.ok) {
              // No server session exists
              // This is expected on initial page load if user hasn't logged in
              
              // Only try to recreate session for test user in development
              const isProduction = window.location.hostname !== 'localhost' && 
                                  window.location.hostname !== '127.0.0.1';
              
              if (userData.email === 'test@marinegroup.com' && !isProduction) {
                console.log('📌 No server session found for test user, attempting to recreate...');
                const serverAuth = await this.serverSignIn(userData.email, 'password123');
                if (serverAuth.success) {
                  console.log('✅ Server session recreated for test user');
                } else {
                  // Even test user failed - clear everything
                  console.warn('⚠️ Could not recreate server session for test user - clearing local session');
                  this.clearLocalSession();
                  this.currentUser = null;
                  this.notify();
                  return;
                }
              } else {
                // Not test user or in production - clear local session silently
                // This is expected behavior when session expires
                this.clearLocalSession();
                this.currentUser = null;
                this.notify();
                return;
              }
            } else {
              console.log('✅ Valid server session exists');
            }
          } catch (err) {
            // Network error or other issue - clear session silently
            this.clearLocalSession();
            this.currentUser = null;
            this.notify();
            return;
          }
          
          this.notify();
        } else {
          this.logout();
        }
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
    }
  }
  
  // Register new user
  async register(email, password, name) {
    // Public registration is disabled for security
    // Users must be added by the master account through the admin dashboard
    return { 
      success: false, 
      error: 'Public registration is disabled. Please contact your administrator to create an account.' 
    };
  }
  
  // Sign in existing user
  async signIn(email, password, rememberMe = false) {
    console.log('🔑 UserManager.signIn() called for email:', email);
    
    try {
      // First try server authentication
      const serverAuth = await this.serverSignIn(email, password);
      
      if (serverAuth.success) {
        console.log('✅ Server authentication successful');
        
        // Clear the explicit logout flag since user is signing in
        localStorage.removeItem('marine_invoice_explicit_logout');
        
        // Check if user is master
        if (serverAuth.isMaster) {
          console.log('👑 Master user detected - redirecting to dashboard');
          // Redirect to master dashboard
          window.location.href = '/master';
          return { success: true, user: serverAuth.user, redirect: true };
        }
        
        // Regular user - continue with normal flow
        this.currentUser = serverAuth.user;
        this.saveSession(rememberMe);
        this.notify();
        
        console.log('✅ Sign-in successful, user:', this.currentUser.name);
        return { success: true, user: this.currentUser };
      }
      
      // Fallback to local authentication if server fails
      console.log('⚠️ Server auth failed, trying local auth');
      
      const existingUsers = this.getAllUsers();
      console.log('👥 Found', existingUsers.length, 'existing users');
      
      const user = existingUsers.find(u => u.email === email);
      
      if (!user) {
        console.log('❌ No user found with email:', email);
        throw new Error('No account found with this email');
      }
      
      console.log('👤 User found:', user.name);
      
      if (!this.verifyPassword(password, user.hashedPassword)) {
        console.log('❌ Password verification failed');
        throw new Error('Incorrect password');
      }
      
      console.log('✅ Password verified');
      
      // Log them in
      this.currentUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences
      };
      
      this.saveSession(rememberMe);
      this.notify();
      
      console.log('✅ Sign-in successful, user:', this.currentUser.name);
      return { success: true, user: this.currentUser };
    } catch (error) {
      console.log('❌ Sign-in error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  // Server authentication
  async serverSignIn(email, password) {
    try {
      // Call server auth endpoint
      // The server uses email-only authentication for this system
      // Password field is kept for compatibility but not used server-side
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email,
          password: password // Include password even though server may not use it
        })
      });
      
      if (!response.ok) {
        console.log('Server auth failed with status:', response.status);
        return { success: false };
      }
      
      const data = await response.json();
      
      // Check if user is master
      const checkMasterResponse = await fetch('/api/auth/check-master', {
        credentials: 'include'
      });
      const masterCheck = await checkMasterResponse.json();
      
      return {
        success: true,
        user: data.user,
        isMaster: masterCheck.isMaster
      };
    } catch (error) {
      console.error('Server auth error:', error);
      return { success: false };
    }
  }
  
  // Helper to clear local session data
  clearLocalSession() {
    localStorage.removeItem(this.sessionKey);
    localStorage.removeItem(this.storageKey);
  }
  
  // Public method to clear session (used when server says not authenticated)
  clearSession(force = false) {
    // Don't clear if we have a valid localStorage user unless forced
    if (!force) {
      const storedUser = localStorage.getItem(this.storageKey);
      const storedSession = localStorage.getItem(this.sessionKey);
      if (storedUser && storedSession) {
        console.log('📌 Preserving localStorage authentication despite server auth failure');
        try {
          const user = JSON.parse(storedUser);
          this.currentUser = user;
          // IMPORTANT: Don't notify to prevent UI updates that would clear auth state
          return; // Don't clear or notify
        } catch (e) {
          console.error('Failed to preserve localStorage user:', e);
        }
      }
    }
    
    this.currentUser = null;
    this.clearLocalSession();
    this.notify();
  }
  
  // Sign out user
  async logout() {
    // Call server to destroy session
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      console.log('✅ Server session destroyed');
    } catch (error) {
      console.error('Failed to destroy server session:', error);
    }
    
    // Clear local state
    this.currentUser = null;
    
    // IMPORTANT: Clear BOTH session and user data to prevent auto-login
    this.clearLocalSession();
    
    // Also set a flag to prevent auto-login after explicit logout
    localStorage.setItem('marine_invoice_explicit_logout', 'true');
    
    this.notify();
  }
  
  // Update user preferences
  updatePreferences(preferences) {
    if (!this.currentUser) return;
    
    this.currentUser.preferences = { ...this.currentUser.preferences, ...preferences };
    
    // Update stored user data
    const existingUsers = this.getAllUsers();
    const userIndex = existingUsers.findIndex(u => u.id === this.currentUser.id);
    if (userIndex !== -1) {
      existingUsers[userIndex].preferences = this.currentUser.preferences;
      localStorage.setItem('marine_invoice_users', JSON.stringify(existingUsers));
    }
    
    this.notify();
  }
  
  // Get current user
  getCurrentUser() {
    // If currentUser is null, try to load from localStorage
    if (!this.currentUser) {
      const storedUser = localStorage.getItem(this.storageKey);
      const storedSession = localStorage.getItem(this.sessionKey);
      if (storedUser && storedSession) {
        try {
          const user = JSON.parse(storedUser);
          const session = JSON.parse(storedSession);
          // Check if session is still valid (24 hours)
          const now = new Date().getTime();
          if (now - session.timestamp < 24 * 60 * 60 * 1000) {
            this.currentUser = user;
            console.log('🔄 Restored user from localStorage in getCurrentUser()');
          }
        } catch (e) {
          console.error('Failed to restore user from localStorage:', e);
        }
      }
    }
    return this.currentUser;
  }
  
  // Check if user is authenticated
  isAuthenticated() {
    // First check currentUser
    if (this.currentUser) {
      return true;
    }
    
    // If not, try to get user (which will restore from localStorage if valid)
    const user = this.getCurrentUser();
    return !!user;
  }
  
  // Helper methods
  generateId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  hashPassword(password) {
    // Simple hash for demo - use proper hashing in production
    return btoa(password + 'marine_salt_key');
  }
  
  verifyPassword(password, hashedPassword) {
    return this.hashPassword(password) === hashedPassword;
  }
  
  saveUser(user) {
    const existingUsers = this.getAllUsers();
    existingUsers.push(user);
    localStorage.setItem('marine_invoice_users', JSON.stringify(existingUsers));
  }
  
  getAllUsers() {
    try {
      const stored = localStorage.getItem('marine_invoice_users');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  saveSession(rememberMe = false) {
    const sessionData = {
      userId: this.currentUser.id,
      timestamp: new Date().getTime(),
      rememberMe
    };
    
    localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
    localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
  }
  
  // Auto-sign in test user for development
  async autoSignInTestUser() {
    try {
      const testEmail = 'test@marinegroup.com';
      
      const existingUsers = this.getAllUsers();
      const testUser = existingUsers.find(u => u.email === testEmail);
      
      if (testUser) {
        console.log('🧪 Auto-signing in test user:', testEmail);
        
        // CRITICAL: Must authenticate with server to create session
        const serverAuth = await this.serverSignIn(testEmail, 'password123');
        
        if (serverAuth.success) {
          console.log('✅ Server session created for test user');
          this.currentUser = serverAuth.user || testUser;
          this.saveSession(true); // Remember the test user
          this.notify();
          console.log('✅ Test user signed in automatically with server session');
        } else {
          // Fallback to local-only (will cause 401s but user can still use the app locally)
          console.warn('⚠️ Could not create server session for test user - saves will fail');
          this.currentUser = testUser;
          this.saveSession(true);
          this.notify();
        }
      }
    } catch (error) {
      console.error('❌ Failed to auto-sign in test user:', error);
    }
  }
}