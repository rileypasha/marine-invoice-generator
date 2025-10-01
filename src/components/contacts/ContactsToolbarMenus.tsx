import React from 'react';
import { ChevronDown, User, Mail, Hash, ArrowUpDown, ArrowUp, ArrowDown, Filter, Activity, Building } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { SimpleButton as Button } from '@/components/ui/simple-button';
import CountBadge from '@/components/ui/count-badge';
import { ContactGroupBy, ContactSort, ContactFilters } from '@/hooks/useContactsQueryState';

interface ToolbarMenuButtonWithBadgeProps {
  label: string;
  count: number;
  ariaLabel: string;
  children: React.ReactNode;
}

function ToolbarMenuButtonWithBadge({ label, count, ariaLabel, children }: ToolbarMenuButtonWithBadgeProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={ariaLabel}
          className="inline-flex items-center h-8 px-3 text-sm font-normal text-gray-600 transition-none"
        >
          {label}
          <CountBadge count={count} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface GroupMenuProps {
  activeGroupBy: ContactGroupBy;
  onGroupByChange: (groupBy: ContactGroupBy) => void;
}

function GroupMenu({ activeGroupBy, onGroupByChange }: GroupMenuProps) {
  const groupOptions = [
    { key: 'none' as ContactGroupBy, label: 'No grouping', icon: <Hash className="h-4 w-4" /> },
    { key: 'activity' as ContactGroupBy, label: 'By All Activity', icon: <Activity className="h-4 w-4" /> },
    { key: 'monthlyActivity' as ContactGroupBy, label: 'By Monthly Activity', icon: <Activity className="h-4 w-4" /> },
  ];

  const groupCount = activeGroupBy !== 'none' ? 1 : 0;
  const ariaLabel = groupCount > 0 ? `Group, 1 option applied` : 'Group options';

  return (
    <ToolbarMenuButtonWithBadge
      label="Group"
      count={groupCount}
      ariaLabel={ariaLabel}
    >
      <DropdownMenuLabel>Group by</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {groupOptions.map((option) => (
        <DropdownMenuItem
          key={option.key}
          onClick={() => onGroupByChange(option.key)}
          className={activeGroupBy === option.key ? 'bg-gray-100' : ''}
        >
          {option.icon}
          <span className="ml-2">{option.label}</span>
        </DropdownMenuItem>
      ))}

      {activeGroupBy !== 'none' && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onGroupByChange('none');
            }}
            className="text-red-600"
          >
            Clear grouping
          </DropdownMenuItem>
        </>
      )}
    </ToolbarMenuButtonWithBadge>
  );
}

interface FilterMenuProps {
  activeFilters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
}

function FilterMenu({ activeFilters, onFiltersChange }: FilterMenuProps) {
  const filterCount = Object.keys(activeFilters).length;
  const ariaLabel = filterCount > 0 ? `Filter, ${filterCount} applied` : 'Filter options';

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...activeFilters };
    if (value === false || value === '' || value === null || value === undefined) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  return (
    <ToolbarMenuButtonWithBadge
      label="Filter"
      count={filterCount}
      ariaLabel={ariaLabel}
    >
      <DropdownMenuLabel>Filter contacts</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuLabel className="text-xs text-gray-500">Status</DropdownMenuLabel>

      <DropdownMenuItem
        onClick={() => handleFilterChange('status', 'active')}
        className={activeFilters.status === 'active' ? 'bg-gray-100' : ''}
      >
        Active contacts
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => handleFilterChange('status', 'inactive')}
        className={activeFilters.status === 'inactive' ? 'bg-gray-100' : ''}
      >
        Inactive contacts
      </DropdownMenuItem>

      {filterCount > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFiltersChange({});
            }}
            className="text-red-600"
          >
            Clear all filters
          </DropdownMenuItem>
        </>
      )}
    </ToolbarMenuButtonWithBadge>
  );
}

interface SortMenuProps {
  activeSort: ContactSort | null;
  onSortChange: (sort: ContactSort | null) => void;
}

function SortMenu({ activeSort, onSortChange }: SortMenuProps) {
  const sortOptions = [
    { field: 'display_name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'invoice_count', label: 'Total Invoices' },
    { field: 'invoice_total', label: 'Total Amount' },
    { field: 'monthly_invoice_count', label: 'Monthly Invoices' },
    { field: 'monthly_invoice_total', label: 'Monthly Amount' },
  ];

  const sortCount = activeSort ? 1 : 0;
  const ariaLabel = sortCount > 0 ? `Sort, 1 rule applied` : 'Sort options';

  const handleSortChange = (field: string) => {
    if (activeSort?.field === field) {
      // Toggle direction if same field
      const newDirection = activeSort.direction === 'asc' ? 'desc' : 'asc';
      onSortChange({ field, direction: newDirection });
    } else {
      // New field, use desc for money columns, asc for others
      const isMoneyColumn = field.includes('invoice_') || field.includes('total');
      const defaultDirection = isMoneyColumn ? 'desc' : 'asc';
      onSortChange({ field, direction: defaultDirection });
    }
  };

  const getSortIcon = (field: string) => {
    if (activeSort?.field !== field) return null;
    return activeSort.direction === 'asc' ?
      <ArrowUp className="h-3 w-3" /> :
      <ArrowDown className="h-3 w-3" />;
  };

  return (
    <ToolbarMenuButtonWithBadge
      label="Sort"
      count={sortCount}
      ariaLabel={ariaLabel}
    >
      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
      <DropdownMenuSeparator />

      {sortOptions.map((option) => (
        <DropdownMenuItem
          key={option.field}
          onClick={() => handleSortChange(option.field)}
          className={activeSort?.field === option.field ? 'bg-gray-100' : ''}
        >
          <div className="flex items-center justify-between w-full">
            <span>{option.label}</span>
            {getSortIcon(option.field)}
          </div>
        </DropdownMenuItem>
      ))}

      {activeSort && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSortChange(null);
            }}
            className="text-red-600"
          >
            Clear sorting
          </DropdownMenuItem>
        </>
      )}
    </ToolbarMenuButtonWithBadge>
  );
}

interface ContactsToolbarMenusProps {
  activeGroupBy: ContactGroupBy;
  onGroupByChange: (groupBy: ContactGroupBy) => void;
  activeFilters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
  activeSort: ContactSort | null;
  onSortChange: (sort: ContactSort | null) => void;
  className?: string;
}

export function ContactsToolbarMenus({
  activeGroupBy,
  onGroupByChange,
  activeFilters,
  onFiltersChange,
  activeSort,
  onSortChange,
  className = ''
}: ContactsToolbarMenusProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <GroupMenu
        activeGroupBy={activeGroupBy}
        onGroupByChange={onGroupByChange}
      />
      <FilterMenu
        activeFilters={activeFilters}
        onFiltersChange={onFiltersChange}
      />
      <SortMenu
        activeSort={activeSort}
        onSortChange={onSortChange}
      />
    </div>
  );
}