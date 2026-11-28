# CI and deploy

GitHub Actions checks the code. Vercel ships `main`. Nothing in Actions deploys the site or Convex, so a green check is not a deploy.

## Workflows

| Workflow | When | Check names |
|---|---|---|
| CI | pull request, push to `main` | `lint`, `typecheck`, `test`, `build`, `check` |
| Apple | pull request, push to `main` | `apple` |
| Desktop | pull request, push to `main` | `desktop-macos`, `desktop-windows` |
| Dependency audit | pull request, push to `main`, Mondays 05:17 UTC | `pnpm audit` |
| Release | tag `v*`, or a manual dispatch | `release-version`, `web`, `apple-macos`, `apple-ios`, `desktop-macos`, `desktop-windows`, `android`, `publish` |

CI, Apple, Desktop, and the audit each cancel an older run of the same workflow and event on that ref. The release workflow does not cancel an in-progress publish.

Jobs install with pnpm 12.21.0, Node 26, and the pnpm lockfile cache (`.github/actions/setup-pnpm`). `lint`, `typecheck`, `test`, and `build` run the whole JS workspace (`apps/*` and `packages/*`). They do not use path filters. A skipped required check blocks the pull request, which is what happened when `version` was required and the Release workflow did not run.

`build` also checks that `packages/backend/convex/pushNode.ts` bundles `web-push`, builds every JS package, verifies the `api/` bundles, and uploads `apps/web/dist`. Desktop's package `build` is the Vite bundle. The Tauri installers stay in the Desktop workflow.

`check` passes only when `lint`, `typecheck`, `test`, and `build` pass. It uses `if: always()` so a failed job makes `check` fail instead of skip.

`pnpm audit` is allowed to fail while known advisories are being removed. Do not require it.

## Required status checks

Ruleset [CI check blocks main](https://github.com/labdm/manager/rules/28060452) on `refs/heads/main`.

Require these check names, from the GitHub Actions app:

- `lint`
- `typecheck`
- `test`
- `build`

`check` may stay required until those four replace it. It is the name the ruleset requires today.

Do not require any of these. They do not run on every pull request, or they are allowed to fail:

- `version`
- `version check`
- `release-version`
- `web`, `apple-macos`, `apple-ios`, `desktop-macos`, `desktop-windows`, `android`, `publish` from the Release workflow
- `pnpm audit`
- `Proof`
- `Cursor Bugbot`

`apple`, `desktop-macos`, and `desktop-windows` do run on every pull request. Leave them off the required list unless a native failure should block a web change.

## Production deploy

Vercel project `manager` (team labdm) builds with `bash scripts/vercel-build.sh`.

`Deploy Convex (production)` runs only when `VERCEL_ENV` is `production` (the `main` branch) and `CONVEX_DEPLOY_KEY` is set. The Convex CLI then builds the SPA with that deployment's `CONVEX_URL`. Preview builds log `Skip Convex deploy` and only build the SPA. There is no GitHub Actions deploy, so a push does not deploy twice.

The Git integration clones `labdm/manager` and starts the production deployment on a push to `main`. GitHub's own deployment and commit-status APIs stay empty until Vercel is allowed to write them. A missing GitHub deployment is not proof that Vercel skipped the push.

## Settings outside this repo

1. Ruleset `CI check blocks main`: require `lint`, `typecheck`, `test`, and `build`. Remove `check` after those four are required. Do not add `version`, `version check`, or `release-version`.
2. Vercel → `manager` → Settings → Git: repository `labdm/manager`, production branch `main`, Ignored Build Step empty. `vercel.json` has no `ignoreCommand`.
3. GitHub → organization `labdm` → GitHub Apps → Vercel: repository access includes `manager`, with permission to write commit statuses and deployments. Reconnect the project if a push to `main` still leaves the commit with no Vercel status.
4. Keep `CONVEX_DEPLOY_KEY` on the Vercel **production** environment. Do not copy it into GitHub Actions or the repo. The preview key is unused by the build script.
5. Web Push still needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the Convex production deployment, and `VITE_VAPID_PUBLIC_KEY` (the same public key) on the Vercel project. The build does not read them.
6. After the merge, confirm the Vercel production deployment of that SHA is `READY` and https://manager.labdm.dev serves it. Then dispatch Release. A green Actions run does not publish the downloadable clients.
