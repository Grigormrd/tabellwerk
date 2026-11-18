import type { SortDirection } from "./types.ts";

/** Texts the grid shows or announces. Override them to translate the grid. */
export interface DataGridMessages {
  /** Shown in the body when there are no rows. */
  empty: string;
  /** Read by screen readers on sortable column headers. */
  sortHint: string;
  /** Visually hidden suffix on headers that are part of a multi-column sort. */
  sortPosition: (position: number, direction: SortDirection) => string;
  /** Announced after the sort changed. Receives the sort order with header texts. */
  sorted: (sort: readonly { header: string; direction: SortDirection }[]) => string;
}

const words: Record<SortDirection, string> = { ascending: "ascending", descending: "descending" };

/** The English texts; spread them to override single messages. */
export const defaultMessages: DataGridMessages = {
  empty: "No rows",
  sortHint: "Press Enter to sort. Shift+Enter adds the column to the sort.",
  sortPosition: (position, direction) => `, sort ${position}, ${words[direction]}`,
  sorted: (sort) =>
    sort.length === 0
      ? "Not sorted"
      : `Sorted by ${sort.map((s) => `${s.header}, ${words[s.direction]}`).join(", then by ")}`,
};
