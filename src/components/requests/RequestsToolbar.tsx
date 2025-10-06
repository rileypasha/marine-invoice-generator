import React from 'react';
import { Plus, FileText, MoreHorizontal, Printer, Upload, Download, ChevronDown } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { ExpandingSearch } from '../contacts/ExpandingSearch';
import { useRequestsQueryState } from '@/hooks/useRequestsQueryState';
import { RequestsMenus } from './RequestsMenus';

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
  const {
    month,
    q,
    groupBy,
    sort,
    filters,
    set,
    getRollingMonths
  } = useRequestsQueryState();

  // Generate rolling months (12 months)
  const monthOptions = getRollingMonths(12);

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
    <div className={`bg-white border-b border-gray-200 ${className}`}>
      <div>
        {/* Row 1: Title + Overflow Menu + New Invoice Button */}
        <div className="flex items-center justify-between py-1 pt-0 md:pt-6 px-2 md:px-6 -mt-1 md:mt-0">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-xl md:text-2xl font-semibold text-gray-900">
              <FileText className="h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden sm:inline">Invoice Requests</span>
              <span className="sm:hidden">Invoice Requests</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Overflow menu for print/import/export */}
            {(onPrint || onImport || onExport) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 px-2 text-xs">
                    <MoreHorizontal className="h-3 w-3" />
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

            {/* Add Invoice Button */}
            <Button
              onClick={onAddClick}
              className="h-8 px-3 text-xs transition-none !bg-[#1E3A5F] !text-white hover:!bg-[#152b47]"
            >
              <Plus className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Add Invoice</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Month Selector (Desktop) OR Controls (Mobile) */}
        <div className="flex items-center justify-between gap-2 py-2 px-2 md:px-6">
          {/* Desktop: Tabs */}
          <div className="hidden md:flex">
            <Tabs key={month} value={month} onValueChange={handleMonthChange}>
              <TabsList>
                {monthOptions.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Mobile & Desktop: Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto md:justify-end">
            {/* Mobile: Compact Month Filter - left aligned */}
            <div className="md:hidden">
              <Select key={month} value={month} onValueChange={handleMonthChange}>
                <SelectTrigger className="inline-flex items-center gap-1.5 h-8 px-3 text-sm text-gray-900 rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 w-auto [&>svg:last-child]:hidden">
                  <span>
                    {month === 'all' ? 'All Months' : monthOptions.find(opt => opt.value === month)?.label || 'Month'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
                </SelectTrigger>
                <SelectContent className="min-w-[160px]">
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value === 'all' ? 'All Months' : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spacer to push right controls to the right */}
            <div className="flex-1 md:hidden" />

            {/* Group/Filter/Sort menus */}
            <RequestsMenus
              activeGroupBy={groupBy}
              onGroupByChange={handleGroupByChange}
              activeFilters={filters}
              onFiltersChange={handleFiltersChange}
              activeSort={sort}
              onSortChange={handleSortChange}
            />

            {/* Expanding search */}
            <ExpandingSearch
              value={q}
              onChange={handleSearchChange}
              placeholder="Search requests..."
              autoFocus={true}
              debounceMs={250}
            />
          </div>
        </div>
      </div>
    </div>
  );
}