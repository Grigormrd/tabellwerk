# @tabellwerk/tokens

Framework-neutral design tokens for Tabellwerk: CSS custom properties for light, dark and
forced-colours mode, plus typed `var()` references for JavaScript.

## Install

```bash
pnpm add @tabellwerk/tokens
```

## CSS

```css
@import "@tabellwerk/tokens/tokens.css";

.panel {
  background: var(--tbw-color-surface);
  color: var(--tbw-color-text);
  padding: var(--tbw-space-4);
}
```

The theme follows `prefers-color-scheme`. Force one with `data-tbw-theme="light"` or `"dark"` on
any element. In forced-colours mode every colour role maps to a CSS system colour. All rules live in
the cascade layer `tabellwerk.tokens`, so unlayered CSS overrides them.

## JavaScript

```ts
import { themes, vars } from "@tabellwerk/tokens";

vars.color.accent; // "var(--tbw-color-accent)"
themes.dark.accent; // resolved hex value, for canvas or chart libraries
```

Every text colour is checked against WCAG 2.1 contrast in both themes.

## License

MIT
