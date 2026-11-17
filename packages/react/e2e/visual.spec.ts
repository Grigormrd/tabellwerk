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
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        `${story.id}--${colorScheme}.png`,
      );
    });
  }
}
