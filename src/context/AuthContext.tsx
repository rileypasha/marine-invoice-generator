import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest, API_ENDPOINTS } from '../config/api';
import { useSessionKeepAlive } from '../hooks/useSessionKeepAlive';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  csrfToken: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiRequest(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role || 'standard',
          avatarUrl: data.user.avatarUrl
        });
        setCsrfToken(data.csrfToken);
        return true;
      } else {
        const error = await response.json();
        console.error('Login failed:', error);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiRequest(API_ENDPOINTS.AUTH.LOGOUT, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setCurrentUser(null);
      setCsrfToken(null);
    }
  };

  const checkAuth = async (): Promise<void> => {
    try {
      const response = await apiRequest(API_ENDPOINTS.AUTH.CHECK, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setCsrfToken(data.csrfToken);

        // Only set user data if logged in (userId exists)
        if (data.userId) {
          // Extract a display name from email (part before @)
          const displayName = data.name || data.email.split('@')[0];
          setCurrentUser({
            id: data.userId,
            email: data.email,
            name: displayName,
            role: data.role || 'standard',
            avatarUrl: data.avatarUrl
          });
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        setCsrfToken(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setCurrentUser(null);
      setCsrfToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Keep the server session alive while the user is actively interacting
  useSessionKeepAlive(!!currentUser);

  const value: AuthContextType = {
    currentUser,
    isAuthenticated: !!currentUser,
    isLoading,
    csrfToken,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};