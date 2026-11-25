// The interactions shown in the README preview. Mostly keyboard, because the
// recording shows focus rings but no mouse pointer.

import { test } from "@playwright/test";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("preview", async ({ page }) => {
  await page.goto("/");
  const grid = page.getByRole("grid", { name: "German electricity market, hour by hour" });
  await grid.waitFor();
  await pause(1200);

  // Scroll through ten years of hours: only the rows in view exist.
  await grid.hover();
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 4000);
    await pause(150);
  }
  await pause(500);

  // Keyboard into the grid: one tab stop, then arrows and Page Down.
  await grid.getByRole("gridcell").first().click();
  for (const key of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "PageDown"]) {
    await page.keyboard.press(key);
    await pause(280);
  }
  await page.keyboard.press("Control+Home");
  await pause(500);

  // Sort by price, highest first, from the header with Enter.
  for (const key of ["ArrowRight", "ArrowRight"]) {
    await page.keyboard.press(key);
    await pause(250);
  }
  await page.keyboard.press("Enter");
  await pause(500);
  await page.keyboard.press("Enter");
  await pause(1300);

  // The last 365 days.
  await page.getByRole("button", { name: "Last 365 days" }).click();
  await pause(900);

  // Add a series with the combobox.
  const series = page.getByRole("combobox", { name: "Series" });
  await series.click();
  await pause(300);
  await series.pressSequentially("bio", { delay: 120 });
  await pause(400);
  await series.press("ArrowDown");
  await pause(300);
  await series.press("Enter");
  await pause(500);
  await page.keyboard.press("Escape");
  await pause(700);

  // Move the start of the period a month back in the calendar.
  await page
    .getByRole("button", { name: /^Change date/ })
    .first()
    .click();
  await pause(700);
  await page.keyboard.press("PageUp");
  await pause(500);
  await page.keyboard.press("ArrowLeft");
  await pause(400);
  await page.keyboard.press("Enter");
  await pause(1500);

  await page.close();
  await page.video()?.saveAs("test-results/preview.webm");
});
