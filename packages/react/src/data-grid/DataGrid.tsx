import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { LiveAnnouncer, useAnnouncer } from "../live-announcer/LiveAnnouncer.tsx";
import { VisuallyHidden } from "../visually-hidden/VisuallyHidden.tsx";
import { defaultMessages, type DataGridMessages } from "./messages.ts";
import { clampPosition, nextPosition, type GridBounds } from "./navigation.ts";
import { isEmpty, readValue } from "./sort.ts";
import type { CellPosition, CellValue, ColumnDef, SortState } from "./types.ts";
import { useDataGrid } from "./useDataGrid.ts";
import { pageSize, scrollTopToReveal, visibleRange, type VirtualRange } from "./virtual.ts";

/** Props of {@link DataGrid}. */
export interface DataGridProps<Row> {
  /** The data. Never copied or mutated; sorting works on an index permutation. */
  rows: readonly Row[];
  /** Column definitions. Keep the array stable (define it outside the component or memoize it). */
  columns: readonly ColumnDef<Row>[];
  /** Accessible name of the grid. Required unless `aria-labelledby` is set. */
  "aria-label"?: string;
  /** Id of a visible element that names the grid. */
  "aria-labelledby"?: string;
  /** Controlled sort state. */
  sort?: SortState;
  /** Initial sort state when uncontrolled. */
  defaultSort?: SortState;
  /** Called with the new sort state whenever the user changes it. */
  onSortChange?: (sort: SortState) => void;
  /** Row height in CSS pixels; every row has the same height. Default: 36. */
  rowHeight?: number;
  /** Rows rendered above and below the visible ones. Default: 6. */
  overscan?: number;
  /** Texts for translation. */
  messages?: Partial<DataGridMessages>;
  /** Class name on the scroll container. Set its height here or with `style`. */
  className?: string;
  /** Inline styles of the scroll container. */
  style?: CSSProperties;
}

const DEFAULT_ROW_HEIGHT = 36;
const DEFAULT_WIDTH = 160;
/** Viewport height assumed before the first measurement (server rendering). */
const INITIAL_VIEWPORT = 384;

const INNER_FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([data-tbw-cell])";

function formatValue(value: CellValue): string {
  if (isEmpty(value)) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function cellSelector(position: CellPosition): string {
  return `[data-tbw-row="${position.row}"][data-tbw-col="${position.col}"]`;
}

function positionOf(element: Element | null): CellPosition | null {
  const cell = element?.closest<HTMLElement>("[data-tbw-cell]");
  if (!cell) return null;
  return { row: Number(cell.dataset["tbwRow"]), col: Number(cell.dataset["tbwCol"]) };
}

// ---------------------------------------------------------------------------
// Body rows and cells. Memoised so that moving focus re-renders exactly the
// two cells whose tabIndex changes, and scrolling renders only new rows.

interface CellProps<Row> {
  row: Row;
  rowIndex: number;
  position: number;
  colIndex: number;
  column: ColumnDef<Row>;
  active: boolean;
}

function BodyCellImpl<Row>({
  row,
  rowIndex,
  position,
  colIndex,
  column,
  active,
}: CellProps<Row>): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const value = readValue(row, column);
  const custom = column.cell;

  // Interactive content inside a cell must not add tab stops: the grid has
  // exactly one. Enter or F2 moves focus into the content (see onKeyDown).
  useLayoutEffect(() => {
    if (!custom || !ref.current) return;
    for (const element of ref.current.querySelectorAll<HTMLElement>(INNER_FOCUSABLE)) {
      element.tabIndex = -1;
      element.dataset["tbwInner"] = "";
    }
  });

  return (
    <div
      ref={ref}
      role="gridcell"
      aria-colindex={colIndex + 1}
      tabIndex={active ? 0 : -1}
      className="tbw-grid__cell"
      data-align={column.align ?? "start"}
      data-tbw-cell=""
      data-tbw-row={position + 1}
      data-tbw-col={colIndex}
    >
      {custom ? (
        custom({ row, value, rowIndex })
      ) : (
        <span className="tbw-grid__text">{(column.format ?? formatValue)(value)}</span>
      )}
    </div>
  );
}
const BodyCell = memo(BodyCellImpl) as typeof BodyCellImpl;

