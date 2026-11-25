// Installs Tabellwerk into a fresh Vite + React + TypeScript app outside the
// repository, the way a user would, then type-checks, builds and opens it in
// Chromium to check that the grid, the combobox and the date picker work.
//
//   node scripts/smoke-test.mjs                      packed tarballs of this checkout
//   node scripts/smoke-test.mjs --registry 0.1.0     the published version from npm
//
// The packages must be built first (`pnpm build`) for the tarball mode.

import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const registryIndex = args.indexOf("--registry");
const registryVersion = registryIndex >= 0 ? args[registryIndex + 1] : undefined;
if (registryIndex >= 0 && !registryVersion) throw new Error("--registry needs a version");
const keep = args.includes("--keep");

const isWindows = process.platform === "win32";
function run(command, commandArgs, cwd) {
  console.log(`$ ${command} ${commandArgs.join(" ")}`);
  execFileSync(command, commandArgs, { cwd, stdio: "inherit", shell: isWindows });
}

const reactPackage = JSON.parse(await readFile(join(root, "packages/react/package.json"), "utf8"));
const dev = reactPackage.devDependencies;

const app = await mkdtemp(join(tmpdir(), "tabellwerk-smoke-"));
console.log(`Fresh app in ${app}`);

let tabellwerk;
let overrides = {};
if (registryVersion) {
  tabellwerk = registryVersion;
  // A version can take a moment to appear after publishing.
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync("npm", ["view", `@tabellwerk/react@${registryVersion}`, "version"], {
        stdio: "ignore",
        shell: isWindows,
      });
      break;
    } catch {
      if (attempt === 12) throw new Error(`@tabellwerk/react@${registryVersion} is not on npm`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
} else {
  const tarballs = join(app, "tarballs");
  await mkdir(tarballs);
  for (const name of ["@tabellwerk/tokens", "@tabellwerk/react"]) {
    run("pnpm", ["--filter", name, "pack", "--pack-destination", tarballs], root);
  }
  const files = await readdir(tarballs);
  const find = (prefix) => {
    const file = files.find((f) => f.startsWith(prefix));
    if (!file) throw new Error(`No tarball for ${prefix} in ${files.join(", ")}`);
    return `file:${join(tarballs, file).replaceAll("\\", "/")}`;
  };
  tabellwerk = find("tabellwerk-react-");
  // The react package depends on the tokens package by version; point that
  // at the tarball of this checkout too, not at the registry.
  overrides = { "@tabellwerk/tokens": find("tabellwerk-tokens-") };
}

const files = {
  "package.json": JSON.stringify(
    {
      name: "tabellwerk-smoke",
      private: true,
      type: "module",
      scripts: { build: "tsc --noEmit && vite build" },
      dependencies: {
        "@tabellwerk/react": tabellwerk,
        react: dev.react,
        "react-dom": dev["react-dom"],
      },
      devDependencies: {
        "@types/react": dev["@types/react"],
        "@types/react-dom": dev["@types/react-dom"],
        "@vitejs/plugin-react": dev["@vitejs/plugin-react"],
        typescript: dev.typescript,
        vite: dev.vite,
      },
      overrides,
    },
    null,
    2,
  ),
  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: ["vite/client"],
      },
      include: ["src"],
    },
    null,
    2,
  ),
  "vite.config.js": `import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({ plugins: [react()] });
`,
  "index.html": `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Tabellwerk smoke test</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`,
  "src/main.tsx": `import "@tabellwerk/react/styles.css";
import { Combobox, DataGrid, DatePicker, type ColumnDef } from "@tabellwerk/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";

interface Row { id: number; zone: string; price: number }

const zones = ["DE-LU", "FR", "NL", "AT"];
const rows: Row[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  zone: zones[i % zones.length] as string,
  price: Math.round(((i * 37) % 200) * 100) / 100,
}));
const columns: ColumnDef<Row>[] = [
  { id: "id", header: "Hour", align: "end" },
  { id: "zone", header: "Zone", filter: "values" },
  { id: "price", header: "Price", align: "end", filter: "number" },
];

function App() {
  const [zone, setZone] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>("2026-11-23");
  return (
    <main>
      <h1>Smoke test</h1>
      <Combobox
        label="Zone"
        options={zones.map((z) => ({ value: z, label: z }))}
        value={zone}
        onChange={setZone}
      />
      <p data-testid="zone">{zone ?? "none"}</p>
      <DatePicker label="Day" value={day} onChange={setDay} />
      <p data-testid="day">{day ?? "none"}</p>
      <DataGrid aria-label="Prices" rows={rows} columns={columns} style={{ height: 400 }} />
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
`,
};

for (const [name, content] of Object.entries(files)) {
  await mkdir(dirname(join(app, name)), { recursive: true });
  await writeFile(join(app, name), content);
}

run("npm", ["install", "--no-audit", "--no-fund"], app);
const installed = JSON.parse(
  await readFile(join(app, "node_modules/@tabellwerk/react/package.json"), "utf8"),
);
console.log(`Installed @tabellwerk/react ${installed.version}`);
run("npm", ["run", "build"], app);

// Serve the build and check it in a real browser.
const PORT = 6010;
const server = spawn(
  process.execPath,
  [join(root, "scripts/serve-static.mjs"), join(app, "dist"), String(PORT)],
  {
    stdio: "ignore",
  },
);
const require = createRequire(join(root, "packages/react/package.json"));
const { chromium } = require("@playwright/test");
const browser = await chromium.launch();
const failures = [];
try {
  await new Promise((r) => setTimeout(r, 500));
  const page = await browser.newPage({ locale: "en-GB" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`http://127.0.0.1:${PORT}/`);

  const check = async (name, fn) => {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (error) {
      failures.push(name);
      console.log(`  FAIL ${name}: ${error.message.split("\n")[0]}`);
    }
  };
  const expectEqual = (actual, expected) => {
    if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
  };

  const grid = page.getByRole("grid", { name: "Prices" });
  await check("the grid renders all rows virtually", async () => {
    await grid.waitFor({ timeout: 10000 });
    expectEqual(await grid.getAttribute("aria-rowcount"), "1001");
    const rendered = await grid.getByRole("row").count();
    if (rendered > 60) throw new Error(`${rendered} rows in the DOM`);
  });
  await check("a header click sorts the grid", async () => {
    const header = grid.getByRole("columnheader", { name: /^Price/ });
    await header.click();
    await header.click();
    expectEqual(await header.getAttribute("aria-sort"), "descending");
    const first = await grid.getByRole("row").nth(1).getByRole("gridcell").nth(2).textContent();
    expectEqual(first, "199");
  });
  await check("the combobox selects an option with the keyboard", async () => {
    const box = page.getByRole("combobox", { name: "Zone" });
    await box.fill("fr");
    await box.press("ArrowDown");
    await box.press("Enter");
    expectEqual(await page.getByTestId("zone").textContent(), "FR");
  });
  await check("the date picker's calendar picks a day", async () => {
    await page.getByRole("button", { name: /^Change date/ }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    expectEqual(await page.getByTestId("day").textContent(), "2026-11-24");
  });
  await check("no errors in the console", async () => {
    if (errors.length > 0) throw new Error(errors.join("; "));
  });
} finally {
  await browser.close();
  server.kill();
  if (!keep) await rm(app, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Smoke test failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`Smoke test passed with @tabellwerk/react ${installed.version}.`);
