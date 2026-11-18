// Keyboard and pointer behaviour in a real browser. Keys are sent with
// `userEvent` from `vitest/browser`, which goes through Playwright and the
// browser's own input handling, so focus moves exactly as it would for a user.

import { useState, type JSX } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DataGrid, type DataGridProps } from "./DataGrid.tsx";
import { makeRows, marketColumns, type MarketRow } from "./stories/data.ts";
import type { ColumnDef, SortState } from "./types.ts";

const ROW_HEIGHT = 36;
const HEIGHT = 36 * 11 + 2; // header + 10 body rows + borders
const rows100k = makeRows(100_000);
const rows50 = makeRows(50);

function Harness(props: Partial<DataGridProps<MarketRow>>): JSX.Element {
  return (
    <div>
      <button type="button">Before</button>
      <DataGrid
        aria-label="Market data"
        rows={rows50}
        columns={marketColumns}
        rowHeight={ROW_HEIGHT}
        style={{ height: HEIGHT, width: 700 }}
        {...props}
      />
      <button type="button">After</button>
    </div>
  );
}

const grid = () => document.querySelector<HTMLElement>('[role="grid"]')!;
const focused = () => {
  const cell = document.activeElement as HTMLElement;
  return { row: Number(cell.dataset["tbwRow"]), col: Number(cell.dataset["tbwCol"]) };
};
const politeText = () => document.querySelector('[data-tbw-live="polite"]')?.textContent;

async function focusGrid() {
  await userEvent.keyboard("{Tab}{Tab}");
  expect(focused()).toEqual({ row: 0, col: 0 });
}

describe("DataGrid structure", () => {
  it("exposes the grid, its size and row and column indexes", async () => {
    const screen = await render(<Harness rows={rows100k} />);
    const element = screen.getByRole("grid", { name: "Market data" });
    await expect.element(element).toHaveAttribute("aria-rowcount", "100001");
    await expect.element(element).toHaveAttribute("aria-colcount", String(marketColumns.length));
    const headers = screen.getByRole("columnheader").elements();
    expect(headers.map((h) => h.getAttribute("aria-colindex"))).toEqual(
      marketColumns.map((_, i) => String(i + 1)),
    );
    const firstBodyRow = grid().querySelector('[role="rowgroup"] + [role="rowgroup"] [role="row"]');
    expect(firstBodyRow?.getAttribute("aria-rowindex")).toBe("2");
  });

  it("renders only the visible rows plus overscan for 100,000 rows", async () => {
    await render(<Harness rows={rows100k} overscan={6} />);
    // 10 visible body rows + 6 overscan below (none above at the top) + header.
    const rendered = grid().querySelectorAll('[role="row"]').length;
    expect(rendered).toBeLessThanOrEqual(1 + 11 + 6);
    grid().scrollTop = 50_000 * ROW_HEIGHT;
    await expect.poll(() => grid().querySelector('[aria-rowindex="50002"]')).not.toBeNull();
    expect(grid().querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(1 + 11 + 12 + 1);
  });

  it("handles 50 columns: renders them all and End reaches the last one", async () => {
    type Wide = Record<string, number>;
    const wideColumns: ColumnDef<Wide>[] = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      header: `Column ${i + 1}`,
      width: 110,
      align: "end",
    }));
    const wideRows: Wide[] = Array.from({ length: 1000 }, (_, r) =>
      Object.fromEntries(wideColumns.map((c, i) => [c.id, r * 100 + i])),
    );
    await render(
      <DataGrid
        aria-label="Wide"
        rows={wideRows}
        columns={wideColumns}
        style={{ height: HEIGHT, width: 700 }}
      />,
    );
    await userEvent.keyboard("{Tab}{ArrowDown}{End}");
    expect(focused()).toEqual({ row: 1, col: 49 });
    expect(document.activeElement?.getAttribute("aria-colindex")).toBe("50");
    expect(document.activeElement?.textContent).toBe("49");
    const cell = (document.activeElement as HTMLElement).getBoundingClientRect();
    expect(cell.right).toBeLessThanOrEqual(grid().getBoundingClientRect().right);
    await userEvent.keyboard("{Home}");
    expect(grid().scrollLeft).toBe(0);
  });

  it("shows a message when there are no rows", async () => {
    const screen = await render(<Harness rows={[]} />);
    await expect.element(screen.getByRole("gridcell", { name: "No rows" })).toBeVisible();
  });
});

