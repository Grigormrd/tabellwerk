# 3. Testing strategy

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

The library promises keyboard support, screen reader support, accessible colours in three colour
modes and a stable look. jsdom cannot test most of that: it has no layout, no focus behaviour of a
real browser and no `prefers-color-scheme`. Tests should run where the code runs.

## Decision

| Layer             | Tool                                                    | Runs in                                    |
| ----------------- | ------------------------------------------------------- | ------------------------------------------ |
| Logic, SSR        | Vitest                                                  | Node (no DOM, which also proves SSR works) |
| Keyboard, pointer | Vitest browser mode, `userEvent` from `vitest/browser`  | Chromium via Playwright                    |
| Stories           | Storybook Vitest addon: render, play function, axe      | Chromium via Playwright                    |
| Accessibility     | Playwright + axe-core on the static Storybook build     | Chromium, light, dark and forced colours   |
| Visual regression | Playwright `toHaveScreenshot` on the static build       | Docker image `playwright:v1.65.0-noble`    |
| Package           | publint, Are the Types Wrong, size-limit, API Extractor | Node                                       |

**Real input events.** Keyboard tests use `userEvent` from `vitest/browser`, which sends keys
through Playwright into the browser's own input pipeline: Tab moves focus the way it does for users,
Enter on a button fires `click`. Storybook's `userEvent` (from `storybook/test`) simulates events in
JavaScript and is used only in play functions, which also run in the Storybook UI.

**Stories are the test inventory.** Every story is rendered and checked by axe in the Vitest run. The
Playwright suite reads the story list from the built `index.json`, so a new story is automatically
checked in light, dark and forced-colours mode and gets screenshots in light and dark. A dedicated
test asserts that the emulated colour scheme really changes the token values, so a broken theme
switch cannot silently test the light theme twice.

**Visual baselines come from one image only.** Font rendering differs between Windows, macOS and
Linux, so screenshots are recorded and compared only inside the Playwright Docker image (CI runs the
visual job in the same image; locally `pnpm visual:update` starts it). Screenshots are taken after
the story's play function has finished.

## Consequences

- `pnpm check` needs a Chromium, the end-to-end suites need a Storybook build first
  (`pnpm build:docs`); CI installs both.
- Updating a baseline needs Docker locally. The visual tests skip on non-Linux hosts with a message
  instead of failing on font differences.
- Firefox and WebKit join the keyboard tests with the first complex widget; the utilities in this
  phase have no engine-specific behaviour.
