import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  berlinParts,
  decodeRecording,
  isoDay,
  rowsInPeriod,
  type HourRow,
  type Recording,
} from "./hours.ts";
import { SERIES_IDS } from "./series.ts";

const HOUR = 3600;

/** A recording of `count` hours from `start`, with simple values. */
function recording(start: number, count: number): Recording {
  const series = Object.fromEntries(
    SERIES_IDS.map((id) => [id, Array.from({ length: count }, () => 1)]),
  ) as Recording["series"];
  const decimals = Object.fromEntries(SERIES_IDS.map((id) => [id, 0])) as Recording["decimals"];
  return {
    source: "test",
    licence: "test",
    url: "",
    recorded: "",
    start,
    step: HOUR,
    count,
    decimals,
    series,
  };
}

function hoursPerDay(rows: readonly HourRow[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const row of rows) days.set(isoDay(row), (days.get(isoDay(row)) ?? 0) + 1);
  return days;
}

describe("berlinParts", () => {
  it("knows winter and summer time", () => {
    expect(berlinParts(Date.UTC(2025, 0, 15, 11) / 1000)).toEqual({ date: "2025-01-15", hour: 12 });
    expect(berlinParts(Date.UTC(2025, 6, 15, 11) / 1000)).toEqual({ date: "2025-07-15", hour: 13 });
  });

  it("puts 23:00 UTC into the next Berlin day", () => {
    expect(berlinParts(Date.UTC(2025, 0, 15, 23) / 1000)).toEqual({ date: "2025-01-16", hour: 0 });
  });
});

describe("decodeRecording", () => {
  // 2025-03-28 00:00 CET to 2025-11-01 00:00 CET: both clock changes of 2025.
  const start = Date.UTC(2025, 2, 27, 23) / 1000;
  const end = Date.UTC(2025, 9, 31, 23) / 1000;
  const rows = decodeRecording(recording(start, (end - start) / HOUR));

  it("gives every hour the Berlin date and time Intl gives it", () => {
    for (const row of rows) {
      const { date, hour } = berlinParts(row.start);
      expect([isoDay(row), row.time]).toEqual([date, `${String(hour).padStart(2, "0")}:00`]);
    }
  });

  it("has 23 hours on the last Sunday of March and 25 on the last Sunday of October", () => {
    const days = hoursPerDay(rows);
    expect(days.get("2025-03-30")).toBe(23);
    expect(days.get("2025-10-26")).toBe(25);
    expect(days.get("2025-03-29")).toBe(24);
    expect(days.get("2025-10-27")).toBe(24);
    const spring = rows.filter((r) => isoDay(r) === "2025-03-30").map((r) => r.time);
    expect(spring).not.toContain("02:00");
    const autumn = rows.filter((r) => isoDay(r) === "2025-10-26").map((r) => r.time);
    expect(autumn.filter((t) => t === "02:00")).toHaveLength(2);
  });

  it("undoes the delta encoding, keeps gaps and applies the decimals", () => {
    const r = recording(start, 5);
    r.series.price = [12345, -45, null, 100, 0];
    r.decimals.price = 2;
    r.series.load = [40000, 10, -20, null, 5];
    const decoded = decodeRecording(r);
    expect(decoded.map((row) => row.price)).toEqual([123.45, 123, null, 124, 124]);
    expect(decoded.map((row) => row.load)).toEqual([40000, 40010, 39990, null, 39995]);
  });

  it("rejects a file of another shape", () => {
    expect(() => decodeRecording({ start: 0, step: 900, count: 0, series: {} })).toThrow(
      "expected format",
    );
    const r = recording(start, 3);
    r.series.solar = [1, 2];
    expect(() => decodeRecording(r)).toThrow("expected format");
  });
});

describe("rowsInPeriod", () => {
  const start = Date.UTC(2025, 0, 31, 23) / 1000; // 1 Feb 2025, 00:00 in Berlin
  const rows = decodeRecording(recording(start, 28 * 24));

  it("includes both ends as whole Berlin days", () => {
    const period = rowsInPeriod(rows, "2025-02-03", "2025-02-04");
    expect(period).toHaveLength(48);
    expect(isoDay(period[0] as HourRow)).toBe("2025-02-03");
    expect(period[0]?.time).toBe("00:00");
    expect(period.at(-1)?.time).toBe("23:00");
  });

  it("clips to the data", () => {
    expect(rowsInPeriod(rows, "2024-01-01", "2030-01-01")).toHaveLength(rows.length);
    expect(rowsInPeriod(rows, "2030-01-01", "2030-12-31")).toHaveLength(0);
  });
});

describe("the recorded file", () => {
  const json = JSON.parse(
    readFileSync(new URL("../../public/data/smard-hourly.json", import.meta.url), "utf8"),
  ) as Recording;
  const rows = decodeRecording(json);

  it("names the source and the licence", () => {
    expect(json.source).toBe("Bundesnetzagentur | SMARD.de");
    expect(json.licence).toBe("CC BY 4.0");
  });

  it("starts on 1 January 2015 at midnight in Berlin and ends with a whole day", () => {
    expect(isoDay(rows[0] as HourRow)).toBe("2015-01-01");
    expect(rows[0]?.time).toBe("00:00");
    expect(rows.at(-1)?.time).toBe("23:00");
    expect(isoDay(rows.at(-1) as HourRow) < json.recorded).toBe(true);
  });

  it("has 23, 24 or 25 hours on every day, 8,760 in 2025 and 8,784 in 2024", () => {
    const days = hoursPerDay(rows);
    const odd = [...days].filter(([, n]) => n !== 24);
    // Two clock changes a year.
    expect(odd.every(([, n]) => n === 23 || n === 25)).toBe(true);
    expect(rowsInPeriod(rows, "2025-01-01", "2025-12-31")).toHaveLength(8760);
    expect(rowsInPeriod(rows, "2024-01-01", "2024-12-31")).toHaveLength(8784);
  });

  it("has prices only from 1 October 2018, when the German-Luxembourg zone started", () => {
    const before = rowsInPeriod(rows, "2015-01-01", "2018-09-30");
    expect(before.every((row) => row.price === null)).toBe(true);
    const after = rowsInPeriod(rows, "2018-10-01", "2018-10-31");
    expect(after.every((row) => typeof row.price === "number")).toBe(true);
  });
});
