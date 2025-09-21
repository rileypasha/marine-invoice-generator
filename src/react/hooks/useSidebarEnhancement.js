import { useState, useEffect, useCallback } from 'react';

const PATH_TO_NAV = {
  '/app': 'invoices',
  '/invoices': 'invoices',
  '/customers': 'customers',
  '/vessels': 'vessels'
};

export const useSidebarEnhancement = (activeKey, options = {}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Resolve active navigation key
  const resolveActiveNav = useCallback((explicitKey) => {
    if (explicitKey) {
      return explicitKey;
    }
    const currentPath = window.location.pathname.replace(/\/$/, '');
    return PATH_TO_NAV[currentPath] || 'invoices';
  }, []);

  // Check if mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Set active navigation
  useEffect(() => {
    setActiveNav(resolveActiveNav(activeKey));
  }, [activeKey, resolveActiveNav]);

  // Toggle sidebar collapse (desktop)
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Toggle mobile menu
  const toggleMobileMenu = useCallback(() => {
    setIsMobileOpen(prev => !prev);
  }, []);

  // Close mobile menu
  const closeMobileMenu = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  // Get user from localStorage
  const getStoredUser = useCallback(() => {
    try {
      const raw = localStorage.getItem('marine_invoice_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse stored user:', error);
      return null;
    }
  }, []);

  // Normalize user name
  const normalizeName = useCallback((user) => {
    return user?.name || user?.email || 'User';
  }, []);

  // Handle settings action
  const handleSettings = useCallback(() => {
    if (window.openSettings) {
      window.openSettings();
    } else {
      console.warn('Settings functionality not loaded');
    }
  }, []);

  return {
    // State
    isCollapsed,
    isMobileOpen,
    activeNav,
    isMobile,

    // Actions
    toggleCollapse,
    toggleMobileMenu,
    closeMobileMenu,
    handleKeyDown,
    handleSettings,

    // Utilities
    getStoredUser,
    normalizeName,
    resolveActiveNav
  };
};

// Hook specifically for mobile menu functionality
export const useMobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close menu when switching to desktop
      if (!mobile && isOpen) {
        setIsOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [isOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen]);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    isMobile,
    toggle,
    open,
    close
  };
};

// Hook for navigation state management
export const useNavigation = (initialActiveKey) => {
  const [activeKey, setActiveKey] = useState('');

  useEffect(() => {
    const resolveActiveNav = (explicitKey) => {
      if (explicitKey) {
        return explicitKey;
      }
      const currentPath = window.location.pathname.replace(/\/$/, '');
      return PATH_TO_NAV[currentPath] || 'invoices';
    };

    setActiveKey(resolveActiveNav(initialActiveKey));
  }, [initialActiveKey]);

  const setActive = useCallback((key) => {
    setActiveKey(key);
  }, []);

  const isActive = useCallback((key) => {
    return activeKey === key;
  }, [activeKey]);

  return {
    activeKey,
    setActive,
    isActive
  };
};