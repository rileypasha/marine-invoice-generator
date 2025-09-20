import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  FileText,
  Users,
  Ship,
  Settings,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { cn, getActiveNavFromPath, isMobileDevice } from '../lib/utils.js';

// Navigation items configuration
const navigationItems = [
  {
    id: 'invoices',
    label: 'Invoices',
    icon: FileText,
    href: '/app'
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    href: '/customers'
  },
  {
    id: 'vessels',
    label: 'Vessels',
    icon: Ship,
    href: '/vessels'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings'
  }
];

/**
 * Mobile overlay component for drawer functionality
 */
function MobileOverlay({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300 md:hidden"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

/**
 * Sidebar content component - used for both desktop and mobile
 */
function SidebarContent({
  isCollapsed,
  activePage,
  onPageChange,
  onToggleCollapse,
  onClose,
  showToggle = true,
  isMobile = false
}) {
  const handleKeyDown = useCallback((event, pageId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPageChange(pageId);
    }
  }, [onPageChange]);

  const handleNavigation = useCallback((item) => {
    onPageChange(item.id);

    // Navigate to the actual page
    if (item.href) {
      window.location.href = item.href;
    }

    // Close mobile sidebar if open
    if (isMobile && onClose) {
      onClose();
    }
  }, [onPageChange, isMobile, onClose]);

  return (
    <div className={cn(
      "flex h-full flex-col bg-white border-r border-gray-200 shadow-sm",
      "dark:bg-gray-900 dark:border-gray-700"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              MG
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Marine Group</h2>
          </div>
        )}
        {isCollapsed && !isMobile && (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto">
            MG
          </div>
        )}

        {/* Mobile close button */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Desktop toggle button */}
        {showToggle && onToggleCollapse && !isMobile && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3" role="navigation" aria-label="Main navigation">
        <ul className="space-y-1" role="menubar" aria-orientation="vertical">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <li key={item.id} role="none">
                <button
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => handleNavigation(item)}
                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
                    isActive && "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
                    !isActive && "text-gray-700 dark:text-gray-300",
                    isCollapsed && !isMobile && "justify-center px-2"
                  )}
                  aria-current={isActive ? "page" : undefined}
                  title={isCollapsed && !isMobile ? item.label : undefined}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive && "text-blue-600 dark:text-blue-400"
                  )} />
                  {(!isCollapsed || isMobile) && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {isActive && (!isCollapsed || isMobile) && (
                    <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full dark:bg-blue-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {!isCollapsed || isMobile ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            © 2024 Marine Group
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>
    </div>
  );
}

/**
 * Enhanced Responsive Sidebar Component
 */
export function EnhancedSidebar({
  defaultCollapsed = false,
  defaultActivePage = 'invoices',
  className,
  onPageChange: externalOnPageChange
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activePage, setActivePage] = useState(defaultActivePage);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check if device is mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update active page based on current URL
  useEffect(() => {
    const currentPath = window.location.pathname;
    const activeFromPath = getActiveNavFromPath(currentPath);
    setActivePage(activeFromPath);
  }, []);

  const handlePageChange = useCallback((pageId) => {
    setActivePage(pageId);
    if (externalOnPageChange) {
      externalOnPageChange(pageId);
    }
  }, [externalOnPageChange]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleMobileOpen = useCallback(() => {
    setMobileOpen(true);
  }, []);

  if (isMobile) {
    return (
      <>
        {/* Mobile Menu Button */}
        <button
          onClick={handleMobileOpen}
          className="fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 md:hidden dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Mobile Overlay */}
        <MobileOverlay isOpen={mobileOpen} onClose={handleMobileClose} />

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-300 ease-in-out md:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent
            isCollapsed={false}
            activePage={activePage}
            onPageChange={handlePageChange}
            onClose={handleMobileClose}
            showToggle={false}
            isMobile={true}
          />
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "transition-all duration-300 ease-in-out bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-700",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      <SidebarContent
        isCollapsed={isCollapsed}
        activePage={activePage}
        onPageChange={handlePageChange}
        onToggleCollapse={handleToggleCollapse}
        showToggle={true}
        isMobile={false}
      />
    </aside>
  );
}

/**
 * Enhanced version of the configureSidebar function that works with the new component
 */
export function configureEnhancedSidebar(activeKey, options = {}) {
  const { manageAuth = true } = options;

  // Initialize the React component if not already done
  if (!window.enhancedSidebarInstance) {
    console.log('Initializing Enhanced Sidebar...');

    // For now, we'll update the active page through the existing configureSidebar
    // Later this can be enhanced to work with React rendering
    if (typeof window.configureSidebar === 'function') {
      window.configureSidebar(activeKey, options);
    }
  }
}

export default EnhancedSidebar;