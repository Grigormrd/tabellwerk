import {
  memo,
  useCallback,
  useEffect,
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
import { useControllableState } from "../internal/useControllableState.ts";
import { LiveAnnouncer, useAnnouncer } from "../live-announcer/LiveAnnouncer.tsx";
import { VisuallyHidden } from "../visually-hidden/VisuallyHidden.tsx";
import { displayText, distinctValues, isActive } from "./filter.ts";
import { FilterPopover } from "./FilterPopover.tsx";
import { defaultMessages, type DataGridMessages } from "./messages.ts";
import { clampPosition, nextPosition, type GridBounds } from "./navigation.ts";
import { ResizeHandle } from "./ResizeHandle.tsx";
import { readValue } from "./sort.ts";
import type {
  CellPosition,
  ColumnDef,
  ColumnFilter,
  ColumnWidths,
  FilterState,
  SortState,
} from "./types.ts";
import { useDataGrid } from "./useDataGrid.ts";
import { pageSize, scrollTopToReveal, visibleRange, type VirtualRange } from "./virtual.ts";

/** Translations for {@link DataGrid}; every key, and every filter label, is optional. */
export type DataGridMessagesInput = Partial<Omit<DataGridMessages, "filterLabels">> & {
  filterLabels?: Partial<DataGridMessages["filterLabels"]>;
};

/** Props of {@link DataGrid}. */
export interface DataGridProps<Row> {
  /** The data. Never copied or mutated; sorting and filtering work on an index permutation. */
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
  /** Controlled filter state. */
  filters?: FilterState;
  /** Initial filter state when uncontrolled. */
  defaultFilters?: FilterState;
  /** Called with the new filter state whenever the user changes it. */
  onFiltersChange?: (filters: FilterState) => void;
  /** Controlled column widths in CSS pixels, by column id. */
  columnWidths?: ColumnWidths;
  /** Initial column widths when uncontrolled; columns not listed use `ColumnDef.width`. */
  defaultColumnWidths?: ColumnWidths;
  /** Called while the user resizes a column, with all widths that differ from the defaults. */
  onColumnWidthsChange?: (widths: ColumnWidths) => void;
  /** Row height in CSS pixels; every row has the same height. Default: 36. */
  rowHeight?: number;
  /** Rows rendered above and below the visible ones. Default: 6. */
  overscan?: number;
  /** Texts for translation. */
  messages?: DataGridMessagesInput;
  /** Class name on the scroll container. Set its height here or with `style`. */
  className?: string;
  /** Inline styles of the scroll container. */
  style?: CSSProperties;
}

const DEFAULT_ROW_HEIGHT = 36;
const DEFAULT_WIDTH = 160;
const DEFAULT_MIN_WIDTH = 48;
const DEFAULT_MAX_WIDTH = 800;
/** Viewport height assumed before the first measurement (server rendering). */
const INITIAL_VIEWPORT = 384;
/** Pause after the last filter change before the result count is announced. */
const ANNOUNCE_DELAY = 600;
const NO_WIDTHS: ColumnWidths = {};

const INNER_FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([data-tbw-cell])";

function cellSelector(position: CellPosition): string {
  return `[data-tbw-row="${position.row}"][data-tbw-col="${position.col}"]`;
}

function positionOf(element: Element | null): CellPosition | null {
  const cell = element?.closest<HTMLElement>("[data-tbw-cell]");
  if (!cell) return null;
  return { row: Number(cell.dataset["tbwRow"]), col: Number(cell.dataset["tbwCol"]) };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The width a cell needs to show its content without truncation: padding,
 * the flex children in a row with their gaps, and the full (scroll) width of
 * text that is currently cut off with an ellipsis. Absolutely positioned
 * children (resize handle, hidden texts) take no space.
 */
function contentWidth(cell: HTMLElement): number {
  const style = getComputedStyle(cell);
  let width = parseFloat(style.paddingInlineStart) + parseFloat(style.paddingInlineEnd);
  const gap = parseFloat(style.columnGap) || 0;
  let count = 0;
  for (const child of cell.children) {
    if (getComputedStyle(child).position === "absolute") continue;
    const element = child as HTMLElement;
    width += child.classList.contains("tbw-grid__text")
      ? element.scrollWidth
      : element.getBoundingClientRect().width;
    count++;
  }
  return width + gap * Math.max(0, count - 1);
}

function widthLimits<Row>(column: ColumnDef<Row>): [number, number] {
  const min = column.minWidth ?? DEFAULT_MIN_WIDTH;
  return [min, Math.max(min, column.maxWidth ?? DEFAULT_MAX_WIDTH)];
}

// ---------------------------------------------------------------------------
// Body rows and cells. Memoised so that moving focus re-renders exactly the
// two cells whose tabIndex changes, scrolling renders only new rows, and
// resizing a column (a CSS custom property) renders no row at all.

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
        <span className="tbw-grid__text">{displayText(column, value)}</span>
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

function FilterIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------

function GridInner<Row>(props: DataGridProps<Row>): JSX.Element {
  const { rows, columns, rowHeight = DEFAULT_ROW_HEIGHT, overscan = 6, className, style } = props;
  const messages = useMemo<DataGridMessages>(
    () => ({
      ...defaultMessages,
      ...props.messages,
      filterLabels: { ...defaultMessages.filterLabels, ...props.messages?.filterLabels },
    }),
    [props.messages],
  );
  const announce = useAnnouncer();
  const baseId = useId();

  const { order, totalCount, sort, toggleSort, filters, setFilter } = useDataGrid({
    rows,
    columns,
    ...(props.sort !== undefined && { sort: props.sort }),
    ...(props.defaultSort !== undefined && { defaultSort: props.defaultSort }),
    ...(props.onSortChange !== undefined && { onSortChange: props.onSortChange }),
    ...(props.filters !== undefined && { filters: props.filters }),
    ...(props.defaultFilters !== undefined && { defaultFilters: props.defaultFilters }),
    ...(props.onFiltersChange !== undefined && { onFiltersChange: props.onFiltersChange }),
  });

  const [widthOverrides, setWidthOverrides] = useControllableState(
    props.columnWidths,
    props.defaultColumnWidths ?? NO_WIDTHS,
    props.onColumnWidthsChange,
  );
  const widths = columns.map((column) => {
    const [min, max] = widthLimits(column);
    return clamp(widthOverrides[column.id] ?? column.width ?? DEFAULT_WIDTH, min, max);
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
  const [openFilter, setOpenFilter] = useState<{ col: number; anchor: HTMLElement } | null>(null);
  const filtersTouched = useRef(false);

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

  // Announce the number of matching rows once filtering has settled.
  useEffect(() => {
    if (!filtersTouched.current) return;
    const timer = setTimeout(
      () => announce(messages.filterResult(rowCount, totalCount)),
      ANNOUNCE_DELAY,
    );
    return () => clearTimeout(timer);
  }, [announce, messages, rowCount, totalCount, filters]);

  const columnOffsets = [0];
  for (const width of widths) columnOffsets.push(columnOffsets.at(-1)! + width);
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

  const changeFilter = (columnId: string, filter: ColumnFilter | undefined) => {
    filtersTouched.current = true;
    setFilter(columnId, filter);
    // New results start at the top.
    const element = scrollRef.current;
    if (element && element.scrollTop !== 0) {
      element.scrollTop = 0;
      updateRange(0);
    }
  };

  const resizeColumn = (colIndex: number, width: number) => {
    const column = columns[colIndex]!;
    const [min, max] = widthLimits(column);
    const next = clamp(Math.round(width), min, max);
    if (next !== widths[colIndex]) setWidthOverrides({ ...widthOverrides, [column.id]: next });
  };

  /** Widest content among the header and the rendered rows (the rows in view). */
  const fitColumn = (colIndex: number) => {
    const grid = scrollRef.current;
    if (!grid) return;
    let needed = 0;
    for (const cell of grid.querySelectorAll<HTMLElement>(`[data-tbw-col="${colIndex}"]`)) {
      needed = Math.max(needed, contentWidth(cell));
    }
    if (needed > 0) resizeColumn(colIndex, Math.ceil(needed));
  };

  const showFilter = (colIndex: number, anchor: HTMLElement) => {
    if (columns[colIndex]?.filter) setOpenFilter({ col: colIndex, anchor });
  };

  const closeFilter = useCallback((restoreFocus: boolean) => {
    setOpenFilter((open) => {
      if (open && restoreFocus) open.anchor.focus({ preventScroll: true });
      return null;
    });
  }, []);

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

    if (position.row === 0) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        sortColumn(position.col, event.shiftKey);
        return;
      }
      if (event.key === "ArrowDown" && event.altKey) {
        event.preventDefault();
        showFilter(position.col, cell);
        return;
      }
    }
    if (event.key === "F2" || (position.row > 0 && event.key === "Enter")) {
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
    const target = event.target as Element;
    // Clicks on the filter button or the resize handle do not sort.
    if (target.closest("[data-tbw-inner]")) return;
    const position = positionOf(target);
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
    "--tbw-grid-template": widths.map((w) => `${w}px`).join(" "),
    "--tbw-grid-width": `${totalWidth}px`,
    "--tbw-grid-row-height": `${rowHeight}px`,
  } as CSSProperties;

  const openColumn = openFilter ? columns[openFilter.col] : undefined;
  const filterValues = useMemo(
    () => (openColumn?.filter === "values" ? distinctValues(rows, openColumn) : ([] as string[])),
    [rows, openColumn],
  );

  return (
    <>
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
              const filterable = Boolean(column.filter);
              const resizable = column.resizable !== false;
              const filtered = isActive(filters[column.id]);
              const index = sortIndex.get(column.id);
              const descriptor = index === undefined ? undefined : sort[index];
              const isActiveCell = active.row === 0 && active.col === colIndex;
              const [min, max] = widthLimits(column);
              const hint = messages.headerHint({ sortable, filterable, resizable });
              const labelId = `${baseId}-h${colIndex}`;
              const hintId = `${baseId}-d${colIndex}`;
              return (
                <div
                  key={column.id}
                  role="columnheader"
                  aria-colindex={colIndex + 1}
                  aria-sort={index === 0 ? descriptor!.direction : undefined}
                  aria-labelledby={labelId}
                  aria-describedby={hint ? hintId : undefined}
                  tabIndex={isActiveCell ? 0 : -1}
                  className="tbw-grid__header-cell"
                  data-align={column.align ?? "start"}
                  data-sortable={sortable || undefined}
                  data-sorted={descriptor?.direction}
                  data-tbw-cell=""
                  data-tbw-row={0}
                  data-tbw-col={colIndex}
                >
                  <span id={labelId} className="tbw-grid__text">
                    {column.header}
                    {descriptor && index! > 0 && (
                      <VisuallyHidden>
                        {messages.sortPosition(index! + 1, descriptor.direction)}
                      </VisuallyHidden>
                    )}
                    {filtered && <VisuallyHidden>{messages.filteredSuffix}</VisuallyHidden>}
                  </span>
                  {descriptor && (
                    <span className="tbw-grid__sort" aria-hidden="true">
                      <svg viewBox="0 0 10 10" width="10" height="10">
                        <path
                          d={descriptor.direction === "ascending" ? "M5 2l4 6H1z" : "M5 8L1 2h8z"}
                          fill="currentColor"
                        />
                      </svg>
                      {sort.length > 1 && (
                        <span className="tbw-grid__sort-index">{index! + 1}</span>
                      )}
                    </span>
                  )}
                  {filterable && (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="tbw-grid__filter-button"
                      aria-label={messages.filterButton(column.header)}
                      aria-haspopup="dialog"
                      aria-expanded={openFilter?.col === colIndex}
                      data-active={filtered || undefined}
                      data-tbw-inner=""
                      onClick={(event) => {
                        const header = event.currentTarget.closest<HTMLElement>("[data-tbw-cell]");
                        if (openFilter?.col === colIndex) closeFilter(true);
                        else if (header) showFilter(colIndex, header);
                      }}
                    >
                      <FilterIcon />
                    </button>
                  )}
                  {resizable && (
                    <ResizeHandle
                      label={messages.resizeHandle(column.header)}
                      valueText={messages.widthText(widths[colIndex]!)}
                      width={widths[colIndex]!}
                      min={min}
                      max={max}
                      onResize={(width) => resizeColumn(colIndex, width)}
                      onFit={() => fitColumn(colIndex)}
                    />
                  )}
                  {hint && <VisuallyHidden id={hintId}>{hint}</VisuallyHidden>}
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
                {totalCount === 0 ? messages.empty : messages.noMatches}
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
      </div>
      {openFilter && openColumn?.filter && (
        <FilterPopover
          kind={openColumn.filter}
          header={openColumn.header}
          filter={filters[openColumn.id]}
          values={filterValues}
          anchor={openFilter.anchor}
          messages={messages}
          onChange={(filter) => changeFilter(openColumn.id, filter)}
          onClose={closeFilter}
        />
      )}
    </>
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
 * - Columns with `filter` get a filter button (Alt+Down Arrow on the header);
 *   resize columns by dragging the header edge or with F2 and the arrow keys.
 * - Sort and filter changes are announced to screen readers.
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
