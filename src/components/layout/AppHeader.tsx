import React from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from '../ui/sidebar';

interface AppHeaderProps {
  userName?: string;
  userInitials?: string;
  onProfileClick?: () => void;
}

/**
 * AppHeader - Uber-style header
 *
 * Final spec:
 * - Left: Logo 16px inset from left
 * - Right: Avatar + Menu (16px from right edge)
 * - Icons: 20-22px; gap: 8px
 * - Header: h-14 (56px); tap targets ≥44px
 * - Hairline divider: border-b border-black/5
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  userName,
  userInitials = 'U',
  onProfileClick,
}) => {
  const { setOpen } = useSidebar();

  const handleMenuClick = () => {
    setOpen(true);
  };

  return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-black/5 md:hidden">
      <div className="flex h-14 items-center" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
          {/* Left: Logo 16px inset */}
        <img
          src="/mgbw_logo.svg"
          alt="Brand"
          className="h-10 select-none"
        />

        {/* Right: Avatar + Menu (8px gap, 16px from edge) */}
        <div className="ml-auto flex items-center" style={{ gap: '8px' }}>
          <button
            onClick={onProfileClick}
            aria-label={userName ? `Account - ${userName}` : 'Account'}
            className="hit rounded-full overflow-hidden"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {userInitials}
              </span>
            </div>
          </button>

          <button
            onClick={handleMenuClick}
            aria-label="Menu"
            className="hit"
          >
            <Menu className="h-5 w-5 text-gray-900" />
          </button>
        </div>
      </div>
    </header>
  );
};
