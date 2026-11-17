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

Nothing is published yet. The release workflow (planned for the release phase, see
[the roadmap](../docs/ROADMAP.md)) will collect the changesets on `main` into a "Version packages"
pull request; merging that pull request publishes to npm.
