# 1. Monorepo, package layout and toolchain

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

Tabellwerk is a library, not an application. Other developers install it, so the published files,
the public API and the supported environments matter as much as the code. Design tokens should be
usable without React (in plain CSS or another framework), the components need React.

## Decision

**Repository.** pnpm workspaces and Turborepo, as in the author's other projects:

- `packages/tokens` → `@tabellwerk/tokens`: design tokens, no runtime dependencies.
- `packages/react` → `@tabellwerk/react`: components and hooks, depends on the tokens.
- `apps/*`: the demo application (later phase). It consumes the **built** packages like any other
  user would, not their source.

Both packages share one version number (Changesets `fixed`), so users never have to work out which
tokens version matches which components version.

**Package format.**

- ESM only, with `exports` maps and no `main`/`module` fields. Every supported bundler and Node.js
  version resolves ESM; dual CommonJS builds double the surface for no current user.
- One entry point per component (`@tabellwerk/react/live-announcer`, later `/data-grid`, …) plus an
  index that re-exports everything. `sideEffects` lists only CSS, so unused components are dropped.
  size-limit measures each entry point on its own, which proves the tree-shaking claim in CI.
- Built with tsdown (Rolldown). Every JavaScript file starts with `"use client"`, because the
  components use hooks and context and must be client components under React Server Components.
- Checked before every merge with publint (package.json and files), Are the Types Wrong (type
  resolution for `node16` and `bundler`) and API Extractor. The API report
  (`packages/react/etc/react.api.md`) is committed; any change to the public API shows up as a diff in
  the pull request and must be updated on purpose (`pnpm --filter @tabellwerk/react api:update`).
- The published source is compiled with `isolatedDeclarations`: every export has an explicit type,
  so the API is written down, not inferred from implementation details.

**Supported environments.**

- React 19 only (`peerDependencies: react ^19`). React 19 removes `forwardRef` (refs are props) and
  renders `<Context>` as a provider; supporting 18 as well would mean two code paths and a second
  test matrix. This is a deliberate limit for a new library and is stated in the README.
- TypeScript 6.0 for the build and for users' type checking. TypeScript 7 (the native compiler) is
  released, but typescript-eslint 8.73 supports only `typescript <6.1`, and the API Extractor
  version used here bundles TypeScript 6.0. The declaration files tsdown emits are plain `.d.ts` and
  work with TypeScript 7 consumers too.
- ESLint 9, not 10: eslint-plugin-jsx-a11y declares support up to ESLint 9.
- Playwright is pinned to 1.65.0: its Chromium build (1254) is the one installed on the development
  machine and the Docker image `mcr.microsoft.com/playwright:v1.65.0-noble` records the visual
  baselines ([ADR 3](0003-testing-strategy.md)). Playwright, the browser and the image move
  together.

## Consequences

- Turborepo builds the tokens before anything that imports them; CI runs one `pnpm check`.
- Adding a component means adding an entry in `tsdown.config.ts`, `package.json#exports` and
  `.size-limit.json`. Forgetting one is caught by publint, attw or size-limit.
- CommonJS-only projects must use `import()`; no such user is in scope.
- TypeScript 7 and ESLint 10 are blocked on third-party support; Dependabot ignores those majors
  until they are revisited.
