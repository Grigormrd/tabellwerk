import { expect, test } from "@playwright/test";
import { COLOR_SCHEMES, loadStories, openStory } from "./stories.ts";

// Pixel baselines are only valid for the Playwright Linux image they were
// recorded in. Locally, run `pnpm visual:update` (Docker) instead.
test.skip(
  process.platform !== "linux",
  "Visual baselines are recorded on Linux; use `pnpm visual:update` (Docker).",
);

for (const story of loadStories()) {
  for (const colorScheme of COLOR_SCHEMES) {
    test(`${story.title} / ${story.name} (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 800, height: 600 });
      await openStory(page, story.id);
      // The whole viewport, not the story element: popups (combobox lists,
      // filter dialogs) are in the top layer and may extend beyond it.
      await expect(page).toHaveScreenshot(`${story.id}--${colorScheme}.png`);
    });
  }
}
