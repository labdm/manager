# AGENTS.md

Manager is Dmytro Afonin's personal task manager. Architecture: [docs/architecture.md](docs/architecture.md).

SwiftUI (`apps/apple`) and Tauri (`apps/desktop`) come later. This tree is the Convex backend, the shared React UI, the static web app, and the MCP server.

## Layout

- `packages/backend` — Convex schema and functions (`convex/`). Domain logic lives here.
- `packages/ui` — shared React task UI. Client-only; no SSR.
- `apps/web` — Vite + React + TanStack Router. Static SPA.
- `apps/mcp` — MCP server. `mcp-handler` + `@clerk/mcp-tools` as Vercel functions. Public routes: `/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/mcp`.
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

## Node and pnpm

- `engines.node` is `26.x`. `devEngines.runtime` is Node `^26.13.0`. There is no `.nvmrc`.
- `packageManager` is `pnpm@12.21.0`. `corepack enable` makes pnpm use that version. Node 25+ does not bundle corepack; `scripts/cloud-agent-install.sh` installs it first.
- Build-script approval lives in `pnpm-workspace.yaml` `allowBuilds`.

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

Clerk React SDK in the web app. Convex verifies the Clerk JWT from the `convex` template. Each signed-in user reads and writes only tasks whose `ownerId` is their `users` row.

## MCP

`/mcp` is a Streamable HTTP endpoint (`mcp-handler`). Clerk verifies the OAuth bearer with `aud` equal to `MCP_RESOURCE_URL` (`https://manager.labdm.dev/mcp` in production). The route sends the Clerk user id to Convex with a short-lived HMAC (`MCP_ROLE_SECRET`), not the bearer. `whoami` returns `{ role, clerkUserId }` for an admin `users` row. A missing or invalid token is rejected. A signed-in non-admin gets 403.

`create_task`, `list_tasks`, and `complete_task` read and write `tasks` (`title`, `done`, optional `dueAt`, `ownerId`). Same admin gate.

Discovery routes:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource/mcp`

Vercel serves the static SPA from `apps/web/dist` and Node functions from the repo `api/` directory. Those functions are thin entrypoints into `apps/mcp`. Rewrites publish `/mcp` and the `/.well-known` routes on `manager.labdm.dev`.

## Deployment

Vercel project `manager` (team labdm), domain https://manager.labdm.dev. The project root is the repository. `scripts/vercel-build.sh` is the build. No production keys belong in the repo.
