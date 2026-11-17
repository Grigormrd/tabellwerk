import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "live-announcer": "src/live-announcer/index.ts",
    "visually-hidden": "src/visually-hidden/index.ts",
  },
  format: "esm",
  platform: "browser",
  target: "es2023",
  tsconfig: "tsconfig.lib.json",
  dts: true,
  sourcemap: true,
  clean: true,
  // Hooks and context make every entry a client module in React Server
  // Components; the directive must be the first statement of each file.
  banner: { js: '"use client";' },
  outputOptions: {
    chunkFileNames: "chunks/[name]-[hash].js",
  },
});
