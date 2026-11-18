# 4. Own virtualiser with a fixed row height

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

The grid must handle 100,000 rows. Rendering them all creates 800,000 cell elements; only
virtualisation (rendering the rows in view plus a few around them) keeps mounting, scrolling and
memory reasonable. TanStack Virtual is the established library for this. The question is whether
the grid should depend on it or bring its own.

The grid has requirements a general-purpose virtualiser does not cover by itself: the focused row
must stay mounted when it scrolls out of view ([ADR 6](0006-grid-focus-and-keyboard-model.md)),
keyboard navigation must scroll and render the target row in the same update before focus moves,
and every rendered row needs its real `aria-rowindex`.

## Decision

The grid has its own virtualiser, `virtual.ts`, about 50 lines of pure functions:

- **Fixed row height.** Every row is `rowHeight` pixels tall (default 36). A row's position is
  `index × rowHeight`; nothing is measured, and the visible range is O(1) to compute.
- **Range = viewport + overscan** (default 6 rows above and below), recomputed on scroll only when
  it changes, so scrolling within a row does not re-render.
- **Rows are absolutely positioned** with `transform: translateY(…)` inside a spacer as tall as all
  rows. The header row is `position: sticky` in the same scroll container, so horizontal scrolling
  needs no synchronisation.
- **Column widths are one CSS custom property** (`grid-template-columns` on every row), so a width
  change in a later phase restyles all rows without re-rendering any of them.

TanStack Virtual is a dev dependency only, used by a reference grid in the benchmark stories.

## Measurements

Production Storybook build, Chromium 158.0.8127.18 (Playwright 1.65.0, headless shell), CPU throttled 4× through
the DevTools protocol, Intel Core i5-12400F, 100,000 synthetic rows × 8 columns, same markup and CSS
for both grids. Median of 5 runs, measured on 2026-11-18 with `pnpm perf`
([e2e/perf.spec.ts](../../packages/react/e2e/perf.spec.ts)).

| Metric                                                      | Tabellwerk | TanStack Virtual |
| ----------------------------------------------------------- | ---------: | ---------------: |
| Mount (click → next paint, Event Timing)                    |     120 ms |           128 ms |
| Long animation frames (> 50 ms) while scrolling 10,000 rows |          4 |                2 |
| Worst animation frame while scrolling 10,000 rows           |      55 ms |            60 ms |

The scroll test jumps 40 rows per frame for 250 frames, so every frame shows only new rows; it is a
worst case, not a normal scroll. Individual runs vary a lot: across the measurement sessions of the
same day, long frames ranged from 1 to 20 per run, and one run of the final session took 1.5 s for
a sort that takes 72 ms in the others (a stall of the machine, not of the code). The table
therefore shows medians, and the budgets have headroom.

The two are in the same range; across sessions, mount and scroll alternated between being slightly
faster in one or the other. Every cell of Tabellwerk is a memoised component, which costs some
mount time and buys re-rendering exactly two cells when focus moves; the reference grid has no
focus model at all. The decision is therefore not about speed but about control: the focus, keyboard and accessibility requirements above sit directly in
the virtualiser, and the library ships without runtime dependencies.

The same measurement in CI (GitHub-hosted `ubuntu-latest` runner, same settings, run on PR 4,
2026-11-18): mount 112 ms (TanStack Virtual 112 ms), 4 long frames (4), worst frame 62 ms
(58 ms), sort by number 104 ms, by text 88 ms, keyboard step 40 ms. The runs on the CI machine
varied much less than locally.

## Budgets

`e2e/perf-budgets.json` holds the limits CI enforces on the median of 5 runs: mount, sorting and
every keyboard step below the INP "good" threshold of 200 ms (100 ms for a keyboard step), at most
20 long frames and a worst frame of 150 ms in the scroll test. Deterministic budgets run in the
browser tests: at most viewport + overscan rows in the DOM, at most 2 cell renders per focus move,
and only entering rows rendered while scrolling.

## Consequences

- Rows of different heights (wrapped text, expandable rows) are not supported. Supporting them
  would need measuring and a position index; out of scope.
- Browsers cap element heights at a few million pixels, which limits the grid to several hundred
  thousand rows of 36 px. Scaling the scroll range beyond that is out of scope.
- Columns are not virtualised; the grid is tested with 50 columns.