describe("DataGrid keyboard navigation", () => {
  it("has a single tab stop", async () => {
    const screen = await render(<Harness />);
    await focusGrid();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button", { name: "After" })).toHaveFocus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(focused()).toEqual({ row: 0, col: 0 });
  });

  it("returns to the last active cell when tabbing back in", async () => {
    await render(<Harness />);
    await focusGrid();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}{Tab}{Shift>}{Tab}{/Shift}");
    expect(focused()).toEqual({ row: 2, col: 1 });
  });

  it("ArrowRight / ArrowLeft move between columns and stop at the edges", async () => {
    await render(<Harness />);
    await focusGrid();
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toEqual({ row: 0, col: 0 });
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(focused()).toEqual({ row: 0, col: 2 });
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toEqual({ row: 0, col: 1 });
  });

  it("ArrowDown / ArrowUp move between rows, from the header into the body and back", async () => {
    await render(<Harness />);
    await focusGrid();
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()).toEqual({ row: 0, col: 0 });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(focused()).toEqual({ row: 3, col: 0 });
    expect(document.activeElement?.getAttribute("role")).toBe("gridcell");
    expect(document.activeElement?.closest('[role="row"]')?.getAttribute("aria-rowindex")).toBe(
      "4",
    );
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()).toEqual({ row: 2, col: 0 });
  });

  it("ArrowDown scrolls the focused row into view", async () => {
    await render(<Harness />);
    await focusGrid();
    for (let i = 0; i < 15; i++) await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toEqual({ row: 15, col: 0 });
    const cell = (document.activeElement as HTMLElement).getBoundingClientRect();
    const box = grid().getBoundingClientRect();
    expect(cell.bottom).toBeLessThanOrEqual(box.bottom);
    expect(cell.top).toBeGreaterThanOrEqual(box.top + ROW_HEIGHT - 1);
  });

  it("Home / End move to the first and last cell of the row", async () => {
    await render(<Harness />);
    await focusGrid();
    await userEvent.keyboard("{ArrowDown}{End}");
    expect(focused()).toEqual({ row: 1, col: marketColumns.length - 1 });
    await userEvent.keyboard("{Home}");
    expect(focused()).toEqual({ row: 1, col: 0 });
  });

  it("End scrolls the last column into view horizontally", async () => {
    await render(<Harness />);
    await focusGrid();
    await userEvent.keyboard("{End}");
    const cell = (document.activeElement as HTMLElement).getBoundingClientRect();
    expect(cell.right).toBeLessThanOrEqual(grid().getBoundingClientRect().right);
    expect(grid().scrollLeft).toBeGreaterThan(0);
  });

  it("Ctrl+End / Ctrl+Home jump to the last and first cell of the grid, 100,000 rows away", async () => {
    await render(<Harness rows={rows100k} />);
    await focusGrid();
    await userEvent.keyboard("{Control>}{End}{/Control}");
    expect(focused()).toEqual({ row: 100_000, col: marketColumns.length - 1 });
    expect(document.activeElement?.closest('[role="row"]')?.getAttribute("aria-rowindex")).toBe(
      "100001",
    );
    expect(document.activeElement?.textContent).toBe(
      marketColumns.at(-1)!.format!(rows100k.at(-1)!.share),
    );
    await userEvent.keyboard("{Control>}{Home}{/Control}");
    expect(focused()).toEqual({ row: 0, col: 0 });
    expect(grid().scrollTop).toBe(0);
  });

  it("PageDown / PageUp move by one viewport minus one row", async () => {
    await render(<Harness rows={rows100k} />);
    await focusGrid();
    await userEvent.keyboard("{ArrowDown}{PageDown}");
    expect(focused()).toEqual({ row: 10, col: 0 });
    await userEvent.keyboard("{PageDown}");
    expect(focused()).toEqual({ row: 19, col: 0 });
    await userEvent.keyboard("{PageUp}{PageUp}{PageUp}");
    expect(focused()).toEqual({ row: 1, col: 0 });
  });

  it("keeps the focused cell in the DOM when it is scrolled far out of view", async () => {
    await render(<Harness rows={rows100k} />);
    await focusGrid();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const cell = document.activeElement;
    grid().scrollTop = 60_000 * ROW_HEIGHT;
    await expect.poll(() => grid().querySelector('[aria-rowindex="60002"]')).not.toBeNull();
    expect(document.activeElement).toBe(cell);
    expect(cell?.isConnected).toBe(true);
    // Navigation continues from the focused row, not from the scroll position.
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toEqual({ row: 3, col: 0 });
  });

  it("hands focus from the grid element to the active cell", async () => {
    await render(<Harness />);
    await focusGrid();
    await userEvent.keyboard("{ArrowDown}{ArrowRight}{Tab}");
    grid().focus();
    expect(focused()).toEqual({ row: 1, col: 1 });
  });

  it("moves the active cell to a clicked cell", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("gridcell", { name: "East" }).first().click();
    expect(document.activeElement?.getAttribute("role")).toBe("gridcell");
    const position = focused();
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toEqual({ row: position.row, col: position.col + 1 });
  });
});

