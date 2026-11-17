import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

interface IndexEntry {
  id: string;
  title: string;
  name: string;
  type: "story" | "docs";
  tags?: string[];
}

/** Every story of the static Storybook build, read from its index.json. */
export function loadStories(): IndexEntry[] {
  const url = new URL("../storybook-static/index.json", import.meta.url);
  let index: { entries: Record<string, IndexEntry> };
  try {
    index = JSON.parse(readFileSync(url, "utf8"));
  } catch {
    throw new Error("storybook-static/index.json is missing. Run `pnpm build:docs` first.");
  }
  const stories = Object.values(index.entries).filter(
    (entry) => entry.type === "story" && !entry.tags?.includes("skip-e2e"),
  );
  if (stories.length === 0) throw new Error("The Storybook build contains no stories.");
  return stories;
}

export const COLOR_SCHEMES = ["light", "dark"] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

/**
 * Opens a story on its own (no Storybook UI) and waits until it has rendered.
 * The theme stays on "auto", so the page follows the emulated colour scheme,
 * which exercises the `prefers-color-scheme` path of the tokens.
 */
export async function openStory(page: Page, id: string): Promise<void> {
  // `a11y.manual` stops the a11y addon from running its own axe pass inside
  // the story frame, which would collide with the one started by the tests
  // ("Axe is already running").
  await page.goto(
    `/iframe.html?id=${encodeURIComponent(id)}&viewMode=story&globals=a11y.manual:!true`,
  );
  await page.locator("#storybook-root > *").first().waitFor();
  // Wait for the play function as well, so checks and screenshots always see
  // the state the story ends in.
  await page.waitForFunction(() => {
    const preview = (window as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } })
      .__STORYBOOK_PREVIEW__;
    return preview?.currentRender?.phase === "finished";
  });
  await page.evaluate(() => document.fonts.ready);
}
