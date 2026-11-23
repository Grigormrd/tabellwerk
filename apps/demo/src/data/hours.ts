// Decodes the recorded SMARD file into rows for the grid.

import { SERIES_IDS, type SeriesId } from "./series.ts";

export interface Recording {
  source: string;
  licence: string;
  url: string;
  /** Day the file was recorded, ISO date. */
  recorded: string;
  /** Start of the first hour, epoch seconds. */
  start: number;
  step: number;
  count: number;
  decimals: Record<SeriesId, number>;
  /** Delta-encoded integers per series; `null` where SMARD has no value. */
  series: Record<SeriesId, (number | null)[]>;
}

export type HourRow = {
  /** Start of the hour, epoch seconds. */
  start: number;
  /** The calendar day in Berlin, as a Date at UTC midnight of that day. */
  day: Date;
  /** Berlin clock time of the start, "14:00". */
  time: string;
} & Record<SeriesId, number | null>;

const BERLIN = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Berlin calendar day and hour of an instant. */
export function berlinParts(epochSeconds: number): { date: string; hour: number } {
  const parts = BERLIN.formatToParts(new Date(epochSeconds * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function isRecording(json: unknown): json is Recording {
  const r = json as Partial<Recording> | null;
  return (
    typeof r?.start === "number" &&
    r.step === 3600 &&
    typeof r.count === "number" &&
    typeof r.series === "object" &&
    SERIES_IDS.every((id) => Array.isArray(r.series?.[id]) && r.series[id].length === r.count)
  );
}

/**
 * Turns the recording into one row per hour. Asking `Intl` for the Berlin
 * time of 104,000 instants is slow, so it is asked only at midnight and at
 * 2 and 3 o'clock, where the clocks can change; every other hour is the
 * previous one plus one.
 */
export function decodeRecording(json: unknown): HourRow[] {
  if (!isRecording(json)) throw new Error("The data file does not have the expected format.");
  const { start, step, count, decimals, series } = json;

  const columns = SERIES_IDS.map((id) => {
    const deltas = series[id];
    const divisor = 10 ** (decimals[id] ?? 0);
    const values = new Array<number | null>(count);
    let value = 0;
    for (let i = 0; i < count; i++) {
      const d = deltas[i];
      if (d === null || d === undefined) {
        values[i] = null;
      } else {
        value += d;
        values[i] = value / divisor;
      }
    }
    return [id, values] as const;
  });

  const days = new Map<string, Date>();
  const rows = new Array<HourRow>(count);
  let parts = berlinParts(start);
  for (let i = 0; i < count; i++) {
    const t = start + i * step;
    if (i > 0) {
      const hour = parts.hour + 1;
      // Recompute at midnight and wherever the clocks change (2 → 3 in
      // spring; 2 → 2 in autumn); everywhere else the next hour follows.
      parts = hour >= 24 || hour === 2 || hour === 3 ? berlinParts(t) : { ...parts, hour };
    }
    let day = days.get(parts.date);
    if (!day) {
      day = new Date(`${parts.date}T00:00:00Z`);
      days.set(parts.date, day);
    }
    const row = { start: t, day, time: `${String(parts.hour).padStart(2, "0")}:00` } as HourRow;
    for (const [id, values] of columns) row[id] = values[i] ?? null;
    rows[i] = row;
  }
  return rows;
}

/** ISO date of a row's Berlin day. */
export function isoDay(row: HourRow): string {
  return row.day.toISOString().slice(0, 10);
}

/**
 * Index of the first row whose Berlin day is on or after `date` (ISO).
 * Rows are in time order, so a binary search finds the period in a few steps.
 */
export function firstIndexOnOrAfter(rows: readonly HourRow[], date: string): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (isoDay(rows[mid] as HourRow) < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The rows from `from` to `to` (inclusive ISO dates), without copying more than needed. */
export function rowsInPeriod(rows: readonly HourRow[], from: string, to: string): HourRow[] {
  const begin = firstIndexOnOrAfter(rows, from);
  const end = firstIndexOnOrAfter(rows, nextDay(to));
  return rows.slice(begin, end);
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
