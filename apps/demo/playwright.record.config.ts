import { defineConfig, devices } from "@playwright/test";

// Records the README preview (`pnpm --filter demo record:preview`): a video of
// the production build, turned into a GIF by scripts/preview-gif.mjs.
const PORT = 6008;
const SIZE = { width: 1280, height: 800 };

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.record.ts",
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
    video: { mode: "on", size: SIZE },
  },
  webServer: {
    command: `node ../../scripts/serve-static.mjs dist ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
  },
});
