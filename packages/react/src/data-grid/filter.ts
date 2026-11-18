import { isEmpty, readValue } from "./sort.ts";
import type { CellValue, ColumnDef, ColumnFilter, FilterState } from "./types.ts";

/** Formats a value the way the grid displays it by default. */
export function formatValue(value: CellValue): string {
  if (isEmpty(value)) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** The text a cell shows: empty for empty values, otherwise the column format. */
export function displayText<Row>(column: ColumnDef<Row>, value: CellValue): string {
  if (isEmpty(value)) return "";
  return column.format ? column.format(value) : formatValue(value);
}

/** Whether a filter restricts anything; empty inputs do not. */
export function isActive(filter: ColumnFilter | undefined): filter is ColumnFilter {
  if (!filter) return false;
  switch (filter.kind) {
    case "text":
      return filter.query.trim() !== "";
    case "number":
      return Number.isFinite(filter.min) || Number.isFinite(filter.max);
    case "values":
      return true; // an empty selection shows nothing, on purpose
    case "date":
      return Boolean(filter.from || filter.to);
  }
}

function toNumber(value: CellValue): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return Number(value);
  return typeof value === "number" ? value : Number.NaN;
}

/**
 * Lower-cased display texts per rows array and column. Typing into a text
 * filter changes only the query, so the texts are formatted once, not on
 * every key press. Keyed weakly, so new data replaces the cache.
 */
const textCache = new WeakMap<object, WeakMap<object, string[]>>();

function displayTexts<Row>(
  rows: readonly Row[],
  column: ColumnDef<Row>,
  locale: string | undefined,
): string[] {
  let byColumn = textCache.get(rows);
  if (!byColumn) textCache.set(rows, (byColumn = new WeakMap()));
  let texts = byColumn.get(column);
  if (!texts) {
    texts = rows.map((row) =>
      displayText(column, readValue(row, column)).toLocaleLowerCase(locale),
    );
    byColumn.set(column, texts);
  }
  return texts;
}

/**
 * A predicate for one column, built once per filter change. Expensive work
 * (formatting and lower-casing every value) happens here, so testing a row
 * is a cheap lookup.
 */
function columnPredicate<Row>(
  rows: readonly Row[],
  column: ColumnDef<Row>,
  filter: ColumnFilter,
  locale: string | undefined,
): (index: number) => boolean {
  const value = (i: number) => readValue(rows[i] as Row, column);
  switch (filter.kind) {
    case "text": {
      const query = filter.query.trim().toLocaleLowerCase(locale);
      const texts = displayTexts(rows, column, locale);
      return (i) => (texts[i] as string).includes(query);
    }
    case "number": {
      const min = Number.isFinite(filter.min) ? (filter.min as number) : -Infinity;
      const max = Number.isFinite(filter.max) ? (filter.max as number) : Infinity;
      return (i) => {
        const n = toNumber(value(i));
        return n === n && n >= min && n <= max;
      };
    }
    case "values": {
      const allowed = new Set(filter.values);
      return (i) => {
        const v = value(i);
        return !isEmpty(v) && allowed.has(formatValue(v));
      };
    }
    case "date": {
      const from = filter.from ?? "";
      const to = filter.to ?? "￿";
      return (i) => {
        const v = value(i);
        if (!(v instanceof Date) || Number.isNaN(v.getTime())) return false;
        const day = v.toISOString().slice(0, 10);
        return day >= from && day <= to;
      };
    }
  }
}

/**
 * Marks the rows that match every active filter (1) or not (0). Returns
 * `null` when no filter is active, so callers can skip filtering entirely.
 */
export function filterMask<Row>(
  rows: readonly Row[],
  columns: readonly ColumnDef<Row>[],
  filters: FilterState,
  locale?: string,
): Uint8Array | null {
  const predicates = Object.entries(filters).flatMap(([columnId, filter]) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column || !isActive(filter)) return [];
    return [columnPredicate(rows, column, filter, locale)];
  });
  if (predicates.length === 0) return null;

  const n = rows.length;
  const mask = new Uint8Array(n);
  outer: for (let i = 0; i < n; i++) {
    for (const matches of predicates) if (!matches(i)) continue outer;
    mask[i] = 1;
  }
  return mask;
}

/** Keeps the entries of `order` whose row matches the mask, in order. */
export function applyMask(order: Uint32Array, mask: Uint8Array | null): Uint32Array {
  if (!mask) return order;
  let count = 0;
  for (let i = 0; i < order.length; i++) count += mask[order[i] as number] as number;
  const result = new Uint32Array(count);
  for (let i = 0, j = 0; i < order.length; i++) {
    const index = order[i] as number;
    if (mask[index]) result[j++] = index;
  }
  return result;
}

/** The distinct formatted values of a column, sorted, for a `"values"` filter. */
export function distinctValues<Row>(
  rows: readonly Row[],
  column: ColumnDef<Row>,
  limit = 200,
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = readValue(row, column);
    if (!isEmpty(value)) seen.add(formatValue(value));
    if (seen.size > limit) break;
  }
  return [...seen].sort(new Intl.Collator(undefined, { numeric: true }).compare).slice(0, limit);
}
