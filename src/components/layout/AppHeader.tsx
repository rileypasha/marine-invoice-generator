import React from 'react';
import { Menu, MoreVertical } from 'lucide-react';
import { useSidebar } from '../ui/sidebar';

interface AppHeaderProps {
  userName?: string;
  userInitials?: string;
  onProfileClick?: () => void;
  onMoreClick?: () => void;
}

/**
 * AppHeader - Uber-style transparent header
 *
 * Single header row with:
 * - Left: Menu + Wordmark
 * - Right: Avatar + More menu
 * - NO page title (renders in PageTitle component below)
 * - 56px content + safe-area padding
 * - 44px minimum touch targets
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
    <header role="banner" className="sticky top-0 z-40 bg-transparent md:hidden">
      <div className="safe-top" />
      <div className="flex h-14 items-center px-4">
        {/* Left: Menu button */}
        <button
          onClick={handleMenuClick}
          aria-label="Menu"
          className="hit mr-2"
        >
          <Menu className="h-6 w-6 text-gray-900" />
        </button>

        {/* Wordmark/Brand */}
        <img
          src="/bw_logo.svg"
          alt="Brand"
          className="h-5 select-none"
        />

        {/* Right: Actions */}
        <div className="ml-auto flex items-center gap-2">
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
            onClick={onMoreClick}
            aria-label="More"
            className="hit"
          >
            <MoreVertical className="h-6 w-6 text-gray-900" />
          </button>
        </div>
      </div>
    </header>
  );
};
