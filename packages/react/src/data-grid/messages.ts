import type { ComboboxMessages } from "../combobox/messages.ts";
import type { DatePickerMessages } from "../date-picker/messages.ts";
import type { SortDirection } from "./types.ts";

/** What a column header offers, for the screen reader hint. */
export interface HeaderCapabilities {
  /** The column can be sorted (`sortable` is not `false`). */
  sortable: boolean;
  /** The column has a `filter`. */
  filterable: boolean;
  /** The column can be resized (`resizable` is not `false`). */
  resizable: boolean;
}

/** Texts the grid shows or announces. Override them to translate the grid. */
export interface DataGridMessages {
  /** Shown in the body when there are no rows at all. */
  empty: string;
  /** Shown in the body when filters hide every row. */
  noMatches: string;
  /** Read by screen readers on column headers: how to sort, filter and resize. */
  headerHint: (capabilities: HeaderCapabilities) => string;
  /** Visually hidden suffix on headers that are part of a multi-column sort. */
  sortPosition: (position: number, direction: SortDirection) => string;
  /** Announced after the sort changed. Receives the sort order with header texts. */
  sorted: (sort: readonly { header: string; direction: SortDirection }[]) => string;
  /** Visually hidden suffix on headers of filtered columns. */
  filteredSuffix: string;
  /** Accessible name of the filter button in a header. */
  filterButton: (header: string) => string;
  /** Accessible name of the filter dialog. */
  filterDialog: (header: string) => string;
  /** Announced after filtering, once typing has paused. */
  filterResult: (count: number, total: number) => string;
  /** Labels inside the filter dialog. */
  filterLabels: {
    contains: string;
    min: string;
    max: string;
    from: string;
    to: string;
    values: string;
    valuesHint: string;
    clear: string;
    close: string;
  };
  /** Accessible name of the resize handle in a header. */
  resizeHandle: (header: string) => string;
  /** Spoken value of the resize handle. */
  widthText: (pixels: number) => string;
  /** Texts of the combobox in `"values"` filters. */
  comboboxMessages: Partial<ComboboxMessages>;
  /** Texts of the date pickers in `"date"` filters. */
  datePickerMessages: Partial<DatePickerMessages>;
}

const words: Record<SortDirection, string> = { ascending: "ascending", descending: "descending" };
const count = new Intl.NumberFormat("en-US");

/** The English texts; spread them to override single messages. */
export const defaultMessages: DataGridMessages = {
  empty: "No rows",
  noMatches: "No rows match the filters",
  headerHint: ({ sortable, filterable, resizable }) =>
    [
      sortable && "Press Enter to sort, Shift+Enter to add the column to the sort.",
      filterable && "Alt+Down Arrow opens the filter.",
      (filterable || resizable) && "F2 moves to the column controls.",
    ]
      .filter(Boolean)
      .join(" "),
  sortPosition: (position, direction) => `, sort ${position}, ${words[direction]}`,
  sorted: (sort) =>
    sort.length === 0
      ? "Not sorted"
      : `Sorted by ${sort.map((s) => `${s.header}, ${words[s.direction]}`).join(", then by ")}`,
  filteredSuffix: ", filtered",
  filterButton: (header) => `Filter ${header}`,
  filterDialog: (header) => `Filter ${header}`,
  filterResult: (shown, total) =>
    shown === total
      ? `All ${count.format(total)} rows shown`
      : `${count.format(shown)} of ${count.format(total)} rows`,
  filterLabels: {
    contains: "Contains",
    min: "Minimum",
    max: "Maximum",
    from: "From",
    to: "To",
    values: "Show rows with",
    valuesHint: "Type to find a value. With no value chosen, every row is shown.",
    clear: "Clear filter",
    close: "Close",
  },
  resizeHandle: (header) => `Resize ${header}`,
  widthText: (pixels) => `${pixels} pixels`,
  comboboxMessages: {},
  datePickerMessages: {},
};
