import React from 'react';
import { Plus, MoreHorizontal, Printer, Upload, Download, ChevronDown } from 'lucide-react';
import { SimpleButton as Button } from '@/components/ui/simple-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExpandingSearch } from '../contacts/ExpandingSearch';
import { useRequestsQueryState } from '@/hooks/useRequestsQueryState';
import { RequestsMenus } from './RequestsMenus';
import { useRequestSection } from '@/hooks/useRequestSection';

interface RequestsToolbarProps {
  // Request data for counts
  requests: any[];

  // Action handlers
  onAddClick?: () => void;
  onPrint?: () => void;
  onImport?: () => void;
  onExport?: () => void;

  // Optional styling
  className?: string;
}

export function RequestsToolbar({
  requests,
  onAddClick,
  onPrint,
  onImport,
  onExport,
  className = ''
}: RequestsToolbarProps) {
  const { isEstimate, singularLabel } = useRequestSection();
  const {
    month,
    q,
    groupBy,
    sort,
    filters,
    set,
    getDateRangeOptions
  } = useRequestsQueryState();

  const dateRangeOptions = getDateRangeOptions();

  const handleMonthChange = (newMonth: string) => {
    set({ month: newMonth });
  };

  const handleSearchChange = (newQ: string) => {
    set({ q: newQ });
  };

  const handleGroupByChange = (newGroupBy: any) => {
    set({ groupBy: newGroupBy });
  };

  const handleFiltersChange = (newFilters: any) => {
    set({ filters: newFilters });
  };

  const handleSortChange = (newSort: any) => {
    set({ sort: newSort });
  };

  return (
    <div className={`bg-white border-b border-gray-100 ${className}`}>
      {/* Single unified header row */}
      <div className="flex items-center justify-between gap-3 px-3 md:px-6 pt-1 md:pt-5 pb-3 md:pb-4">
        {/* Left: Title + Month filter */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg md:text-xl font-semibold text-gray-900 tracking-tight whitespace-nowrap">
            {isEstimate ? 'Estimates' : 'Invoices'}
          </h1>

          {/* Date Range Dropdown */}
          <div className="flex-shrink-0">
            <Select key={month} value={month} onValueChange={handleMonthChange}>
              <SelectTrigger className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[13px] text-gray-600 rounded-md border-0 bg-gray-100/80 hover:bg-gray-100 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-gray-300 w-auto [&>svg:last-child]:hidden">
                <span>
                  {dateRangeOptions.find(opt => opt.value === month)?.label || 'All'}
                </span>
                <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
              </SelectTrigger>
              <SelectContent className="min-w-[160px]">
                {dateRangeOptions.map((option, idx) => {
                  const prevOption = idx > 0 ? dateRangeOptions[idx - 1] : null;
                  const showGroupLabel = option.group && option.group !== prevOption?.group;
                  return (
                    <React.Fragment key={option.value}>
                      {showGroupLabel && (
                        <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-gray-400 uppercase tracking-wider select-none">
                          {option.group}
                        </div>
                      )}
                      <SelectItem value={option.value}>
                        {option.label}
                      </SelectItem>
                    </React.Fragment>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right: Controls + Actions */}
        <div className="flex items-center gap-1.5">
          {/* Group/Filter/Sort menus */}
          <RequestsMenus
            activeGroupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            activeFilters={filters}
            onFiltersChange={handleFiltersChange}
            activeSort={sort}
            onSortChange={handleSortChange}
          />

          {/* Search */}
          <ExpandingSearch
            value={q}
            onChange={handleSearchChange}
            placeholder={isEstimate ? 'Search estimates...' : 'Search requests...'}
            autoFocus={true}
            debounceMs={250}
          />

          {/* Subtle divider */}
          <div className="hidden md:block w-px h-4 bg-gray-200 mx-1" />

          {/* Overflow menu */}
          {(onPrint || onImport || onExport) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onPrint && (
                  <DropdownMenuItem onClick={onPrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print this page
                  </DropdownMenuItem>
                )}
                {onImport && (
                  <DropdownMenuItem onClick={onImport}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import data from CSV
                  </DropdownMenuItem>
                )}
                {onExport && (
                  <DropdownMenuItem onClick={onExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export data as CSV
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Add Button */}
          <Button
            onClick={onAddClick}
            className="h-8 px-3 text-[13px] font-medium transition-colors !bg-[#1E3A5F] !text-white hover:!bg-[#152b47] rounded-lg"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">{singularLabel}</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
