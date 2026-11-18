# 5. Sorting with index permutations and radix sort

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

Sorting 100,000 rows must feel instant: the click on a header should be followed by the sorted
grid within the INP "good" threshold of 200 ms, also on slower devices. The rows belong to the
application and must not be copied or mutated. The sort must be stable, put empty values last in
both directions, sort strings case-insensitively with natural number order, and support custom
comparisons and several sort columns.

## Decision

**A permutation, not a sorted copy.** `sortPermutation` returns a `Uint32Array` with the row
indexes in display order. The grid reads `rows[order[position]]`; `rows` is never touched.

**No comparison callback per pair of rows.** Each sort column is first turned into an unsigned
64-bit key per row whose numeric order is the sort order:

- numbers, dates and booleans: an order-preserving transform of the IEEE 754 bits (flip all bits of
  negatives, set the sign bit of positives; `-0` counts as `0`);
- strings and columns with a custom `compare`: the rank among the distinct values, sorted once with
  `Intl.Collator` (`numeric: true`, `sensitivity: "base"`) or the custom function; values that
  compare equal share a rank;
- descending: the bits inverted; empty values: the largest key in both directions.

The rows are then ordered with a stable LSD radix sort, 16 bits per pass, skipping passes in which
all rows share the same digit. A multi-column sort is a stable sort by the last column, then by the
one before, and so on.

**Row elements are reused by position.** Body rows are keyed by their position in the view, not by
row identity. After a sort, React updates the text in the existing row elements instead of
destroying and recreating them.

## Measurements

The first version ranked strings but sorted the index array with a JavaScript comparison function.
Pure sort time for 100,000 rows (Node 26, no throttling, median of 7):

| Sort column               | Comparison sort | Radix sort |
| ------------------------- | --------------: | ---------: |
| Price (floating point)    |         23.5 ms |     6.1 ms |
| Zone (5 distinct strings) |         14.0 ms |     7.0 ms |
| Time (dates)              |         13.3 ms |     5.4 ms |

Click on a header until the next paint (Event Timing), production build, Chromium, CPU throttled
4×, median of 5 runs (conditions as in [ADR 4](0004-own-virtualiser.md)):

| Step                                    | Sort by price | Sort by zone |
| --------------------------------------- | ------------: | -----------: |
| Comparison sort, rows keyed by identity |        216 ms |   144–168 ms |
| Comparison sort, rows keyed by position |        192 ms |       112 ms |
| Radix sort, rows keyed by position      |         80 ms |        72 ms |

The first row comes from single runs, the other two are medians of 5 runs; all were measured on
2026-11-17 and 2026-11-18 on the same machine. The radix version is the one in the code.

## Consequences

- Sorting stays well inside the 200 ms budget that CI enforces, with room for slower machines.
- Cell renderers must render from their arguments only: after a sort, a row element shows another
  row, so state inside a cell component would move with the element. This is documented on
  `ColumnDef.cell`.
- Strings with many distinct values (100,000 unique names) still need one collator sort of the
  distinct values; that is the remaining cost for such columns.
- The transform assumes the platform's byte order, which is detected at load time.
