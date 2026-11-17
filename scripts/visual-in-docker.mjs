// Runs the visual regression tests inside the official Playwright Docker image,
// the same image CI uses, so screenshots match pixel for pixel regardless of
// the host OS. Writes updated baselines back into the repository.
//
// Usage:
//   node scripts/visual-in-docker.mjs            compare against the baselines
//   node scripts/visual-in-docker.mjs --update   record new baselines
//
// The repository is mounted read-only and copied into the container without
// node_modules, because the host's native binaries do not run on Linux.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const screenshots = fileURLToPath(
  new URL("../packages/react/e2e/__screenshots__", import.meta.url),
);
mkdirSync(screenshots, { recursive: true });

const playwrightVersion = JSON.parse(
  readFileSync(new URL("../packages/react/package.json", import.meta.url), "utf8"),
).devDependencies["@playwright/test"];
const pnpmVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).packageManager.split("@")[1];

const update = process.argv.includes("--update");
const image = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;

const script = [
  "set -euo pipefail",
  "mkdir -p /work",
  "tar -C /src --exclude=node_modules --exclude=.git --exclude=dist --exclude=storybook-static --exclude=.turbo -cf - . | tar -C /work -xf -",
  "cd /work",
  `npm install --global --silent pnpm@${pnpmVersion}`,
  "pnpm install --frozen-lockfile --reporter=silent",
  "pnpm --filter @tabellwerk/tokens build",
  "pnpm --filter @tabellwerk/react build:docs",
  `pnpm --filter @tabellwerk/react exec playwright test --project visual ${update ? "--update-snapshots=changed" : ""}`,
  update ? "cp -r packages/react/e2e/__screenshots__/. /out/" : "true",
].join("\n");

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--ipc=host",
    "-e",
    "CI=1",
    "-e",
    "npm_config_store_dir=/pnpm-store",
    "-v",
    `${repo}:/src:ro`,
    "-v",
    `${screenshots}:/out`,
    "-v",
    "tabellwerk-pnpm-store:/pnpm-store",
    image,
    "bash",
    "-c",
    script,
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
