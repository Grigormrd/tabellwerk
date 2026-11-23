// The recorded file, decoded with the app's own code, so tests can work out
// what the page must show instead of hard-coding numbers.

import { readFileSync } from "node:fs";

import { decodeRecording, rowsInPeriod, type HourRow, type Recording } from "../src/data/hours.ts";

export const recording = JSON.parse(
  readFileSync(new URL("../public/data/smard-hourly.json", import.meta.url), "utf8"),
) as Recording;

export const rows: HourRow[] = decodeRecording(recording);

export function period(from: string, to: string): HourRow[] {
  return rowsInPeriod(rows, from, to);
}

/** "2025-02-01" → "01/02/2025", the en-GB input format. */
export function typed(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const number = new Intl.NumberFormat("en-GB");
export const count = (n: number) => number.format(n);
