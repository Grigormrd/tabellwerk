// Filtering and column resizing with real keyboard, mouse and touch input.

import { useState, type JSX } from "react";
import { describe, expect, it } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DataGrid, type DataGridProps } from "./DataGrid.tsx";
import { makeRows, marketColumns, type MarketRow } from "./stories/data.ts";
import type { ColumnWidths, FilterState } from "./types.ts";

const rows = makeRows(300);
const col = (id: string) => marketColumns.findIndex((c) => c.id === id);

function Harness(props: Partial<DataGridProps<MarketRow>>): JSX.Element {
  return (
    <div>
      <button type="button">Before</button>
      <DataGrid
        aria-label="Market data"
        rows={rows}
        columns={marketColumns}
        style={{ height: 36 * 11 + 2, width: 900 }}
        {...props}
      />
      <button type="button">After</button>
    </div>
  );
}

const grid = () => document.querySelector<HTMLElement>('[role="grid"]')!;
const header = (id: string) =>
  grid().querySelector<HTMLElement>(`[data-tbw-row="0"][data-tbw-col="${col(id)}"]`)!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const politeText = () => document.querySelector('[data-tbw-live="polite"]')?.textContent;
const columnTexts = (id: string) =>
  [...grid().querySelectorAll<HTMLElement>(`[role="gridcell"][data-tbw-col="${col(id)}"]`)].map(
    (cell) => cell.textContent ?? "",
  );
const rowCount = () => Number(grid().getAttribute("aria-rowcount")) - 1;

async function focusHeader(id: string) {
  await userEvent.keyboard("{Tab}{Tab}");
  for (let i = 0; i < col(id); i++) await userEvent.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(header(id));
}

