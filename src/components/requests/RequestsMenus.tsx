import React from 'react';
import { ChevronDown, Users, Ship, Receipt, Hash, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
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
import { RequestGroupBy, RequestSort, RequestFilters } from '@/hooks/useRequestsQueryState';

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
  activeGroupBy: RequestGroupBy;
  onGroupByChange: (groupBy: RequestGroupBy) => void;
}

function GroupMenu({ activeGroupBy, onGroupByChange }: GroupMenuProps) {
  const groupOptions = [
    { key: 'none' as RequestGroupBy, label: 'No grouping', icon: <Hash className="h-4 w-4" /> },
    { key: 'contact' as RequestGroupBy, label: 'Contact', icon: <Users className="h-4 w-4" /> },
    { key: 'vessel' as RequestGroupBy, label: 'Vessel', icon: <Ship className="h-4 w-4" /> },
    { key: 'status' as RequestGroupBy, label: 'Status', icon: <Receipt className="h-4 w-4" /> },
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
    </ToolbarMenuButtonWithBadge>
  );
}

interface FilterMenuProps {
  activeFilters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
}

function FilterMenu({ activeFilters, onFiltersChange }: FilterMenuProps) {
  const filterCount = Object.keys(activeFilters).length;
  const ariaLabel = filterCount > 0 ? `Filter, ${filterCount} applied` : 'Filter options';

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...activeFilters };
    if (value === false || value === '' || value === null) {
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
      <DropdownMenuLabel>Filter requests</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuLabel className="text-xs text-gray-500">Status</DropdownMenuLabel>

      <DropdownMenuItem
        onClick={() => handleFilterChange('status', 'saved')}
        className={activeFilters.status === 'saved' ? 'bg-gray-100' : ''}
      >
        Saved requests
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => handleFilterChange('status', 'draft')}
        className={activeFilters.status === 'draft' ? 'bg-gray-100' : ''}
      >
        Draft requests
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => handleFilterChange('status', 'submitted')}
        className={activeFilters.status === 'submitted' ? 'bg-gray-100' : ''}
      >
        Submitted requests
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuLabel className="text-xs text-gray-500">Amount Range</DropdownMenuLabel>

      <DropdownMenuItem
        onClick={() => handleFilterChange('minAmount', 1000)}
        className={activeFilters.minAmount === 1000 ? 'bg-gray-100' : ''}
      >
        Over $1,000
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => handleFilterChange('minAmount', 5000)}
        className={activeFilters.minAmount === 5000 ? 'bg-gray-100' : ''}
      >
        Over $5,000
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => handleFilterChange('minAmount', 10000)}
        className={activeFilters.minAmount === 10000 ? 'bg-gray-100' : ''}
      >
        Over $10,000
      </DropdownMenuItem>

      {filterCount > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onFiltersChange({})}
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
  activeSort: RequestSort | null;
  onSortChange: (sort: RequestSort | null) => void;
}

function SortMenu({ activeSort, onSortChange }: SortMenuProps) {
  const sortOptions = [
    { field: 'invoice_number', label: 'Invoice #' },
    { field: 'customer.display_name', label: 'Contact' },
    { field: 'vessel.name', label: 'Vessel' },
    { field: 'total_amount', label: 'Amount' },
    { field: 'invoice_date', label: 'Created At' },
    { field: 'updated_at', label: 'Last Modified' },
    { field: 'status', label: 'Status' },
  ];

  const sortCount = activeSort ? 1 : 0;
  const ariaLabel = sortCount > 0 ? `Sort, 1 rule applied` : 'Sort options';

  const handleSortChange = (field: string) => {
    if (activeSort?.field === field) {
      // Toggle direction if same field
      const newDirection = activeSort.direction === 'asc' ? 'desc' : 'asc';
      onSortChange({ field, direction: newDirection });
    } else {
      // New field, default to ascending (except for dates and amounts)
      const defaultDesc = ['invoice_date', 'updated_at', 'total_amount'].includes(field);
      onSortChange({ field, direction: defaultDesc ? 'desc' : 'asc' });
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
            onClick={() => onSortChange(null)}
            className="text-red-600"
          >
            Clear sorting
          </DropdownMenuItem>
        </>
      )}
    </ToolbarMenuButtonWithBadge>
  );
}

interface RequestsMenusProps {
  activeGroupBy: RequestGroupBy;
  onGroupByChange: (groupBy: RequestGroupBy) => void;
  activeFilters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
  activeSort: RequestSort | null;
  onSortChange: (sort: RequestSort | null) => void;
  className?: string;
}

export function RequestsMenus({
  activeGroupBy,
  onGroupByChange,
  activeFilters,
  onFiltersChange,
  activeSort,
  onSortChange,
  className = ''
}: RequestsMenusProps) {
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