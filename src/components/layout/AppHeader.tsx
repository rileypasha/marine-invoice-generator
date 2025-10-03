import React from 'react';
import { Menu, User, MoreVertical } from 'lucide-react';
import { useSidebar } from '../ui/sidebar';

interface AppHeaderProps {
  /**
   * Optional user name for avatar display
   */
  userName?: string;
  /**
   * Optional user initials for avatar fallback
   */
  userInitials?: string;
  /**
   * Callback when profile button is clicked
   */
  onProfileClick?: () => void;
  /**
   * Callback when more menu button is clicked
   */
  onMoreClick?: () => void;
}

/**
 * AppHeader - Uber-style transparent mobile header
 *
 * Mobile-first header that blends with page background.
 * Left: hamburger menu + wordmark
 * Right: profile avatar + more menu
 *
 * Follows iOS PWA guidelines with safe-area support and 44px touch targets.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  userName,
  userInitials = 'U',
  onProfileClick,
  onMoreClick,
}) => {
  const { setOpen } = useSidebar();

  const handleMenuClick = () => {
    setOpen(true);
  };

  return (
    <header className="sticky top-0 z-40 bg-white md:hidden">
      <div
        className="flex h-14 items-center px-4"
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top))',
        }}
      >
        {/* Left: Hamburger + Logo */}
        <button
          onClick={handleMenuClick}
          aria-label="Open menu"
          className="hit inline-flex items-center justify-center min-w-[44px] min-h-[44px] -mx-1 px-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <Menu className="h-6 w-6 text-gray-900" />
        </button>

        <div className="flex-1 flex items-center ml-2">
          <img
            src="/bw_logo.svg"
            alt="Global Invoicing"
            className="h-8 select-none"
          />
        </div>

        {/* Right: Profile + More */}
        <div className="flex items-center gap-1">
          <button
            onClick={onProfileClick}
            aria-label={userName ? `Account - ${userName}` : 'Account'}
            className="hit inline-flex items-center justify-center min-w-[44px] min-h-[44px] -mx-1 px-1 rounded-full overflow-hidden hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {userInitials}
              </span>
            </div>
          </button>

          <button
            onClick={onMoreClick}
            aria-label="More options"
            className="hit inline-flex items-center justify-center min-w-[44px] min-h-[44px] -mx-1 px-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <MoreVertical className="h-6 w-6 text-gray-900" />
          </button>
        </div>
      </div>
    </header>
  );
};
