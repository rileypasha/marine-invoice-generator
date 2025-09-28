import React from 'react';
import { Plus, FileText, MoreHorizontal, Printer, Upload, Download } from 'lucide-react';
import { SimpleButton as Button } from '@/components/ui/simple-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <div className={`sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 ${className}`}>
      <div>
        {/* Row 1: Title + Overflow Menu + New Invoice Button */}
        <div className="flex items-center justify-between py-2 pt-3 px-6">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <FileText className="h-5 w-5" />
              Invoice Requests
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

            {/* New Invoice Button */}
            <Button
              onClick={onAddClick}
              className="h-8 px-3 text-xs transition-none !bg-black !text-white hover:!bg-gray-800"
            >
              <Plus className="h-3 w-3 mr-1" />
              New Invoice
            </Button>
          </div>
        </div>

        {/* Row 2: Month Tabs + Controls + Search */}
        <div className="flex items-center justify-between py-2 px-6">
          {/* Left side: Month tabs */}
          <div className="flex items-center">
            <Tabs value={month} onValueChange={handleMonthChange}>
              <TabsList>
                {monthOptions.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Right side: Controls */}
          <div className="flex items-center gap-2">
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