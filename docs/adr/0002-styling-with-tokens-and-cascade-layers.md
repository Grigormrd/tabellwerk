# 2. Styling: design tokens, CSS custom properties and cascade layers

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

A component library has to look good out of the box and still be easy to restyle. It must not
force a styling solution on the application (Tailwind, CSS Modules, CSS-in-JS), must render on the
server without a style runtime, and must support light, dark and forced-colours (Windows contrast
themes) with accessible contrast in each.

## Decision

**Tokens.** The source of truth is a set of JSON files in the
[Design Tokens Community Group format](https://www.designtokens.org/) in `packages/tokens/tokens`:
mode-independent tokens (`base.json`) and one colour file per theme with identical role names
(`color.light.json`, `color.dark.json`). Style Dictionary resolves and transforms them; a small build
script writes:

- `tokens.css`: CSS custom properties with the prefix `--tbw-` (not `--tw-`, which Tailwind uses).
- `index.js` / `index.d.ts`: typed `var(--tbw-…)` references and the resolved colours per theme,
  for inline styles, CSS-in-JS or charts.

Colours are named by role (`text`, `text-muted`, `surface`, `accent`, `focus`, …), not by hue, so a
dark theme is a second set of values for the same names.

**Themes.** `prefers-color-scheme` selects the theme by default. The attribute `data-tbw-theme="light"`
or `"dark"` forces a theme on an element and everything inside it. In `forced-colors: active` every
colour role maps to a CSS system colour (`Canvas`, `CanvasText`, `Highlight`, …).

**Contrast is tested, not eyeballed.** A unit test computes the WCAG 2.1 contrast ratio of every
foreground role on every background role it is used on, in both themes: 4.5:1 for text, 3:1 for
focus indicators and control borders.

**Delivery.** Components use plain CSS that reads the custom properties; `@tabellwerk/react/styles.css`
bundles the tokens and the component styles. Everything sits in the cascade layer `tabellwerk`
(`tabellwerk.tokens`, `tabellwerk.components`). Unlayered CSS always wins over layered CSS, so an
application overrides any library rule with an ordinary selector, without `!important` or
specificity tricks. There is no CSS-in-JS runtime.

## Consequences

- Restyling is a matter of overriding custom properties (`:root { --tbw-color-accent: … }`) or
  writing normal CSS. Both work with any styling solution and with server rendering.
- Applications import one stylesheet. Components that need styles to function at all (the visually
  hidden live regions, for example) use inline styles instead, so they work without it.
- Browsers without cascade layers (before 2022) are not supported.
- A new colour role needs a value in both theme files and a forced-colours mapping; the token build
  fails if one is missing.