describe("DataGrid filtering", () => {
  it("Alt+Down Arrow opens the filter, the values combobox filters, Escape returns to the header", async () => {
    const screen = await render(<Harness />);
    await focusHeader("zone");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");

    const filter = screen.getByRole("dialog", { name: "Filter Zone" });
    await expect.element(filter).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Filter Zone" }))
      .toHaveAttribute("aria-expanded", "true");
    const values = screen.getByRole("combobox", { name: "Show rows with" });
    await expect.element(values).toHaveFocus();

    // The library's own multiple combobox: type, choose, choose another.
    await userEvent.keyboard("nor{ArrowDown}{Enter}");
    await expect.poll(() => new Set(columnTexts("zone"))).toEqual(new Set(["North"]));
    await userEvent.keyboard("sou{ArrowDown}{Enter}");
    await expect.poll(() => new Set(columnTexts("zone"))).toEqual(new Set(["North", "South"]));
    const expected = rows.filter((r) => r.zone === "North" || r.zone === "South").length;
    await expect.poll(() => rowCount()).toBe(expected);

    // First Escape closes the combobox list, the second closes the dialog.
    await userEvent.keyboard("{Escape}");
    expect(dialog()).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(header("zone"));
    // Browsers put a space before the visually hidden suffix.
    await expect
      .element(screen.getByRole("columnheader", { name: /^Zone ?, filtered$/ }))
      .toBeVisible();
    await expect.poll(politeText, { timeout: 3000 }).toBe(`${rowCount()} of 300 rows`);
  });

  it("text filter: typing filters as you go, Enter closes", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "Filter #" }).click();
    await expect.element(screen.getByRole("textbox", { name: "Contains" })).toHaveFocus();
    await userEvent.keyboard("29");
    await expect
      .poll(() => rowCount())
      .toBe(rows.filter((r) => String(r.id).includes("29")).length);
    expect(columnTexts("id").every((t) => t.includes("29"))).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(header("id"));
  });

  it("number filter: minimum and maximum", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "Filter Price €/MWh" }).click();
    await screen.getByRole("spinbutton", { name: "Minimum" }).fill("100");
    await screen.getByRole("spinbutton", { name: "Maximum" }).fill("120");
    const expected = rows.filter((r) => r.price >= 100 && r.price <= 120).length;
    await expect.poll(() => rowCount()).toBe(expected);
    const prices = columnTexts("price").map((t) => Number(t.replace(/,/g, "")));
    expect(prices.every((p) => p >= 100 && p <= 120)).toBe(true);
  });

  it("date filter: from and to, as UTC calendar dates", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "Filter Time (UTC)" }).click();
    await screen.getByLabelText("From").fill("2023-01-02");
    await screen.getByLabelText("To").fill("2023-01-02");
    // 300 quarter-hours from 2023-01-01 00:00 UTC: 96 of them on 2 January.
    await expect.poll(() => rowCount()).toBe(96);
    expect(columnTexts("time").every((t) => t.startsWith("2023-01-02"))).toBe(true);
  });

  it("removing the last value or Clear filter shows every row again", async () => {
    const screen = await render(
      <Harness defaultFilters={{ zone: { kind: "values", values: ["East"] } }} />,
    );
    expect(rowCount()).toBe(rows.filter((r) => r.zone === "East").length);
    await screen.getByRole("button", { name: "Filter Zone" }).click();
    await screen.getByRole("button", { name: "Remove East" }).click();
    await expect.poll(() => rowCount()).toBe(300);
    await expect.element(screen.getByRole("button", { name: "Clear filter" })).toBeDisabled();
  });

  it("says when filters match nothing", async () => {
    const screen = await render(
      <Harness defaultFilters={{ zone: { kind: "values", values: [] } }} />,
    );
    await expect
      .element(screen.getByRole("gridcell", { name: "No rows match the filters" }))
      .toBeVisible();
  });

  it("keeps focus inside the dialog and closes on a click outside without moving focus back", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "Filter Price €/MWh" }).click();
    const minimum = screen.getByRole("spinbutton", { name: "Minimum" });
    await expect.element(minimum).toHaveFocus();
    await userEvent.keyboard("{Tab}{Tab}{Tab}");
    // Minimum → Maximum → (Clear is disabled) Close → back to Minimum.
    await expect.element(minimum).toHaveFocus();
    await screen.getByRole("button", { name: "After" }).click();
    expect(dialog()).toBeNull();
    await expect.element(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("clicking the filter button does not sort, clicking it again closes", async () => {
    const screen = await render(<Harness />);
    const button = screen.getByRole("button", { name: "Filter Zone" });
    await button.click();
    await expect
      .element(screen.getByRole("columnheader", { name: "Zone" }))
      .not.toHaveAttribute("aria-sort");
    await button.click();
    expect(dialog()).toBeNull();
  });

  it("reports filter changes in controlled mode", async () => {
    function Controlled(): JSX.Element {
      const [filters, setFilters] = useState<FilterState>({
        price: { kind: "number", min: 150 },
      });
      return (
        <>
          <output>{JSON.stringify(filters)}</output>
          <Harness filters={filters} onFiltersChange={setFilters} />
        </>
      );
    }
    const screen = await render(<Controlled />);
    expect(rowCount()).toBe(rows.filter((r) => r.price >= 150).length);
    await screen.getByRole("button", { name: "Filter Price €/MWh" }).click();
    await screen.getByRole("button", { name: "Clear filter" }).click();
    await expect.element(screen.getByRole("status")).toHaveTextContent("{}");
    await expect.poll(() => rowCount()).toBe(300);
  });
});

describe("DataGrid header controls", () => {
  it("F2 moves into the header controls, Tab cycles, Escape returns", async () => {
    const screen = await render(<Harness />);
    await focusHeader("zone");
    await userEvent.keyboard("{F2}");
    await expect.element(screen.getByRole("button", { name: "Filter Zone" })).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("separator", { name: "Resize Zone" })).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button", { name: "Filter Zone" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(header("zone"));
  });

  it("header controls are not tab stops", async () => {
    const screen = await render(<Harness />);
    await userEvent.keyboard("{Tab}{Tab}{Tab}");
    await expect.element(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });
});

