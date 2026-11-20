# AGENTS.md

Manager is Dmytro Afonin's personal task manager. Architecture: [docs/architecture.md](docs/architecture.md).

Tauri (`apps/desktop`) comes later. This tree is the Convex backend, the shared React UI, the static web app, the MCP server, and the native Apple client.

## Layout

- `packages/backend` — Convex schema and functions (`convex/`). Domain logic lives here.
- `packages/ui` — shared React task UI. Client-only; no SSR.
- `apps/web` — Vite + React + TanStack Router. Static SPA.
- `apps/mcp` — MCP server. `mcp-handler` + `@clerk/mcp-tools` as Vercel functions. Public routes: `/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/mcp`.
- `apps/apple` — SwiftUI client for iPhone (including the Duo), iPad and Mac. Details: [apps/apple/README.md](apps/apple/README.md). `ManagerKit` (models + views, no Convex/Clerk imports) and `ManagerData` (Convex + Clerk adapters) are local Swift packages; `project.yml` is the XcodeGen source of truth. Generated `Manager.xcodeproj` and `Config/Secrets.plist` are gitignored. Do not commit secrets.
- `scripts/cloud-agent-install.sh` — `pnpm install --frozen-lockfile`.
- `scripts/cloud-agent-start.sh` — anonymous Convex plus the Vite app on port 3000.
- `scripts/vercel-build.sh` — when `CONVEX_DEPLOY_KEY` is set, `convex deploy` then the Vite build. The deploy command exports `CONVEX_URL`, which the build maps to `VITE_CONVEX_URL`. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is mapped to `VITE_CLERK_PUBLISHABLE_KEY`. Set `CLERK_FRONTEND_API_URL` and `MCP_ROLE_SECRET` on the Convex deployment before the first push. A preview deploy key cannot set those variables.

## Commands

From the repo root:

- `pnpm dev` — Vite on http://localhost:3000
- `pnpm dev:backend` — Convex dev in `packages/backend`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm apple:project` — generate `Config/Secrets.plist` from the env files and regenerate `Manager.xcodeproj`. Run this before opening the Apple project.
- `pnpm apple:test` — Swift tests for the Apple client's pure logic (no Xcode needed).
- `pnpm apple:build:mac`, `pnpm apple:build:ios` — Apple Silicon builds; `apple:package` applies a valid ad-hoc signature before publishing.
- `pnpm apple:package` — zip the built macOS and iOS Simulator apps into `artifacts/apple/`.
- `pnpm check:functions` — assert the Convex deployment has every function the clients call.

## Node and pnpm

- `engines.node` is `26.x`. `devEngines.runtime` is Node `^26.13.0`. There is no `.nvmrc`.
- `packageManager` is `pnpm@12.21.0`. `corepack enable` makes pnpm use that version. Node 25+ does not bundle corepack; `scripts/cloud-agent-install.sh` installs it first.
- Build-script approval lives in `pnpm-workspace.yaml` `allowBuilds`.
- ESLint uses the TypeScript 6 API (`typescript` is an alias for `@typescript/typescript6`); `tsc` runs TypeScript 7 via the `@typescript/native` alias. Keep both aliases in every workspace.

## Local backend

1. Copy `.env.example` to `apps/web/.env.local` and `packages/backend/.env.local`. Fill Clerk values when the Manager Clerk app exists. Do not commit `.env.local` or any secret.
2. Backend, from `packages/backend`:
   `CONVEX_AGENT_MODE=anonymous pnpm exec convex dev`
   Local anonymous Convex listens on `http://127.0.0.1:3210` and writes the deployment URL into `packages/backend/.env.local`. Copy that URL to `VITE_CONVEX_URL` in `apps/web/.env.local`.
3. After Convex is up, set deployment env when you have the values:
   `pnpm exec convex env set CLERK_FRONTEND_API_URL "$CLERK_FRONTEND_API_URL"`
   `pnpm exec convex env set MCP_ROLE_SECRET "$MCP_ROLE_SECRET"`
   `pnpm exec convex env set ADMIN_CLERK_USER_IDS "$ADMIN_CLERK_USER_IDS"`
   `convex dev` exits while `CLERK_FRONTEND_API_URL` is unset, because `convex/auth.config.ts` reads it. Until a Clerk app exists, the start script sets local Convex to `https://clerk.example.invalid`. That value is not a Clerk issuer and is not a secret.
