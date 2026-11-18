# Tabellwerk

**Accessible React components centred on a fast data grid.** A WAI-ARIA grid for 100,000 rows with
sorting, filtering and column resizing by keyboard and pointer, plus the two widgets most libraries
get wrong: a combobox with autocomplete and a date picker. Framework-neutral design tokens,
light/dark/forced-colours themes, and every claim backed by a test.

> **Status: under construction.** The data grid renders, navigates and sorts 100,000 rows (Phase 1).
> Filtering and column resizing, the combobox and the date picker follow in the phases of the
> [roadmap](docs/ROADMAP.md). Nothing is published to npm yet.

## Packages

| Package              | What it contains                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@tabellwerk/tokens` | Design tokens as CSS custom properties (light, dark, forced colours) and typed `var()` references; no React |
| `@tabellwerk/react`  | Components and hooks; one entry point per component; one stylesheet that includes the tokens                |

## Features

Available today:

- **`DataGrid`** following the [WAI-ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/):
  - 100,000 rows with its own virtualiser; only the rows in view are in the DOM, every row keeps
    its real `aria-rowindex`
  - one tab stop; arrow keys, Home/End, Ctrl+Home/End, PageUp/PageDown; Enter or F2 into links and
    buttons inside cells, Escape back; the focused row stays mounted when scrolled away
  - stable single and multi-column sorting by click, Enter or Space, announced to screen readers;
    radix sort over an index permutation, `rows` is never copied
  - controlled or uncontrolled sort state, translatable texts, `useDataGrid()` for custom markup
- **`LiveAnnouncer`** with `useAnnouncer()`: polite and assertive screen reader announcements
- **`VisuallyHidden`**: text for assistive technology only

```tsx
import { DataGrid, type ColumnDef } from "@tabellwerk/react";
import "@tabellwerk/react/styles.css";

const columns: ColumnDef<Price>[] = [
  { id: "time", header: "Time" },
  { id: "price", header: "Price €/MWh", align: "end" },
];

<DataGrid aria-label="Day-ahead prices" rows={rows} columns={columns} style={{ height: 480 }} />;
```

Planned:

- **Data grid:** per-column filters and column resizing by keyboard, pointer and touch
- **Combobox** with list and inline autocomplete, async options and correct IME handling
- **Date picker** dialog with a keyboard-operable calendar grid and locale-aware week start
- Controlled and uncontrolled state everywhere; hooks for custom markup, components for the rest
- Server rendering without hydration warnings

## Tech stack

| Area           | Choice                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| Monorepo       | pnpm workspaces, Turborepo                                                 |
| Library        | React 19, TypeScript 6 (strict, `isolatedDeclarations`), tsdown (ESM only) |
| Styling        | Plain CSS on custom properties, in the cascade layer `tabellwerk`          |
| Tokens         | DTCG JSON, Style Dictionary                                                |
| Documentation  | Storybook 10                                                               |
| Testing        | Vitest (Node and browser mode), Playwright, axe-core                       |
| Package checks | publint, Are the Types Wrong, size-limit, API Extractor                    |
| Releases       | Changesets                                                                 |

## Architecture

```mermaid
flowchart LR
  subgraph tokens["@tabellwerk/tokens"]
    JSON[("DTCG JSON<br/>base · light · dark")] --> SD["Style Dictionary<br/>+ build script"]
    SD --> CSS["tokens.css<br/>--tbw-* custom properties"]
    SD --> TS["index.js + .d.ts<br/>typed var() references"]
  end
  subgraph react["@tabellwerk/react"]
    SRC["components + hooks"] --> TSD["tsdown<br/>ESM, one entry per component,<br/>'use client'"]
    STY["component CSS"] --> BUNDLE["styles.css<br/>@layer tabellwerk"]
  end
  CSS --> BUNDLE
  SRC --> SB["Storybook<br/>documentation"]
  SB --> E2E["Playwright<br/>axe · screenshots"]
  TSD --> CHECKS["publint · attw<br/>size-limit · API report"]
  TSD --> APP["Your app"]
  BUNDLE --> APP
```

Inside the grid, data and rendering are separate:

```mermaid
flowchart LR
  ROWS[("rows<br/>(never copied)")] --> SORT["useDataGrid<br/>sort state → radix sort<br/>→ Uint32Array order"]
  SORT --> VIRT["virtualiser<br/>scrollTop → visible range<br/>+ overscan + focused row"]
  VIRT --> DOM["≈ 30 row elements<br/>keyed by position,<br/>aria-rowindex = real index"]
  KEYS["keydown"] --> NAV["nextPosition()<br/>pure, tested per key"]
  NAV --> VIRT
  NAV --> FOCUS["focus the cell<br/>after it is rendered"]