interface RowProps<Row> {
  row: Row;
  rowIndex: number;
  position: number;
  columns: readonly ColumnDef<Row>[];
  /** Column of the active cell if it is in this row, otherwise -1. */
  activeCol: number;
  rowHeight: number;
}

function BodyRowImpl<Row>({
  row,
  rowIndex,
  position,
  columns,
  activeCol,
  rowHeight,
}: RowProps<Row>): JSX.Element {
  return (
    <div
      role="row"
      aria-rowindex={position + 2}
      className="tbw-grid__row"
      style={{ transform: `translateY(${position * rowHeight}px)` }}
    >
      {columns.map((column, colIndex) => (
        <BodyCell
          key={column.id}
          row={row}
          rowIndex={rowIndex}
          position={position}
          colIndex={colIndex}
          column={column}
          active={colIndex === activeCol}
        />
      ))}
    </div>
  );
}
const BodyRow = memo(BodyRowImpl) as typeof BodyRowImpl;

// ---------------------------------------------------------------------------

function GridInner<Row>(props: DataGridProps<Row>): JSX.Element {
  const { rows, columns, rowHeight = DEFAULT_ROW_HEIGHT, overscan = 6, className, style } = props;
  const messages = useMemo(() => ({ ...defaultMessages, ...props.messages }), [props.messages]);
  const announce = useAnnouncer();
  const hintId = useId();

  const { order, sort, toggleSort } = useDataGrid({
    rows,
    columns,
    ...(props.sort !== undefined && { sort: props.sort }),
    ...(props.defaultSort !== undefined && { defaultSort: props.defaultSort }),
    ...(props.onSortChange !== undefined && { onSortChange: props.onSortChange }),
  });

  const rowCount = order.length;
  const scrollRef = useRef<HTMLDivElement>(null);
  // The body height is state for rendering (PageUp/PageDown size) and a ref
  // for scroll and key handlers, which must not wait for a re-render.
  const [viewportHeight, setViewportHeight] = useState(INITIAL_VIEWPORT - rowHeight);
  const viewportRef = useRef(viewportHeight);
  const [range, setRange] = useState<VirtualRange>(() =>
    visibleRange(0, INITIAL_VIEWPORT - rowHeight, rowHeight, rowCount, overscan),
  );
  const [activeState, setActive] = useState<CellPosition>({ row: 0, col: 0 });
  const focusPending = useRef(false);

  const bounds: GridBounds = {
    rowCount: rowCount + 1,
    colCount: columns.length,
    pageSize: pageSize(viewportHeight, rowHeight),
  };
  const active = clampPosition(activeState, bounds);

  const updateRange = useCallback(
    (scrollTop: number) => {
      const next = visibleRange(scrollTop, viewportRef.current, rowHeight, rowCount, overscan);
      setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    },
    [rowHeight, rowCount, overscan],
  );

  // Measure the viewport and keep the range in sync with size and data.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => {
      const height = Math.max(0, element.clientHeight - rowHeight);
      viewportRef.current = height;
      setViewportHeight(height);
      updateRange(element.scrollTop);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rowHeight, updateRange]);

  // Move DOM focus after keyboard navigation, once the target cell is rendered.
  useLayoutEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    scrollRef.current
      ?.querySelector<HTMLElement>(cellSelector(active))
      ?.focus({ preventScroll: true });
  });

  const columnOffsets = useMemo(() => {
    const offsets = [0];
    for (const column of columns) offsets.push(offsets.at(-1)! + (column.width ?? DEFAULT_WIDTH));
    return offsets;
  }, [columns]);
  const totalWidth = columnOffsets.at(-1)!;

  const moveTo = (next: CellPosition) => {
    const element = scrollRef.current;
    if (element) {
      // Leaving the body for the header (Ctrl+Home, ArrowUp from row 1) shows
      // the top of the data; the header itself is always visible.
      if (next.row === 0 && active.row > 0 && element.scrollTop !== 0) {
        element.scrollTop = 0;
        updateRange(0);
      }
      if (next.row > 0) {
        const top = scrollTopToReveal(
          next.row - 1,
          rowHeight,
          element.scrollTop,
          viewportRef.current,
        );
        if (top !== element.scrollTop) {
          element.scrollTop = top;
          updateRange(top);
        }
      }
      const left = columnOffsets[next.col]!;
      const right = columnOffsets[next.col + 1]!;
      if (left < element.scrollLeft) element.scrollLeft = left;
      else if (right > element.scrollLeft + element.clientWidth) {
        element.scrollLeft = right - element.clientWidth;
      }
    }
    focusPending.current = true;
    setActive(next);
  };

  const sortColumn = (colIndex: number, multi: boolean) => {
    const column = columns[colIndex];
    if (!column || column.sortable === false) return;
    const next = toggleSort(column.id, multi);
    announce(
      messages.sorted(
        next.flatMap((d) => {
          const c = columns.find((col) => col.id === d.columnId);
          return c ? [{ header: c.header, direction: d.direction }] : [];
        }),
      ),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>("[data-tbw-cell]");
    if (!cell) return;

    // Focus is on content inside a cell (after Enter or F2).
    if (target !== cell) {
      if (event.key === "Escape") {
        event.preventDefault();
        cell.focus();
      } else if (event.key === "Tab") {
        const inner = [...cell.querySelectorAll<HTMLElement>("[data-tbw-inner]")];
        if (inner.length > 0) {
          event.preventDefault();
          const index = inner.indexOf(target);
          const step = event.shiftKey ? -1 : 1;
          inner[(index + step + inner.length) % inner.length]?.focus();
        }
      }
      return;
    }

    const position = positionOf(cell);
    if (!position) return;

    if (position.row === 0 && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      sortColumn(position.col, event.shiftKey);
      return;
    }
    if (position.row > 0 && (event.key === "Enter" || event.key === "F2")) {
      const first = cell.querySelector<HTMLElement>("[data-tbw-inner]");
      if (first) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    const next = nextPosition(position, event, bounds);
    if (next) {
      event.preventDefault();
      moveTo(next);
    }
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    // The grid element itself (focused by a click on empty space or by a
    // script) hands focus on to the active cell.
    if (event.target === event.currentTarget) {
      event.currentTarget
        .querySelector<HTMLElement>(cellSelector(active))
        ?.focus({ preventScroll: true });
      return;
    }
    const position = positionOf(event.target);
    if (position && (position.row !== active.row || position.col !== active.col)) {
      setActive(position);
    }
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const position = positionOf(event.target as Element);
    if (position?.row === 0) sortColumn(position.col, event.shiftKey);
  };

  const onScroll = () => {
    if (scrollRef.current) updateRange(scrollRef.current.scrollTop);
  };

  // Rows to render: the virtual range, plus the active row wherever it is, so
  // that DOM focus is never lost when the focused row scrolls out of view.
  const positions: number[] = [];
  for (let p = range.start; p < Math.min(range.end, rowCount); p++) positions.push(p);
  const activePosition = active.row - 1;
  if (activePosition >= 0 && (activePosition < range.start || activePosition >= range.end)) {
    positions.push(activePosition);
  }

  const sortIndex = new Map(sort.map((d, i) => [d.columnId, i]));
  const gridStyle = {
    ...style,
    "--tbw-grid-template": columns.map((c) => `${c.width ?? DEFAULT_WIDTH}px`).join(" "),
    "--tbw-grid-width": `${totalWidth}px`,
    "--tbw-grid-row-height": `${rowHeight}px`,
  } as CSSProperties;

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      aria-rowcount={rowCount === 0 ? 2 : rowCount + 1}
      aria-colcount={columns.length}
      // Focusable by clicks and scripts, but not a tab stop: the active cell
      // is the single tab stop of the grid.
      tabIndex={-1}
      className={className ? `tbw-grid ${className}` : "tbw-grid"}
      style={gridStyle}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClick={onClick}
      onScroll={onScroll}
    >
      <div role="rowgroup" className="tbw-grid__head">
        <div role="row" aria-rowindex={1} className="tbw-grid__header-row">
          {columns.map((column, colIndex) => {
            const sortable = column.sortable !== false;
            const index = sortIndex.get(column.id);
            const descriptor = index === undefined ? undefined : sort[index];
            const isActive = active.row === 0 && active.col === colIndex;
            return (
              <div
                key={column.id}
                role="columnheader"
                aria-colindex={colIndex + 1}
                aria-sort={index === 0 ? descriptor!.direction : undefined}
                aria-describedby={sortable ? hintId : undefined}
                tabIndex={isActive ? 0 : -1}
                className="tbw-grid__header-cell"
                data-align={column.align ?? "start"}
                data-sortable={sortable || undefined}
                data-sorted={descriptor?.direction}
                data-tbw-cell=""
                data-tbw-row={0}
                data-tbw-col={colIndex}
              >
                <span className="tbw-grid__text">
                  {column.header}
                  {descriptor && index! > 0 && (
                    <VisuallyHidden>
                      {messages.sortPosition(index! + 1, descriptor.direction)}
                    </VisuallyHidden>
                  )}
                </span>
                {descriptor && (
                  <span className="tbw-grid__sort" aria-hidden="true">
                    <svg viewBox="0 0 10 10" width="10" height="10">
                      <path
                        d={descriptor.direction === "ascending" ? "M5 2l4 6H1z" : "M5 8L1 2h8z"}
                        fill="currentColor"
                      />
                    </svg>
                    {sort.length > 1 && <span className="tbw-grid__sort-index">{index! + 1}</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div
        role="rowgroup"
        className="tbw-grid__body"
        style={{ height: Math.max(1, rowCount) * rowHeight }}
      >
        {rowCount === 0 ? (
          <div role="row" aria-rowindex={2} className="tbw-grid__row">
            <div
              role="gridcell"
              aria-colindex={1}
              aria-colspan={columns.length}
              className="tbw-grid__empty"
            >
              {messages.empty}
            </div>
          </div>
        ) : (
          positions.map((position) => {
            const rowIndex = order[position]!;
            return (
              <BodyRow
                // Keyed by position, not by row: after sorting, the existing row
                // elements are updated in place instead of being destroyed and
                // recreated (measured in ADR 5).
                key={position}
                row={rows[rowIndex]!}
                rowIndex={rowIndex}
                position={position}
                columns={columns}
                activeCol={position === activePosition ? active.col : -1}
                rowHeight={rowHeight}
              />
            );
          })
        )}
      </div>
      <VisuallyHidden id={hintId}>{messages.sortHint}</VisuallyHidden>
    </div>
  );
}

/**
 * An accessible data grid following the WAI-ARIA grid pattern. Renders only
 * the visible rows, so 100,000 rows scroll as smoothly as 100.
 *
 * - One tab stop; arrow keys, Home/End, Ctrl+Home/End and PageUp/PageDown
 *   move between cells. Enter or F2 moves into interactive cell content,
 *   Escape back to the cell.
 * - Enter, Space or a click on a header sorts (none → ascending →
 *   descending); with Shift the column is added to the sort.
 * - Sort changes are announced to screen readers.
 *
 * Give the grid a height (`style` or `className`); it scrolls inside it.
 *
 * @example
 * ```tsx
 * <DataGrid aria-label="Prices" rows={rows} columns={columns} style={{ height: 480 }} />
 * ```
 */
export function DataGrid<Row>(props: DataGridProps<Row>): JSX.Element {
  return (
    <LiveAnnouncer>
      <GridInner {...props} />
    </LiveAnnouncer>
  );
}
