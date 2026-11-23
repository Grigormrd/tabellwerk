import { defineConfig, devices } from "@playwright/test";

// Runs against the production build (`pnpm build`), served as static files,
// with the recorded SMARD file: no request leaves the machine.
const PORT = 6008;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    // Fixed, so dates and numbers read the same everywhere: 01/02/2025 is
    // 1 February, 1,234.5 has a comma for thousands.
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
  },
  webServer: {
    command: `node ../../scripts/serve-static.mjs dist ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env["CI"],
  },
});
