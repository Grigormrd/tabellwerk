import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loadDocsPages, loadStories, openDocs, openStory, type ColorScheme } from "./stories.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const MODES: { name: string; colorScheme: ColorScheme; forcedColors: "none" | "active" }[] = [
  { name: "light", colorScheme: "light", forcedColors: "none" },
  { name: "dark", colorScheme: "dark", forcedColors: "none" },
  { name: "forced colors", colorScheme: "light", forcedColors: "active" },
];

for (const story of loadStories()) {
  for (const mode of MODES) {
    test(`${story.title} / ${story.name} (${mode.name})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode.colorScheme, forcedColors: mode.forcedColors });
      await openStory(page, story.id);

      const results = await new AxeBuilder({ page })
        .include("#storybook-root")
        .withTags(WCAG_TAGS)
        .analyze();

      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });
  }
}

// The documentation pages are part of the product too: prose, tables and the
// stories embedded in them.
for (const docs of loadDocsPages()) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${docs.title} / docs page (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openDocs(page, docs.id);
      const results = await new AxeBuilder({ page })
        .include("#storybook-docs")
        .withTags(WCAG_TAGS)
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });
  }
}

test("Markdown tables in docs pages render as tables", async ({ page }) => {
  await openDocs(page, "components-datagrid--docs");
  const table = page.locator("#storybook-docs table").first();
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(19);
});

// Guards the checks above: without this, a broken theme switch would let the
// "dark" runs silently test the light theme a second time.
test("the emulated colour scheme switches the token values", async ({ page }) => {
  const [first] = loadStories();
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: "light" });
  await openStory(page, first!.id);
  expect(await background()).toBe("rgb(255, 255, 255)");

  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).toBe("rgb(18, 21, 27)");
});
