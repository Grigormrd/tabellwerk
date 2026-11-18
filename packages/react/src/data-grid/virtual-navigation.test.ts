import { describe, expect, it } from "vitest";
import { clampPosition, nextPosition, type GridBounds } from "./navigation.ts";
import { pageSize, scrollTopToReveal, visibleRange } from "./virtual.ts";

describe("visibleRange", () => {
  it("covers the viewport plus overscan", () => {
    // Rows of 36 px, viewport 360 px → rows 10..19 visible at scrollTop 360.
    expect(visibleRange(360, 360, 36, 100_000, 3)).toEqual({ start: 7, end: 23 });
  });

  it("handles partially visible rows at both edges", () => {
    expect(visibleRange(370, 360, 36, 1000, 0)).toEqual({ start: 10, end: 21 });
  });

  it("clamps at the start and the end", () => {
    expect(visibleRange(0, 360, 36, 100_000, 5)).toEqual({ start: 0, end: 15 });
    expect(visibleRange(36 * 99_990, 360, 36, 100_000, 5)).toEqual({ start: 99_985, end: 100_000 });
    expect(visibleRange(-50, 360, 36, 3, 5)).toEqual({ start: 0, end: 3 });
  });

  it("renders at least one row before the viewport is measured, none without rows", () => {
    expect(visibleRange(0, 0, 36, 10, 0)).toEqual({ start: 0, end: 1 });
    expect(visibleRange(0, 360, 36, 0, 5)).toEqual({ start: 0, end: 0 });
  });
});

describe("scrollTopToReveal", () => {
  it("does not scroll when the row is fully visible", () => {
    expect(scrollTopToReveal(12, 36, 360, 360)).toBe(360);
  });

  it("aligns the row to the top or the bottom edge, whichever is closer", () => {
    expect(scrollTopToReveal(5, 36, 360, 360)).toBe(180);
    expect(scrollTopToReveal(25, 36, 360, 360)).toBe(26 * 36 - 360);
    expect(scrollTopToReveal(0, 36, 1000, 360)).toBe(0);
  });
});

describe("pageSize", () => {
  it("keeps one row of overlap and never returns zero", () => {
    expect(pageSize(360, 36)).toBe(9);
    expect(pageSize(20, 36)).toBe(1);
  });
});

describe("nextPosition", () => {
  // Header row + 100 data rows, 5 columns.
  const bounds: GridBounds = { rowCount: 101, colCount: 5, pageSize: 10 };
  const at = (row: number, col: number) => ({ row, col });

  it.each([
    ["ArrowRight", at(3, 2), at(3, 3)],
    ["ArrowRight", at(3, 4), at(3, 4)],
    ["ArrowLeft", at(3, 2), at(3, 1)],
    ["ArrowLeft", at(3, 0), at(3, 0)],
    ["ArrowDown", at(3, 2), at(4, 2)],
    ["ArrowDown", at(100, 2), at(100, 2)],
    ["ArrowUp", at(1, 2), at(0, 2)],
    ["ArrowUp", at(0, 2), at(0, 2)],
    ["Home", at(30, 3), at(30, 0)],
    ["End", at(30, 1), at(30, 4)],
    ["PageDown", at(3, 1), at(13, 1)],
    ["PageDown", at(95, 1), at(100, 1)],
    ["PageDown", at(0, 1), at(10, 1)],
    ["PageUp", at(30, 1), at(20, 1)],
    ["PageUp", at(5, 1), at(1, 1)],
    ["PageUp", at(0, 1), at(0, 1)],
  ])("%s from %o goes to %o", (key, from, to) => {
    expect(nextPosition(from, { key }, bounds)).toEqual(to);
  });

  it("jumps to the corners with Ctrl or Cmd + Home/End", () => {
    expect(nextPosition(at(30, 3), { key: "Home", ctrlKey: true }, bounds)).toEqual(at(0, 0));
    expect(nextPosition(at(30, 1), { key: "End", ctrlKey: true }, bounds)).toEqual(at(100, 4));
    expect(nextPosition(at(30, 1), { key: "End", metaKey: true }, bounds)).toEqual(at(100, 4));
  });

  it("ignores other keys", () => {
    expect(nextPosition(at(1, 1), { key: "a" }, bounds)).toBeNull();
    expect(nextPosition(at(1, 1), { key: "Tab" }, bounds)).toBeNull();
  });

  it("stays in the header when there are no data rows", () => {
    const headerOnly = { rowCount: 1, colCount: 3, pageSize: 10 };
    expect(nextPosition(at(0, 1), { key: "ArrowDown" }, headerOnly)).toEqual(at(0, 1));
    expect(nextPosition(at(0, 1), { key: "PageDown" }, headerOnly)).toEqual(at(0, 1));
    expect(nextPosition(at(0, 1), { key: "End", ctrlKey: true }, headerOnly)).toEqual(at(0, 2));
  });

  it("clamps a position after the data shrank", () => {
    expect(clampPosition(at(500, 9), bounds)).toEqual(at(100, 4));
  });
});
