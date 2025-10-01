import React, { useState } from 'react';
import { ChevronDown, Users, Ship, Receipt, Hash, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, UserCog } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
  const [contactInput, setContactInput] = useState('');
  const [vesselInput, setVesselInput] = useState('');
  const [createdByInput, setCreatedByInput] = useState('');
  const [modifiedByInput, setModifiedByInput] = useState('');
  const [minAmountInput, setMinAmountInput] = useState('');
  const [maxAmountInput, setMaxAmountInput] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

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

  const applyContactFilter = () => {
    if (contactInput.trim()) {
      handleFilterChange('contact', contactInput.trim());
    }
  };

  const applyVesselFilter = () => {
    if (vesselInput.trim()) {
      handleFilterChange('vessel', vesselInput.trim());
    }
  };

  const applyCreatedByFilter = () => {
    if (createdByInput.trim()) {
      handleFilterChange('createdBy', createdByInput.trim());
    }
  };

  const applyModifiedByFilter = () => {
    if (modifiedByInput.trim()) {
      handleFilterChange('modifiedBy', modifiedByInput.trim());
    }
  };

  const applyAmountRangeFilter = () => {
    if (minAmountInput) {
      handleFilterChange('minAmount', parseFloat(minAmountInput));
    }
    if (maxAmountInput) {
      handleFilterChange('maxAmount', parseFloat(maxAmountInput));
    }
  };

  const applyStatusFilter = (status: string) => {
    setSelectedStatus(status);
    handleFilterChange('status', status);
  };

  const removeFilter = (key: string) => {
    handleFilterChange(key, null);
    // Clear corresponding input
    if (key === 'contact') setContactInput('');
    if (key === 'vessel') setVesselInput('');
    if (key === 'createdBy') setCreatedByInput('');
    if (key === 'modifiedBy') setModifiedByInput('');
    if (key === 'minAmount') setMinAmountInput('');
    if (key === 'maxAmount') setMaxAmountInput('');
    if (key === 'status') setSelectedStatus('');
  };

  return (
    <ToolbarMenuButtonWithBadge
      label="Filter"
      count={filterCount}
      ariaLabel={ariaLabel}
    >
      <div className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel>Filter requests</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Contact Filter */}
        <div className="px-2 py-2">
          <DropdownMenuLabel className="text-xs text-gray-500 px-0 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Contact
          </DropdownMenuLabel>
          <div className="flex gap-1 mt-1">
            <Input
              placeholder="Enter contact name..."
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyContactFilter()}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={applyContactFilter}
              className="h-8 px-3"
            >
              Apply
            </Button>
          </div>
          {activeFilters.contact && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">
                {activeFilters.contact}
              </span>
              <button
                onClick={() => removeFilter('contact')}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Vessel Filter */}
        <div className="px-2 py-2">
          <DropdownMenuLabel className="text-xs text-gray-500 px-0 flex items-center gap-1">
            <Ship className="h-3 w-3" />
            Vessel
          </DropdownMenuLabel>
          <div className="flex gap-1 mt-1">
            <Input
              placeholder="Enter vessel name..."
              value={vesselInput}
              onChange={(e) => setVesselInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyVesselFilter()}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={applyVesselFilter}
              className="h-8 px-3"
            >
              Apply
            </Button>
          </div>
          {activeFilters.vessel && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">
                {activeFilters.vessel}
              </span>
              <button
                onClick={() => removeFilter('vessel')}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Created By Filter */}
        <div className="px-2 py-2">
          <DropdownMenuLabel className="text-xs text-gray-500 px-0 flex items-center gap-1">
            <UserCog className="h-3 w-3" />
            Created By
          </DropdownMenuLabel>
          <div className="flex gap-1 mt-1">
            <Input
              placeholder="Enter creator name..."
              value={createdByInput}
              onChange={(e) => setCreatedByInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCreatedByFilter()}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={applyCreatedByFilter}
              className="h-8 px-3"
            >
              Apply
            </Button>
          </div>
          {activeFilters.createdBy && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">
                {activeFilters.createdBy}
              </span>
              <button
                onClick={() => removeFilter('createdBy')}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Modified By Filter */}
        <div className="px-2 py-2">
          <DropdownMenuLabel className="text-xs text-gray-500 px-0 flex items-center gap-1">
            <UserCog className="h-3 w-3" />
            Modified By
          </DropdownMenuLabel>
          <div className="flex gap-1 mt-1">
            <Input
              placeholder="Enter modifier name..."
              value={modifiedByInput}
              onChange={(e) => setModifiedByInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyModifiedByFilter()}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={applyModifiedByFilter}
              className="h-8 px-3"
            >
              Apply
            </Button>
          </div>
          {activeFilters.modifiedBy && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">
                {activeFilters.modifiedBy}
              </span>
              <button
                onClick={() => removeFilter('modifiedBy')}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Status Filter */}
        <div className="px-2 py-2">
          <DropdownMenuLabel className="text-xs text-gray-500 px-0 flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            Status
          </DropdownMenuLabel>
          <div className="mt-1 space-y-1">
            {['requested', 'approved', 'change_requested', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => applyStatusFilter(status)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                  activeFilters.status === status ? 'bg-gray-100 font-medium' : ''
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
          {activeFilters.status && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">
                {activeFilters.status.charAt(0).toUpperCase() + activeFilters.status.slice(1).replace('_', ' ')}
              </span>
              <button
                onClick={() => removeFilter('status')}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Amount Range Filter */}
        <div className="px-2 py-2">
          <DropdownMenuLabel className="text-xs text-gray-500 px-0">Amount Range</DropdownMenuLabel>
          <div className="mt-1 space-y-2">
            <div className="flex gap-1 items-center">
              <span className="text-xs text-gray-500 w-12">Min:</span>
              <Input
                type="number"
                placeholder="0.00"
                value={minAmountInput}
                onChange={(e) => setMinAmountInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyAmountRangeFilter()}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-1 items-center">
              <span className="text-xs text-gray-500 w-12">Max:</span>
              <Input
                type="number"
                placeholder="0.00"
                value={maxAmountInput}
                onChange={(e) => setMaxAmountInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyAmountRangeFilter()}
                className="h-8 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={applyAmountRangeFilter}
              className="h-8 w-full"
            >
              Apply Range
            </Button>
          </div>
          {(activeFilters.minAmount !== undefined || activeFilters.maxAmount !== undefined) && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">
                ${activeFilters.minAmount || 0} - ${activeFilters.maxAmount || '∞'}
              </span>
              <button
                onClick={() => {
                  removeFilter('minAmount');
                  removeFilter('maxAmount');
                }}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {filterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onFiltersChange({});
                  setContactInput('');
                  setVesselInput('');
                  setCreatedByInput('');
                  setModifiedByInput('');
                  setMinAmountInput('');
                  setMaxAmountInput('');
                  setSelectedStatus('');
                }}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Clear all filters
              </Button>
            </div>
          </>
        )}
      </div>
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