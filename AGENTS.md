# AGENTS.md

Manager is Dmytro Afonin's ADHD-first, gamified life manager — not just another checkbox list. Architecture: [docs/architecture.md](docs/architecture.md).

This tree is the Convex backend, the shared React UI, the static web app, the Tauri desktop client, the MCP server, and the native Apple and Android clients.

## Product vision

- **Agent-first.** The intended path is `agent → Manager → native APIs (push · calendar · reminders · alarms)`. An agent connects over MCP (native integrations later), reads your email and context, talks with you, and writes tasks into Manager. Manager is the system of record and fans changes out to native APIs. Manual entry in the UI is a fallback, not the main workflow.
- **Gamification is the main feature.** Borrow heavily from gacha games: dailies, periodic events, seasons, battle passes, leveling, achievements, dedicated sections for different kinds of activities, and eventually social/group play. A repeating series declares its own behavior: `replace` (dishes — a missed day must not stay open beside today) or `stack` (a journal — missed days stay, each on its own). A deadline is its own mechanic, distinct from the planned day and from a reminder. Introduction: [docs/introduction.md](docs/introduction.md). Build order: [docs/plan.md](docs/plan.md).
- **Why this exists.** Existing task apps have no usable free tier, weak task-management mechanics (native Apple Reminders in particular), and almost no real integrations for agents and harnesses. Personal use comes first; shipping it as a product is a bonus.

Only the foundation is built today (tasks, auth, clients, MCP, email reminders). The mechanics above are the next design/grooming target — describe them as planned, not shipped.

## Domain language

Use these terms consistently in code, schema, docs and UI. The Convex schema currently implements `tasks` with `title`, `done` and optional `dueAt`; the rest is target vocabulary from [docs/plan.md](docs/plan.md), not shipped behavior.

| Term | Meaning |
|---|---|
| task | Atomic unit of work. The only thing that can be completed. Create, edit, mark done, soft-delete. |
| recurrence | A series that mints tasks. `behavior` is `replace` or `stack`, chosen per series, never implied by "daily". |
| replace | One open occurrence. A missed period is `superseded` and leaves the open board. Dishes. |
| stack | One open occurrence per period. Missed periods stay open. A journal. |
| planned day | When you intend to act. Usually a civil day with no clock time. Today's `dueAt` is this, not a deadline. |
| deadline | The instant an overdue policy runs: `retire` (the chance ended) or `escalate` (it stays, louder). Not trash. |
| event | A span with a start and an end. A day, a week, a month, a quarter, a year, or a named run. One table. |
| season | An event with a theme. Usually long. Length is not checked. |
| limited | Not a type. An end plus `retire`. UI copy may say "limited task". |
| progression | A known-size track: N steps, or a meter such as pages. |
| quest | A chain of tasks. Steps may be known up front or appended when the current step ends. |
| category | A slice of life. Household, health, work, and whatever the user adds. |
| space | People plus the entities attached to it. Attach and detach. Not a required parent. Has a Lucide icon and a color. |
| view | A left-rail slice. Home, an installed template, a computed query (New, high priority, today), or a custom list. Not a shared space. |
| alert | A note from an agent or another person. No checkbox and no done state. Reading it clears it from the band. |
| question | A prompt with options. Answering can create the next task. Not a task itself. |
| pin | A sort override on a view. Does not change priority or date. Include and exclude are membership overrides on a computed view. |
| appearance | `icon` is a Lucide name. `color` is a palette token. Both are strings. Unknown values fall back. Used on views, events, categories, and spaces. |
| presentation pack | A client skin addressed by an id, on top of icon and color. The core does not branch on it. |
| achievement | Later. A query over completions, tracks, and quests. |

## Public entry points

- Web app: https://manager.labdm.dev
- MCP endpoint: https://manager.labdm.dev/mcp — Streamable HTTP, Clerk OAuth on first connect. Register this URL as the `manager` MCP server in an agent harness. Discovery routes and tool list are in the [MCP](#mcp) section below.
- Downloads: https://manager.labdm.dev/download

## Layout

