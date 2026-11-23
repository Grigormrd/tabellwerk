// Writes dist/styles.css: the token custom properties followed by the
// component styles, so that applications need a single stylesheet import.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const tokensCss = fileURLToPath(import.meta.resolve("@tabellwerk/tokens/tokens.css"));

// Order matters: the layer order statement in base.css must come first.
const sources = [
  "src/styles/base.css",
  "src/data-grid/data-grid.css",
  "src/combobox/combobox.css",
  "src/date-picker/date-picker.css",
];

const parts = [
  await readFile(new URL(sources[0], root), "utf8"),
  await readFile(tokensCss, "utf8"),
  ...(await Promise.all(sources.slice(1).map((file) => readFile(new URL(file, root), "utf8")))),
];

await writeFile(
  new URL("dist/styles.css", root),
  `/* @tabellwerk/react styles (includes @tabellwerk/tokens). */\n${parts.join("\n")}`,
);
console.log("styles: dist/styles.css written");
