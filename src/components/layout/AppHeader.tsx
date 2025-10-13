import React from 'react';

interface AppHeaderProps {
  userName?: string;
  userInitials?: string;
  avatarUrl?: string;
  onProfileClick?: () => void;
}

/**
 * AppHeader - Mobile PWA header
 *
 * Final spec:
 * - Left: Logo 16px inset from left
 * - Right: Avatar (16px from right edge)
 * - Header: h-14 (56px); tap targets ≥44px
 * - Hairline divider: border-b border-black/5
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  userName,
  userInitials = 'U',
  avatarUrl,
  onProfileClick,
}) => {
  return (
    <header role="banner" className="app-header fixed top-0 left-0 right-0 z-[3000] bg-white/95 backdrop-blur-[10px] backdrop-saturate-[180%] border-b border-black/5 md:hidden">
      <div className="flex h-14 items-center justify-between" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
        {/* Left: Logo 16px inset */}
        <img
          src="/mgbw_logo.svg"
          alt="Brand"
          className="h-10 select-none"
        />

        {/* Right: Avatar (optimized touch target) */}
        <button
          onClick={onProfileClick}
          aria-label={userName ? `Account - ${userName}` : 'Account'}
          className="h-12 w-12 rounded-full p-0 flex items-center justify-center active:opacity-70 transition-opacity"
        >
          <div className="h-10 w-10 rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName || 'User'}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // If image fails to load, hide it so initials show
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            {/* Always render initials as fallback */}
            <span className="text-sm font-medium text-gray-700" style={{ display: avatarUrl ? 'none' : 'block' }}>
              {userInitials}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
