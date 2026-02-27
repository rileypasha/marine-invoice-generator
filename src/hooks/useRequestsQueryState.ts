import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export type RequestView = 'list' | 'grid' | 'gallery';
export type RequestGroupBy = 'contact' | 'vessel' | 'status' | 'createdBy' | 'modifiedBy' | 'none';
export type SortDirection = 'asc' | 'desc';

export interface RequestSort {
  field: string;
  direction: SortDirection;
}

export interface RequestFilters {
  status?: string;
  contactId?: string;
  vesselId?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any;
}

export interface RequestsQueryState {
  month: string; // 'all' | 'today' | 'this-week' | 'this-month' | 'this-quarter' | 'this-year' | 'last-week' | 'last-month' | 'last-quarter' | 'last-year'
  view: RequestView;
  q: string;
  groupBy: RequestGroupBy;
  sort: RequestSort | null;
  filters: RequestFilters;
}

export interface DateRangeOption {
  value: string;
  label: string;
  group?: string;
}

export interface UseRequestsQueryStateReturn extends RequestsQueryState {
  set: (updates: Partial<RequestsQueryState>) => void;
  setAll: (state: RequestsQueryState) => void;
  resetFilters: () => void;
  resetAll: () => void;
  getDateRangeOptions: () => DateRangeOption[];
}

const DEFAULT_STATE: RequestsQueryState = {
  month: 'all',
  view: 'list',
  q: '',
  groupBy: 'none',
  sort: null,
  filters: {}
};

// Date range preset options
export function getDateRangeOptions(): DateRangeOption[] {
  return [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today', group: 'Current' },
    { value: 'this-week', label: 'This Week', group: 'Current' },
    { value: 'this-month', label: 'This Month', group: 'Current' },
    { value: 'this-quarter', label: 'This Quarter', group: 'Current' },
    { value: 'this-year', label: 'This Year', group: 'Current' },
    { value: 'last-week', label: 'Last Week', group: 'Previous' },
    { value: 'last-month', label: 'Last Month', group: 'Previous' },
    { value: 'last-quarter', label: 'Last Quarter', group: 'Previous' },
    { value: 'last-year', label: 'Last Year', group: 'Previous' },
  ];
}

// Resolve a date range option to start/end dates
export function resolveDateRange(option: string): { startDate: Date; endDate: Date } | null {
  if (option === 'all') return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (option) {
    case 'today': {
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { startDate: today, endDate: end };
    }
    case 'this-week': {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'this-month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'this-quarter': {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qStart, 1);
      const end = new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'this-year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'last-week': {
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const end = new Date(thisWeekStart);
      end.setDate(thisWeekStart.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'last-quarter': {
      const curQStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), curQStart - 3, 1);
      const end = new Date(now.getFullYear(), curQStart, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'last-year': {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    default: {
      // Backward compatibility: handle legacy YYYY-MM format
      if (/^\d{4}-\d{2}$/.test(option)) {
        const [year, monthNum] = option.split('-');
        const start = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        const end = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);
        return { startDate: start, endDate: end };
      }
      return null;
    }
  }
}

export function useRequestsQueryState(): UseRequestsQueryStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current state from URL params
  const state = useMemo((): RequestsQueryState => {
    const month = searchParams.get('month') || DEFAULT_STATE.month;
    const view = (searchParams.get('view') as RequestView) || DEFAULT_STATE.view;
    const q = searchParams.get('q') || DEFAULT_STATE.q;
    const groupBy = (searchParams.get('groupBy') as RequestGroupBy) || DEFAULT_STATE.groupBy;

    // Parse sort
    const sortField = searchParams.get('sortField');
    const sortDirection = searchParams.get('sortDirection') as SortDirection;
    const sort = sortField ? { field: sortField, direction: sortDirection || 'desc' } : null;

    // Parse filters
    const filters: RequestFilters = {};
    const filterEntries = Array.from(searchParams.entries()).filter(([key]) =>
      key.startsWith('filter_')
    );

    for (const [key, value] of filterEntries) {
      const filterKey = key.replace('filter_', '');
      if (filterKey === 'minAmount' || filterKey === 'maxAmount') {
        filters[filterKey] = parseFloat(value) || undefined;
      } else {
        filters[filterKey] = value;
      }
    }

    return {
      month,
      view,
      q,
      groupBy,
      sort,
      filters
    };
  }, [searchParams]);

  // Update specific state properties
  const set = useCallback((updates: Partial<RequestsQueryState>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);

      // Handle each update
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'sort' && value) {
          const sortValue = value as RequestSort;
          newParams.set('sortField', sortValue.field);
          newParams.set('sortDirection', sortValue.direction);
        } else if (key === 'sort' && value === null) {
          newParams.delete('sortField');
          newParams.delete('sortDirection');
        } else if (key === 'filters' && value) {
          // Remove existing filter params
          Array.from(newParams.keys()).forEach(paramKey => {
            if (paramKey.startsWith('filter_')) {
              newParams.delete(paramKey);
            }
          });

          // Add new filter params
          const filtersValue = value as RequestFilters;
          Object.entries(filtersValue).forEach(([filterKey, filterValue]) => {
            if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
              newParams.set(`filter_${filterKey}`, String(filterValue));
            }
          });
        } else if (key === 'month') {
          // Always explicitly handle month to ensure immediate state changes
          // This prevents needing multiple clicks for month filter changes
          if (value === 'all' || value === DEFAULT_STATE.month) {
            newParams.delete('month');
          } else if (value) {
            newParams.set('month', String(value));
          }
        } else if (key === 'groupBy') {
          // Always explicitly handle groupBy to ensure immediate state changes
          // This prevents needing multiple clicks for grouping changes
          if (value === 'none' || value === DEFAULT_STATE.groupBy) {
            newParams.delete('groupBy');
          } else if (value) {
            newParams.set('groupBy', String(value));
          }
        } else if (key === 'q' && value === '') {
          newParams.delete('q');
        } else if (value === DEFAULT_STATE[key as keyof RequestsQueryState]) {
          // Remove param if it matches default value
          if (key !== 'sort') {
            newParams.delete(key);
          }
        } else if (value !== undefined && value !== null && value !== '') {
          newParams.set(key, String(value));
        } else {
          newParams.delete(key);
        }
      });

      return newParams;
    });
  }, [setSearchParams]);

  // Replace entire state
  const setAll = useCallback((newState: RequestsQueryState) => {
    setSearchParams(() => {
      const newParams = new URLSearchParams();

      // Set all non-default values
      Object.entries(newState).forEach(([key, value]) => {
        if (key === 'sort' && value) {
          const sortValue = value as RequestSort;
          newParams.set('sortField', sortValue.field);
          newParams.set('sortDirection', sortValue.direction);
        } else if (key === 'filters' && value) {
          const filtersValue = value as RequestFilters;
          Object.entries(filtersValue).forEach(([filterKey, filterValue]) => {
            if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
              newParams.set(`filter_${filterKey}`, String(filterValue));
            }
          });
        } else if (value !== DEFAULT_STATE[key as keyof RequestsQueryState] &&
                   value !== undefined && value !== null && value !== '') {
          newParams.set(key, String(value));
        }
      });

      return newParams;
    });
  }, [setSearchParams]);

  // Reset only filters
  const resetFilters = useCallback(() => {
    set({ filters: {} });
  }, [set]);

  // Reset to default state
  const resetAll = useCallback(() => {
    setAll(DEFAULT_STATE);
  }, [setAll]);

  return {
    ...state,
    set,
    setAll,
    resetFilters,
    resetAll,
    getDateRangeOptions
  };
}