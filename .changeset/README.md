# Changesets

Every pull request that changes a published package (`@tabellwerk/tokens`, `@tabellwerk/react`) adds
a changeset:

```bash
pnpm changeset
```

Pick the packages, the bump (patch, minor, major) and write one or two sentences for the changelog,
from the point of view of someone using the library. Both packages always share one version number
(`fixed` in `config.json`).

While the version is `0.x`, a breaking change is a **minor** bump. The API report in
`packages/react/etc/react.api.md` shows every change to the public API in the pull request diff.

The release workflow collects the changesets on `main` into a "Version Packages" pull request.
Merging it stages the new versions on npm; they are public once a maintainer approves them on
npmjs.com ([ADR 11](../docs/adr/0011-releases.md)).
