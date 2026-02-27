import React, { useState, useEffect } from 'react';
import { Users, Ship, Receipt, Hash, ArrowUp, ArrowDown, X, UserCog, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      <DropdownMenuContent align="end">
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
    { key: 'createdBy' as RequestGroupBy, label: 'Created By', icon: <UserCog className="h-4 w-4" /> },
    { key: 'modifiedBy' as RequestGroupBy, label: 'Modified By', icon: <UserCog className="h-4 w-4" /> },
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
      <div
        className="w-[220px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
          <span className="text-[13px] font-semibold text-gray-900">Group by</span>
          {groupCount > 0 && (
            <button
              onClick={() => onGroupByChange('none')}
              className="text-[12px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Active group chip */}
        {groupCount > 0 && (
          <div className="px-3 pb-2.5">
            <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] font-medium bg-[#1E3A5F]/[0.08] text-[#1E3A5F] rounded-md">
              {groupOptions.find(o => o.key === activeGroupBy)?.label}
              <button
                onClick={() => onGroupByChange('none')}
                className="p-0.5 rounded hover:bg-[#1E3A5F]/[0.1] transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        <div className="h-px bg-gray-100" />

        {/* Options */}
        <div className="px-1.5 py-1.5 space-y-0.5">
          {groupOptions.map((option) => {
            const isActive = activeGroupBy === option.key;
            return (
              <button
                key={option.key}
                onClick={() => onGroupByChange(option.key)}
                className={cn(
                  "flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors",
                  isActive
                    ? "bg-[#1E3A5F]/[0.08] text-[#1E3A5F] font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <span className={cn(
                  "flex-shrink-0",
                  isActive ? "text-[#1E3A5F]" : "text-gray-400"
                )}>
                  {option.icon}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </ToolbarMenuButtonWithBadge>
  );
}

interface FilterMenuProps {
  activeFilters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
}

function FilterMenu({ activeFilters, onFiltersChange }: FilterMenuProps) {
  const [contactInput, setContactInput] = useState(activeFilters.contact || '');
  const [vesselInput, setVesselInput] = useState(activeFilters.vessel || '');
  const [createdByInput, setCreatedByInput] = useState(activeFilters.createdBy || '');
  const [modifiedByInput, setModifiedByInput] = useState(activeFilters.modifiedBy || '');

  // Sync local inputs when filters change externally (e.g. URL navigation)
  useEffect(() => { setContactInput(activeFilters.contact || ''); }, [activeFilters.contact]);
  useEffect(() => { setVesselInput(activeFilters.vessel || ''); }, [activeFilters.vessel]);
  useEffect(() => { setCreatedByInput(activeFilters.createdBy || ''); }, [activeFilters.createdBy]);
  useEffect(() => { setModifiedByInput(activeFilters.modifiedBy || ''); }, [activeFilters.modifiedBy]);

  const filterCount = Object.keys(activeFilters).length;
  const ariaLabel = filterCount > 0 ? `Filter, ${filterCount} applied` : 'Filter options';

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...activeFilters };
    if (value === false || value === '' || value === null || value === undefined) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const clearFilter = (key: string) => {
    updateFilter(key, null);
    if (key === 'contact') setContactInput('');
    if (key === 'vessel') setVesselInput('');
    if (key === 'createdBy') setCreatedByInput('');
    if (key === 'modifiedBy') setModifiedByInput('');
  };

  const clearAll = () => {
    onFiltersChange({});
    setContactInput('');
    setVesselInput('');
    setCreatedByInput('');
    setModifiedByInput('');
  };

  const statusOptions = [
    { value: 'requested', label: 'Pending', dotColor: 'bg-amber-400' },
    { value: 'approved', label: 'Approved', dotColor: 'bg-emerald-400' },
    { value: 'change_requested', label: 'Revision', dotColor: 'bg-blue-400' },
  ];

  const textFilters = [
    { key: 'contact', label: 'Contact', icon: Users, value: contactInput, setValue: setContactInput, placeholder: 'Filter by name...' },
    { key: 'vessel', label: 'Vessel', icon: Ship, value: vesselInput, setValue: setVesselInput, placeholder: 'Filter by vessel...' },
    { key: 'createdBy', label: 'Created by', icon: UserCog, value: createdByInput, setValue: setCreatedByInput, placeholder: 'Filter by creator...' },
    { key: 'modifiedBy', label: 'Modified by', icon: UserCog, value: modifiedByInput, setValue: setModifiedByInput, placeholder: 'Filter by modifier...' },
  ];

  return (
    <ToolbarMenuButtonWithBadge
      label="Filter"
      count={filterCount}
      ariaLabel={ariaLabel}
    >
      <div
        className="w-[320px]"
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
          <span className="text-[13px] font-semibold text-gray-900">Filters</span>
          {filterCount > 0 && (
            <button
              onClick={clearAll}
              className="text-[12px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Reset all
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {filterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
            {Object.entries(activeFilters).map(([key, value]) => {
              const labelMap: Record<string, string> = {
                contact: 'Contact', vessel: 'Vessel', createdBy: 'Created by',
                modifiedBy: 'Modified by', status: 'Status',
              };
              const displayValue = key === 'status'
                ? (statusOptions.find(s => s.value === value)?.label || value)
                : value;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] font-medium bg-[#1E3A5F]/[0.08] text-[#1E3A5F] rounded-md"
                >
                  {labelMap[key] || key}: {displayValue}
                  <button
                    onClick={() => clearFilter(key)}
                    className="p-0.5 rounded hover:bg-[#1E3A5F]/[0.1] transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="h-px bg-gray-100" />

        {/* Text filters */}
        <div className="px-3 pt-2 pb-1 space-y-2.5">
          {textFilters.map(({ key, label, icon: Icon, value, setValue, placeholder }) => {
            const isActive = !!activeFilters[key];
            return (
              <div key={key}>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  <Icon className="h-3 w-3" />
                  {label}
                </label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (value.trim()) {
                          updateFilter(key, value.trim());
                        } else {
                          clearFilter(key);
                        }
                      }
                    }}
                    placeholder={placeholder}
                    className={cn(
                      "w-full h-8 pl-7 pr-7 text-[13px] rounded-md transition-all",
                      "placeholder:text-gray-300 focus:outline-none",
                      isActive
                        ? "bg-[#1E3A5F]/[0.04] border border-[#1E3A5F]/20 text-gray-900 focus:border-[#1E3A5F]/40 focus:ring-1 focus:ring-[#1E3A5F]/10"
                        : "bg-gray-50 border border-gray-200 text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-200"
                    )}
                  />
                  {isActive && (
                    <button
                      onClick={() => clearFilter(key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-px bg-gray-100 mt-1" />

        {/* Status filter */}
        <div className="px-3 pt-2 pb-2.5">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Status
          </label>
          <div className="flex gap-1.5">
            {statusOptions.map((opt) => {
              const isActive = activeFilters.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateFilter('status', isActive ? null : opt.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md border transition-all",
                    isActive
                      ? "bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full flex-shrink-0",
                    isActive ? "bg-white/80" : opt.dotColor
                  )} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="h-px bg-gray-100" />
        <div className="px-3 py-2">
          <span className="text-[11px] text-gray-300">Press Enter to apply text filters</span>
        </div>
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
      <div
        className="w-[220px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
          <span className="text-[13px] font-semibold text-gray-900">Sort by</span>
          {sortCount > 0 && (
            <button
              onClick={() => onSortChange(null)}
              className="text-[12px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Active sort chip */}
        {activeSort && (
          <div className="px-3 pb-2.5">
            <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] font-medium bg-[#1E3A5F]/[0.08] text-[#1E3A5F] rounded-md">
              {sortOptions.find(o => o.field === activeSort.field)?.label}
              {activeSort.direction === 'asc' ? ' (A→Z)' : ' (Z→A)'}
              <button
                onClick={() => onSortChange(null)}
                className="p-0.5 rounded hover:bg-[#1E3A5F]/[0.1] transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        <div className="h-px bg-gray-100" />

        {/* Options */}
        <div className="px-1.5 py-1.5 space-y-0.5">
          {sortOptions.map((option) => {
            const isActive = activeSort?.field === option.field;
            return (
              <button
                key={option.field}
                onClick={() => handleSortChange(option.field)}
                className={cn(
                  "flex items-center justify-between w-full px-2.5 py-2 text-[13px] rounded-md transition-colors",
                  isActive
                    ? "bg-[#1E3A5F]/[0.08] text-[#1E3A5F] font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <span>{option.label}</span>
                {isActive && (
                  <span className="text-[#1E3A5F]">
                    {getSortIcon(option.field)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
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