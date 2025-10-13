import React from 'react';
import { cn } from '../../lib/utils';

interface PageTitleProps {
  /**
   * Main page title
   */
  title: string;
  /**
   * Optional subtitle or description
   */
  subtitle?: string;
  /**
   * Optional right-side action buttons (e.g., Save, Print)
   */
  rightActions?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * PageTitle - Below-header page title component
 *
 * Renders page titles below the transparent header in the content area.
 * Supports optional subtitle and right-side action buttons.
 *
 * Mobile: Sticky below the AppHeader with frosted glass blur
 * Desktop: Normal flow without sticky positioning
 *
 * Usage:
 * <PageTitle title="New Invoice" rightActions={<SaveButton />} />
 */
export const PageTitle: React.FC<PageTitleProps> = ({
  title,
  subtitle,
  rightActions,
  className = '',
}) => {
  return (
    <div className={cn(
      'mb-6',
      'md:relative md:z-auto',
      'sticky top-[56px] z-[2999] bg-white/95 backdrop-blur-[10px] backdrop-saturate-[180%] border-b border-border md:border-0 md:bg-transparent md:backdrop-blur-none md:static',
      '-mx-4 px-4 pt-6 pb-3 md:mx-0 md:px-0 md:pt-0 md:pb-0',
      className
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600">
              {subtitle}
            </p>
          )}
        </div>
        {rightActions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {rightActions}
          </div>
        )}
      </div>
    </div>
  );
};