describe("DataGrid sorting", () => {
  const priceColumn = marketColumns.findIndex((c) => c.id === "price");
  const zoneColumn = marketColumns.findIndex((c) => c.id === "zone");
  const sortedPrices = () =>
    [...grid().querySelectorAll(`[role="row"] [data-tbw-col="${priceColumn}"][role="gridcell"]`)]
      .sort(
        (a, b) =>
          Number(a.closest("[aria-rowindex]")!.getAttribute("aria-rowindex")) -
          Number(b.closest("[aria-rowindex]")!.getAttribute("aria-rowindex")),
      )
      .slice(0, 5)
      .map((cell) => Number(cell.textContent!.replace(/,/g, "")));

  it("Enter on a header cycles ascending → descending → none and announces it", async () => {
    const screen = await render(<Harness />);
    await focusGrid();
    for (let i = 0; i < priceColumn; i++) await userEvent.keyboard("{ArrowRight}");
    const header = screen.getByRole("columnheader", { name: /Price/ });

    await userEvent.keyboard("{Enter}");
    await expect.element(header).toHaveAttribute("aria-sort", "ascending");
    const ascending = sortedPrices();
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    await expect.poll(politeText).toBe("Sorted by Price €/MWh, ascending");

    await userEvent.keyboard("{Enter}");
    await expect.element(header).toHaveAttribute("aria-sort", "descending");
    const descending = sortedPrices();
    expect(descending).toEqual([...descending].sort((a, b) => b - a));
    await expect.poll(politeText).toBe("Sorted by Price €/MWh, descending");

    await userEvent.keyboard("{Enter}");
    await expect.element(header).not.toHaveAttribute("aria-sort");
    await expect.poll(politeText).toBe("Not sorted");
    // Focus stays on the header throughout.
    expect(focused()).toEqual({ row: 0, col: priceColumn });
  });

  it("Space sorts like Enter", async () => {
    const screen = await render(<Harness />);
    await focusGrid();
    for (let i = 0; i < priceColumn; i++) await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");
    await expect
      .element(screen.getByRole("columnheader", { name: /Price/ }))
      .toHaveAttribute("aria-sort", "ascending");
  });

  it("Shift+Enter adds a column to the sort", async () => {
    const screen = await render(<Harness />);
    await focusGrid();
    for (let i = 0; i < zoneColumn; i++) await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Enter}");
    for (let i = zoneColumn; i < priceColumn; i++) await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await expect.poll(politeText).toBe("Sorted by Zone, ascending, then by Price €/MWh, ascending");
    // aria-sort only on the primary column; the secondary is described in text.
    await expect
      .element(screen.getByRole("columnheader", { name: /Zone/ }))
      .toHaveAttribute("aria-sort", "ascending");
    const price = screen.getByRole("columnheader", { name: /Price/ });
    await expect.element(price).not.toHaveAttribute("aria-sort");
    // Browsers insert a space before the visually hidden (absolutely positioned) suffix.
    await expect.element(price).toHaveAccessibleName(/^Price €\/MWh ?, sort 2, ascending$/);
  });

  it("clicking a header sorts, Shift+click adds to the sort", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("columnheader", { name: /Zone/ }).click();
    await screen.getByRole("columnheader", { name: /Price/ }).click({ modifiers: ["Shift"] });
    await expect.poll(politeText).toBe("Sorted by Zone, ascending, then by Price €/MWh, ascending");
  });

  it("does not sort columns marked sortable: false", async () => {
    const columns = marketColumns.map((c) => (c.id === "id" ? { ...c, sortable: false } : c));
    const screen = await render(<Harness columns={columns} />);
    await focusGrid();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("columnheader", { name: "#" }))
      .not.toHaveAttribute("aria-sort");
  });

  it("describes how to sort on sortable headers", async () => {
    const screen = await render(<Harness />);
    await expect
      .element(screen.getByRole("columnheader", { name: /Price/ }))
      .toHaveAccessibleDescription("Press Enter to sort. Shift+Enter adds the column to the sort.");
  });

  it("supports controlled sort state", async () => {
    function Controlled(): JSX.Element {
      const [sort, setSort] = useState<SortState>([]);
      return (
        <>
          <output>{sort.map((s) => `${s.columnId}:${s.direction}`).join(",") || "none"}</output>
          <Harness sort={sort} onSortChange={setSort} />
        </>
      );
    }
    const screen = await render(<Controlled />);
    await screen.getByRole("columnheader", { name: /Load/ }).click();
    await expect.element(screen.getByRole("status")).toHaveTextContent("load:ascending");
  });
});

