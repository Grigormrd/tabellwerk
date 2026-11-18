import { useCallback, useMemo } from "react";
import { useControllableState } from "../internal/useControllableState.ts";
import { sortPermutation, toggleSort as nextSort } from "./sort.ts";
import type { ColumnDef, SortState } from "./types.ts";

const NO_SORT: SortState = [];

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
}

/** What {@link useDataGrid} returns. */
export interface DataGridState {
  /**
   * Display order as indexes into `rows`: `order[0]` is the index of the row
   * shown first. The rows themselves are never copied.
   */
  order: Uint32Array;
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
}

/**
 * The data side of the grid without any markup: sort state (controlled or
 * uncontrolled) and the resulting display order. `<DataGrid>` is built on it;
 * use it directly to render rows yourself.
 */
export function useDataGrid<Row>(options: UseDataGridOptions<Row>): DataGridState {
  const { rows, columns, sort: sortProp, defaultSort = NO_SORT, onSortChange } = options;
  const [sort, setSort] = useControllableState(sortProp, defaultSort, onSortChange);

  const order = useMemo(() => sortPermutation(rows, columns, sort), [rows, columns, sort]);

  const toggleSort = useCallback(
    (columnId: string, multi = false) => {
      const next = nextSort(sort, columnId, multi);
      setSort(next);
      return next;
    },
    [sort, setSort],
  );

  return { order, sort, setSort, toggleSort };
}
