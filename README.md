# Manager

**An ADHD-first, gamified life manager.** Live at [manager.labdm.dev](https://manager.labdm.dev).

Manager is Dmytro Afonin's personal system for getting life under control, built with the intention of shipping it as a product later. It is not just another task app: it is meant to be the task layer for your agents, with game mechanics that make showing up feel rewarding.

Architecture: [docs/architecture.md](docs/architecture.md). Layout, commands and agent rules: [AGENTS.md](./AGENTS.md).

## Why another task app?

- Every serious task app has a paywall, and most have no useful free tier.
- Native Apple Reminders is painful for actual task management: dailies stack into an endless backlog, there is no real deadline mechanic, and grouping or sharing is awkward.
- Agent harnesses have almost no integration with real task apps. Manager fixes that by being agent-first.

## The idea

```
agent → Manager → native APIs (push · calendar · reminders · alarms)
```

An agent reads your email and context, talks with you, and writes tasks into Manager. Manager is the system of record: anything created or completed there shows up everywhere, and can fan out to native notifications, calendars, reminders and alarms. Manual entry in the UI stays available as a fallback.

What makes it different is gamification, borrowed from gacha games: dailies that replace themselves when you skip a day instead of piling up, real deadlines, events, seasons, battle passes, levels, achievements, dedicated sections for different parts of life, and eventually groups and sharing. These mechanics are the design target; today's build is the foundation (tasks, auth, web/desktop/mobile clients, MCP, email reminders) with the game layer still to come.

## Use it with an agent (MCP)

Register this URL as a Streamable HTTP MCP server named `manager` in your agent harness:

```
https://manager.labdm.dev/mcp
```

```json
{
  "mcpServers": {
    "manager": {
      "url": "https://manager.labdm.dev/mcp"
    }
  }
}
```

The first connection opens Clerk OAuth in your browser. Sign in, then ask your agent to manage your tasks. Available tools:

- `whoami` — check the authenticated user and role
- `create_task` — add a task (optional `dueAt`)
- `list_tasks` — read your tasks
- `complete_task`, `reopen_task`, `delete_task` — update them

OAuth metadata is published at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`. Sign in on the web app at [manager.labdm.dev](https://manager.labdm.dev); native clients and download links are listed on the [download page](https://manager.labdm.dev/download).

## Repository layout

- `packages/backend` — Convex schema and functions; domain logic lives here
- `packages/ui` — shared React task UI
- `apps/web` — Vite + React + TanStack Router (static SPA)
- `apps/desktop` — Tauri v2 client for Windows and macOS
- `apps/mcp` — MCP server behind `/mcp`
- `apps/apple` — SwiftUI client for iPhone, iPad and Mac
- `apps/android` — Kotlin + Compose client

Development commands are in [AGENTS.md](./AGENTS.md).
