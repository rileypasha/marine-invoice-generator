import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export type ContactSegment = 'all' | 'customers' | 'owners' | 'vendors' | 'archived';
export type ContactActivity = 'all' | 'monthly';
export type ContactView = 'list' | 'grid' | 'gallery';
export type ContactGroupBy = 'company' | 'city' | 'role' | 'activity' | 'monthlyActivity' | 'none';
export type SortDirection = 'asc' | 'desc';

export interface ContactSort {
  field: string;
  direction: SortDirection;
}

export interface ContactFilters {
  status?: string;
  hasEmail?: boolean;
  country?: string;
  [key: string]: any;
}

export interface ContactsQueryState {
  segment: ContactSegment;
  activity: ContactActivity;
  fleet: string;
  view: ContactView;
  q: string;
  groupBy: ContactGroupBy;
  sort: ContactSort | null;
  filters: ContactFilters;
}

export interface UseContactsQueryStateReturn extends ContactsQueryState {
  set: (updates: Partial<ContactsQueryState>) => void;
  setAll: (state: ContactsQueryState) => void;
  resetFilters: () => void;
  resetAll: () => void;
}

const DEFAULT_STATE: ContactsQueryState = {
  segment: 'all',
  activity: 'all',
  fleet: 'all',
  view: 'list',
  q: '',
  groupBy: 'none',
  sort: null,
  filters: {}
};

export function useContactsQueryState(): UseContactsQueryStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current state from URL params
  const state = useMemo((): ContactsQueryState => {
    const segment = (searchParams.get('segment') as ContactSegment) || DEFAULT_STATE.segment;
    const activity = (searchParams.get('activity') as ContactActivity) || DEFAULT_STATE.activity;
    const fleet = searchParams.get('fleet') || DEFAULT_STATE.fleet;
    const view = (searchParams.get('view') as ContactView) || DEFAULT_STATE.view;
    const q = searchParams.get('q') || DEFAULT_STATE.q;
    const groupBy = (searchParams.get('groupBy') as ContactGroupBy) || DEFAULT_STATE.groupBy;

    // Parse sort
    const sortField = searchParams.get('sortField');
    const sortDirection = searchParams.get('sortDirection') as SortDirection;
    const sort = sortField ? { field: sortField, direction: sortDirection || 'asc' } : null;

    // Parse filters
    const filters: ContactFilters = {};
    const filterEntries = Array.from(searchParams.entries()).filter(([key]) =>
      key.startsWith('filter_')
    );

    for (const [key, value] of filterEntries) {
      const filterKey = key.replace('filter_', '');
      if (filterKey === 'hasEmail') {
        filters[filterKey] = value === 'true';
      } else {
        filters[filterKey] = value;
      }
    }

    return {
      segment,
      activity,
      fleet,
      view,
      q,
      groupBy,
      sort,
      filters
    };
  }, [searchParams]);

  // Update specific state properties
  const set = useCallback((updates: Partial<ContactsQueryState>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);

      // Handle each update
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'sort' && value) {
          const sortValue = value as ContactSort;
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
          const filtersValue = value as ContactFilters;
          Object.entries(filtersValue).forEach(([filterKey, filterValue]) => {
            if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
              newParams.set(`filter_${filterKey}`, String(filterValue));
            }
          });
        } else if (key === 'q' && value === '') {
          newParams.delete('q');
        } else if (value === DEFAULT_STATE[key as keyof ContactsQueryState]) {
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
  const setAll = useCallback((newState: ContactsQueryState) => {
    setSearchParams(() => {
      const newParams = new URLSearchParams();

      // Set all non-default values
      Object.entries(newState).forEach(([key, value]) => {
        if (key === 'sort' && value) {
          const sortValue = value as ContactSort;
          newParams.set('sortField', sortValue.field);
          newParams.set('sortDirection', sortValue.direction);
        } else if (key === 'filters' && value) {
          const filtersValue = value as ContactFilters;
          Object.entries(filtersValue).forEach(([filterKey, filterValue]) => {
            if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
              newParams.set(`filter_${filterKey}`, String(filterValue));
            }
          });
        } else if (value !== DEFAULT_STATE[key as keyof ContactsQueryState] &&
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
    resetAll
  };
}