- `packages/backend` — Convex schema and functions (`convex/`). Domain logic lives here.
- `packages/ui` — shared React task UI. Client-only; no SSR.
- `apps/web` — Vite + React + TanStack Router. Static SPA.
- `apps/desktop` — Tauri v2 Windows/macOS client. Bundles the Vite SPA locally; reuses `packages/ui`; hides the Downloads link. Details: [apps/desktop/README.md](apps/desktop/README.md).
- `apps/mcp` — MCP server. `mcp-handler` + `@clerk/mcp-tools` as Vercel functions. Public routes: `/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/mcp`.
- `apps/apple` — SwiftUI client for iPhone (including the Duo), iPad and Mac. Details: [apps/apple/README.md](apps/apple/README.md). `ManagerKit` (models + views, no Convex/Clerk imports) and `ManagerData` (Convex + Clerk adapters) are local Swift packages; `project.yml` is the XcodeGen source of truth. Generated `Manager.xcodeproj` and `Config/Secrets.plist` are gitignored. Do not commit secrets.
- `apps/android` — standalone Gradle Kotlin/Compose client. Details: [apps/android/README.md](apps/android/README.md). `:managerkit` (pure models + Compose UI, no Convex/Clerk imports), `:managerdata` (Convex + Clerk adapters), `:app`. `local.properties` is gitignored; public config only.
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
- `pnpm desktop:dev` — Tauri dev window against the local Vite server.
- `pnpm desktop:build` — bundled SPA plus native Tauri app.
- `pnpm desktop:package windows|macos` — copy Tauri bundles into `artifacts/desktop` as release names.
- `pnpm apple:project` — generate `Config/Secrets.plist` from the env files and regenerate `Manager.xcodeproj`. Run this before opening the Apple project.
- `pnpm apple:test` — Swift tests for the Apple client's pure logic (no Xcode needed).
- `pnpm apple:build:mac`, `pnpm apple:build:ios` — Apple Silicon builds; `apple:package` applies a valid ad-hoc signature before publishing.
- `pnpm apple:package` — zip the built macOS and iOS Simulator apps into `artifacts/apple/`.
- `pnpm android:test`, `pnpm android:build`, `pnpm android:install` — run the standalone Gradle build in `apps/android` with Android Studio's JDK and SDK found automatically. Gitignored `apps/android/local.properties` holds public config; Android Studio opens `apps/android` directly.
- `scripts/package-android-artifacts.sh` — copy the debug APK and release AAB into `artifacts/android` as `Manager-Android-<version>.*`.
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

Clerk React SDK in the web app; `ClerkKit` + `ClerkConvexAuthProvider` in the Apple app; Clerk Android UI + `clerk-convex-kotlin` in the Android app. Convex verifies the Clerk JWT from the `convex` template. Each signed-in user reads and writes only tasks whose `ownerId` is their `users` row.

The Apple client subscribes to `tasks:list` and uses `tasks:create`, `tasks:setDone`, `tasks:remove` in `packages/backend/convex/tasks.ts`. `tasks:setDone` is an explicit setter so retried checkbox taps cannot invert state. Convex numbers are tagged on the wire: decode `dueAt` with `@OptionalConvexFloat`, not plain `Double`. The Apple workflow in `.github/workflows/apple.yml` runs on an arm64 macOS runner because ConvexMobile's binary is arm64-only. The Android client decodes the same tagged `dueAt` with Convex Android's `Float64`, not a plain `Double`.

## MCP

`/mcp` is a Streamable HTTP endpoint (`mcp-handler`). Clerk verifies the OAuth bearer with `aud` equal to `MCP_RESOURCE_URL` (`https://manager.labdm.dev/mcp` in production). The route sends the Clerk user id to Convex with a short-lived HMAC (`MCP_ROLE_SECRET`), not the bearer. `whoami` returns `{ role, clerkUserId }` for an authenticated `users` row. A missing or invalid token is rejected. A not signed-in gets 403.

`create_task`, `list_tasks`, `complete_task`, `reopen_task`, and `delete_task` read and write `tasks` (`title`, `done`, optional `dueAt`, `ownerId`). Same authenticated user gate.

Discovery routes:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource/mcp`

Vercel serves the static SPA from `apps/web/dist` and Node functions from the repo `api/` directory. Those functions are self-contained ESM bundles generated from `scripts/api-entries/*.ts`. When modifying `apps/mcp`, run `pnpm build:api` (or `pnpm build`) to update the bundles in `api/`. CI runs `pnpm verify:api` to ensure the bundles in `api/` match the source code. Rewrites publish `/mcp` and the `/.well-known` routes on `manager.labdm.dev`.

## Downloads and releases

`/download` is the public download page. It lists web, Windows, macOS and Android release assets for everyone. `packages/backend/convex/downloads.ts` fetches GitHub releases server-side and strips iOS assets before responding to a non-admin, using the `users.role` value from Convex. Never filter iOS assets only in the browser. Vercel preview builds skip the release inventory and link to the production download page and CI runs instead, because preview deployments have no published releases and short-lived Actions artifacts are not release assets.

`.github/workflows/release.yml` publishes a tagged release when a `v*` tag is pushed, or when the workflow is dispatched with a version. It builds the web app, an ad-hoc-signed macOS app, an ad-hoc-signed iOS Simulator app, Tauri Windows/macOS installers, and a Kotlin APK/AAB. Each job uploads its assets as a workflow artifact; the `publish` job downloads them and creates or updates the GitHub release once. The public config values `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` must exist as repository variables so release builds point at production. No secret key belongs in the browser or repo. The repository is public; a `GITHUB_TOKEN` with read access to releases may still be set on Convex for higher rate limits, but no secret belongs in the browser.

CI and Apple workflows upload per-commit artifacts for inspection. The release workflow builds web, each Apple target, each desktop target and Android as parallel jobs; a final `publish` job downloads those artifacts and creates or updates the GitHub release once, so a failed build cannot leave a partial public release. Actions are pinned to Node 24-compatible majors: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-java@v5`, `pnpm/action-setup@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v7`.

## Deployment

Vercel project `manager` (team labdm), domain https://manager.labdm.dev. The project root is the repository. `scripts/vercel-build.sh` is the build. No production keys belong in the repo.
