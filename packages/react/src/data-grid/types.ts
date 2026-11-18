import type { ReactNode } from "react";

/** Values the grid can sort. `null` and `undefined` count as empty and always sort last. */
export type CellValue = string | number | boolean | Date | null | undefined;

/** Context passed to a custom cell renderer. */
export interface CellContext<Row> {
  /** The row object as passed in `rows`. */
  row: Row;
  /** The value returned by the column's `getValue`. */
  value: CellValue;
  /** Index of the row in `rows` (not its position after sorting). */
  rowIndex: number;
}

/** Describes one column of a {@link DataGrid}. */
export interface ColumnDef<Row> {
  /** Unique, stable id. Used in sort state and as the default property name for `getValue`. */
  id: string;
  /** Header text. Also used in screen reader announcements, so keep it short. */
  header: string;
  /**
   * Returns the cell value used for sorting and default rendering.
   * Defaults to `row[id]`.
   */
  getValue?: (row: Row) => CellValue;
  /**
   * Renders the cell content. Defaults to the formatted value. Interactive
   * content (links, buttons) is reachable with Enter or F2 on the cell.
   *
   * Render from the arguments only. Row elements are reused by position, so
   * after sorting or scrolling the same element shows a different row; state
   * kept inside a cell component would move with the element, not the row.
   */
  cell?: (context: CellContext<Row>) => ReactNode;
  /**
   * Formats a non-empty value for display and for text filters. Empty values
   * (`null`, `undefined`, `NaN`) always show as an empty cell. Defaults to
   * `String(value)`, and ISO dates (`2026-11-18`) for `Date`.
   */
  format?: (value: NonNullable<CellValue>) => string;
  /** Initial column width in CSS pixels. Default: 160. */
  width?: number;
  /** Smallest width the user can resize the column to. Default: 48. */
  minWidth?: number;
  /** Largest width the user can resize the column to. Default: 800. */
  maxWidth?: number;
  /** Whether the user can resize the column. Default: `true`. */
  resizable?: boolean;
  /** Text alignment; use `"end"` for numbers. Default: `"start"`. */
  align?: "start" | "end";
  /** Whether the column can be sorted. Default: `true`. */
  sortable?: boolean;
  /**
   * Custom comparison for sorting, called with two non-empty values. Must
   * return a negative number, zero or a positive number, like `Array#sort`.
   */
  compare?: (a: NonNullable<CellValue>, b: NonNullable<CellValue>) => number;
  /**
   * Adds a filter to the column header:
   * - `"text"`: the formatted cell text contains the input (case-insensitive)
   * - `"number"`: the value lies within a minimum and/or maximum
   * - `"values"`: the value is one of the checked values (for columns with few distinct values)
   * - `"date"`: the date lies within a range (compared as UTC calendar dates)
   *
   * Default: no filter.
   */
  filter?: FilterKind;
}

/** The kinds of column filter; see `ColumnDef.filter`. */
export type FilterKind = "text" | "number" | "values" | "date";

/** The filter of one column. Which shape applies follows from `ColumnDef.filter`. */
export type ColumnFilter =
  | { kind: "text"; query: string }
  | { kind: "number"; min?: number; max?: number }
  | { kind: "values"; values: readonly string[] }
  | { kind: "date"; from?: string; to?: string };

/**
 * Active filters by column id. A row is shown when it matches every filter.
 * Dates in `"date"` filters are ISO calendar dates (`"2026-11-18"`).
 */
export type FilterState = Readonly<Record<string, ColumnFilter>>;

/** Column widths in CSS pixels by column id. Missing columns use `ColumnDef.width`. */
export type ColumnWidths = Readonly<Record<string, number>>;

/** Sort direction, using the same words as `aria-sort`. */
export type SortDirection = "ascending" | "descending";

/** Sorting by one column. */
export interface SortDescriptor {
  /** The `id` of the sorted column. */
  columnId: string;
  /** Ascending or descending; empty values are last in both. */
  direction: SortDirection;
}

/** Sort order: the first descriptor is the primary sort, later ones break ties. */
export type SortState = readonly SortDescriptor[];

/** Position of the active cell. `row` 0 is the header row; data rows start at 1, in display order. */
export interface CellPosition {
  row: number;
  col: number;
}
