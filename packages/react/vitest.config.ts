import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { pointerDoubleClick, pointerDrag } from "./vitest.commands.ts";

const dirname = fileURLToPath(new URL(".", import.meta.url));

// A fresh object per project: Vitest names the instances in place.
const browser = () => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{ browser: "chromium" as const }],
  // Desktop size: the default (414 × 896) puts wide grids partly outside the
  // frame, where real pointer input cannot reach them.
  viewport: { width: 1280, height: 900 },
  commands: { pointerDrag, pointerDoubleClick },
});

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        // Pure logic and server rendering, in Node.
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        // Keyboard and pointer tests in a real browser. `userEvent` from
        // `vitest/browser` drives Playwright, so keys go through the browser's
        // own input pipeline (Tab moves focus natively, default actions run).
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          // Real key presses go to whichever test frame has focus, so test
          // files must not run side by side in the same browser.
          fileParallelism: false,
          setupFiles: [".storybook/vitest.setup.ts"],
          browser: browser(),
        },
      },
      {
        // Every story renders, its play function passes and axe finds nothing.
        extends: true,
        plugins: [storybookTest({ configDir: `${dirname}.storybook` })],
        test: {
          name: "storybook",
          browser: browser(),
        },
      },
    ],
  },
});
