<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Manager is Dmytro Afonin's personal to-do app. This repo is the web MCP host.
The task UI is not created yet. A phone client is later, not part of the
current plan.

## Layout

- `apps/web` — Next.js App Router (React 19). MCP lives here: `app/mcp/route.ts`.
  Convex lives next to that app, in `apps/web/convex`, the same placement
  happy-parent uses relative to its Next app.
- `packages/shared` — workspace placeholder (`@manager/shared`).
- `scripts/cloud-agent-install.sh` — `pnpm install --frozen-lockfile`.
- `scripts/cloud-agent-start.sh` — anonymous Convex plus Next on port 3000.
- `scripts/vercel-build.sh` — `convex deploy` then `next build`. The Vercel
  project is not created yet.

## Commands

From the repo root:

- `pnpm lint` — ESLint in `apps/web`
- `pnpm typecheck` — `tsc --noEmit` in `apps/web` and `packages/shared`
- `pnpm build` — `next build` in `apps/web`
- `pnpm dev` — Next.js on http://localhost:3000

## Node and pnpm

- `engines.node` is `26.x`. `devEngines.runtime` is Node `^26.13.0`. There is no `.nvmrc`.
- `packageManager` is `pnpm@12.16.1`. `corepack enable` makes pnpm use that version.
  Node 25+ does not bundle corepack; `scripts/cloud-agent-install.sh` installs it first.
- Build-script approval lives in `pnpm-workspace.yaml` `allowBuilds`.

## Local backend

1. Copy `.env.example` to `apps/web/.env.local` and fill Clerk values when a
   Clerk app exists. Do not commit `.env.local` or any secret.
2. Backend, from `apps/web`:
   `CONVEX_AGENT_MODE=anonymous pnpm exec convex dev`
   Local anonymous Convex listens on `http://127.0.0.1:3210` and writes
   `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `apps/web/.env.local`.
   Prefer `pnpm exec` (the workspace dependency) over `pnpm dlx`.
3. After Convex is up, set deployment env when you have the values:
   `pnpm exec convex env set CLERK_FRONTEND_API_URL "$CLERK_FRONTEND_API_URL"`
   `pnpm exec convex env set MCP_ROLE_SECRET "$MCP_ROLE_SECRET"`
   `pnpm exec convex env set ADMIN_CLERK_USER_IDS "$ADMIN_CLERK_USER_IDS"`
   `convex dev` exits while `CLERK_FRONTEND_API_URL` is unset, because
   `convex/auth.config.ts` reads it. Until a Clerk app exists, the start
   script sets local Convex to `https://clerk.example.invalid`. That value
   is not a Clerk issuer and is not a secret.
4. Frontend: `pnpm dev` from the repo root, after `NEXT_PUBLIC_CONVEX_URL` exists.

`scripts/cloud-agent-start.sh` does those steps when the corresponding
environment variables are present. Do not inject `CONVEX_DEPLOYMENT` or
`NEXT_PUBLIC_CONVEX_URL` as cloud secrets — local Convex owns those.

Anonymous local Convex is enough for lint, typecheck, and build. Do not deploy
a production Convex project from this tree.

## MCP

`/mcp` is a Streamable HTTP endpoint (`mcp-handler`). Clerk verifies the
OAuth bearer with `aud` equal to `MCP_RESOURCE_URL`
(`https://manager.labdm.dev/mcp` in production). The route sends the Clerk
user id to Convex with a short-lived HMAC (`MCP_ROLE_SECRET`), not the bearer.
`whoami` returns `{ role, clerkUserId }` for an admin `users` row. A missing
or invalid token is rejected. A signed-in non-admin gets 403.

`create_task`, `list_tasks`, and `complete_task` read and write `tasks`
(`title`, `done`, optional `dueAt`, `createdBy`). Same admin gate.

Discovery routes:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource/mcp`

## Not done yet

- Vercel project (team labdm, https://manager.labdm.dev)
- Clerk application
- Convex production deployment
- Task UI

A phone client is later, not planned now.

When the Vercel project is created, set its root directory to `apps/web`.
`apps/web/vercel.json` calls `scripts/vercel-build.sh`. No production keys
belong in the repo.
