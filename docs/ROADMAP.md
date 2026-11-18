# Roadmap

Each phase is one branch and one pull request. A phase is done when every "Done when" item is
true and checked, not when the code is written.

## Phase 0: Foundation

pnpm + Turborepo, TypeScript strict, ESLint, Prettier; `@tabellwerk/tokens` (DTCG → CSS custom
properties for light, dark, forced colours); `@tabellwerk/react` with `VisuallyHidden` and
`LiveAnnouncer`; Storybook; Vitest in Node and Chromium; Playwright with axe and visual regression;
size-limit, publint, Are the Types Wrong, API report; Changesets; CI; ADRs 1–3.

Done when:

- [x] `pnpm check` (lint, typecheck, unit and browser tests, build, package checks) passes locally
- [x] `pnpm check` passes in a fresh clone
- [x] `pnpm e2e` passes: axe on every story in light, dark and forced colours
- [x] Visual baselines recorded in the Playwright Docker image and compared there
- [x] `npm pack --dry-run` contains only `dist`, `README.md`, `LICENSE` and `package.json`
- [x] CI passes on the pull request (#1)

## Phase 1: Data grid: rendering, keyboard, sorting

Column and row API, own virtualiser for 100,000 rows, WAI-ARIA grid structure
(`aria-rowcount`/`aria-rowindex`), focus model that keeps the focused row mounted, full keyboard
navigation, single and multi-column sorting with announcements, performance harness.

Done when:

- [x] Every key in the documented keyboard table has an interaction test
- [x] axe passes in light, dark and forced colours
- [x] Performance budgets measured, documented with the measuring conditions and enforced in CI
- [x] Comparison with TanStack Virtual recorded in an ADR
- [x] Storybook documentation deployed (after approval): https://tabellwerk.vercel.app

## Phase 2: Data grid: filtering and column resizing

Per-column filters in a header popover, controlled and uncontrolled filter state, resizing by
pointer, touch and keyboard, fit-to-content.

Done when:

- [x] Interaction tests for filtering and resizing, including keyboard and touch input
- [ ] Filtering 100,000 rows within the budget (locally yes; CI pending on the pull request)
- [x] axe and screenshots include the open popovers
- [x] Docs page with the keyboard table updated

## Phase 3: Combobox

WAI-ARIA combobox with list and inline autocomplete, async options, groups, long virtualised lists,
IME composition, form integration.

Done when:

- [ ] Keyboard tests pass in Chromium, Firefox and WebKit
- [ ] IME and form (submit, reset) tests pass
- [ ] axe and screenshots for every state in light and dark
- [ ] Own size-limit entry; the grid's "choose values" filter uses the combobox

## Phase 4: Date picker

WAI-ARIA date picker dialog, ISO date strings in the API, min/max/unavailable dates, locale-aware
week start and input parsing, form integration.

Done when:

- [ ] Unit tests for the date logic (leap years, month ends, daylight saving changes)
- [ ] Keyboard tests in three engines, locale tests for `de-DE` and `en-US`
- [ ] Focus trap and focus return tested; axe and screenshots
- [ ] The grid's date filter uses the date picker

## Phase 5: Demo application

Vite app with German electricity market data (Bundesnetzagentur | SMARD.de, CC BY 4.0) in the grid,
the date picker for the period and the combobox for the series.

Done when:

- [ ] The demo builds against the built packages
- [ ] End-to-end tests against the production build with recorded data
- [ ] Data source decided in an ADR
- [ ] Deployed (after approval) and checked live; Lighthouse measured on the production build

## Phase 6: Release and documentation

Complete Storybook documentation, release workflow (Changesets, npm trusted publishing with
provenance), README with live links, preview GIF, architecture diagram and "What was hard",
first npm release `0.1.0` (after approval).

Done when:

- [ ] A fresh Vite project installs `@tabellwerk/react` from npm and renders the grid, combobox and
      date picker (automated smoke test)
- [ ] Provenance visible on npmjs.com
- [ ] Documentation and demo live
