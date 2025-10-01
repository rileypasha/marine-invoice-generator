import React from 'react';
import { Plus, Users, MoreHorizontal, Printer, Upload, Download, CheckCircle, Circle } from 'lucide-react';
import { SimpleButton as Button } from '@/components/ui/simple-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ToolbarSelect, ToolbarSelectOption } from './ToolbarSelect';
import { ContactsToolbarMenus } from './ContactsToolbarMenus';
import { ExpandingSearch } from './ExpandingSearch';
import { useContactsQueryState, ContactGroupBy, ContactActivity } from '@/hooks/useContactsQueryState';

interface ContactsToolbarProps {
  // Contact data for counts
  customers: any[];

  // Local groupBy state from parent (for instant badge updates)
  currentGroupBy?: ContactGroupBy;

  // Local activity state from parent (for instant dropdown updates)
  currentActivity?: ContactActivity;

  // Local fleet state from parent (for instant dropdown updates)
  currentFleet?: string;

  // Action handlers
  onAddClick?: () => void;
  onPrint?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onGroupByChange?: (groupBy: ContactGroupBy) => void;  // NEW: Direct state handler
  onActivityChange?: (activity: ContactActivity) => void;  // NEW: Direct state handler
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

export function ContactsToolbar({
  customers,
  currentGroupBy,
  currentActivity,
  currentFleet,
  onAddClick,
  onPrint,
  onImport,
  onExport,
  onGroupByChange: externalHandler,  // NEW
  onActivityChange: externalActivityHandler,  // NEW
  onFleetChange: externalFleetHandler,  // NEW
  className = '',
  counts
}: ContactsToolbarProps) {
  const {
    activity,
    fleet,
    q,
    groupBy,
    sort,
    filters,
    set
  } = useContactsQueryState();

  // Use local state if provided, otherwise fall back to URL state
  const activeGroupBy = currentGroupBy ?? groupBy;
  const activeActivity = currentActivity ?? activity;
  const activeFleet = currentFleet ?? fleet;

  // Calculate counts if not provided
  const calculatedCounts = counts || {
    all: customers.length,
    active: customers.filter(c => (c.invoice_count || 0) > 0).length,
    inactive: customers.filter(c => (c.invoice_count || 0) === 0).length,
    archived: customers.filter(c => c.archived === true).length,
  };

  // Add monthly counts separately to avoid type issues
  const monthlyActive = customers.filter(c => (c.monthly_invoice_count || 0) > 0).length;
  const monthlyInactive = customers.filter(c => (c.monthly_invoice_count || 0) === 0).length;

  // Activity options for ToolbarSelect
  const activityOptions: ToolbarSelectOption[] = [
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
      count: monthlyActive
    },
    {
      value: 'inactive',
      label: 'Inactive',
      icon: <Circle className="h-3.5 w-3.5" />,
      count: monthlyInactive
    }
  ];

  const handleActivityChange = (newActivity: string) => {
    // Call external handler if provided (updates table state directly)
    if (externalActivityHandler) {
      externalActivityHandler(newActivity as typeof activity);
    } else {
      // Fallback to URL update only
      set({ activity: newActivity as typeof activity });
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
        {/* Row 1: Title + Overflow Menu + Add Contact */}
        <div className="flex items-center justify-between py-2 pt-3 px-4 md:px-0">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
              <Users className="h-4 w-4 md:h-5 md:w-5" />
              Contacts
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

            {/* Add Contact Button */}
            <Button
              onClick={onAddClick}
              className="h-8 px-3 text-xs transition-none !bg-black !text-white hover:!bg-gray-800"
            >
              <Plus className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Add Contact</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Toolbar Selects + Controls + Search */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-2 px-4 md:px-0">
          {/* Left side: Dropdown selects */}
          <div className="flex items-center gap-2">
            <ToolbarSelect
              label="Activity"
              value={activeActivity}
              options={activityOptions}
              onChange={handleActivityChange}
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
            <ContactsToolbarMenus
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
              placeholder="Search contacts..."
              autoFocus={true}
              debounceMs={250}
            />
          </div>
        </div>
      </div>
    </div>
  );
}