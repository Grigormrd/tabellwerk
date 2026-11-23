import { expect, test as base, type Page } from "@playwright/test";

/**
 * Every test fails if the page asks for anything outside the local server:
 * the demo has to work from the recorded file alone.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page, baseURL }, run) => {
    const outside: string[] = [];
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(baseURL as string)) return route.continue();
      outside.push(url);
      return route.abort();
    });
    await run(page);
    expect(outside, "requests outside the local server").toEqual([]);
  },
});

export { expect };

export const TITLE = "German electricity market, hour by hour";

/** Opens the demo and waits until the data is in the grid. */
export async function openDemo(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("grid", { name: TITLE })).toBeVisible();
}

export function grid(page: Page) {
  return page.getByRole("grid", { name: TITLE });
}
