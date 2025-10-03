import React from 'react';

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
    <div className={`mb-6 ${className}`}>
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
