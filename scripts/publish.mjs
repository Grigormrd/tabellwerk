// Releases the public packages in two halves (ADR 11):
//
// - Without flags, run by the release workflow after a "Version Packages" pull
//   request is merged: stages every package version that has no git tag yet
//   on npm (`npm stage publish`, with provenance from GitHub Actions), tags it
//   and creates a draft GitHub release from the changelog. A staged version is
//   not public until a maintainer approves it on npmjs.com with 2FA.
// - With `--finish`, run by the finish-release workflow: publishes the draft
//   GitHub release of every version that is on npm by now (approved).
//
// `--dry-run` stages nothing and writes no tags or releases. Each package is
// packed with pnpm first, which replaces `workspace:^` with real version
// ranges.

import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const finish = process.argv.includes("--finish");
const shell = process.platform === "win32";

/** In release order: the react package depends on the tokens package. */
const PACKAGES = ["packages/tokens", "packages/react"];

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(" ")}`);
  return execFileSync(command, args, { stdio: "inherit", shell, ...options });
}

function read(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell,
    }).trim();
  } catch {
    return null;
  }
}

/** Approved and public; a staged version is not visible here yet. */
function isPublished(name, version) {
  return read("npm", ["view", `${name}@${version}`, "version"]) === version;
}

function hasTag(tag) {
  return Boolean(read("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`]));
}

/** `true` for a draft release, `false` for a published one, `null` for none. */
function isDraftRelease(tag) {
  const out = read("gh", ["release", "view", tag, "--json", "isDraft", "--jq", ".isDraft"]);
  return out === null ? null : out === "true";
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

async function packages() {
  const result = [];
  for (const dir of PACKAGES) {
    const {
      name,
      version,
      private: isPrivate,
    } = JSON.parse(await readFile(join(root, dir, "package.json"), "utf8"));
    if (!isPrivate) result.push({ dir, name, version, tag: `${name}@${version}` });
  }
  return result;
}

async function stage() {
  const staged = [];
  for (const { dir, name, version, tag } of await packages()) {
    // The tag is written when a version is staged, so it also marks versions
    // that wait for approval (npm shows those only to maintainers).
    if (hasTag(tag) || isPublished(name, version)) {
      console.log(`${tag} is already staged or published.`);
      continue;
    }
    const destination = await mkdtemp(join(tmpdir(), "tabellwerk-publish-"));
    run("pnpm", ["pack", "--pack-destination", destination], { cwd: join(root, dir) });
    const [tarball] = await readdir(destination);
    const args = ["stage", "publish", join(destination, tarball), "--access", "public"];
    args.push("--provenance");
    if (dryRun) args.push("--dry-run");
    run("npm", args);
    staged.push({ dir, version, tag });
  }
  if (staged.length === 0) {
    console.log("Nothing to stage.");
    return;
  }
  if (dryRun) return;
  for (const { dir, version, tag } of staged) {
    run("git", ["tag", tag]);
    run("git", ["push", "origin", tag]);
    const notes = (await releaseNotes(dir, version)) || `Released ${tag} on npm.`;
    run("gh", ["release", "create", tag, "--draft", "--title", tag, "--notes", notes]);
    console.log(`Staged: ${tag}`);
  }
}

async function finishReleases() {
  const finished = [];
  for (const { name, version, tag } of await packages()) {
    if (isDraftRelease(tag) !== true) continue;
    if (!isPublished(name, version)) {
      console.log(`${tag} is staged but not approved yet.`);
      continue;
    }
    if (!dryRun) run("gh", ["release", "edit", tag, "--draft=false"]);
    finished.push(tag);
  }
  if (finished.length === 0) console.log("No approved versions to finish.");
  for (const tag of finished) console.log(`New version: ${tag}`);
}

await (finish ? finishReleases() : stage());
