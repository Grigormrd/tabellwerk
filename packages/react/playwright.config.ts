import { defineConfig, devices } from "@playwright/test";

// Runs against the static Storybook build (`pnpm build:docs`), the same files
// that are deployed as the documentation site.
const PORT = 6007;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  // Baselines are produced only in the Playwright Docker image (Linux), so
  // the file names carry no platform suffix. See docs/adr/0003.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "a11y", testMatch: "a11y.spec.ts" },
    { name: "visual", testMatch: "visual.spec.ts" },
  ],
  webServer: {
    command: `node ../../scripts/serve-static.mjs storybook-static ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env["CI"],
  },
});
