import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, grid, openDemo, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const MODES = [
  { name: "light", colorScheme: "light", forcedColors: "none" },
  { name: "dark", colorScheme: "dark", forcedColors: "none" },
  { name: "forced colors", colorScheme: "light", forcedColors: "active" },
] as const;

/** The page as it loads, and with each kind of popup open. */
const STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: "loaded", open: async () => {} },
  {
    name: "calendar open",
    open: async (page) => {
      await page
        .getByRole("button", { name: /^Change date/ })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "series list open",
    open: async (page) => {
      await page.getByRole("combobox", { name: "Series" }).click();
      await expect(page.getByRole("listbox")).toBeVisible();
    },
  },
  {
    name: "filter open",
    open: async (page) => {
      await page.getByRole("button", { name: "Filter Time" }).click();
      await expect(page.getByRole("dialog", { name: "Filter Time" })).toBeVisible();
    },
  },
];

for (const mode of MODES) {
  for (const state of STATES) {
    test(`axe: ${state.name} (${mode.name})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode.colorScheme, forcedColors: mode.forcedColors });
      await openDemo(page);
      await state.open(page);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });
  }
}

// Guards the runs above: a broken theme would let "dark" test light twice.
test("the emulated colour scheme switches the page colours", async ({ page }) => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: "light" });
  await openDemo(page);
  expect(await background()).toBe("rgb(255, 255, 255)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).not.toBe("rgb(255, 255, 255)");
  await expect(grid(page)).toBeVisible();
});
