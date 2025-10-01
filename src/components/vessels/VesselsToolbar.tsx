import React from 'react';
import { Plus, Ship, MoreHorizontal, Printer, Upload, Download, Anchor, Waves, Flag, Archive, CheckCircle, Circle } from 'lucide-react';
import { SimpleButton as Button } from '@/components/ui/simple-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ToolbarSelect, ToolbarSelectOption } from '../contacts/ToolbarSelect';
import { VesselsToolbarMenus } from './VesselsToolbarMenus';
import { ExpandingSearch } from '../contacts/ExpandingSearch';
import { useVesselsQueryState, VesselGroupBy, VesselSegment } from '@/hooks/useVesselsQueryState';

interface VesselsToolbarProps {
  // Vessel data for counts
  vessels: any[];

  // Local groupBy state from parent (for instant badge updates)
  currentGroupBy?: VesselGroupBy;

  // Local segment state from parent (for instant dropdown updates)
  currentSegment?: VesselSegment;

  // Local fleet state from parent (for instant dropdown updates)
  currentFleet?: string;

  // Action handlers
  onAddClick?: () => void;
  onPrint?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onGroupByChange?: (groupBy: VesselGroupBy) => void;  // NEW: Direct state handler
  onSegmentChange?: (segment: VesselSegment) => void;  // NEW: Direct state handler
  onFleetChange?: (fleet: string) => void;  // NEW: Direct state handler

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
  currentGroupBy,
  currentSegment,
  currentFleet,
  onAddClick,
  onPrint,
  onImport,
  onExport,
  onGroupByChange: externalHandler,  // NEW
  onSegmentChange: externalSegmentHandler,  // NEW
  onFleetChange: externalFleetHandler,  // NEW
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

  // Use local state if provided, otherwise fall back to URL state
  const activeGroupBy = currentGroupBy ?? groupBy;
  const activeSegment = currentSegment ?? segment;
  const activeFleet = currentFleet ?? fleet;

  // Calculate counts if not provided
  const calculatedCounts = counts || {
    all: vessels.length,
    active: vessels.filter(v => (v.invoice_count || 0) > 0).length,
    inactive: vessels.filter(v => (v.invoice_count || 0) === 0).length,
    archived: vessels.filter(v => v.archived === true).length,
    monthlyActive: vessels.filter(v => (v.monthly_invoice_count || 0) > 0).length,
    monthlyInactive: vessels.filter(v => (v.monthly_invoice_count || 0) === 0).length,
  };

  // Segment options for ToolbarSelect
  const segmentOptions: ToolbarSelectOption[] = [
    {
      value: 'all',
      label: 'All Activity'
    },
    {
      value: 'active',
      label: 'Active',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      count: calculatedCounts.active
    },
    {
      value: 'inactive',
      label: 'Inactive',
      icon: <Circle className="h-3.5 w-3.5" />,
      count: calculatedCounts.inactive
    }
  ];

  // Fleet options for ToolbarSelect (secondary segment)
  const fleetOptions: ToolbarSelectOption[] = [
    { value: 'all', label: 'Monthly Activity' },
    {
      value: 'active',
      label: 'Active',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      count: calculatedCounts.monthlyActive
    },
    {
      value: 'inactive',
      label: 'Inactive',
      icon: <Circle className="h-3.5 w-3.5" />,
      count: calculatedCounts.monthlyInactive
    }
  ];

  const handleSegmentChange = (newSegment: string) => {
    // Call external handler if provided (updates table state directly)
    if (externalSegmentHandler) {
      externalSegmentHandler(newSegment as typeof segment);
    } else {
      // Fallback to URL update only
      set({ segment: newSegment as typeof segment });
    }
  };

  const handleFleetChange = (newFleet: string) => {
    // Call external handler if provided (updates table state directly)
    if (externalFleetHandler) {
      externalFleetHandler(newFleet);
    } else {
      // Fallback to URL update only
      set({ fleet: newFleet });
    }
  };

  const handleSearchChange = (newQ: string) => {
    set({ q: newQ });
  };

  const handleGroupByChange = (newGroupBy: typeof groupBy) => {
    // Call external handler if provided (updates table state directly)
    if (externalHandler) {
      externalHandler(newGroupBy);
    } else {
      // Fallback to URL update only
      set({ groupBy: newGroupBy });
    }
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
        <div className="flex items-center justify-between py-2 pt-3 px-4 md:px-0">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
              <Ship className="h-4 w-4 md:h-5 md:w-5" />
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
              <span className="hidden sm:inline">Add Vessel</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Toolbar Selects + Controls + Search */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-2 px-4 md:px-0">
          {/* Left side: Dropdown selects */}
          <div className="flex items-center gap-2">
            <ToolbarSelect
              label="Segment"
              value={activeSegment}
              options={segmentOptions}
              onChange={handleSegmentChange}
              showCounts={true}
            />
            <ToolbarSelect
              label="Fleet"
              value={activeFleet}
              options={fleetOptions}
              onChange={handleFleetChange}
              showCounts={true}
            />
          </div>

          {/* Right side: Controls */}
          <div className="flex items-center gap-2">
            {/* Group/Filter/Sort menus */}
            <VesselsToolbarMenus
              activeGroupBy={activeGroupBy}
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