// Synthetic, deterministic sample data for stories, tests and benchmarks.
// The shape resembles quarter-hourly electricity market data, but every value
// is generated from a seeded random number generator; none of it is real.

import type { ColumnDef } from "../types.ts";

export interface MarketRow {
  id: number;
  time: Date;
  zone: string;
  price: number;
  wind: number;
  solar: number;
  load: number;
  share: number;
}

const ZONES = ["North", "East", "South", "West", "Central"];
const START = Date.UTC(2023, 0, 1);
const QUARTER_HOUR = 15 * 60 * 1000;

export function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRows(count: number, seed = 1): MarketRow[] {
  const random = seededRandom(seed);
  const rows: MarketRow[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const time = new Date(START + i * QUARTER_HOUR);
    const hour = time.getUTCHours() + time.getUTCMinutes() / 60;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const wind = Math.round(random() * 30_000);
    const solar = Math.round(daylight * (20_000 + random() * 25_000));
    const load = Math.round(45_000 + daylight * 15_000 + random() * 8_000);
    rows[i] = {
      id: i + 1,
      time,
      zone: ZONES[Math.floor(random() * ZONES.length)]!,
      price: Math.round((140 - (wind + solar) / 500 + random() * 60) * 100) / 100,
      wind,
      solar,
      load,
      share: Math.min(1, (wind + solar) / load),
    };
  }
  return rows;
}

const integer = new Intl.NumberFormat("en-US");
const euro = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const formatTime = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 16).replace("T", " ") : "";

export const marketColumns: ColumnDef<MarketRow>[] = [
  { id: "id", header: "#", width: 100, align: "end", filter: "text" },
  { id: "time", header: "Time (UTC)", width: 180, format: formatTime, filter: "date" },
  { id: "zone", header: "Zone", width: 120, filter: "values" },
  {
    id: "price",
    header: "Price €/MWh",
    width: 170,
    align: "end",
    filter: "number",
    format: (v) => euro.format(v as number),
  },
  {
    id: "wind",
    header: "Wind MW",
    width: 140,
    align: "end",
    filter: "number",
    format: (v) => integer.format(v as number),
  },
  {
    id: "solar",
    header: "Solar MW",
    width: 120,
    align: "end",
    format: (v) => integer.format(v as number),
  },
  {
    id: "load",
    header: "Load MW",
    width: 120,
    align: "end",
    format: (v) => integer.format(v as number),
  },
  {
    id: "share",
    header: "Renewable share",
    width: 150,
    align: "end",
    format: (v) => percent.format(v as number),
  },
];

let hundredThousand: MarketRow[] | undefined;
/** 100,000 rows, generated once per page. */
export function hundredThousandRows(): MarketRow[] {
  hundredThousand ??= makeRows(100_000);
  return hundredThousand;
}