```

The reasoning behind these choices is recorded in [Architecture Decision Records](docs/adr):
[package layout and toolchain](docs/adr/0001-monorepo-and-package-layout.md),
[tokens and cascade layers](docs/adr/0002-styling-with-tokens-and-cascade-layers.md),
[testing strategy](docs/adr/0003-testing-strategy.md),
[own virtualiser](docs/adr/0004-own-virtualiser.md),
[sorting with radix sort](docs/adr/0005-sorting-with-rank-permutations.md),
[focus and keyboard model](docs/adr/0006-grid-focus-and-keyboard-model.md).

## Performance

Measured on the production Storybook build with 100,000 synthetic rows × 8 columns, Chromium
158 (headless), CPU throttled 4×, median of 5 runs, on 2026-11-18: locally on an Intel Core
i5-12400F and in CI on a GitHub-hosted `ubuntu-latest` runner
([method](docs/adr/0004-own-virtualiser.md#measurements)):

| Interaction                                             |  Local |     CI | Budget in CI |
| ------------------------------------------------------- | -----: | -----: | -----------: |
| Mount the grid (click → next paint)                     | 120 ms | 112 ms |       200 ms |
| Sort by a number column                                 |  80 ms | 104 ms |       200 ms |
| Sort by a text column                                   |  72 ms |  88 ms |       200 ms |
| Keyboard step (ArrowDown, PageDown)                     |  32 ms |  40 ms |       100 ms |
| Long frames (> 50 ms) while jumping through 10,000 rows |      4 |      4 |           20 |

Interaction times come from the Event Timing API, the data INP is computed from. CI runs the same
measurement on every pull request and fails when a median exceeds its budget. Bundle size of the
grid: 4.0 kB (minified and brotli-compressed, checked by size-limit).

## Project structure

```
packages/
  tokens/     @tabellwerk/tokens: DTCG sources, build script, contrast tests
  react/      @tabellwerk/react: components, stories, tests, Storybook config
    e2e/      Playwright: axe and visual regression on the Storybook build
    etc/      API report (public API, reviewed in every pull request)
scripts/      static file server for tests, visual tests in Docker
docs/
  adr/        Architecture Decision Records
  ROADMAP.md  phases and their "done when" criteria
```

## Getting started

Requirements: Node.js 24+, pnpm, and Docker for updating visual baselines.

```bash
pnpm install
pnpm --filter @tabellwerk/react exec playwright install chromium   # once
pnpm build
pnpm storybook        # http://localhost:6006
```

## Scripts

| Command              | What it does                                                                        |
| -------------------- | ----------------------------------------------------------------------------------- |
| `pnpm check`         | Lint, typecheck, unit and browser tests, build, package checks (everything CI runs) |
| `pnpm storybook`     | Storybook in development mode                                                       |
| `pnpm build:docs`    | Static Storybook build in `packages/react/storybook-static`                         |
| `pnpm e2e`           | axe on every story in light, dark and forced colours (needs `build:docs`)           |
| `pnpm visual:update` | Record visual baselines in the Playwright Docker image                              |
| `pnpm perf`          | Performance measurements and budgets (needs `build:docs`)                           |
| `pnpm changeset`     | Describe a change for the changelog                                                 |
| `pnpm format`        | Format the codebase with Prettier                                                   |

## Testing

Tests run where the code runs ([ADR 3](docs/adr/0003-testing-strategy.md)):

| Layer             | Tool                                            | What it covers                                                                |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Tokens            | Vitest                                          | WCAG contrast of every colour pair in light and dark, build output            |
| Server rendering  | Vitest in Node                                  | Components render without a DOM; live regions exist before the first message  |
| Keyboard, pointer | Vitest browser mode (Chromium via Playwright)   | Real key events through the browser's input pipeline                          |
| Stories           | Storybook Vitest addon                          | Every story renders, its play function passes, axe finds no violation         |
| Accessibility     | Playwright + axe-core                           | WCAG 2.1 A/AA on every story in light, dark and forced-colours mode           |
| Visual regression | Playwright in Docker                            | Screenshot of every story in light and dark, compared pixel by pixel          |
| Package           | publint, attw, size-limit, API Extractor        | Exports, type resolution, size per entry point, unintended public API changes |
| Performance       | Playwright, Event Timing, Long Animation Frames | Interaction and scroll budgets on 100,000 rows; render counts per key press   |

## What was hard

Things that took longer than expected so far, and what they changed.

- **Two axe runs in one page.** The accessibility tests failed about once in fifty runs with "Axe is
  already running": Storybook's a11y addon starts its own axe pass inside the story frame, and the
  Playwright test started a second one at the same moment. The tests now open stories with the
  addon in manual mode and wait for the story's play function to finish, which also made the
  screenshots deterministic. 140 repeated runs passed afterwards.
- **Screenshots that depend on the operating system.** Font rendering on Windows differs from the
  Linux CI runners, so baselines recorded on the development machine would fail in CI. Baselines are
  recorded and compared only in the Playwright Docker image; the local script copies the repository
  into the container without `node_modules`, because the Windows native binaries do not run there.
- **Sorting 100,000 rows within an interaction budget.** The first version sorted an index array
  with a comparison function and took 216 ms from click to paint (CPU throttled 4×), above the
  200 ms INP threshold. Two changes brought it to 72–80 ms: keying rows by position, so React updates
  the visible row elements instead of recreating them, and replacing the comparison sort with a
  stable radix sort over order-preserving 64-bit keys (IEEE 754 bits for numbers, ranks for
  strings). Reference tests compare the result with `Array#sort` on 10,000 to 30,000 random rows,
  including `-0`, infinities and empty values. ([ADR 5](docs/adr/0005-sorting-with-rank-permutations.md))
- **Real key presses and parallel test files.** Browser tests send keys through Playwright, which
  types into whichever frame has focus. Vitest runs test files in parallel frames of one browser,
  so key presses from one file landed in another and tests failed only when run together. Browser
  test files now run one after another.
- **Measuring on a laptop that sleeps.** A measurement run that overlapped with the machine going
  to sleep reported a five-hour test and nonsense frame times, and one run overlapped with another
  test run. Both were thrown away; the numbers above come from runs with nothing else running.

## License

[MIT](LICENSE)
