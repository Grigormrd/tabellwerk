// Records hourly SMARD data for the demo into one compact file that is
// committed with the app (ADR 10). Run with `pnpm --filter demo record`.
//
// SMARD serves one JSON file per series and week. Downloaded weeks are kept in
// `.smard-cache/` (git-ignored), so a second run only fetches what is new.
// The output is columnar: hours are contiguous, so a row's time is
// `start + index * 3600`, and each series is a list of integers (cents for
// prices, whole MWh for energy), delta-encoded so the file compresses well.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SERIES } from "../src/data/series.ts";

const BASE = "https://www.smard.de/app/chart_data";
const HOUR = 3600;
const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, "..", ".smard-cache");
const outFile = join(here, "..", "public", "data", "smard-hourly.json");

/** First hour: 1 January 2015, midnight in Berlin (CET, UTC+1). */
const START = Date.UTC(2014, 11, 31, 23) / 1000;

/** Last complete day in Berlin: everything before today's midnight there. */
function endOfYesterdayBerlin(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  // Midnight in Berlin is 22:00 or 23:00 UTC the day before; find the hour
  // whose Berlin date is today and whose Berlin hour is 0.
  for (const offset of [1, 2]) {
    const candidate = Date.UTC(y, m - 1, d) / 1000 - offset * HOUR;
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(candidate * 1000));
    if (hour === "00") return candidate;
  }
  throw new Error("Could not find midnight in Berlin");
}

const END = Number(process.env.SMARD_END ?? endOfYesterdayBerlin()); // exclusive

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return fetchJson(url, attempt + 1);
    }
    throw new Error(`${response.status} for ${url}`);
  }
  const text = await response.text();
  return text === "" ? null : JSON.parse(text);
}

async function cached(name, load) {
  const file = join(cacheDir, name);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    const json = await load();
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(json));
    return json;
  }
}

/** Rejects anything that is not `[[ms, number | null], ...]` on the hour grid. */
function parseWeek(json, url) {
  const rows = json?.series;
  if (!Array.isArray(rows)) throw new Error(`No series array in ${url}`);
  return rows.map((row) => {
    const [ms, value] = row;
    if (!Number.isInteger(ms) || (ms / 1000) % HOUR !== 0)
      throw new Error(`Bad time ${ms} in ${url}`);
    if (value !== null && !Number.isFinite(value)) throw new Error(`Bad value ${value} in ${url}`);
    return [ms / 1000, value];
  });
}

async function pool(items, size, task) {
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
      done++;
      if (done % 250 === 0) console.log(`  ${done} / ${items.length} files`);
    }
  }
  await Promise.all(Array.from({ length: size }, worker));
}

const hours = (END - START) / HOUR;
if (!Number.isInteger(hours) || hours <= 0) throw new Error(`Bad range ${START}–${END}`);
console.log(`Recording ${hours} hours from ${new Date(START * 1000).toISOString()}`);

const columns = {};
const jobs = [];
for (const [id, { filter, region, decimals }] of Object.entries(SERIES)) {
  const values = new Array(hours).fill(null);
  columns[id] = values;
  const index = await fetchJson(`${BASE}/${filter}/${region}/index_hour.json`);
  for (const week of index?.timestamps ?? []) {
    if (week / 1000 >= END || week / 1000 + 8 * 24 * HOUR <= START) continue;
    jobs.push({ id, filter, region, week, values, factor: 10 ** decimals });
  }
}

// Only the most recent week of each series may still change; refetch it.
const latest = new Map();
for (const job of jobs) latest.set(job.id, Math.max(latest.get(job.id) ?? 0, job.week));

await pool(jobs, 6, async ({ id, filter, region, week, values, factor }) => {
  const url = `${BASE}/${filter}/${region}/${filter}_${region}_hour_${week}.json`;
  const name = `${filter}_${region}_${week}.json`;
  const json =
    latest.get(id) === week ? await fetchJson(url) : await cached(name, () => fetchJson(url));
  if (json === null) return;
  for (const [start, value] of parseWeek(json, url)) {
    const i = (start - START) / HOUR;
    if (i >= 0 && i < hours && value !== null) values[i] = Math.round(value * factor);
  }
});

/** Delta-encodes a column; `null` stays `null` and does not move the base. */
function deltas(values) {
  let previous = 0;
  return values.map((v) => {
    if (v === null) return null;
    const d = v - previous;
    previous = v;
    return d;
  });
}

const output = {
  source: "Bundesnetzagentur | SMARD.de",
  licence: "CC BY 4.0",
  url: "https://www.smard.de",
  recorded: new Date().toISOString().slice(0, 10),
  start: START,
  step: HOUR,
  count: hours,
  decimals: Object.fromEntries(Object.entries(SERIES).map(([id, s]) => [id, s.decimals])),
  series: Object.fromEntries(Object.entries(columns).map(([id, v]) => [id, deltas(v)])),
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(output));
for (const [id, values] of Object.entries(columns)) {
  const filled = values.filter((v) => v !== null).length;
  console.log(`  ${id.padEnd(28)} ${filled} of ${hours} hours`);
}
console.log(`Wrote ${outFile}`);
