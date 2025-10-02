import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Search, Plus, Users, Menu } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { hapticFeedback } from '../../hooks/useGestures';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'requests', label: 'Requests', icon: <Home size={24} />, path: '/requests' },
  { id: 'search', label: 'Search', icon: <Search size={24} />, path: '/search' },
  { id: 'create', label: 'Create', icon: <Plus size={24} />, path: '/requests/new' },
  { id: 'contacts', label: 'Contacts', icon: <Users size={24} />, path: '/contacts' },
  { id: 'more', label: 'More', icon: <Menu size={24} />, path: '/settings' },
];

export function BottomNav() {
  const location = useLocation();
  const { isMobile, isPWA } = useResponsive();

  // Only show on mobile in PWA mode
  if (!isMobile || !isPWA) {
    return null;
  }

  const handleNavClick = () => {
    // Trigger haptic feedback on navigation
    hapticFeedback(10);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
                          (item.path === '/requests' && location.pathname === '/');

          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={handleNavClick}
              className={`flex flex-col items-center justify-center flex-1 h-full relative ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              aria-label={item.label}
            >
              {/* Icon with scale animation */}
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
                className="relative"
              >
                {item.icon}

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
              </motion.div>

              {/* Label */}
              <span
                className={`text-xs mt-1 font-medium ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
