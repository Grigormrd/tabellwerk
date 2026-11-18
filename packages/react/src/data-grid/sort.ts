import type { CellValue, ColumnDef, SortDirection, SortState } from "./types.ts";

/** Reads a cell value with the column's `getValue`, falling back to `row[column.id]`. */
export function readValue<Row>(row: Row, column: ColumnDef<Row>): CellValue {
  if (column.getValue) return column.getValue(row);
  return (row as Record<string, CellValue> | null)?.[column.id];
}

export function isEmpty(value: CellValue): value is null | undefined {
  return (
    value === null || value === undefined || (typeof value === "number" && Number.isNaN(value))
  );
}

const NEXT: Record<SortDirection | "none", SortDirection | null> = {
  none: "ascending",
  ascending: "descending",
  descending: null,
};

/**
 * Returns the sort state after the user activates a column header:
 * none → ascending → descending → none. With `multi` (Shift), the column is
 * added to or updated in the existing sort; otherwise it replaces it.
 */
export function toggleSort(state: SortState, columnId: string, multi = false): SortState {
  const current = state.find((d) => d.columnId === columnId);
  const next = NEXT[current?.direction ?? "none"];
  if (!multi) return next ? [{ columnId, direction: next }] : [];
  if (!current) return next ? [...state, { columnId, direction: next }] : state;
  return next
    ? state.map((d) => (d.columnId === columnId ? { columnId, direction: next } : d))
    : state.filter((d) => d.columnId !== columnId);
}

// ---------------------------------------------------------------------------
// Sorting without a comparison callback.
//
// Every sort column is turned into an unsigned 64-bit key per row (two
// Uint32Arrays, `hi` and `lo`) whose numeric order is the sort order:
// numbers, dates and booleans through an order-preserving transform of their
// IEEE 754 bits, strings and custom comparisons through their rank among the
// distinct values. Empty values get the largest key in both directions, so
// they always come last. The rows are then ordered with a stable LSD radix
// sort, 16 bits per pass, and a multi-column sort is a series of stable sorts
// from the last column to the first. No step calls a comparison function per
// pair of rows, which is what made the first version too slow for 100,000
// rows (see ADR 5).

const EMPTY = 0xffffffff;

interface SortKey {
  hi: Uint32Array | null;
  lo: Uint32Array;
}

const float = new Float64Array(1);
const words = new Uint32Array(float.buffer);
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const LOW = LITTLE_ENDIAN ? 0 : 1;
const HIGH = LITTLE_ENDIAN ? 1 : 0;

/** Order-preserving 64-bit keys for numbers, dates and booleans. */
function numberKey(values: readonly CellValue[], descending: boolean): SortKey {
  const n = values.length;
  const hi = new Uint32Array(n);
  const lo = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const value = values[i];
    if (isEmpty(value)) {
      hi[i] = EMPTY;
      lo[i] = EMPTY;
      continue;
    }
    const number =
      value instanceof Date
        ? value.getTime()
        : typeof value === "boolean"
          ? Number(value)
          : (value as number);
    float[0] = number === 0 ? 0 : number; // -0 and 0 are equal
    let h = words[HIGH] as number;
    let l = words[LOW] as number;
    if (h & 0x80000000) {
      // Negative: flip every bit, so larger magnitudes sort first.
      h = ~h >>> 0;
      l = ~l >>> 0;
    } else {
      // Positive: set the sign bit, so positives sort after negatives.
      h = (h | 0x80000000) >>> 0;
    }
    if (descending) {
      h = ~h >>> 0;
      l = ~l >>> 0;
    }
    // The transformed keys never reach EMPTY: NaN is filtered out above.
    hi[i] = h;
    lo[i] = l;
  }
  return { hi, lo };
}

/** Ranks among the distinct values; values the comparison calls equal share a rank. */
function rankKey(
  values: readonly CellValue[],
  compare: (a: NonNullable<CellValue>, b: NonNullable<CellValue>) => number,
  asString: boolean,
  descending: boolean,
): SortKey {
  const n = values.length;
  const unique = new Map<unknown, number>();
  for (const value of values) {
    if (!isEmpty(value)) unique.set(asString ? String(value) : value, 0);
  }
  const sorted = [...unique.keys()] as NonNullable<CellValue>[];
  sorted.sort(compare);
  let rank = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || compare(sorted[i - 1]!, sorted[i]!) !== 0) rank++;
    unique.set(sorted[i], rank);
  }
  const distinct = rank + 1;
  const lo = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const value = values[i];
    if (isEmpty(value)) {
      lo[i] = EMPTY;
    } else {
      const r = unique.get(asString ? String(value) : value) as number;
      lo[i] = descending ? distinct - 1 - r : r;
    }
  }
  return { hi: null, lo };
}

function columnKey<Row>(
  rows: readonly Row[],
  column: ColumnDef<Row>,
  collator: Intl.Collator,
  descending: boolean,
): SortKey {
  const n = rows.length;
  const values: CellValue[] = new Array(n);
  let hasString = false;
  for (let i = 0; i < n; i++) {
    const value = readValue(rows[i] as Row, column);
    values[i] = value;
    if (typeof value === "string") hasString = true;
  }
  if (column.compare) return rankKey(values, column.compare, false, descending);
  if (hasString) {
    return rankKey(values, (a, b) => collator.compare(String(a), String(b)), true, descending);
  }
  return numberKey(values, descending);
}

/**
 * One stable counting-sort pass over 16 bits of `key`. Returns false (and
 * leaves `to` untouched) when every row has the same digit, so the pass can
 * be skipped.
 */
function radixPass(
  from: Uint32Array,
  to: Uint32Array,
  key: Uint32Array,
  shift: number,
  counts: Uint32Array,
): boolean {
  const n = from.length;
  counts.fill(0);
  for (let i = 0; i < n; i++) counts[((key[from[i] as number] as number) >>> shift) & 0xffff]!++;
  if (counts[((key[from[0] as number] as number) >>> shift) & 0xffff] === n) return false;
  let sum = 0;
  for (let digit = 0; digit < 65536; digit++) {
    const count = counts[digit] as number;
    counts[digit] = sum;
    sum += count;
  }
  for (let i = 0; i < n; i++) {
    const index = from[i] as number;
    to[counts[((key[index] as number) >>> shift) & 0xffff]!++] = index;
  }
  return true;
}

const defaultCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Returns the display order of `rows` for `sort` as a permutation of row
 * indexes. The rows themselves are never copied or reordered. The sort is
 * stable (ties keep their original order) and empty values come last in
 * either direction.
 */
export function sortPermutation<Row>(
  rows: readonly Row[],
  columns: readonly ColumnDef<Row>[],
  sort: SortState,
  collator: Intl.Collator = defaultCollator,
): Uint32Array {
  const n = rows.length;
  let order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;

  const keys = sort.flatMap((descriptor) => {
    const column = columns.find((c) => c.id === descriptor.columnId);
    if (!column || column.sortable === false) return [];
    return [columnKey(rows, column, collator, descriptor.direction === "descending")];
  });
  if (keys.length === 0 || n < 2) return order;

  // Least significant first: the last sort column, its low word, low digit.
  let spare = new Uint32Array(n);
  const counts = new Uint32Array(65536);
  for (let k = keys.length - 1; k >= 0; k--) {
    const { hi, lo } = keys[k]!;
    for (const word of hi ? [lo, hi] : [lo]) {
      for (const shift of [0, 16]) {
        if (radixPass(order, spare, word, shift, counts)) [order, spare] = [spare, order];
      }
    }
  }
  return order;
}
