// Performance measurements on the production Storybook build.
//
// Interaction cost is measured with the Event Timing API, the same data INP
// is computed from: the time from the input event until the next frame is
// painted. Scrolling is measured with the Long Animation Frames API.
//
// Each measurement runs RUNS times in a fresh page; the median is compared
// with the budgets in perf-budgets.json. Results are written to
// test-results/perf.json and printed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const budgets = JSON.parse(
  readFileSync(new URL("./perf-budgets.json", import.meta.url), "utf8"),
) as {
  cpuThrottling: number;
  runs: number;
  budgets: Record<string, number>;
};

const RUNS = Number(process.env["PERF_RUNS"] ?? budgets.runs);
const CPU = Number(process.env["PERF_CPU"] ?? budgets.cpuThrottling);
const ROW_HEIGHT = 36;
const SCROLL_FRAMES = 250;
const ROWS_PER_FRAME = 40; // 250 × 40 = 10,000 rows, each frame shows all-new rows

test.describe.configure({ mode: "serial" });

const results: Record<string, number[]> = {};
const record = (name: string, value: number) => (results[name] ??= []).push(value);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

async function open(page: Page, story: string) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=a11y.manual:!true`);
  await page.getByRole("button", { name: "Mount grid" }).waitFor();
  // Collect Event Timing entries (≥ 16 ms, the smallest threshold allowed)
  // and long animation frames from here on.
  await page.evaluate(() => {
    const w = window as unknown as { __events: PerformanceEntry[]; __loaf: PerformanceEntry[] };
    w.__events = [];
    w.__loaf = [];
    new PerformanceObserver((list) => w.__events.push(...list.getEntries())).observe({
      type: "event",
      durationThreshold: 16,
    } as PerformanceObserverInit);
    new PerformanceObserver((list) => w.__loaf.push(...list.getEntries())).observe({
      type: "long-animation-frame",
    });
  });
}

/** Longest Event Timing duration since the last call, for the given event types. */
async function takeInteraction(page: Page, types: string[]): Promise<number> {
  // Event Timing entries are delivered after the next paint.
  await page.waitForTimeout(300);
  return page.evaluate((names) => {
    const w = window as unknown as { __events: PerformanceEventTiming[] };
    const entries = w.__events.filter((e) => names.includes(e.name));
    w.__events = [];
    // Entries below the 16 ms threshold are not reported at all.
    return entries.length ? Math.max(...entries.map((e) => e.duration)) : 16;
  }, types);
}

async function mount(page: Page): Promise<number> {
  await page.getByRole("button", { name: "Mount grid" }).click();
  await page.locator('[role="grid"] [aria-rowindex="2"]').waitFor();
  return takeInteraction(page, ["pointerdown", "pointerup", "click"]);
}

async function scroll(page: Page): Promise<{ longFrames: number; worstFrame: number }> {
  await page.evaluate(() => ((window as unknown as { __loaf: unknown[] }).__loaf = []));
  await page.evaluate(
    ({ frames, step }) =>
      new Promise<void>((resolve) => {
        const grid = document.querySelector<HTMLElement>('[role="grid"]')!;
        let n = 0;
        const tick = () => {
          grid.scrollTop += step;
          if (++n < frames) requestAnimationFrame(tick);
          else requestAnimationFrame(() => resolve());
        };
        requestAnimationFrame(tick);
      }),
    { frames: SCROLL_FRAMES, step: ROWS_PER_FRAME * ROW_HEIGHT },
  );
  await page.waitForTimeout(300);
  // Every frame must show rows, not the empty spacer.
  const firstVisible = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('[role="grid"]')!;
    return Math.floor(grid.scrollTop / 36) + 2;
  });
  await expect(page.locator(`[role="grid"] [aria-rowindex="${firstVisible}"]`)).toBeAttached();
  return page.evaluate(() => {
    const frames = (window as unknown as { __loaf: PerformanceEntry[] }).__loaf;
    return {
      longFrames: frames.filter((f) => f.duration > 50).length,
      worstFrame: frames.length ? Math.max(...frames.map((f) => f.duration)) : 0,
    };
  });
}

for (const [variant, story] of [
  ["tabellwerk", "benchmarks-datagrid--tabellwerk"],
  ["tanstack", "benchmarks-datagrid--tan-stack-virtual"],
] as const) {
  for (let run = 0; run < RUNS; run++) {
    test(`${variant}: mount and scroll 100,000 rows (run ${run + 1})`, async ({ page }) => {
      await open(page, story);
      record(`${variant}.mount`, await mount(page));
      const { longFrames, worstFrame } = await scroll(page);
      record(`${variant}.scrollLongFrames`, longFrames);
      record(`${variant}.scrollWorstFrame`, worstFrame);
    });
  }
}

for (let run = 0; run < RUNS; run++) {
  test(`tabellwerk: sort and keyboard on 100,000 rows (run ${run + 1})`, async ({ page }) => {
    await open(page, "benchmarks-datagrid--tabellwerk");
    await mount(page);

    const price = page.getByRole("columnheader", { name: /Price/ });
    await price.click();
    await expect(price).toHaveAttribute("aria-sort", "ascending");
    record(
      "tabellwerk.sortNumbers",
      await takeInteraction(page, ["pointerdown", "pointerup", "click"]),
    );

    const zone = page.getByRole("columnheader", { name: /Zone/ });
    await zone.click();
    await expect(zone).toHaveAttribute("aria-sort", "ascending");
    record(
      "tabellwerk.sortStrings",
      await takeInteraction(page, ["pointerdown", "pointerup", "click"]),
    );

    await page.locator('[role="gridcell"]').first().click();
    await takeInteraction(page, ["pointerdown", "pointerup", "click"]);
    let worst = 0;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(i % 5 === 4 ? "PageDown" : "ArrowDown");
      worst = Math.max(worst, await takeInteraction(page, ["keydown", "keyup"]));
    }
    record("tabellwerk.keyboardStep", worst);
  });
}

for (let run = 0; run < RUNS; run++) {
  test(`tabellwerk: filter and resize on 100,000 rows (run ${run + 1})`, async ({ page }) => {
    await open(page, "benchmarks-datagrid--tabellwerk");
    await mount(page);
    const grid = page.getByRole("grid");

    // Typing into the text filter: every key press tests 100,000 rows.
    await page.getByRole("button", { name: "Filter #" }).click();
    await takeInteraction(page, ["pointerdown", "pointerup", "click"]);
    let worstKey = 0;
    let worstResult = 0;
    for (const key of "1234") {
      // Event Timing ends at the next paint, which shows the typed character.
      // The rows are filtered in a deferred render after that, so also time
      // the key press until the grid's row count has changed.
      await page.evaluate(() => {
        const w = window as unknown as { __filterDone: Promise<number> };
        const grid = document.querySelector('[role="grid"]')!;
        const before = grid.getAttribute("aria-rowcount");
        w.__filterDone = new Promise((resolve) => {
          let start = 0;
          document.addEventListener("keydown", () => (start = performance.now()), {
            capture: true,
            once: true,
          });
          new MutationObserver((_, observer) => {
            if (grid.getAttribute("aria-rowcount") === before) return;
            observer.disconnect();
            requestAnimationFrame(() => resolve(performance.now() - start));
          }).observe(grid, { attributes: true, attributeFilter: ["aria-rowcount"] });
        });
      });
      await page.keyboard.press(key);
      worstResult = Math.max(
        worstResult,
        await page.evaluate(
          () => (window as unknown as { __filterDone: Promise<number> }).__filterDone,
        ),
      );
      worstKey = Math.max(worstKey, await takeInteraction(page, ["keydown", "keyup", "keypress"]));
    }
    // The 20 ids from 1 to 100,000 that contain "1234", plus the header row.
    await expect(grid).toHaveAttribute("aria-rowcount", "21");
    record("tabellwerk.filterKeystroke", worstKey);
    record("tabellwerk.filterResult", worstResult);
    await page.keyboard.press("Escape");

    // Dragging a column edge 200 px in 20 steps: long frames during the drag.
    const handle = page.getByRole("separator", { name: "Resize Zone" });
    const box = (await handle.boundingBox())!;
    await page.evaluate(() => ((window as unknown as { __loaf: unknown[] }).__loaf = []));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 20 });
    await page.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", "320");
    await page.waitForTimeout(300);
    record(
      "tabellwerk.resizeWorstFrame",
      await page.evaluate(() => {
        const frames = (window as unknown as { __loaf: PerformanceEntry[] }).__loaf;
        return frames.length ? Math.max(...frames.map((f) => f.duration)) : 0;
      }),
    );
  });
}

test.afterAll(() => {
  const summary = Object.fromEntries(
    Object.entries(results).map(([name, values]) => [name, { median: median(values), values }]),
  );
  mkdirSync(new URL("../test-results/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../test-results/perf.json", import.meta.url),
    JSON.stringify({ cpuThrottling: CPU, runs: RUNS, results: summary }, null, 2),
  );
  console.log(`\nPerformance (CPU throttling ${CPU}×, median of ${RUNS} runs, ms or count):`);
  for (const [name, { median: m, values }] of Object.entries(summary)) {
    const budget = budgets.budgets[name];
    console.log(
      `  ${name.padEnd(28)} ${String(Math.round(m)).padStart(6)}   budget ${budget ?? "-"}   runs ${values.map(Math.round).join(", ")}`,
    );
  }
});

test("medians stay within the budgets", () => {
  test.skip(Object.keys(results).length === 0, "Run the whole file to compare with budgets.");
  const failures = Object.entries(budgets.budgets).flatMap(([name, budget]) => {
    const values = results[name];
    if (!values) return [];
    const m = median(values);
    return m > budget ? [`${name}: median ${Math.round(m)} > budget ${budget}`] : [];
  });
  expect(failures).toEqual([]);
});
