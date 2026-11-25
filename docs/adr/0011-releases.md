# 11. Releases: Changesets, npm trusted publishing, smoke test from the registry

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Two packages are published: `@tabellwerk/tokens` and `@tabellwerk/react`, which depends on the
first. Releases should be reproducible from `main`, carry a changelog written when the change was
made, and be verifiable: users should be able to see that a tarball was built from this repository
by its CI, and we should know that the published package works in a project that is not this
monorepo. No long-lived npm token should exist.

## Decision

**Changesets for versions and changelogs.** Every pull request that changes a published package
adds a changeset (`pnpm changeset`) with a user-facing summary. The two packages are `fixed`: they
always share a version number, so "Tabellwerk 0.3" means one thing. Until the API has proved
itself in the demo, versions stay at 0.x; the API report (`etc/react.api.md`) makes every change
to the public API visible in review, so a breaking change cannot slip in as a patch.

**A release workflow in two steps** (`.github/workflows/release.yml`):

1. On every push to `main`, `changesets/action` opens or updates a "Version Packages" pull request
   that applies the pending changesets: new versions and changelog entries. Pull requests opened
   by a workflow do not start other workflows, so CI on that pull request is started by hand
   (`gh workflow run ci.yml --ref changeset-release/main`); it must pass before the merge, like
   any other pull request.
2. When that pull request is merged, no changesets are left, and `scripts/publish.mjs` publishes
   every package whose version is not on npm yet. Each package is packed with pnpm, which
   replaces `workspace:^` with a real version range, and the tarball is published with npm
   through **trusted publishing** (OIDC from GitHub Actions): no token, and npm attaches a
   provenance statement linking the tarball to the commit and workflow run. The script then tags
   the release and creates a GitHub release with the changelog section.

Publishing runs only when the repository variable `NPM_PUBLISH` is `true`, so merging the
workflow itself publishes nothing.

**The first release.** Trusted publishing can only be configured for a package that already exists
on npm, so the first version cannot use it. Two ways were considered: the maintainer publishes
0.1.0 from their machine with two-factor authentication (`node scripts/publish.mjs
--no-provenance`), which leaves 0.1.0 without provenance; or a short-lived npm token, limited to
the `@tabellwerk` scope, is stored as the GitHub secret `NPM_TOKEN` for a single CI publish. The
maintainer chose the token (2026-11-25), so 0.1.0 gets provenance like every later version: the
workflow writes the token into the runner's npm configuration only if the secret exists, and
provenance comes from the OIDC token either way. After the release, trusted publishers are set up
for both packages and the token and secret are deleted; from then on npm authenticates through
OIDC alone.

**A smoke test outside the monorepo** (`scripts/smoke-test.mjs`). It creates a fresh Vite + React

- TypeScript app in a temporary folder, installs Tabellwerk with npm, type-checks it with
  `skipLibCheck: false`, builds it and checks in Chromium that the grid renders virtually and sorts,
  that the combobox selects with the keyboard and that the date picker's calendar picks a day. In CI
  it runs on every pull request with the packed tarballs of the checkout; after a release, the
  release workflow runs it against the version just published on npm.

## Consequences

- **Nothing in the monorepo can hide a packaging error.** Workspace links, path aliases and hoisted
  dependencies do not exist in the smoke test's app; missing files in `files`, wrong `exports` or
  types that only compile with this repository's settings fail it.
- **No npm token in the repository or its secrets** once trusted publishing is configured. The
  trusted publisher is bound to this repository and the workflow file name, so renaming
  `release.yml` requires updating it on npmjs.com.
- **A release needs two merges** (the feature, then "Version Packages"), each after green CI. This
  is slower than publishing on every merge, but the versions and changelog are reviewed before
  anything reaches npm.
- **A token exists for one release.** Between creating it and deleting it after 0.1.0, the
  `NPM_TOKEN` secret can publish to the scope; it is short-lived and removed as soon as trusted
  publishing works.
