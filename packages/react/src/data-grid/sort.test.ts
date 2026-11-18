import { describe, expect, it } from "vitest";
import { sortPermutation, toggleSort } from "./sort.ts";
import type { ColumnDef, SortState } from "./types.ts";

interface Row {
  name: string | null;
  price: number | null;
  day: Date | null;
  ok: boolean;
}

const rows: Row[] = [
  { name: "Wind", price: 12, day: new Date("2026-11-03"), ok: true },
  { name: "solar", price: null, day: new Date("2026-11-01"), ok: false },
  { name: "Gas", price: 80, day: null, ok: true },
  { name: null, price: 12, day: new Date("2026-11-02"), ok: false },
  { name: "Biomass 10", price: -5, day: new Date("2026-11-02"), ok: true },
  { name: "Biomass 9", price: 80, day: new Date("2026-11-04"), ok: false },
];

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name" },
  { id: "price", header: "Price" },
  { id: "day", header: "Day" },
  { id: "ok", header: "OK" },
];

const order = (sort: SortState) =>
  Array.from(sortPermutation(rows, columns, sort)).map((i) => rows[i]!.name);

describe("toggleSort", () => {
  it("cycles none → ascending → descending → none", () => {
    let state: SortState = [];
    state = toggleSort(state, "price");
    expect(state).toEqual([{ columnId: "price", direction: "ascending" }]);
    state = toggleSort(state, "price");
    expect(state).toEqual([{ columnId: "price", direction: "descending" }]);
    expect(toggleSort(state, "price")).toEqual([]);
  });

  it("replaces the sort without multi", () => {
    const state = toggleSort([{ columnId: "price", direction: "ascending" }], "name");
    expect(state).toEqual([{ columnId: "name", direction: "ascending" }]);
  });

  it("appends, updates in place and removes with multi", () => {
    let state: SortState = [{ columnId: "price", direction: "ascending" }];
    state = toggleSort(state, "name", true);
    expect(state.map((d) => d.columnId)).toEqual(["price", "name"]);
    state = toggleSort(state, "price", true);
    expect(state).toEqual([
      { columnId: "price", direction: "descending" },
      { columnId: "name", direction: "ascending" },
    ]);
    state = toggleSort(state, "price", true);
    expect(state).toEqual([{ columnId: "name", direction: "ascending" }]);
  });
});

