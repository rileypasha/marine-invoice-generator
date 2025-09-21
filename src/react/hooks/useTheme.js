/**
 * useTheme - React hook for theme management
 * Replaces vanilla ThemeManager.js with React patterns
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export const useTheme = () => {
  const { currentUser, updateUserPreferences } = useAuth();
  const [currentTheme, setCurrentTheme] = useState('dark');

  const STORAGE_KEY = 'marine_invoice_theme';

  /**
   * Apply theme to document
   */
  const applyTheme = useCallback((theme) => {
    try {
      // Remove existing theme classes
      document.documentElement.classList.remove('theme-light', 'theme-dark');
      document.body.classList.remove('light-theme', 'dark-theme');

      // Add new theme class
      document.documentElement.classList.add(`theme-${theme}`);
      document.body.classList.add(`${theme}-theme`);

      // Set CSS custom properties for theme
      const root = document.documentElement;
      if (theme === 'dark') {
        root.style.setProperty('--bg-primary', '#1a1a1a');
        root.style.setProperty('--bg-secondary', '#2d2d2d');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#cccccc');
        root.style.setProperty('--border-color', '#404040');
        root.style.setProperty('--accent-color', '#3b82f6');
      } else {
        root.style.setProperty('--bg-primary', '#ffffff');
        root.style.setProperty('--bg-secondary', '#f8f9fa');
        root.style.setProperty('--text-primary', '#1a1a1a');
        root.style.setProperty('--text-secondary', '#6b7280');
        root.style.setProperty('--border-color', '#e5e7eb');
        root.style.setProperty('--accent-color', '#2563eb');
      }

      console.log(`🎨 Applied ${theme} theme`);
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, []);

  /**
   * Set theme with persistence
   */
  const setTheme = useCallback(async (theme, saveToUserPrefs = true) => {
    if (!['light', 'dark'].includes(theme)) {
      console.warn('Invalid theme:', theme);
      return;
    }

    setCurrentTheme(theme);
    applyTheme(theme);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }

    // Save to user preferences if logged in and requested
    if (saveToUserPrefs && currentUser && updateUserPreferences) {
      try {
        await updateUserPreferences({ theme });
        console.log(`💾 Saved theme preference: ${theme}`);
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    }
  }, [currentUser, updateUserPreferences, applyTheme]);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [currentTheme, setTheme]);

  /**
   * Load theme from storage or user preferences
   */
  const loadTheme = useCallback(() => {
    let theme = 'dark'; // Default theme

    // Priority 1: User preferences (if logged in)
    if (currentUser?.preferences?.theme) {
      theme = currentUser.preferences.theme;
      console.log(`🔄 Loaded theme from user preferences: ${theme}`);
    } else {
      // Priority 2: localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && ['light', 'dark'].includes(stored)) {
          theme = stored;
          console.log(`🔄 Loaded theme from localStorage: ${theme}`);
        }
      } catch (error) {
        console.error('Error loading theme from localStorage:', error);
      }
    }

    // Priority 3: System preference (if no stored preference)
    if (!currentUser?.preferences?.theme && !localStorage.getItem(STORAGE_KEY)) {
      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          theme = 'dark';
          console.log('🔄 Using system dark theme preference');
        } else {
          theme = 'light';
          console.log('🔄 Using system light theme preference');
        }
      } catch (error) {
        console.error('Error detecting system theme preference:', error);
      }
    }

    setCurrentTheme(theme);
    applyTheme(theme);
  }, [currentUser, applyTheme]);

  /**
   * Get theme options
   */
  const getThemeOptions = useCallback(() => [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' }
  ], []);

  /**
   * Check if theme is dark
   */
  const isDark = currentTheme === 'dark';

  /**
   * Check if theme is light
   */
  const isLight = currentTheme === 'light';

  // Load theme on mount and when user changes
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // Listen for system theme changes
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleSystemThemeChange = (e) => {
        // Only update if no user preference is set
        if (!currentUser?.preferences?.theme && !localStorage.getItem(STORAGE_KEY)) {
          const systemTheme = e.matches ? 'dark' : 'light';
          setCurrentTheme(systemTheme);
          applyTheme(systemTheme);
          console.log(`🔄 System theme changed to: ${systemTheme}`);
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    } catch (error) {
      console.error('Error setting up system theme listener:', error);
    }
  }, [currentUser, applyTheme]);

  return {
    // Current theme state
    currentTheme,
    isDark,
    isLight,

    // Theme actions
    setTheme,
    toggleTheme,
    loadTheme,

    // Utilities
    getThemeOptions,
    applyTheme
  };
};

export default useTheme;