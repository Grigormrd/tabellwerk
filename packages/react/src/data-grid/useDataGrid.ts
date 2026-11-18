import { useCallback, useDeferredValue, useMemo } from "react";
import { useControllableState } from "../internal/useControllableState.ts";
import { applyMask, filterMask } from "./filter.ts";
import { sortPermutation, toggleSort as nextSort } from "./sort.ts";
import type { ColumnDef, ColumnFilter, FilterState, SortState } from "./types.ts";

const NO_SORT: SortState = [];
const NO_FILTERS: FilterState = {};

/** Options of {@link useDataGrid}. */
export interface UseDataGridOptions<Row> {
  /** The data. Never copied or mutated. */
  rows: readonly Row[];
  /** Keep this array stable (define it outside the component or memoize it). */
  columns: readonly ColumnDef<Row>[];
  /** Controlled sort state. */
  sort?: SortState;
  /** Initial sort state when uncontrolled. */
  defaultSort?: SortState;
  /** Called with the new sort state whenever the user changes it. */
  onSortChange?: (sort: SortState) => void;
  /** Controlled filter state. */
  filters?: FilterState;
  /** Initial filter state when uncontrolled. */
  defaultFilters?: FilterState;
  /** Called with the new filter state whenever the user changes it. */
  onFiltersChange?: (filters: FilterState) => void;
}

/** What {@link useDataGrid} returns. */
export interface DataGridState {
  /**
   * Display order as indexes into `rows`, sorted and filtered: `order[0]` is
   * the index of the row shown first. The rows themselves are never copied.
   */
  order: Uint32Array;
  /** Number of rows before filtering. */
  totalCount: number;
  /** Current sort state. */
  sort: SortState;
  /** Replaces the sort state. */
  setSort: (sort: SortState) => void;
  /**
   * Applies a header activation (none → ascending → descending → none) and
   * returns the resulting sort state. With `multi`, the column is added to
   * the existing sort instead of replacing it.
   */
  toggleSort: (columnId: string, multi?: boolean) => SortState;
  /** Current filter state (immediately, while `order` may lag behind during typing). */
  filters: FilterState;
  /** Replaces the filter state. */
  setFilters: (filters: FilterState) => void;
  /** Sets or (with `undefined`) removes the filter of one column. */
  setFilter: (columnId: string, filter: ColumnFilter | undefined) => void;
}

/**
 * The data side of the grid without any markup: sort and filter state
 * (controlled or uncontrolled) and the resulting display order. `<DataGrid>`
 * is built on it; use it directly to render rows yourself.
 *
 * Sorting and filtering are cached separately: typing into a filter does not
 * sort again, and sorting does not filter again. Filtering uses React's
 * deferred rendering, so inputs stay responsive while 100,000 rows are tested.
 */
export function useDataGrid<Row>(options: UseDataGridOptions<Row>): DataGridState {
  const { rows, columns } = options;
  const [sort, setSort] = useControllableState(
    options.sort,
    options.defaultSort ?? NO_SORT,
    options.onSortChange,
  );
  const [filters, setFilters] = useControllableState(
    options.filters,
    options.defaultFilters ?? NO_FILTERS,
    options.onFiltersChange,
  );
  const deferredFilters = useDeferredValue(filters);

  const sorted = useMemo(() => sortPermutation(rows, columns, sort), [rows, columns, sort]);
  const mask = useMemo(
    () => filterMask(rows, columns, deferredFilters),
    [rows, columns, deferredFilters],
  );
  const order = useMemo(() => applyMask(sorted, mask), [sorted, mask]);

  const toggleSort = useCallback(
    (columnId: string, multi = false) => {
      const next = nextSort(sort, columnId, multi);
      setSort(next);
      return next;
    },
    [sort, setSort],
  );

  const setFilter = useCallback(
    (columnId: string, filter: ColumnFilter | undefined) => {
      const next: Record<string, ColumnFilter> = { ...filters };
      if (filter) next[columnId] = filter;
      else delete next[columnId];
      setFilters(next);
    },
    [filters, setFilters],
  );

  return {
    order,
    totalCount: rows.length,
    sort,
    setSort,
    toggleSort,
    filters,
    setFilters,
    setFilter,
  };
}
