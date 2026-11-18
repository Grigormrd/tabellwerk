// Virtualisation with a fixed row height: every row's position follows from
// its index, so no row has to be measured and the range is O(1) to compute.

/** Half-open range of display positions `[start, end)` to render. */
export interface VirtualRange {
  start: number;
  end: number;
}

/**
 * Rows to render for a scroll position: the rows that intersect the viewport
 * plus `overscan` rows above and below, so that fast scrolling does not show
 * empty space before React has rendered the next rows.
 */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  rowCount: number,
  overscan: number,
): VirtualRange {
  if (rowCount <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const top = Math.max(0, scrollTop);
  const first = Math.floor(top / rowHeight);
  const last = Math.ceil((top + Math.max(0, viewportHeight)) / rowHeight);
  return {
    start: Math.min(rowCount, Math.max(0, first - overscan)),
    end: Math.min(rowCount, Math.max(first + 1, last) + overscan),
  };
}

/**
 * The scroll position that makes the row at `index` fully visible with the
 * least movement, or the current position if it already is.
 */
export function scrollTopToReveal(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
): number {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return Math.max(0, bottom - viewportHeight);
  return scrollTop;
}

/** How many rows PageUp/PageDown move: one less than fit, so one row stays in view. */
export function pageSize(viewportHeight: number, rowHeight: number): number {
  return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
}
