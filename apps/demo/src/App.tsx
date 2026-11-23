import {
  Combobox,
  DataGrid,
  DatePicker,
  type ColumnDef,
  type ComboboxOption,
  type ISODate,
} from "@tabellwerk/react";
import { useEffect, useId, useMemo, useState } from "react";

import { decodeRecording, isoDay, rowsInPeriod, type HourRow } from "./data/hours.ts";
import { SERIES, SERIES_IDS, type SeriesDefinition, type SeriesId } from "./data/series.ts";
import { ThemeSelect } from "./ThemeSelect.tsx";

const DATA_URL = "/data/smard-hourly.json";
const DOCS_URL = "https://tabellwerk.vercel.app";
const REPO_URL = "https://github.com/Grigormrd/tabellwerk";

const DEFAULT_SERIES: SeriesId[] = [
  "price",
  "load",
  "solar",
  "windOnshore",
  "windOffshore",
  "lignite",
  "gas",
];

const SERIES_OPTIONS: ComboboxOption[] = SERIES_IDS.map((id) => ({
  value: id,
  label: SERIES[id].label,
  group: SERIES[id].group,
}));

type Data =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; rows: HourRow[]; recorded: string };

function useRecording(attempt: number): Data {
  const [data, setData] = useState<Data>({ state: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    fetch(DATA_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`The server answered ${response.status}.`);
        return response.json() as Promise<unknown>;
      })
      .then((json) => {
        const rows = decodeRecording(json);
        const recorded = (json as { recorded?: string }).recorded ?? "";
        setData({ state: "ready", rows, recorded });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setData({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => controller.abort();
  }, [attempt]);
  return data;
}

function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
const formatDay = (iso: ISODate) => dayFormat.format(new Date(`${iso}T00:00:00Z`));

export function App() {
  const [attempt, setAttempt] = useState(0);
  const data = useRecording(attempt);
  const titleId = useId();

  return (
    <div className="demo">
      <header className="demo-header">
        <div className="demo-header__text">
          <p className="demo-eyebrow">Tabellwerk demo</p>
          <h1 id={titleId}>German electricity market, hour by hour</h1>
          <p className="demo-lede">
            Every hour since 1 January 2015: day-ahead prices, load and generation by source, about
            104,000 rows in one accessible data grid. Sort, filter and resize columns with a pointer
            or the keyboard.
          </p>
        </div>
        <nav className="demo-nav" aria-label="Project">
          <a href={DOCS_URL}>Documentation</a>
          <a href={REPO_URL}>Source on GitHub</a>
          <ThemeSelect />
        </nav>
      </header>

      <main className="demo-main">
        {data.state === "loading" && (
          <p className="demo-message" role="status">
            Loading hourly data…
          </p>
        )}
        {data.state === "error" && (
          <div className="demo-message demo-message--error" role="alert">
            <p>The data could not be loaded. {data.message}</p>
            <button type="button" className="demo-button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}
        {data.state === "ready" && <Explorer rows={data.rows} titleId={titleId} />}
      </main>

      <footer className="demo-footer">
        <p>
          Data: <a href="https://www.smard.de">Bundesnetzagentur | SMARD.de</a>, licensed under{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          {data.state === "ready" && data.recorded && <>, recorded on {formatDay(data.recorded)}</>}
          . Hourly values as SMARD publishes them; energy rounded to whole MWh. Prices are for the
          German-Luxembourg bidding zone, which exists since 1 October 2018, so earlier hours have
          none. Times are Berlin local time: on the last Sunday of October 02:00 appears twice, on
          the last Sunday of March not at all.
        </p>
      </footer>
    </div>
  );
}

interface ExplorerProps {
  rows: HourRow[];
  titleId: string;
}

function Explorer({ rows, titleId }: ExplorerProps) {
  const firstDay = isoDay(rows[0] as HourRow);
  const lastDay = isoDay(rows.at(-1) as HourRow);

  const [from, setFrom] = useState<ISODate | null>(null);
  const [to, setTo] = useState<ISODate | null>(null);
  const [series, setSeries] = useState<string[]>(DEFAULT_SERIES);

  const start = from ?? firstDay;
  const end = to ?? lastDay;
  // Newest hours first: the recent past is what most people look for.
  const visible = useMemo(() => rowsInPeriod(rows, start, end).reverse(), [rows, start, end]);
  const columns = useMemo(() => buildColumns(series as SeriesId[]), [series]);

  const presets: { label: string; from: ISODate | null; to: ISODate | null }[] = [
    { label: "Last 7 days", from: addDays(lastDay, -6), to: lastDay },
    { label: "Last 30 days", from: addDays(lastDay, -29), to: lastDay },
    { label: "Last 365 days", from: addDays(lastDay, -364), to: lastDay },
    { label: "Everything", from: null, to: null },
  ];

  return (
    <>
      <section className="demo-controls" aria-label="Period and series">
        <div className="demo-period">
          <DatePicker
            label="From"
            value={from ?? firstDay}
            min={firstDay}
            max={to ?? lastDay}
            onChange={setFrom}
          />
          <DatePicker
            label="To"
            value={to ?? lastDay}
            min={from ?? firstDay}
            max={lastDay}
            onChange={setTo}
          />
          <div className="demo-presets" role="group" aria-label="Quick periods">
            {presets.map((preset) => {
              const active = start === (preset.from ?? firstDay) && end === (preset.to ?? lastDay);
              return (
                <button
                  key={preset.label}
                  type="button"
                  className="demo-button"
                  aria-pressed={active}
                  onClick={() => {
                    setFrom(preset.from);
                    setTo(preset.to);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
        <Combobox
          className="demo-series"
          label="Series"
          description="Each series is a column. Remove one with its × button or Backspace."
          multiple
          options={SERIES_OPTIONS}
          value={series}
          onChange={setSeries}
        />
      </section>

      <p className="demo-summary" aria-live="polite">
        {visible.length.toLocaleString()} hours from {formatDay(start)} to {formatDay(end)}, newest
        first
      </p>

      <DataGrid className="demo-grid" aria-labelledby={titleId} rows={visible} columns={columns} />
    </>
  );
}

const numberFormats = new Map<number, Intl.NumberFormat>();
function formatNumber(value: number, decimals: number): string {
  let format = numberFormats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormats.set(decimals, format);
  }
  return format.format(value);
}

const DAY_COLUMN: ColumnDef<HourRow> = {
  id: "day",
  header: "Date",
  filter: "date",
  width: 140,
  format: (value) => dayFormat.format(value as Date),
};

const TIME_COLUMN: ColumnDef<HourRow> = {
  id: "time",
  header: "Time",
  filter: "values",
  width: 100,
};

const seriesColumns = new Map<SeriesId, ColumnDef<HourRow>>(
  SERIES_IDS.map((id) => {
    const definition: SeriesDefinition = SERIES[id];
    const { label, header, unit, decimals } = definition;
    const text = `${header ?? label} (${unit})`;
    return [
      id,
      {
        id,
        header: text,
        filter: "number",
        align: "end",
        // Room for the header text, the sort arrow and the filter button.
        width: Math.max(130, Math.round(text.length * 6.8 + 60)),
        format: (value) => formatNumber(value as number, decimals),
      },
    ];
  }),
);

/** Columns in a fixed order, whatever order the series were picked in. */
function buildColumns(selected: readonly SeriesId[]): ColumnDef<HourRow>[] {
  const chosen = SERIES_IDS.filter((id) => selected.includes(id));
  return [
    DAY_COLUMN,
    TIME_COLUMN,
    ...chosen.map((id) => seriesColumns.get(id) as ColumnDef<HourRow>),
  ];
}