describe("DataGrid column resizing", () => {
  const separator = (name: string) =>
    document.querySelector<HTMLElement>(`[role="separator"][aria-label="Resize ${name}"]`)!;
  const width = (id: string) => header(id).getBoundingClientRect().width;

  it("arrow keys resize in steps of 8 (32 with Shift), Home and End jump to the limits", async () => {
    const screen = await render(<Harness />);
    await focusHeader("zone");
    await userEvent.keyboard("{F2}{Tab}");
    const handle = screen.getByRole("separator", { name: "Resize Zone" });
    await expect.element(handle).toHaveAttribute("aria-valuenow", "120");
    await expect.element(handle).toHaveAttribute("aria-valuetext", "120 pixels");

    await userEvent.keyboard("{ArrowRight}");
    await expect.element(handle).toHaveAttribute("aria-valuenow", "128");
    expect(width("zone")).toBe(128);
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    await expect.element(handle).toHaveAttribute("aria-valuenow", "96");
    await userEvent.keyboard("{Home}");
    await expect.element(handle).toHaveAttribute("aria-valuenow", "48");
    await userEvent.keyboard("{End}");
    await expect.element(handle).toHaveAttribute("aria-valuenow", "800");
    // Body cells follow the header.
    const cell = grid().querySelector<HTMLElement>(
      `[role="gridcell"][data-tbw-col="${col("zone")}"]`,
    )!;
    expect(cell.getBoundingClientRect().width).toBe(800);
  });

  it("drags with the mouse", async () => {
    await render(<Harness />);
    const handle = separator("Wind MW");
    const box = handle.getBoundingClientRect();
    await commands.pointerDrag({
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      dx: 60,
      pointer: "mouse",
    });
    await expect.poll(() => width("wind")).toBe(200);
    // The drag did not sort the column.
    expect(header("wind").getAttribute("aria-sort")).toBeNull();
  });

  it("drags with touch", async () => {
    await render(<Harness />);
    const handle = separator("Wind MW");
    const box = handle.getBoundingClientRect();
    await commands.pointerDrag({
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      dx: -40,
      pointer: "touch",
    });
    await expect.poll(() => width("wind")).toBe(100);
  });

  it("double click and Enter fit the column to its content", async () => {
    await render(<Harness />);
    await focusHeader("price");
    await userEvent.keyboard("{F2}{Tab}{End}");
    expect(width("price")).toBe(800);
    // The focused handle is scrolled back into view.
    await expect
      .poll(() => separator("Price €/MWh").getBoundingClientRect().right)
      .toBeLessThanOrEqual(grid().getBoundingClientRect().right);

    const box = separator("Price €/MWh").getBoundingClientRect();
    await commands.pointerDoubleClick({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    const fitted = width("price");
    expect(fitted).toBeLessThan(800);
    // The header and every visible price are still shown in full.
    for (const text of grid().querySelectorAll<HTMLElement>(
      `[data-tbw-col="${col("price")}"] .tbw-grid__text`,
    )) {
      expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
    }

    await userEvent.keyboard("{End}{Enter}");
    expect(width("price")).toBe(fitted);
  });

  it("does not re-render body cells while resizing", async () => {
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
    await render(<Harness columns={counted} />);
    await focusHeader("zone");
    await userEvent.keyboard("{F2}{Tab}");
    calls = 0;
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(width("zone")).toBe(144);
    expect(calls).toBe(0);
  });

  it("reports widths in controlled mode and respects column limits", async () => {
    function Controlled(): JSX.Element {
      const [widths, setWidths] = useState<ColumnWidths>({ zone: 200 });
      return (
        <>
          <output>{JSON.stringify(widths)}</output>
          <Harness
            columns={marketColumns.map((c) => (c.id === "zone" ? { ...c, minWidth: 150 } : c))}
            columnWidths={widths}
            onColumnWidthsChange={setWidths}
          />
        </>
      );
    }
    const screen = await render(<Controlled />);
    expect(width("zone")).toBe(200);
    await focusHeader("zone");
    await userEvent.keyboard("{F2}{Tab}{Home}");
    await expect.element(screen.getByRole("status")).toHaveTextContent('{"zone":150}');
    expect(width("zone")).toBe(150);
  });

  it("columns marked resizable: false have no handle", async () => {
    const screen = await render(
      <Harness columns={marketColumns.map((c) => ({ ...c, resizable: c.id !== "zone" }))} />,
    );
    await expect
      .element(screen.getByRole("separator", { name: "Resize Zone" }))
      .not.toBeInTheDocument();
  });
});
