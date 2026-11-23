# 10. Demo data: an hourly SMARD recording, committed with the app

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The demo application should show the grid with real data at the size the library is built for,
about 100,000 rows, together with the date picker (period) and the combobox (series). The data
is the German electricity market from SMARD (Bundesnetzagentur, licence CC BY 4.0), the same
source as the sister project Stromfenster. Requirements: no account or key, no server of our own,
end-to-end tests without the live network, and nothing invented.

Options checked on 23 November 2026:

| Option                                      | Result                                                                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stromfenster's API (`/api/days/YYYY-MM-DD`) | CORS allowed, but real values only from 12 November 2026: under 300 hours, not 100,000. It would also tie the demo to another project's uptime.                                                                                        |
| SMARD from the browser at runtime           | SMARD's files allow CORS, but they come per series and week: 14 series since 2015 are 8,352 files. Every visitor would send thousands of requests to a public authority's site that promises no rate limit.                            |
| SMARD quarter-hour files, recorded          | 100,000 quarter hours are less than three years. Before October 2025 the quarter-hour price files repeat each hourly price four times (seen in the file for the week of 1 October 2018), so the finer grid adds rows, not information. |
| **SMARD hourly files, recorded**            | 1 January 2015 to 22 November 2026 is **104,256 hours**: the whole history SMARD offers, at the size the grid is built for.                                                                                                            |
| Synthetic rows                              | Already used for the performance budgets in Storybook. A demo with made-up numbers would show nothing the stories do not.                                                                                                              |

## Decision

**A recorded hourly snapshot in the repository.** `apps/demo/scripts/record-smard.mjs` downloads
the hourly weekly files of 14 series (day-ahead price, load and twelve generation sources),
validates them (shape, timestamps on the hour, numeric values) and writes one file,
`apps/demo/public/data/smard-hourly.json`, which the demo loads with a single request. Downloaded
weeks are cached locally (`.smard-cache/`, git-ignored), so a refresh only fetches the newest week.
The file names its source, licence and recording date, and the page shows them in its footer.

**A compact, columnar format.** Hours are contiguous, so a row's time is `start + index × 3600`
and is not stored. Each series is a list of integers, delta-encoded (small numbers compress well),
with `null` where SMARD has no value. Prices keep their cents; energy is rounded to whole MWh.
Measured with Node's zlib (gzip level 9, Brotli quality 11) on the recorded file:

| Variant                                       |     Raw |    gzip |  Brotli |
| --------------------------------------------- | ------: | ------: | ------: |
| Energy and prices in hundredths               | 8.26 MB | 3.04 MB | 2.76 MB |
| Energy in whole MWh, prices in cents (chosen) | 5.74 MB | 2.10 MB | 1.87 MB |

Decoding into 104,256 row objects took 126 ms in Node 26 on the development machine (Intel Core
i5-12400F). Berlin dates and times are worked out with `Intl` only at midnight and at 2 and 3
o'clock, where the clocks can change; a unit test compares every hour of 2025's spring and autumn
changes with `Intl`.

**Prices only from 1 October 2018.** SMARD's series 4169 is the German-Luxembourg bidding zone,
which started on that day. SMARD also serves a price series under filter 251 until 30 September
2018, which matches the end of the former German-Austrian-Luxembourg zone, but no documentation
names it, so it is left out rather than guessed. Earlier hours have empty price cells, which also
shows how the grid sorts and filters empty values.

**Times in Berlin.** The grid shows the Berlin calendar day (as a date column, so the grid's date
filter works on it) and the clock time. On the last Sunday of October 02:00 appears twice, on the
last Sunday of March not at all; the footer says so.

## Consequences

- **Tests need no network.** Unit and end-to-end tests read the same committed file, and the
  end-to-end tests compute their expected numbers from it with the app's own decoder. A Playwright
  fixture fails any test whose page requests anything outside the local server.
- **The data ages.** The demo ends on the recording day. Refreshing is one command
  (`pnpm --filter demo record`) and a commit; each refresh adds about 2 MB (compressed) to the
  repository history.
- **One larger download.** About 2 MB over the wire before the grid appears. The page shell renders
  at once with a loading message, and `index.html` preloads the file. Splitting it by year would
  show recent data sooner but complicates the period selection; revisit if the Lighthouse
  measurement on the deployed demo calls for it.
- **SMARD's format can change.** The recorder rejects anything unexpected instead of writing a
  wrong file; the deployed demo is unaffected until someone records again.
