import "@tabellwerk/tokens/tokens.css";
import "../src/styles/base.css";
import "../src/data-grid/data-grid.css";
import "../src/combobox/combobox.css";
import "../src/date-picker/date-picker.css";
import "./preview.css";

import type { Decorator, Preview } from "@storybook/react-vite";
import { THEME_ATTRIBUTE } from "@tabellwerk/tokens";
import { useLayoutEffect, type ReactNode } from "react";

import { systemTheme } from "./theme.ts";

type Theme = "auto" | "light" | "dark";

/**
 * "auto" follows `prefers-color-scheme`, which is what the end-to-end tests
 * emulate; "light" and "dark" force a theme through the token attribute.
 */
function ThemeRoot({ theme, children }: { theme: Theme; children: ReactNode }): ReactNode {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute(THEME_ATTRIBUTE);
    else root.setAttribute(THEME_ATTRIBUTE, theme);
  }, [theme]);
  return children;
}

const withTheme: Decorator = (Story, context) => (
  <ThemeRoot theme={(context.globals["theme"] ?? "auto") as Theme}>
    <Story />
  </ThemeRoot>
);

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "auto", title: "System" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "auto" },
  parameters: {
    layout: "padded",
    // Docs pages follow the system theme like the stories in "System" mode.
    docs: { theme: systemTheme() },
    options: {
      storySort: { order: ["Getting started", "Theming", "Accessibility", "Components"] },
    },
    controls: { expanded: true },
    // Fail the Vitest run on any axe violation (default theme). The
    // Playwright suite repeats the check in light, dark and forced colours.
    a11y: { test: "error" },
  },
  tags: ["autodocs"],
};

export default preview;