4. Frontend: `pnpm dev` from the repo root, after `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` exist.

The Clerk JWT template must be named `convex` (Convex auth `applicationID` is `convex`).

`scripts/cloud-agent-start.sh` does those steps when the corresponding environment variables are present. Do not inject `CONVEX_DEPLOYMENT` or `VITE_CONVEX_URL` as cloud secrets — local Convex owns those.

Anonymous local Convex is enough for lint, typecheck, and build. Production Convex deploys happen from the Vercel build when `CONVEX_DEPLOY_KEY` is set.

## Auth

Clerk React SDK in the web app; `ClerkKit` + `ClerkConvexAuthProvider` in the Apple app. Convex verifies the Clerk JWT from the `convex` template. Each signed-in user reads and writes only tasks whose `ownerId` is their `users` row.

The Apple client subscribes to `tasks:list` and uses `tasks:create`, `tasks:setDone`, `tasks:remove` in `packages/backend/convex/tasks.ts`. `tasks:setDone` is an explicit setter so retried checkbox taps cannot invert state. Convex numbers are tagged on the wire: decode `dueAt` with `@OptionalConvexFloat`, not plain `Double`. The Apple workflow in `.github/workflows/apple.yml` runs on an arm64 macOS runner because ConvexMobile's binary is arm64-only.

## MCP

`/mcp` is a Streamable HTTP endpoint (`mcp-handler`). Clerk verifies the OAuth bearer with `aud` equal to `MCP_RESOURCE_URL` (`https://manager.labdm.dev/mcp` in production). The route sends the Clerk user id to Convex with a short-lived HMAC (`MCP_ROLE_SECRET`), not the bearer. `whoami` returns `{ role, clerkUserId }` for an authenticated `users` row. A missing or invalid token is rejected. A not signed-in gets 403.

`create_task`, `list_tasks`, `complete_task`, `reopen_task`, and `delete_task` read and write `tasks` (`title`, `done`, optional `dueAt`, `ownerId`). Same authenticated user gate.

Discovery routes:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource/mcp`

Vercel serves the static SPA from `apps/web/dist` and Node functions from the repo `api/` directory. Those functions are self-contained ESM bundles generated from `scripts/api-entries/*.ts`. When modifying `apps/mcp`, run `pnpm build:api` (or `pnpm build`) to update the bundles in `api/`. CI runs `pnpm verify:api` to ensure the bundles in `api/` match the source code. Rewrites publish `/mcp` and the `/.well-known` routes on `manager.labdm.dev`.

## Downloads and releases

`/download` is the public download page. It lists web and macOS release assets for everyone. `packages/backend/convex/downloads.ts` fetches GitHub releases server-side and strips iOS assets before responding to a non-admin, using the `users.role` value from Convex. Never filter iOS assets only in the browser. Vercel preview builds skip the release inventory and link to the production download page and CI runs instead, because preview deployments have no published releases and short-lived Actions artifacts are not release assets.

`.github/workflows/release.yml` publishes a tagged release when a `v*` tag is pushed, or when the workflow is dispatched with a version. It builds the web app, an ad-hoc-signed macOS app and an ad-hoc-signed iOS Simulator app, publishes each as `.zip` and `.tar.gz`, uploads all six files as workflow artifacts, and creates/updates the GitHub release with the same assets. The public config values `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` must exist as repository variables so release builds point at production. No secret key belongs in the browser or repo. The repository is private, so each Convex deployment also needs `GITHUB_TOKEN` with read access to releases; the CLI token works for now, but a fine-grained `Contents: read` PAT is preferable.

CI and Apple workflows upload per-commit artifacts for inspection. Actions are pinned to Node 24-compatible majors: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, `actions/upload-artifact@v7`.

## Deployment

Vercel project `manager` (team labdm), domain https://manager.labdm.dev. The project root is the repository. `scripts/vercel-build.sh` is the build. No production keys belong in the repo.