describe("sortPermutation", () => {
  it("keeps the original order without sort", () => {
    expect(Array.from(sortPermutation(rows, columns, []))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("sorts strings with natural, case-insensitive order and empty values last", () => {
    expect(order([{ columnId: "name", direction: "ascending" }])).toEqual([
      "Biomass 9",
      "Biomass 10",
      "Gas",
      "solar",
      "Wind",
      null,
    ]);
  });

  it("keeps empty values last when descending", () => {
    expect(order([{ columnId: "name", direction: "descending" }]).at(-1)).toBeNull();
    expect(order([{ columnId: "price", direction: "descending" }]).at(-1)).toBe("solar");
  });

  it("sorts numbers, dates and booleans", () => {
    expect(order([{ columnId: "price", direction: "ascending" }])).toEqual([
      "Biomass 10",
      "Wind",
      null,
      "Gas",
      "Biomass 9",
      "solar",
    ]);
    expect(order([{ columnId: "day", direction: "ascending" }])).toEqual([
      "solar",
      null,
      "Biomass 10",
      "Wind",
      "Biomass 9",
      "Gas",
    ]);
    expect(order([{ columnId: "ok", direction: "ascending" }]).slice(0, 3)).toEqual([
      "solar",
      null,
      "Biomass 9",
    ]);
  });

  it("is stable and breaks ties with the next criterion", () => {
    // Price ties: 12 (Wind, null name), 80 (Gas, Biomass 9).
    expect(order([{ columnId: "price", direction: "descending" }])).toEqual([
      "Gas",
      "Biomass 9",
      "Wind",
      null,
      "Biomass 10",
      "solar",
    ]);
    expect(
      order([
        { columnId: "price", direction: "descending" },
        { columnId: "name", direction: "ascending" },
      ]),
    ).toEqual(["Biomass 9", "Gas", "Wind", null, "Biomass 10", "solar"]);
  });

  it("uses a custom compare function and ignores unknown or unsortable columns", () => {
    const byLength: ColumnDef<Row> = {
      id: "name",
      header: "Name",
      compare: (a, b) => String(a).length - String(b).length,
    };
    expect(
      Array.from(sortPermutation(rows, [byLength], [{ columnId: "name", direction: "ascending" }]))
        .map((i) => rows[i]!.name)
        .slice(0, 2),
    ).toEqual(["Gas", "Wind"]);
    expect(
      Array.from(sortPermutation(rows, columns, [{ columnId: "missing", direction: "ascending" }])),
    ).toEqual([0, 1, 2, 3, 4, 5]);
    const locked = columns.map((c) => ({ ...c, sortable: false }));
    expect(
      Array.from(sortPermutation(rows, locked, [{ columnId: "price", direction: "ascending" }])),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("matches a reference sort on 10,000 random rows", () => {
    const random = mulberry32(42);
    const many = Array.from({ length: 10_000 }, () => ({
      a: Math.floor(random() * 50),
      b: random() < 0.05 ? null : Math.round(random() * 1000) / 10,
    }));
    const cols: ColumnDef<(typeof many)[number]>[] = [
      { id: "a", header: "A" },
      { id: "b", header: "B" },
    ];
    const sort: SortState = [
      { columnId: "a", direction: "descending" },
      { columnId: "b", direction: "ascending" },
    ];
    const actual = Array.from(sortPermutation(many, cols, sort));
    const expected = many
      .map((_, i) => i)
      .sort((x, y) => {
        const p = many[x]!;
        const q = many[y]!;
        if (p.a !== q.a) return q.a - p.a;
        if (p.b === null || q.b === null) return p.b === q.b ? x - y : p.b === null ? 1 : -1;
        return p.b - q.b || x - y;
      });
    expect(actual).toEqual(expected);
  });
});

describe("sortPermutation with one column (native path)", () => {
  const random = mulberry32(7);
  const many = Array.from({ length: 20_000 }, (_, i) => ({
    n: random() < 0.03 ? null : Math.round(random() * 200) - 100,
    s: random() < 0.03 ? null : ["wind", "Wind", "solar", "Solar 2", "solar 10"][i % 5]!,
    d: random() < 0.03 ? null : new Date(Date.UTC(2026, 0, 1 + Math.floor(random() * 60))),
  }));
  type Item = (typeof many)[number];
  const cols: ColumnDef<Item>[] = [
    { id: "n", header: "N" },
    { id: "s", header: "S" },
    { id: "d", header: "D" },
  ];
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const key = (item: Item, id: "n" | "s" | "d") => item[id];
  const compareValues = (a: NonNullable<Item["n" | "s" | "d"]>, b: typeof a) =>
    typeof a === "string"
      ? collator.compare(a, b as string)
      : a instanceof Date
        ? a.getTime() - (b as Date).getTime()
        : (a as number) - (b as number);

  it.each([
    ["n", "ascending"],
    ["n", "descending"],
    ["s", "ascending"],
    ["s", "descending"],
    ["d", "ascending"],
    ["d", "descending"],
  ] as const)("%s %s matches a stable reference sort with empty values last", (id, direction) => {
    const sign = direction === "ascending" ? 1 : -1;
    const expected = many
      .map((_, i) => i)
      .sort((x, y) => {
        const a = key(many[x]!, id);
        const b = key(many[y]!, id);
        if (a === null || b === null) return a === b ? x - y : a === null ? 1 : -1;
        return sign * compareValues(a, b) || x - y;
      });
    expect(Array.from(sortPermutation(many, cols, [{ columnId: id, direction }]))).toEqual(
      expected,
    );
  });
});

describe("sortPermutation with awkward numbers", () => {
  const random = mulberry32(99);
  const special = [0, -0, Infinity, -Infinity, 1e-300, -1e-300, 1e300, -1e300, 2 ** 53, -(2 ** 53)];
  const many = Array.from({ length: 30_000 }, (_, i) => ({
    x:
      i % 50 === 0
        ? null
        : i % 7 === 0
          ? special[i % special.length]!
          : (random() - 0.5) * 10 ** Math.floor(random() * 12 - 6),
    day: new Date(Date.UTC(2020, 0, 1) + Math.floor(random() * 400) * 86_400_000),
  }));
  type Item = (typeof many)[number];
  const cols: ColumnDef<Item>[] = [
    { id: "x", header: "X" },
    { id: "day", header: "Day" },
  ];

  const reference = (sort: SortState) =>
    many
      .map((_, i) => i)
      .sort((p, q) => {
        for (const { columnId, direction } of sort) {
          const sign = direction === "ascending" ? 1 : -1;
          const a = columnId === "x" ? many[p]!.x : many[p]!.day.getTime();
          const b = columnId === "x" ? many[q]!.x : many[q]!.day.getTime();
          if (a === null || b === null) {
            if (a === b) continue;
            return a === null ? 1 : -1;
          }
          if (a !== b) return sign * (a < b ? -1 : 1);
        }
        return p - q;
      });

  it.each<SortState>([
    [{ columnId: "x", direction: "ascending" }],
    [{ columnId: "x", direction: "descending" }],
    [
      { columnId: "day", direction: "descending" },
      { columnId: "x", direction: "ascending" },
    ],
    [
      { columnId: "x", direction: "descending" },
      { columnId: "day", direction: "ascending" },
    ],
  ])("matches the reference for %j", (...sort) => {
    expect(Array.from(sortPermutation(many, cols, sort))).toEqual(reference(sort));
  });

  it("treats -0 and 0 as equal (stable order)", () => {
    const zeros = [{ x: 0 }, { x: -0 }, { x: 0 }, { x: -0 }];
    expect(
      Array.from(
        sortPermutation(
          zeros,
          [{ id: "x", header: "X" }],
          [{ columnId: "x", direction: "descending" }],
        ),
      ),
    ).toEqual([0, 1, 2, 3]);
  });
});

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
