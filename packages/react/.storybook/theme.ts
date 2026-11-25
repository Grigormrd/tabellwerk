import { themes as tokens } from "@tabellwerk/tokens";
import { create } from "storybook/theming";

const brand = {
  brandTitle: "Tabellwerk",
  brandUrl: "https://github.com/Grigormrd/tabellwerk",
  brandTarget: "_blank",
};

/** Storybook's own UI and the docs pages, in the token colours. */
export const lightTheme = create({
  base: "light",
  ...brand,
  colorSecondary: tokens.light.accent,
  appBg: tokens.light.surface,
  appContentBg: tokens.light.bg,
  appBorderColor: tokens.light.border,
  textColor: tokens.light.text,
  textMutedColor: tokens.light["text-muted"],
  barBg: tokens.light.bg,
});

export const darkTheme = create({
  base: "dark",
  ...brand,
  colorSecondary: tokens.dark.accent,
  appBg: tokens.dark.surface,
  appContentBg: tokens.dark.bg,
  appBorderColor: tokens.dark.border,
  textColor: tokens.dark.text,
  textMutedColor: tokens.dark["text-muted"],
  barBg: tokens.dark.bg,
  barTextColor: tokens.dark["text-muted"],
  barSelectedColor: tokens.dark.accent,
});

/**
 * Follows the operating system's preference when the page loads; the
 * toolbar's theme switch changes the stories, not Storybook's own UI.
 */
export function systemTheme() {
  const dark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? darkTheme : lightTheme;
}
