import { createRequire } from "node:module";
import { sep } from "node:path";
import { describe, expect, it } from "vitest";

// The demo uses the library as an installed package would: through the
// package.json exports, which point at the built files, never at its source.
describe("the demo's view of the library", () => {
  const require = createRequire(import.meta.url);

  it.each([
    ["@tabellwerk/react", ["packages", "react", "dist", "index.js"]],
    ["@tabellwerk/react/styles.css", ["packages", "react", "dist", "styles.css"]],
    ["@tabellwerk/tokens", ["packages", "tokens", "dist", "index.js"]],
  ])("resolves %s to its built file", (specifier, parts) => {
    expect(require.resolve(specifier).endsWith(parts.join(sep))).toBe(true);
  });
});
