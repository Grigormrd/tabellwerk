import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// No aliases: `@tabellwerk/react` resolves through its package.json exports to
// the built `dist` files, exactly as it would for an application installing it
// from npm. Turborepo builds the packages first (`dependsOn: ["^build"]`).
export default defineConfig({
  plugins: [react()],
  build: { target: "es2023" },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
