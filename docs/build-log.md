# Build log

Decisions made while implementing the plan in [docs/plan.md](plan.md). The plan wins if this file disagrees with it. This file records only the choices the plan left open.

## 2026-11-23 — M1 wave

The first implementation wave is M1 only (LAB-145). Recurrence, the Home rail, alerts, questions, and shared spaces stay unbuilt.

Work is split so agents do not edit the same trees:

| Owner | Trees |
|---|---|
| Backend and MCP | `packages/backend`, `apps/mcp`, generated `api/` via `pnpm build:api`, `docs/harness.md` |
| Web and desktop | `packages/ui` only. Web and desktop both render that package. |
| Apple | `apps/apple` |
| Android | `apps/android` |

`origin` is stored because `seenAt` alone cannot tell an old row from an agent-created row. Values are `self`, `agent`, and `member`. A signed-in create writes `self` and sets `seenAt`. An MCP create writes `agent` and leaves `seenAt` unset. Existing rows have neither field. They are not NEW. NEW means `origin` is `agent` or `member` and `seenAt` is absent. `member` is reserved for shared spaces later.

Opening a row calls `tasks.markSeen`. It sets `seenAt` if it is still empty. MCP has no mark-seen tool in M1.

Omitted priority is stored as `normal` / `10`, not left blank. `overduePolicy` omitted is stored as `none`.

`dueAt` and `plannedOn` mirror each other when either one is the planned day. `deadlineAt` never writes either of them. A `dueAt`-only create leaves `deadlineAt` unset.

`effectiveRank` and `overdue` are computed in `taskView` and are not columns. Escalate is not persisted in M1. `overdue` is true when `deadlineAt` is before now and the row is not done and not trashed. For a seed priority with policy `escalate`, `effectiveRank` is `min(priorityRank + 10, 30)`. Otherwise `effectiveRank` is `priorityRank`.

`completedAt` is set when `done` becomes true and cleared when it becomes false, including `toggle`.

Delete sets `deletedAt` and does not call `db.delete`. Lists hide those rows. There is no `deletedAt` index and no `open` column yet.

Client branches must typecheck against the current generated API. They cast at the Convex boundary when they send fields the generated types do not list yet. Apple and Android already post dynamic payloads. Their in-memory backends learn the new fields so unit tests do not need a server.

Provider order for implementation: Antigravity Gemini 3.8 first, then OpenCode models. Big Pickle is the OpenCode model to use before the smaller free models. DeepSeek's free OpenCode pool is a separate, smaller limit. Cursor and Grok spend the orchestrator's tokens and are the last resort, only after Gemini and the OpenCode models have run out.

The first Android attempt on free OpenCode DeepSeek wrote nothing. A Cursor retry started the Android edits and was stopped so it would not keep spending Cursor tokens. Big Pickle finishes that slice from those files. The Cursor UI attempt wrote nothing and was stopped. The UI slice moves to Antigravity Gemini.
