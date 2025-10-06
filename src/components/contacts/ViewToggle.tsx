import React from 'react';
import { List, Grid3X3, Images } from 'lucide-react';
import { ContactView } from '@/hooks/useContactsQueryState';

interface ViewToggleButtonProps {
  view: ContactView;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ViewToggleButton({ view, icon, label, active, onClick }: ViewToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center px-2 py-1.5 text-sm font-medium
        transition-all duration-200 ease-in-out
        first:rounded-l-md last:rounded-r-md
        border border-gray-300 hover:bg-gray-50
        ${active
          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] z-10'
          : 'bg-white text-gray-700 hover:text-gray-900'
        }
        ${!active && 'border-r-0 last:border-r'}
      `}
      title={`${label} view`}
      aria-label={`Switch to ${label.toLowerCase()} view`}
      aria-pressed={active}
    >
      {icon}
      <span className="ml-1.5 hidden sm:inline">{label}</span>
    </button>
  );
}

interface ViewToggleProps {
  activeView: ContactView;
  onViewChange: (view: ContactView) => void;
  className?: string;
}

export function ViewToggle({
  activeView,
  onViewChange,
  className = ''
}: ViewToggleProps) {
  const views = [
    {
      key: 'list' as ContactView,
      icon: <List className="h-4 w-4" />,
      label: 'List'
    },
    {
      key: 'grid' as ContactView,
      icon: <Grid3X3 className="h-4 w-4" />,
      label: 'Grid'
    },
    {
      key: 'gallery' as ContactView,
      icon: <Images className="h-4 w-4" />,
      label: 'Gallery'
    }
  ];

  return (
    <div className={`inline-flex ${className}`} role="group" aria-label="View toggle">
      {views.map((view) => (
        <ViewToggleButton
          key={view.key}
          view={view.key}
          icon={view.icon}
          label={view.label}
          active={activeView === view.key}
          onClick={() => onViewChange(view.key)}
        />
      ))}
    </div>
  );
}