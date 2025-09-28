import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export type VesselSegment = 'all' | 'active' | 'inactive';
export type VesselView = 'list' | 'grid' | 'gallery';
export type VesselGroupBy = 'size' | 'activity' | 'none';
export type SortDirection = 'asc' | 'desc';

export interface VesselSort {
  field: string;
  direction: SortDirection;
}

export interface VesselFilters {
  status?: string;
  minLength?: number;
  maxLength?: number;
  minWeight?: number;
  maxWeight?: number;
  type?: string;
  flag?: string;
  owner?: string;
  [key: string]: any;
}

export interface VesselsQueryState {
  segment: VesselSegment;
  fleet: string;
  view: VesselView;
  q: string;
  groupBy: VesselGroupBy;
  sort: VesselSort | null;
  filters: VesselFilters;
}

export interface UseVesselsQueryStateReturn extends VesselsQueryState {
  set: (updates: Partial<VesselsQueryState>) => void;
  setAll: (state: VesselsQueryState) => void;
  resetFilters: () => void;
  resetAll: () => void;
}

const DEFAULT_STATE: VesselsQueryState = {
  segment: 'all',
  fleet: 'all',
  view: 'list',
  q: '',
  groupBy: 'none',
  sort: { field: 'name', direction: 'asc' },
  filters: {}
};

export function useVesselsQueryState(): UseVesselsQueryStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current state from URL params
  const state = useMemo((): VesselsQueryState => {
    const segment = (searchParams.get('segment') as VesselSegment) || DEFAULT_STATE.segment;
    const fleet = searchParams.get('fleet') || DEFAULT_STATE.fleet;
    const view = (searchParams.get('view') as VesselView) || DEFAULT_STATE.view;
    const q = searchParams.get('q') || DEFAULT_STATE.q;
    const groupBy = (searchParams.get('groupBy') as VesselGroupBy) || DEFAULT_STATE.groupBy;

    // Parse sort
    const sortField = searchParams.get('sortField');
    const sortDirection = searchParams.get('sortDirection') as SortDirection;
    const sort = sortField ? { field: sortField, direction: sortDirection || 'asc' } : null;

    // Parse filters
    const filters: VesselFilters = {};
    const filterEntries = Array.from(searchParams.entries()).filter(([key]) =>
      key.startsWith('filter_')
    );

    for (const [key, value] of filterEntries) {
      const filterKey = key.replace('filter_', '');
      if (filterKey === 'minLength' || filterKey === 'maxLength' || filterKey === 'minWeight' || filterKey === 'maxWeight') {
        filters[filterKey] = parseFloat(value) || undefined;
      } else {
        filters[filterKey] = value;
      }
    }

    return {
      segment,
      fleet,
      view,
      q,
      groupBy,
      sort,
      filters
    };
  }, [searchParams]);

  // Update specific state properties
  const set = useCallback((updates: Partial<VesselsQueryState>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);

      // Handle each update
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'sort' && value) {
          const sortValue = value as VesselSort;
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
          const filtersValue = value as VesselFilters;
          Object.entries(filtersValue).forEach(([filterKey, filterValue]) => {
            if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
              newParams.set(`filter_${filterKey}`, String(filterValue));
            }
          });
        } else if (key === 'q' && value === '') {
          newParams.delete('q');
        } else if (value === DEFAULT_STATE[key as keyof VesselsQueryState]) {
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
  const setAll = useCallback((newState: VesselsQueryState) => {
    setSearchParams(() => {
      const newParams = new URLSearchParams();

      // Set all non-default values
      Object.entries(newState).forEach(([key, value]) => {
        if (key === 'sort' && value) {
          const sortValue = value as VesselSort;
          newParams.set('sortField', sortValue.field);
          newParams.set('sortDirection', sortValue.direction);
        } else if (key === 'filters' && value) {
          const filtersValue = value as VesselFilters;
          Object.entries(filtersValue).forEach(([filterKey, filterValue]) => {
            if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
              newParams.set(`filter_${filterKey}`, String(filterValue));
            }
          });
        } else if (value !== DEFAULT_STATE[key as keyof VesselsQueryState] &&
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