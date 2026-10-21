# Stock Flow releases

## Releasing

1. Edit `release/release-config.js`: bump `version` and write `releaseNotes`.
2. Apply any Supabase migration the release depends on.
3. Commit your code changes (the release commit only contains the version files).
4. `npm run release:check` checks the token, config, git state and tag in about 20 seconds without changing anything.
5. `npm run release`

`npm run release` does, in order:

| Step | What happens |
| --- | --- |
| Preflight | Config, `GH_TOKEN` (authenticates and can push to the repo), Supabase env, branch not behind origin, tag free. Fails before anything is built. |
| Compile | `npm run electron:build` (main process + Vite renderer) |
| Version | `package.json` and `CHANGELOG.md` updated |
| Package | One `npm run package` (NSIS installer). Old installers and unpacked output are cleaned first; Windows file-lock errors are retried. |
| Git | Release commit `Release v{version}`, tag `v{version}`, push |
| Publish | `finish-release.js`: GitHub release, installer upload (streamed, with progress and retries), download link check, then Supabase |

Phase timings are printed at the end.

## When something fails

Run `npm run release:finish`. It checks the token, makes sure the tag is on origin, creates or reuses the GitHub release, uploads the installer only if it isn't already there in full, checks the download link, and publishes to Supabase last. It is safe to run any number of times.

`npm run release` itself can also be rerun: the same version in `package.json` is treated as a resume.

Supabase is never published unless the GitHub download link works, so the app never offers users a broken update.

## Environment (`.env.local`)

```
GH_TOKEN=ghp_...                 # classic token with "repo" scope, or fine-grained with Contents: write
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Installer contents

`electron-builder.yml` packages `dist/` (the Vite-bundled renderer), `electron-app/dist/` (main process) and only the `node_modules` the main process requires at runtime (`dotenv`). If the main process starts requiring another package, add it to `files` there.
