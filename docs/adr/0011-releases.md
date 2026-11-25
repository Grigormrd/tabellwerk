# 11. Releases: Changesets, staged trusted publishing, smoke test from the registry

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Two packages are published: `@tabellwerk/tokens` and `@tabellwerk/react`, which depends on the
first. Releases should be reproducible from `main`, carry a changelog written when the change was
made, and be verifiable: users should be able to see that a tarball was built from this repository
by its CI, and we should know that the published package works in a project that is not this
monorepo. No long-lived npm token should exist, and a compromised workflow alone should not be
able to put a version on npm.

## Decision

**Changesets for versions and changelogs.** Every pull request that changes a published package
adds a changeset (`pnpm changeset`) with a user-facing summary. The two packages are `fixed`: they
always share a version number, so "Tabellwerk 0.3" means one thing. Until the API has proved
itself in the demo, versions stay at 0.x; the API report (`etc/react.api.md`) makes every change
to the public API visible in review, so a breaking change cannot slip in as a patch.

**A release in three steps:**

1. On every push to `main`, `changesets/action` (`.github/workflows/release.yml`) opens or
   updates a "Version Packages" pull request that applies the pending changesets: new versions and
   changelog entries. Pull requests opened by a workflow do not start other workflows, so CI on
   that pull request is started by hand (`gh workflow run ci.yml --ref changeset-release/main`);
   it must pass before the merge, like any other pull request.
2. When that pull request is merged, no changesets are left, and `scripts/publish.mjs` **stages**
   every package version that has no git tag yet. Each package is packed with pnpm, which replaces
   `workspace:^` with a real version range, and the tarball is uploaded with `npm stage publish`
   through **trusted publishing** (OIDC from GitHub Actions): no token, and npm attaches a
   provenance statement linking the tarball to the commit and workflow run. The script tags the
   version and creates a **draft** GitHub release with the changelog section. The tag also marks
   a version as staged, since npm shows staged versions only to maintainers.
3. A maintainer **approves** the staged versions on npmjs.com (or with `npm stage approve`), which
   asks for their second factor; only then are they public. The "Finish release" workflow
   (`.github/workflows/finish-release.yml`, every three hours and by hand) publishes the draft
   GitHub release of every version that is on npm by now and runs the smoke test against it.

The trusted publishers of both packages allow only `npm stage publish`, as npm recommends; a
direct `npm publish` from the workflow is refused. Staging runs only when the repository variable
`NPM_PUBLISH` is `true`.

To withdraw a staged version, reject it on npmjs.com and delete its tag and draft release. npm
does not say whether a rejected version number can be staged again, so the safe way forward is a
new changeset and the next version.

**The first release.** Trusted publishing and staging both need a package that already exists on
npm. Two ways were considered: the maintainer publishes 0.1.0 from their machine with two-factor
authentication, which leaves 0.1.0 without provenance; or a short-lived npm token, limited to the
`@tabellwerk` scope and allowed to bypass two-factor authentication, is stored as a GitHub secret
for a single CI publish with `npm publish`. The maintainer chose the token, so 0.1.0 has provenance
like every later version. It was published on 2026-11-25; afterwards the trusted publishers were
set up and the token and secret deleted, and the workflow moved to staging.

Two things went wrong on the way, both fixed. The first run was green although npm rejected the
upload (the token could not bypass two-factor authentication yet): the step piped the script
through `tee` without `pipefail`, so it took `tee`'s exit code (#17). And after the successful
publish, npm kept answering 404 for the new packages for about five minutes, longer than the smoke
test waited; it now waits up to ten.

**A smoke test outside the monorepo** (`scripts/smoke-test.mjs`). It creates a fresh Vite, React
and TypeScript app in a temporary folder, installs Tabellwerk with npm, type-checks it with
`skipLibCheck: false`, builds it and checks in Chromium that the grid renders virtually and sorts,
that the combobox selects with the keyboard and that the date picker's calendar picks a day. In CI
it runs on every pull request with the packed tarballs of the checkout; after an approval, the
finish workflow runs it against the version on npm.

## Consequences

- **Nothing in the monorepo can hide a packaging error.** Workspace links, path aliases and hoisted
  dependencies do not exist in the smoke test's app; missing files in `files`, wrong `exports` or
  types that only compile with this repository's settings fail it.
- **No npm token anywhere.** The trusted publisher is bound to this repository and the workflow
  file name, so renaming `release.yml` requires updating it on npmjs.com.
- **No version reaches npm without a person.** A compromised dependency or workflow can at most
  stage a version, which a maintainer would have to approve with their second factor.
- **A release needs two merges and one approval** (the feature, then "Version Packages", then the
  approval on npm), each after green CI. The GitHub release and the registry smoke test follow the
  approval by up to three hours unless the finish workflow is started by hand.