describe("DataGrid interactive cells", () => {
  interface LinkRow {
    name: string;
    url: string;
  }
  const linkRows: LinkRow[] = [
    { name: "First", url: "#first" },
    { name: "Second", url: "#second" },
  ];
  const linkColumns: ColumnDef<LinkRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <span>
          <a href={row.url}>{row.name}</a> <button type="button">Edit {row.name}</button>
        </span>
      ),
    },
    { id: "url", header: "URL" },
  ];

  function LinkGrid(): JSX.Element {
    return (
      <div>
        <button type="button">Before</button>
        <DataGrid
          aria-label="Links"
          rows={linkRows}
          columns={linkColumns}
          style={{ height: 200 }}
        />
        <button type="button">After</button>
      </div>
    );
  }

  it("removes cell content from the tab order", async () => {
    const screen = await render(<LinkGrid />);
    await userEvent.keyboard("{Tab}{Tab}{Tab}");
    await expect.element(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("Enter moves into the cell, Tab cycles inside it, Escape returns to the cell", async () => {
    const screen = await render(<LinkGrid />);
    await userEvent.keyboard("{Tab}{Tab}{ArrowDown}");
    expect(focused()).toEqual({ row: 1, col: 0 });
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("link", { name: "First" })).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button", { name: "Edit First" })).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("link", { name: "First" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(focused()).toEqual({ row: 1, col: 0 });
  });

  it("F2 moves into the cell as well", async () => {
    const screen = await render(<LinkGrid />);
    await userEvent.keyboard("{Tab}{Tab}{ArrowDown}{ArrowDown}{F2}");
    await expect.element(screen.getByRole("link", { name: "Second" })).toHaveFocus();
  });

  it("arrow keys inside the cell content do not move the grid focus", async () => {
    const screen = await render(<LinkGrid />);
    await userEvent.keyboard("{Tab}{Tab}{ArrowDown}{Enter}{ArrowDown}");
    await expect.element(screen.getByRole("link", { name: "First" })).toHaveFocus();
  });
});

describe("DataGrid render budget", () => {
  it("re-renders only the two affected cells when focus moves", async () => {
    let calls = 0;
    const counted = marketColumns.map((c) =>
      c.id === "zone"
        ? {
            ...c,
            cell: ({ value }: { value: unknown }) => {
              calls++;
              return <span>{String(value)}</span>;
            },
          }
        : c,
    );
    const zoneColumn = counted.findIndex((c) => c.id === "zone");
    await render(<Harness rows={rows100k} columns={counted} />);
    await focusGrid();
    for (let i = 0; i < zoneColumn; i++) await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowDown}");
    calls = 0;
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toEqual({ row: 2, col: zoneColumn });
    expect(calls).toBeLessThanOrEqual(2);
  });

  it("renders only rows that enter the view while scrolling", async () => {
    let calls = 0;
    const counted = marketColumns.map((c) =>
      c.id === "zone"
        ? {
            ...c,
            cell: ({ value }: { value: unknown }) => {
              calls++;
              return <span>{String(value)}</span>;
            },
          }
        : c,
    );
    await render(<Harness rows={rows100k} columns={counted} overscan={6} />);
    calls = 0;
    grid().scrollTop = 3 * ROW_HEIGHT;
    await expect.poll(() => grid().querySelector('[aria-rowindex="21"]')).not.toBeNull();
    // Three rows scrolled → three new rows at the bottom.
    expect(calls).toBeLessThanOrEqual(3);
  });
});
