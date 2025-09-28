import React from 'react';
import { Plus, Ship, MoreHorizontal, Printer, Upload, Download, Anchor, Waves, Flag, Archive } from 'lucide-react';
import { SimpleButton as Button } from '@/components/ui/simple-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ToolbarSelect, ToolbarSelectOption } from '../contacts/ToolbarSelect';
import { ToolbarMenus } from '../contacts/ToolbarMenus';
import { ExpandingSearch } from '../contacts/ExpandingSearch';
import { useVesselsQueryState } from '@/hooks/useVesselsQueryState';

interface VesselsToolbarProps {
  // Vessel data for counts
  vessels: any[];

  // Action handlers
  onAddClick?: () => void;
  onPrint?: () => void;
  onImport?: () => void;
  onExport?: () => void;

  // Optional styling
  className?: string;

  // Count overrides (optional)
  counts?: {
    all: number;
    active: number;
    inactive: number;
    archived: number;
  };
}

export function VesselsToolbar({
  vessels,
  onAddClick,
  onPrint,
  onImport,
  onExport,
  className = '',
  counts
}: VesselsToolbarProps) {
  const {
    segment,
    fleet,
    q,
    groupBy,
    sort,
    filters,
    set
  } = useVesselsQueryState();

  // Calculate counts if not provided
  const calculatedCounts = counts || {
    all: vessels.length,
    active: vessels.filter(v => !v.archived && v.name).length,
    inactive: vessels.filter(v => !v.name || v.name.trim() === '').length,
    archived: vessels.filter(v => v.archived === true).length,
  };

  // Segment options for ToolbarSelect
  const segmentOptions: ToolbarSelectOption[] = [
    {
      value: 'all',
      label: 'All Activity'
    },
    {
      value: 'active',
      label: 'Active Fleet',
      icon: <Anchor className="h-3.5 w-3.5" />,
      count: calculatedCounts.active
    },
    {
      value: 'inactive',
      label: 'Inactive',
      icon: <Waves className="h-3.5 w-3.5" />,
      count: calculatedCounts.inactive
    },
    {
      value: 'archived',
      label: 'Archived',
      icon: <Archive className="h-3.5 w-3.5" />,
      count: calculatedCounts.archived
    }
  ];

  // Fleet options for ToolbarSelect (secondary segment)
  const fleetOptions: ToolbarSelectOption[] = [
    { value: 'all', label: 'Monthly Activity' },
    { value: 'commercial', label: 'Commercial', icon: <Flag className="h-3.5 w-3.5" /> },
    { value: 'recreational', label: 'Recreational', icon: <Waves className="h-3.5 w-3.5" /> },
    { value: 'military', label: 'Military', icon: <Anchor className="h-3.5 w-3.5" /> }
  ];

  const handleSegmentChange = (newSegment: string) => {
    set({ segment: newSegment as typeof segment });
  };

  const handleFleetChange = (newFleet: string) => {
    set({ fleet: newFleet });
  };

  const handleSearchChange = (newQ: string) => {
    set({ q: newQ });
  };

  const handleGroupByChange = (newGroupBy: typeof groupBy) => {
    set({ groupBy: newGroupBy });
  };

  const handleFiltersChange = (newFilters: typeof filters) => {
    set({ filters: newFilters });
  };

  const handleSortChange = (newSort: typeof sort) => {
    set({ sort: newSort });
  };

  return (
    <div className={`sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 ${className}`}>
      <div>
        {/* Row 1: Title + Overflow Menu + Add Vessel */}
        <div className="flex items-center justify-between py-2 pt-3 px-6">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Ship className="h-5 w-5" />
              Vessels
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

            {/* Add Vessel Button */}
            <Button
              onClick={onAddClick}
              className="h-8 px-3 text-xs transition-none !bg-black !text-white hover:!bg-gray-800"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Vessel
            </Button>
          </div>
        </div>

        {/* Row 2: Toolbar Selects + Controls + Search */}
        <div className="flex items-center justify-between py-2 px-6">
          {/* Left side: Dropdown selects */}
          <div className="flex items-center gap-2">
            <ToolbarSelect
              label="Segment"
              value={segment}
              options={segmentOptions}
              onChange={handleSegmentChange}
              showCounts={true}
            />
            <ToolbarSelect
              label="Fleet"
              value={fleet}
              options={fleetOptions}
              onChange={handleFleetChange}
            />
          </div>

          {/* Right side: Controls */}
          <div className="flex items-center gap-2">
            {/* Group/Filter/Sort menus */}
            <ToolbarMenus
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
              placeholder="Search vessels..."
              autoFocus={true}
              debounceMs={250}
            />
          </div>
        </div>
      </div>
    </div>
  );
}