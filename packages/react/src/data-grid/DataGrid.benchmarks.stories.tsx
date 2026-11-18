// Stories used by the performance tests (e2e/perf.spec.ts). They render the
// same 100,000 synthetic rows with Tabellwerk's DataGrid and, for comparison,
// with a minimal grid built on TanStack Virtual using the same markup and
// styles. Both mount on a button press, so the press measures the mount.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useRef, useState, type CSSProperties, type JSX } from "react";
import { DataGrid } from "./DataGrid.tsx";
import { hundredThousandRows, marketColumns, type MarketRow } from "./stories/data.ts";

const ROW_HEIGHT = 36;
const OVERSCAN = 6;
const rows = hundredThousandRows();

const template = marketColumns.map((c) => `${c.width ?? 160}px`).join(" ");
const width = marketColumns.reduce((sum, c) => sum + (c.width ?? 160), 0);
const gridStyle = {
  height: 480,
  "--tbw-grid-template": template,
  "--tbw-grid-width": `${width}px`,
  "--tbw-grid-row-height": `${ROW_HEIGHT}px`,
} as CSSProperties;

const TanStackRow = memo(function TanStackRow({
  row,
  index,
}: {
  row: MarketRow;
  index: number;
}): JSX.Element {
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      className="tbw-grid__row"
      style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
    >
      {marketColumns.map((column, col) => {
        const value = row[column.id as keyof MarketRow];
        return (
          <div
            key={column.id}
            role="gridcell"
            aria-colindex={col + 1}
            tabIndex={-1}
            className="tbw-grid__cell"
            data-align={column.align ?? "start"}
          >
            <span className="tbw-grid__text">
              {column.format ? column.format(value) : String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/** Minimal virtualised grid with TanStack Virtual, for comparison only. */
function TanStackGrid(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions that cannot be memoised safely; this
  // component is a benchmark baseline and is not compiled by React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => ref.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });
  return (
    <div
      ref={ref}
      role="grid"
      aria-label="Market data (TanStack Virtual)"
      aria-rowcount={rows.length + 1}
      className="tbw-grid"
      style={gridStyle}
    >
      <div role="rowgroup" className="tbw-grid__head">
        <div role="row" aria-rowindex={1} className="tbw-grid__header-row">
          {marketColumns.map((column, col) => (
            <div
              key={column.id}
              role="columnheader"
              aria-colindex={col + 1}
              className="tbw-grid__header-cell"
              data-align={column.align ?? "start"}
            >
              <span className="tbw-grid__text">{column.header}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        role="rowgroup"
        className="tbw-grid__body"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <TanStackRow key={item.key} row={rows[item.index]!} index={item.index} />
        ))}
      </div>
    </div>
  );
}

function MountBenchmark({ variant }: { variant: "tabellwerk" | "tanstack" }): JSX.Element {
  const [mounted, setMounted] = useState(false);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0 }}>
        <button type="button" className="story-button" onClick={() => setMounted((m) => !m)}>
          {mounted ? "Unmount grid" : "Mount grid"}
        </button>
      </p>
      {mounted &&
        (variant === "tabellwerk" ? (
          <DataGrid
            aria-label="Market data, 100,000 rows"
            rows={rows}
            columns={marketColumns}
            rowHeight={ROW_HEIGHT}
            overscan={OVERSCAN}
            style={{ height: 480 }}
          />
        ) : (
          <TanStackGrid />
        ))}
    </div>
  );
}

const meta = {
  title: "Benchmarks/DataGrid",
  tags: ["skip-e2e", "!autodocs"],
  parameters: {
    docs: { disable: true },
    // The TanStack baseline is not a Tabellwerk component; axe runs on the
    // real grid in the component stories.
    a11y: { test: "off" },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mounts Tabellwerk's DataGrid with 100,000 rows on button press. */
export const Tabellwerk: Story = {
  render: () => <MountBenchmark variant="tabellwerk" />,
};

/** The same data and markup with TanStack Virtual, as a reference. */
export const TanStackVirtual: Story = {
  name: "TanStack Virtual (reference)",
  render: () => <MountBenchmark variant="tanstack" />,
};
