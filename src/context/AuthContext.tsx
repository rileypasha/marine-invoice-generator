import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest, API_ENDPOINTS } from '../config/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
          id: data.userId,
          email: data.email,
          name: data.name,
          role: data.role
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
        // Extract a display name from email (part before @)
        const displayName = data.email.split('@')[0];
        setCurrentUser({
          id: data.userId,
          email: data.email,
          name: displayName,
          role: 'standard' // Default role
        });
        setCsrfToken(data.csrfToken);
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