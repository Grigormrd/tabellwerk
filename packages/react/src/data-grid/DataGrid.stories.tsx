import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DataGrid } from "./DataGrid.tsx";
import { hundredThousandRows, makeRows, marketColumns, type MarketRow } from "./stories/data.ts";
import type { ColumnDef, SortState } from "./types.ts";

const smallRows = makeRows(200);

const meta = {
  title: "Components/DataGrid",
  component: DataGrid,
  // Documented in DataGrid.mdx instead of the generated page.
  tags: ["!autodocs"],
  parameters: { layout: "padded" },
  args: {
    "aria-label": "Market data",
    rows: smallRows,
    columns: marketColumns,
    style: { height: 420 },
  },
} satisfies Meta<typeof DataGrid<MarketRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 200 rows of synthetic market data. Click into the grid or press Tab, then
 * use the arrow keys. Enter on a header sorts.
 */
export const Basic: Story = {};

/**
 * 100,000 rows. Only the rows in view (plus a few above and below) are in
 * the DOM, so scrolling and keyboard navigation stay fast. Press Ctrl+End to
 * jump to the last row.
 */
export const HundredThousandRows: Story = {
  name: "100,000 rows",
  args: { rows: hundredThousandRows(), "aria-label": "Market data, 100,000 rows" },
  play: async ({ canvasElement }) => {
    const grid = within(canvasElement).getByRole("grid");
    await expect(grid).toHaveAttribute("aria-rowcount", "100001");
    await expect(grid.querySelectorAll('[role="row"]').length).toBeLessThan(40);
  },
};

/** Sorted by zone, then by price descending. Headers show the sort order. */
export const MultiColumnSort: Story = {
  args: {
    defaultSort: [
      { columnId: "zone", direction: "ascending" },
      { columnId: "price", direction: "descending" },
    ],
  },
  play: async ({ canvasElement }) => {
    const zone = within(canvasElement).getByRole("columnheader", { name: /Zone/ });
    await expect(zone).toHaveAttribute("aria-sort", "ascending");
  },
};

/** Clicking a header sorts and the change is announced. */
export const SortByClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const price = canvas.getByRole("columnheader", { name: /Price/ });
    await userEvent.click(price);
    await expect(price).toHaveAttribute("aria-sort", "ascending");
    const region = canvasElement.querySelector('[data-tbw-live="polite"]');
    await waitFor(() => expect(region).toHaveTextContent("Sorted by Price €/MWh, ascending"));
  },
};

/** The sort state lives in the parent component (controlled). */
export const ControlledSort: Story = {
  render: (args) => {
    const [sort, setSort] = useState<SortState>([{ columnId: "load", direction: "descending" }]);
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0 }}>
          Sort state:{" "}
          <code>
            {sort.length ? sort.map((s) => `${s.columnId} ${s.direction}`).join(", ") : "none"}
          </code>{" "}
          <button type="button" className="story-button" onClick={() => setSort([])}>
            Clear sort
          </button>
        </p>
        <DataGrid {...args} sort={sort} onSortChange={setSort} />
      </div>
    );
  },
};

interface Plant {
  name: string;
  source: string;
  capacity: number;
  url: string;
}

const plants: Plant[] = [
  { name: "Example Wind Park", source: "Wind", capacity: 320, url: "#wind" },
  { name: "Example Solar Field", source: "Solar", capacity: 180, url: "#solar" },
  { name: "Example Hydro Station", source: "Hydro", capacity: 95, url: "#hydro" },
];

const plantColumns: ColumnDef<Plant>[] = [
  {
    id: "name",
    header: "Plant",
    width: 260,
    cell: ({ row }) => <a href={row.url}>{row.name}</a>,
  },
  { id: "source", header: "Source", width: 140 },
  { id: "capacity", header: "Capacity MW", width: 140, align: "end" },
  {
    id: "actions",
    header: "Actions",
    width: 200,
    sortable: false,
    cell: ({ row }) => (
      <span style={{ display: "flex", gap: 8 }}>
        <button type="button" className="story-button" aria-label={`Edit ${row.name}`}>
          Edit
        </button>
        <button type="button" className="story-button" aria-label={`Remove ${row.name}`}>
          Remove
        </button>
      </span>
    ),
  },
];

/**
 * Links and buttons inside cells are not tab stops. Press Enter or F2 on the
 * cell to reach them, Tab to move between them, Escape to return to the cell.
 */
export const InteractiveCells: StoryObj<typeof DataGrid<Plant>> = {
  args: {
    "aria-label": "Power plants",
    rows: plants,
    columns: plantColumns,
    rowHeight: 44,
    style: { height: 220 },
  },
};

/** No rows: the body says so instead of staying blank. */
export const Empty: Story = {
  args: { rows: [] },
};
