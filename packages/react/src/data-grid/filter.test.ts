import { describe, expect, it } from "vitest";
import { applyMask, distinctValues, filterMask, isActive } from "./filter.ts";
import type { ColumnDef, FilterState } from "./types.ts";

interface Row {
  name: string | null;
  price: number | null;
  day: Date | null;
  zone: string;
}

const rows: Row[] = [
  { name: "Wind Park North", price: 12.5, day: new Date("2026-11-01T23:30:00Z"), zone: "North" },
  { name: "Solar Field", price: null, day: new Date("2026-11-02T10:00:00Z"), zone: "South" },
  { name: "Gas Plant", price: 80, day: null, zone: "East" },
  { name: null, price: -3, day: new Date("2026-11-03T00:00:00Z"), zone: "North" },
  { name: "wind farm", price: 40, day: new Date("2026-11-04T12:00:00Z"), zone: "West" },
];

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", filter: "text" },
  {
    id: "price",
    header: "Price",
    filter: "number",
    format: (v) => `${(v as number).toFixed(2)} €`,
  },
  { id: "day", header: "Day", filter: "date" },
  { id: "zone", header: "Zone", filter: "values" },
];

const names = (filters: FilterState) => {
  const mask = filterMask(rows, columns, filters);
  return rows.filter((_, i) => !mask || mask[i]).map((r) => r.name);
};

describe("filterMask", () => {
  it("returns null without active filters", () => {
    expect(filterMask(rows, columns, {})).toBeNull();
    expect(filterMask(rows, columns, { name: { kind: "text", query: "  " } })).toBeNull();
    expect(filterMask(rows, columns, { price: { kind: "number" } })).toBeNull();
    expect(filterMask(rows, columns, { missing: { kind: "text", query: "x" } })).toBeNull();
  });

  it("text: case-insensitive substring of the displayed text", () => {
    expect(names({ name: { kind: "text", query: "WIND" } })).toEqual([
      "Wind Park North",
      "wind farm",
    ]);
  });

  it("text filters use the column format", () => {
    const formatted: ColumnDef<Row>[] = [{ ...columns[1]!, filter: "text" }];
    const mask = filterMask(rows, formatted, { price: { kind: "text", query: "12.50 €" } });
    expect(Array.from(mask!)).toEqual([1, 0, 0, 0, 0]);
  });

  it("number: inclusive range, either bound optional, empty values excluded", () => {
    expect(names({ price: { kind: "number", min: 12.5, max: 40 } })).toEqual([
      "Wind Park North",
      "wind farm",
    ]);
    expect(names({ price: { kind: "number", max: 0 } })).toEqual([null]);
    expect(names({ price: { kind: "number", min: 50 } })).toEqual(["Gas Plant"]);
  });

  it("values: one of the selected values; an empty selection shows nothing", () => {
    expect(names({ zone: { kind: "values", values: ["North", "West"] } })).toEqual([
      "Wind Park North",
      null,
      "wind farm",
    ]);
    expect(names({ zone: { kind: "values", values: [] } })).toEqual([]);
  });

  it("date: inclusive range of UTC calendar dates", () => {
    expect(names({ day: { kind: "date", from: "2026-11-02", to: "2026-11-03" } })).toEqual([
      "Solar Field",
      null,
    ]);
    // 2026-11-01T23:30Z is still 1 November in UTC.
    expect(names({ day: { kind: "date", to: "2026-11-01" } })).toEqual(["Wind Park North"]);
    expect(names({ day: { kind: "date", from: "2026-11-04" } })).toEqual(["wind farm"]);
  });

  it("combines filters with AND", () => {
    expect(
      names({
        name: { kind: "text", query: "wind" },
        price: { kind: "number", min: 20 },
      }),
    ).toEqual(["wind farm"]);
  });

  it("sees new text when the rows change", () => {
    const first = [{ name: "alpha" }];
    const second = [{ name: "beta" }];
    const cols: ColumnDef<{ name: string }>[] = [{ id: "name", header: "N", filter: "text" }];
    expect(Array.from(filterMask(first, cols, { name: { kind: "text", query: "alp" } })!)).toEqual([
      1,
    ]);
    expect(Array.from(filterMask(second, cols, { name: { kind: "text", query: "alp" } })!)).toEqual(
      [0],
    );
  });
});

describe("applyMask", () => {
  it("keeps the display order and drops filtered rows", () => {
    const order = Uint32Array.from([4, 2, 0, 3, 1]);
    const mask = Uint8Array.from([1, 0, 1, 0, 1]);
    expect(Array.from(applyMask(order, mask))).toEqual([4, 2, 0]);
    expect(applyMask(order, null)).toBe(order);
  });
});

describe("isActive", () => {
  it("knows when a filter restricts nothing", () => {
    expect(isActive(undefined)).toBe(false);
    expect(isActive({ kind: "number", min: Number.NaN })).toBe(false);
    expect(isActive({ kind: "date", from: "" })).toBe(false);
    expect(isActive({ kind: "values", values: [] })).toBe(true);
  });
});

describe("distinctValues", () => {
  it("lists distinct display values in natural order, without empties", () => {
    expect(distinctValues(rows, columns[3]!)).toEqual(["East", "North", "South", "West"]);
    expect(distinctValues(rows, columns[0]!, 2)).toHaveLength(2);
  });
});
