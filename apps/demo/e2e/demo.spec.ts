import type { Page } from "@playwright/test";

import { count, period, recording, rows, typed } from "./data.ts";
import { expect, grid, openDemo, test } from "./fixtures.ts";

const lastDay = rows.at(-1)!.day.toISOString().slice(0, 10);
const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
const price = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function expectRows(page: Page, n: number) {
  await expect(grid(page)).toHaveAttribute("aria-rowcount", String(n + 1));
  await expect(page.getByText(`${count(n)} hours from`)).toBeVisible();
}

/** Types a period into the two date fields; From first, as To may not end before it. */
async function choosePeriod(page: Page, from: string, to: string) {
  const fromField = page.getByRole("textbox", { name: "From" });
  await fromField.fill(typed(from));
  await fromField.press("Enter");
  const toField = page.getByRole("textbox", { name: "To" });
  await toField.fill(typed(to));
  await toField.press("Enter");
}

test("shows every recorded hour, newest first, and names the source", async ({ page }) => {
  await openDemo(page);
  await expectRows(page, rows.length);

  const newest = grid(page).getByRole("row").nth(1);
  await expect(newest.getByRole("gridcell").nth(0)).toHaveText(dayFormat.format(rows.at(-1)!.day));
  await expect(newest.getByRole("gridcell").nth(1)).toHaveText("23:00");

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Bundesnetzagentur | SMARD.de" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "CC BY 4.0" })).toBeVisible();
  const recorded = dayFormat.format(new Date(`${recording.recorded}T00:00:00Z`));
  await expect(footer).toContainText(`recorded on ${recorded}`);
});

test("quick periods and typed dates narrow the rows", async ({ page }) => {
  await openDemo(page);

  const lastWeek = page.getByRole("button", { name: "Last 7 days" });
  await lastWeek.click();
  await expect(lastWeek).toHaveAttribute("aria-pressed", "true");
  await expectRows(page, period(addDays(lastDay, -6), lastDay).length);

  await choosePeriod(page, "2025-01-01", "2025-12-31");
  await expect(lastWeek).toHaveAttribute("aria-pressed", "false");
  await expectRows(page, 8760);

  await page.getByRole("button", { name: "Everything" }).click();
  await expectRows(page, rows.length);
});

test("the calendar moves the start of the period with the keyboard", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Last 7 days" }).click();

  const from = page.getByRole("textbox", { name: "From" });
  await page
    .getByRole("button", { name: /^Change date/ })
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const calendar = page.getByRole("dialog");
  await expect(calendar).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(calendar).toBeHidden();

  const start = addDays(lastDay, -7);
  await expect(from).toHaveValue(typed(start));
  await expectRows(page, period(start, lastDay).length);
});

test("each series is a column; removing and adding one changes the columns", async ({ page }) => {
  await openDemo(page);
  const header = (name: string) =>
    grid(page).getByRole("columnheader", { name: new RegExp(`^${name}`) });

  await expect(header("Solar \\(MWh\\)")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove Solar" }).click();
  await expect(header("Solar \\(MWh\\)")).toHaveCount(0);

  const series = page.getByRole("combobox", { name: "Series" });
  await series.fill("nucl");
  await series.press("ArrowDown");
  await series.press("Enter");
  await expect(header("Nuclear \\(MWh\\)")).toHaveCount(1);
  // Columns keep a fixed order, whatever order the series were picked in.
  await expect(grid(page).getByRole("columnheader").last()).toHaveAccessibleName(/^Nuclear/);
});

test("sorting by price puts the most expensive hour of 2025 first", async ({ page }) => {
  await openDemo(page);
  await choosePeriod(page, "2025-01-01", "2025-12-31");

  const prices = period("2025-01-01", "2025-12-31").map((row) => row.price ?? -Infinity);
  const highest = Math.max(...prices);

  const priceHeader = grid(page).getByRole("columnheader", { name: /^Price/ });
  await priceHeader.click();
  await expect(priceHeader).toHaveAttribute("aria-sort", "ascending");
  await priceHeader.click();
  await expect(priceHeader).toHaveAttribute("aria-sort", "descending");

  const first = grid(page).getByRole("row").nth(1);
  await expect(first.getByRole("gridcell").nth(2)).toHaveText(price.format(highest));
});

test("a number filter finds the hours of 2025 with negative prices", async ({ page }) => {
  await openDemo(page);
  await choosePeriod(page, "2025-01-01", "2025-12-31");
  const negative = period("2025-01-01", "2025-12-31").filter(
    (row) => row.price !== null && row.price <= -0.01,
  ).length;
  expect(negative).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Filter Price (EUR/MWh)" }).click();
  await page.getByRole("spinbutton", { name: "Maximum" }).fill("-0.01");
  await page.keyboard.press("Escape");

  await expect(grid(page)).toHaveAttribute("aria-rowcount", String(negative + 1));
  await expect(grid(page).getByRole("columnheader", { name: /^Price/ })).toHaveAccessibleName(
    /filtered/,
  );
});

test("the theme choice applies at once and survives a reload", async ({ page }) => {
  await openDemo(page);
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-tbw-theme");

  await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
  await expect(html).toHaveAttribute("data-tbw-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-tbw-theme", "dark");
  await expect(page.getByRole("combobox", { name: "Theme" })).toHaveValue("dark");
});

test("a failed download says so and can be tried again", async ({ page }) => {
  let fail = true;
  await page.route("**/data/smard-hourly.json", (route) =>
    fail ? route.fulfill({ status: 503, body: "" }) : route.fallback(),
  );
  await page.goto("/");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("The data could not be loaded. The server answered 503.");

  fail = false;
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(grid(page)).toBeVisible();
  await expect(alert).toBeHidden();
});

test("no column header is cut off, also with a sort arrow and every series", async ({ page }) => {
  await openDemo(page);
  const series = page.getByRole("combobox", { name: "Series" });
  // Add every series that is not shown yet.
  for (const name of [
    "Biomass",
    "Hydro",
    "Other renewables",
    "Hard coal",
    "Nuclear",
    "Pumped storage",
    "Other conventional",
  ]) {
    await series.fill(name);
    await series.press("ArrowDown");
    await series.press("Enter");
  }
  await page.keyboard.press("Escape");

  const priceHeader = grid(page).getByRole("columnheader", { name: /^Price/ });
  await priceHeader.click();
  await priceHeader.click();
  await expect(priceHeader).toHaveAttribute("aria-sort", "descending");

  const cut = await grid(page)
    .locator('[role="columnheader"] .tbw-grid__text')
    .evaluateAll((texts) =>
      texts.filter((t) => t.scrollWidth > t.clientWidth).map((t) => t.textContent),
    );
  expect(cut).toEqual([]);
  await expect(grid(page).getByRole("columnheader")).toHaveCount(16);
});
