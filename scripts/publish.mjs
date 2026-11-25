// Publishes every public package whose current version is not on npm yet,
// then tags the release and creates a GitHub release from the changelog.
// Run by the release workflow after a "Version Packages" pull request is
// merged (ADR 11); `--dry-run` shows what would happen without publishing.
//
// Each package is packed with pnpm first, which replaces `workspace:^` with
// real version ranges, and the tarball is published with npm, which signs it
// with provenance from GitHub Actions (OIDC trusted publishing, no token).

import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
// Provenance needs GitHub Actions; `--no-provenance` is for a publish from a
// developer machine, such as the very first one before trusted publishing
// can be configured.
const provenance = !process.argv.includes("--no-provenance");
const shell = process.platform === "win32";

/** In publishing order: the react package depends on the tokens package. */
const PACKAGES = ["packages/tokens", "packages/react"];

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(" ")}`);
  return execFileSync(command, args, { stdio: "inherit", shell, ...options });
}

function isPublished(name, version) {
  try {
    const out = execFileSync("npm", ["view", `${name}@${version}`, "version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell,
    });
    return out.trim() === version;
  } catch {
    return false; // 404: the package or the version does not exist yet
  }
}

/** The changelog section of one version, for the GitHub release notes. */
async function releaseNotes(dir, version) {
  try {
    const changelog = await readFile(join(root, dir, "CHANGELOG.md"), "utf8");
    const start = changelog.indexOf(`## ${version}`);
    if (start < 0) return "";
    const rest = changelog.slice(start + `## ${version}`.length);
    const end = rest.search(/\n## /);
    return (end < 0 ? rest : rest.slice(0, end)).trim();
  } catch {
    return "";
  }
}

const published = [];
for (const dir of PACKAGES) {
  const {
    name,
    version,
    private: isPrivate,
  } = JSON.parse(await readFile(join(root, dir, "package.json"), "utf8"));
  if (isPrivate) continue;
  if (isPublished(name, version)) {
    console.log(`${name}@${version} is already on npm.`);
    continue;
  }
  const destination = await mkdtemp(join(tmpdir(), "tabellwerk-publish-"));
  run("pnpm", ["pack", "--pack-destination", destination], { cwd: join(root, dir) });
  const [tarball] = await readdir(destination);
  const args = ["publish", join(destination, tarball), "--access", "public"];
  args.push(provenance ? "--provenance" : "--provenance=false");
  if (dryRun) args.push("--dry-run");
  run("npm", args);
  published.push({ dir, name, version });
}

if (published.length === 0) {
  console.log("Nothing to publish.");
} else if (!dryRun) {
  for (const { dir, name, version } of published) {
    const tag = `${name}@${version}`;
    run("git", ["tag", tag]);
    run("git", ["push", "origin", tag]);
    const notes = (await releaseNotes(dir, version)) || `Published ${tag} to npm.`;
    run("gh", ["release", "create", tag, "--title", tag, "--notes", notes]);
  }
}
for (const { name, version } of published) console.log(`New version: ${name}@${version}`);
