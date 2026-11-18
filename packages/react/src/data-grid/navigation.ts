import type { CellPosition } from "./types.ts";

export interface GridBounds {
  /** Rows including the header row (row 0). */
  rowCount: number;
  colCount: number;
  /** Rows moved by PageUp/PageDown. */
  pageSize: number;
}

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The cell that receives focus after a navigation key, following the
 * WAI-ARIA grid pattern, or `null` if the key does not navigate. Movement
 * stops at the edges; it does not wrap to the next row.
 *
 * Ctrl (or Cmd on macOS) with Home/End jumps to the first/last row as well.
 */
export function nextPosition(
  position: CellPosition,
  input: KeyInput,
  bounds: GridBounds,
): CellPosition | null {
  const lastRow = bounds.rowCount - 1;
  const lastCol = bounds.colCount - 1;
  if (lastRow < 0 || lastCol < 0) return null;
  const modifier = Boolean(input.ctrlKey || input.metaKey);
  const { row, col } = position;

  switch (input.key) {
    case "ArrowRight":
      return { row, col: Math.min(lastCol, col + 1) };
    case "ArrowLeft":
      return { row, col: Math.max(0, col - 1) };
    case "ArrowDown":
      return { row: Math.min(lastRow, row + 1), col };
    case "ArrowUp":
      return { row: Math.max(0, row - 1), col };
    case "Home":
      return modifier ? { row: 0, col: 0 } : { row, col: 0 };
    case "End":
      return modifier ? { row: lastRow, col: lastCol } : { row, col: lastCol };
    case "PageDown":
      return { row: clamp(row + bounds.pageSize, 0, lastRow), col };
    case "PageUp":
      // Paging stops at the first data row; the header is one ArrowUp away.
      return {
        row: row === 0 ? 0 : clamp(row - bounds.pageSize, Math.min(1, lastRow), lastRow),
        col,
      };
    default:
      return null;
  }
}

/** Keeps a position inside the grid after rows or columns were removed. */
export function clampPosition(position: CellPosition, bounds: GridBounds): CellPosition {
  return {
    row: clamp(position.row, 0, Math.max(0, bounds.rowCount - 1)),
    col: clamp(position.col, 0, Math.max(0, bounds.colCount - 1)),
  };
}
