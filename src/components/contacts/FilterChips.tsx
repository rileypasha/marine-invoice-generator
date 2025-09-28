import React from 'react';
import { Users, Building2, Crown, Package, Archive } from 'lucide-react';
import { ContactSegment } from '@/hooks/useContactsQueryState';

interface FilterChipProps {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  count?: number;
  onClick: () => void;
}

function FilterChip({ label, icon, active, count, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
        transition-all duration-200 ease-in-out
        ${active
          ? 'bg-black text-white shadow-sm'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
        }
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`
          ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium
          ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}
        `}>
          {count}
        </span>
      )}
    </button>
  );
}

interface FilterChipsProps {
  activeSegment: ContactSegment;
  onSegmentChange: (segment: ContactSegment) => void;
  counts?: {
    all: number;
    customers: number;
    owners: number;
    vendors: number;
    archived: number;
  };
  className?: string;
}

export function FilterChips({
  activeSegment,
  onSegmentChange,
  counts,
  className = ''
}: FilterChipsProps) {
  const chips = [
    {
      key: 'all' as ContactSegment,
      label: 'All',
      icon: <Users className="h-3.5 w-3.5" />,
      count: counts?.all
    },
    {
      key: 'customers' as ContactSegment,
      label: 'Customers',
      icon: <Building2 className="h-3.5 w-3.5" />,
      count: counts?.customers
    },
    {
      key: 'owners' as ContactSegment,
      label: 'Owners',
      icon: <Crown className="h-3.5 w-3.5" />,
      count: counts?.owners
    },
    {
      key: 'vendors' as ContactSegment,
      label: 'Vendors',
      icon: <Package className="h-3.5 w-3.5" />,
      count: counts?.vendors
    },
    {
      key: 'archived' as ContactSegment,
      label: 'Archived',
      icon: <Archive className="h-3.5 w-3.5" />,
      count: counts?.archived
    }
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          label={chip.label}
          icon={chip.icon}
          active={activeSegment === chip.key}
          count={chip.count}
          onClick={() => onSegmentChange(chip.key)}
        />
      ))}
    </div>
  );
}