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
  month: string; // 'all' | 'YYYY-MM'
  view: RequestView;
  q: string;
  groupBy: RequestGroupBy;
  sort: RequestSort | null;
  filters: RequestFilters;
}

export interface UseRequestsQueryStateReturn extends RequestsQueryState {
  set: (updates: Partial<RequestsQueryState>) => void;
  setAll: (state: RequestsQueryState) => void;
  resetFilters: () => void;
  resetAll: () => void;
  getRollingMonths: (count: number) => Array<{ value: string; label: string }>;
}

const DEFAULT_STATE: RequestsQueryState = {
  month: 'all',
  view: 'list',
  q: '',
  groupBy: 'none',
  sort: { field: 'invoice_date', direction: 'desc' },
  filters: {}
};

// Generate fixed months for invoice requests
export function getRollingMonths(count: number): Array<{ value: string; label: string }> {
  return [
    { value: 'all', label: 'All' },
    { value: '2025-09', label: 'Sep25' },
    { value: '2025-10', label: 'Oct25' },
    { value: '2025-11', label: 'Nov25' },
    { value: '2025-12', label: 'Dec25' },
    { value: '2026-01', label: 'Jan26' },
    { value: '2026-02', label: 'Feb26' },
    { value: '2026-03', label: 'Mar26' },
    { value: '2026-04', label: 'Apr26' },
    { value: '2026-05', label: 'May26' },
    { value: '2026-06', label: 'Jun26' },
    { value: '2026-07', label: 'Jul26' },
    { value: '2026-08', label: 'Aug26' }
  ];
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
    const sort = sortField ? { field: sortField, direction: sortDirection || 'desc' } : DEFAULT_STATE.sort;

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
    getRollingMonths
  };
}