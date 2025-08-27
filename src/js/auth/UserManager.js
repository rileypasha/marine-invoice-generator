export class UserManager {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this.storageKey = 'marine_invoice_user';
    this.sessionKey = 'marine_invoice_session';
    
    this.initTestUser();
    this.loadUserFromStorage();
    
    // Auto-sign in test user if not already authenticated (for development)
    if (!this.isAuthenticated()) {
      this.autoSignInTestUser();
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
  loadUserFromStorage() {
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
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if user already exists
      const existingUsers = this.getAllUsers();
      if (existingUsers.find(user => user.email === email)) {
        throw new Error('User already exists with this email');
      }
      
      // Create new user
      const user = {
        id: this.generateId(),
        email,
        name,
        hashedPassword: this.hashPassword(password),
        createdAt: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      // Save user to storage
      this.saveUser(user);
      
      // Log them in
      this.currentUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences
      };
      
      this.saveSession();
      this.notify();
      
      return { success: true, user: this.currentUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Sign in existing user
  async signIn(email, password, rememberMe = false) {
    console.log('🔑 UserManager.signIn() called for email:', email);
    
    try {
      // First try server authentication
      const serverAuth = await this.serverSignIn(email, password);
      
      if (serverAuth.success) {
        console.log('✅ Server authentication successful');
        
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
      // NOTE: Login endpoint should NOT accept or need a name field
      // Names are only set during signup, not login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email
          // DO NOT send name during login - only email is needed
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
  
  // Sign out user
  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.sessionKey);
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
    return this.currentUser;
  }
  
  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
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
  autoSignInTestUser() {
    try {
      const testEmail = 'test@marinegroup.com';
      
      const existingUsers = this.getAllUsers();
      const testUser = existingUsers.find(u => u.email === testEmail);
      
      if (testUser) {
        console.log('🧪 Auto-signing in test user:', testEmail);
        this.currentUser = testUser;
        this.saveSession(true); // Remember the test user
        this.notify();
        console.log('✅ Test user signed in automatically');
      }
    } catch (error) {
      console.error('❌ Failed to auto-sign in test user:', error);
    }
  }
}