/**
 * AuthContext - React Context for user authentication management
 * Replaces vanilla UserManager.js with React-based authentication
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children, isStandaloneMode = false }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const storageKey = 'marine_invoice_user';
  const sessionKey = 'marine_invoice_session';

  // Initialize test user (keeping existing behavior)
  const initTestUser = () => {
    const testUser = {
      id: 'test-user-1',
      email: 'test@marinegroup.com',
      name: 'Test User',
      role: 'user',
      isTestUser: true
    };
    return testUser;
  };

  // Load user from localStorage
  const loadUserFromStorage = useCallback(async () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const userData = JSON.parse(stored);
        setCurrentUser(userData);
        setIsAuthenticated(true);
        console.log('✅ User loaded from storage:', userData.email);
        return userData;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load user from storage:', error);
    }
    return null;
  }, []);

  // Save user to localStorage
  const saveUserToStorage = useCallback((user) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(user));
      localStorage.setItem(sessionKey, Date.now().toString());
    } catch (error) {
      console.warn('⚠️ Failed to save user to storage:', error);
    }
  }, []);

  // Clear user from storage
  const clearUserFromStorage = useCallback(() => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(sessionKey);
    localStorage.setItem('marine_invoice_explicit_logout', 'true');
  }, []);

  // Login function
  const login = useCallback(async (userData) => {
    try {
      setCurrentUser(userData);
      setIsAuthenticated(true);
      saveUserToStorage(userData);
      console.log('✅ User logged in:', userData.email);
      return { success: true };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return { success: false, error: error.message };
    }
  }, [saveUserToStorage]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setCurrentUser(null);
      setIsAuthenticated(false);
      clearUserFromStorage();
      console.log('✅ User logged out');

      // Redirect to home page
      window.location.href = '/';
      return { success: true };
    } catch (error) {
      console.error('❌ Logout failed:', error);
      return { success: false, error: error.message };
    }
  }, [clearUserFromStorage]);

  // Check server session
  const checkServerSession = useCallback(async () => {
    try {
      const response = await fetch('/api/simple-auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const serverAuth = await response.json();
        if (serverAuth.authenticated && serverAuth.user) {
          return { valid: true, user: serverAuth.user };
        }
      }
      return { valid: false };
    } catch (error) {
      console.error('❌ Server session check failed:', error);
      return { valid: false };
    }
  }, []);

  // Initialize authentication
  const initializeAuth = useCallback(async () => {
    setIsLoading(true);

    try {
      // In standalone mode, skip authentication entirely
      if (isStandaloneMode) {
        console.log('🏃 Standalone mode - skipping authentication');
        setCurrentUser({
          id: 'standalone-user',
          email: 'standalone@marinegroup.com',
          name: 'Standalone User',
          role: 'user',
          isStandaloneUser: true
        });
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Check if user explicitly logged out
      const explicitLogout = localStorage.getItem('marine_invoice_explicit_logout');
      if (explicitLogout === 'true') {
        console.log('🚫 User explicitly logged out - skipping auto-login');
        localStorage.removeItem('marine_invoice_explicit_logout');
        setIsLoading(false);
        return;
      }

      // Try to load from storage first
      const storedUser = await loadUserFromStorage();

      // If we have a stored user, verify with server
      if (storedUser) {
        const serverCheck = await checkServerSession();
        if (serverCheck.valid) {
          // Server confirms authentication, we're good
          console.log('✅ Authentication confirmed by server');
        } else {
          // Server doesn't recognize us, clear local storage
          console.log('⚠️ Server session invalid, clearing local storage');
          clearUserFromStorage();
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } else {
        // No stored user, check if server has session
        const serverCheck = await checkServerSession();
        if (serverCheck.valid) {
          console.log('✅ Server session found, logging in');
          await login(serverCheck.user);
        } else {
          // No authentication anywhere, use test user for development
          console.log('📝 No authentication found, using test user');
          const testUser = initTestUser();
          await login(testUser);
        }
      }
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      // Fallback to test user
      const testUser = initTestUser();
      await login(testUser);
    } finally {
      setIsLoading(false);
    }
  }, [isStandaloneMode, loadUserFromStorage, checkServerSession, clearUserFromStorage, login]);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Provide auth context
  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkServerSession,
    initializeAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;