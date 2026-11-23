# Big Pickle — Manager product + technical plan

## 1. Introduction

Manager stops being a checkbox list and becomes the system of record for a life that has shape. A task is still the atom, but it no longer floats alone: it can carry a date, a time, a place, a schedule, a priority, a deadline, a progression counter, and links into events, seasons, quests, categories, and shared spaces. The test for every feature is simple: can an agent say it once over MCP and have every screen agree about what it means?

The agent-first loop is unchanged and becomes more demanding. An agent connects at `https://manager.labdm.dev/mcp` with Clerk OAuth, calls `whoami`, then writes entities into Convex: a limited window for taxes read from an email, a `replace` series for dishes, a `stack` series for journaling, an emergent quest for a broken window. Convex fans the result out to the SPA, the Tauri desktop app, and the native Apple and Android clients. Later, Manager fans changes out to push, calendar, reminders, and alarms. Manual entry stays as the fallback. Because the SPA is static and the MCP server is thin, all meaning lives in one place: the Convex service layer. No public REST, no second database, no client-side domain rules.

The correction I want burned into the vocabulary: "dailies never stack" is wrong as a universal rule. A recurring **series** declares its own **behavior**. `replace` means one rolling live instance: if dishes are not done today, the next rollover moves the undone instance forward, so yesterday's missed dish cannot be washed. Completed history remains for progression and stats. `stack` means a new occurrence per period: journaling yesterday, today, and tomorrow are three real tasks, and missed days stay completable. Both are first-class mechanics; neither is a UI special case. The UI may *suggest* `replace` for dishes and `stack` for journaling, but it cannot forbid the opposite.

Deadlines are first-class and separate from a planned date and a reminder. A planned date answers "when will I do it"; a deadline answers "when does this stop counting"; a reminder answers "when should I be told". Overdue policy is data: taxes escalate and rise in priority, a McDonald's offer retires because it cannot be redeemed later. Gacha language is a presentation choice, not a schema constraint: "limited window" is fine internally, while a plain pack says "closes Friday".

Categories, seasons, events, progressions, quests, spaces, and packs are all data. The core stores ids, timestamps, and links; a presentation pack supplies colors, copy, and layout hints. That is how we get a playful board — vertical worlds, horizontal slices, cards, rows, progression bars, a dedicated quest tab — without hard-coding "seasons last a month" or "a quest's next step is always a surprise". Season length, single attachment, and known quest sequences are defaults a user or agent can override.

I take three positions in this plan. Soft deletion is absolute; no user-facing delete ever removes a row. Sharing is space-first, not ACL-first; ownership stays for private data, spaces grant shared visibility. Seed data wins over enums: every built-in we ship is a row with a stable slug, so an experiment never needs a migration.

## 2. Domain model

### Stable vocabulary

| Loose phrase | Stable term | What it actually is |
|---|---|---|
| "period with from and to" | **window** | A concrete span: `[from, to)`, or a single date when `from == to` at date granularity. |
| "event" | **event** | A named happening bound to a primary window. `cadence` is a seed string: `single`, `named`, `week`, `month`, `limited`, plus `daily`, `weekly`, `monthly`, `quarter`, `year`, `custom` for recurring happenings. |
| "daily / weekly" | **recurrence rule** | A rule on a `series` that generates occurrences. It is not an event kind. An event *uses* a rule via `seriesId`. |
| "season" | **season** | A long-lived themed container with an optional window. No minimum length. |
| "limited event", "deadline" | **limited window** (internal) / **deadline** (field) | Internal `event.cadence: "limited"` plus `deadlineAt`. UI copy comes from the pack: "limited task", "closes Friday". |
| "schedule" | **series** | `{ rule, behavior, anchorAt }` plus occurrence state. |
| "dailies" | recurrence rule `daily` + behavior `replace` or `stack` | Behavior is per series, never global. |
| "overdue" | **overdue policy** | Data on the entity naming a registered handler: `retire` or `escalate`. |

A window is a value object, not a second task. A task's own planned date stays in `dueAt` (epoch ms, unchanged on the wire); its time-of-day is `allDay: false` plus `dueAt`, or a `startAt` when a window is attached. Windows give ranges and named spans their own identity so several entities can point at the same week.

### Entities and key fields

All tables below carry `ownerId` and `deletedAt?`. There is no unqualified "system owner": seed rows are cloned per user at first sign-in so users can edit them.

- **`users`** — existing fields; add `defaultPackId?`, `defaultSpaceId?`.
- **`tasks`** — `title`, `done`, `ownerId`, `dueAt?` (epoch ms), `allDay` (default `true`), `timeZone?`, `location?`, `deadlineAt?`, `remindAt?`, `priority` (seed string), `priorityRank?` (optional number for user-defined scales), `overduePolicy` (seed string), `source` (`manual` | `agent` seed), `completedAt?`, `seriesId?`, `occurrenceKey?`, `presentationId?`, `deletedAt?`.
- **`windows`** — `ownerId`, `from`, `to`, `granularity` (`date` | `instant` seed), `label?`, `deletedAt?`.
- **`events`** — `ownerId`, `title`, `primaryWindowId?`, `cadence` (seed string), `seriesId?`, `deadlineAt?`, `remindAt?`, `priority`, `overduePolicy`, `presentationId?`, `deletedAt?`.
- **`seasons`** — `ownerId`, `title`, `windowId?`, `description?`, `presentationId?`, `deletedAt?`. Length is guidance only.
- **`categories`** — `ownerId`, `slug`, `title`, `color?`, `icon?`, `isSeed`, `deletedAt?`.
- **`series`** — `ownerId`, `title?`, `rule` (seed string), `behavior` (registered string), `anchorAt?`, `lastMaterializedPeriod?`, `deletedAt?`. Occurrence identity is `(seriesId, occurrenceKey)` among live rows.
- **`progressions`** — `ownerId`, `title`, `metric` (seed string: `days` | `pages` | `count` | `minutes`), `target?`, `current`, `unit?`, `presentationId?`, `deletedAt?`.
- **`quests`** — `ownerId`, `title`, `revealMode` (seed string: `known` | `emergent`), `steps` embedded as `{ id, title?, done, unlocked, revealText? }[]`, `currentStepId?`, `presentationId?`, `deletedAt?`. Steps are embedded because they are always read with the quest; an unknown step has `title: undefined` until revealed.
- **`spaces`** — `ownerId`, `title`, `slug?`, `deletedAt?`.
- **`space_members`** — `spaceId`, `userId`, `role` (seed string: `owner` | `member`), `joinedAt`, `deletedAt?`.
- **`space_entities`** — `spaceId`, `entityType`, `entityId`, `addedBy`, `deletedAt?`. Any entity kind may be attached.
- **`links`** — `fromType`, `fromId`, `toType`, `toId`, `relation` (seed string: `category` | `window` | `season` | `event` | `quest` | `progression` | `context`), `isPrimary`, `createdBy`, `deletedAt?`.
- **`presentation_packs`** — `ownerId`, `slug`, `tokens` (colors, spacing, icons), `copy` (label map), `layoutHints` (default axes, card vs row), `isSeed`, `deletedAt?`.
- **`overdue_policies`** — `slug`, `handler` (registered string), `params`, `isSeed`, `deletedAt?`. Policy is data plus a handler in Convex.

### Core invariants (enforced in Convex service layer)

1. Every entity has an owner and a `deletedAt?`. Reads never return soft-deleted rows.
2. A caller may read/write an entity only if they own it or are an active member of a space containing it.
3. `title` is non-empty after normalization. Completion is set explicitly (`setDone` / `completeStep`) so a retried tap cannot invert state; `toggle` is a UI convenience that computes the value first.
4. A series declares exactly one behavior from a registered behavior set; shipped values are `replace` and `stack`. The registry, not the schema validator, is extensible.
5. For `stack`, `(seriesId, occurrenceKey)` is unique among live occurrences. For `replace`, there is at most one live, undone occurrence per series; rollover patches that instance forward instead of creating a backlog.
6. A limit of one primary attachment is **not** an invariant. `links.isPrimary` is just a flag; many links may exist.
7. All time fields (`dueAt`, `deadlineAt`, `remindAt`, `from`, `to`, `anchorAt`) are epoch-ms numbers on the wire. Clients decode Convex's tagged float (`@OptionalConvexFloat` on Apple, `Float64` on Android).
8. MCP tools contain no business rules; they call the same Convex functions clients call. No public REST surface.

### UI guidance (data or pack hints, never schema bans)

- Show one primary attachment, collapse the rest under "also in".
- Seasons are usually a month or longer; a three-day season is legal.
- Dishes default to `replace`, journaling to `stack`; either may be changed.
- Broken-window quests are emergent; a moving-in checklist quest may be fully known.
- Plain copy says "limited task" and "closes Friday"; a playful pack may say "Limited Event".
- Cards for dense worlds, rows for scan-heavy worlds; progression bars may use either.
- Default category presets and default vertical/horizontal axes come from the pack.

## 3. Prebuilt catalog

Everything here is **seed data** created per user with a stable slug. Slugs are `v.string()` in Convex, not unions; users and agents can add, rename, hide, or soft-delete any row.

| Group | Seed slugs | Notes |
|---|---|---|
| Categories | `household`, `health`, `relationship`, `work`, `project`, `finance` | `finance` added so taxes have a natural home. |
| Built-in windows / cadences | `single`, `named`, `day`, `week`, `month`, `quarter`, `year`, `daily`, `weekly`, `monthly`, `custom`, `limited` | `day/week/month/quarter/year` describe windows; `daily/weekly/...` describe recurrence rules; `limited` marks deadline-driven events. |
| Recurrence behaviors | `replace`, `stack` | `replace`: wash dishes, take today's meds. `stack`: journal, log water, read pages. |
| Overdue policies | `retire`, `escalate` | `retire`: McDonald's promo, expired offer. `escalate`: taxes, rent, passport. |
| Priority scale | `low`, `normal`, `high`, `urgent` | Sorted by `priorityRank` seed 0/10/20/30; custom scales may supply any string + rank. |
| Starter progressions | `move-30-days` (`days`, target 30), `read-book` (`pages`), `journal-streak` (`days`) | Increment happens on explicit `record_progress` or on instance completion when configured on the entity. |
| Starter quests | `broken-window` (emergent), `morning-launch` (known), `tax-season` (known) | `broken-window` step 1 "call landlord"; next step revealed as mall / send money / repairer. |
| Starter seasons | `winter`, `tax-season`, `project-sprint` | Winter: snowy-night walk, Christmas market with friends. No length enforced. |
| Starter limited windows | `christmas-market-weekend`, `mcdonalds-promo`, `taxes` | `taxes` carries `deadlineAt` + `escalate`; the promo carries `retire`. |
| Presentation packs | `plain`, `gacha-night`, `gacha-winter`, `focus` | Tokens + copy + layout hints only. No pack may add fields or validation rules. |

## 4. UI shell

**Recommended default — "Worlds × Slices".**

- **Vertical rail (worlds):** `Today`, each category, `Quests`, `Seasons`, `Spaces`, `Progress`. Quests get their own vertical tab as requested.
- **Horizontal strip inside a world:** generated from that world's active entities — `Daily`, `Weekly`, `This event`, `Limited`, `Done`, `All`. Seasons are also reachable as a vertical world with per-season chips.
- A selected pair becomes a generic slice query: `{ vertical: { type, id? }, horizontal: { type, id? } }`. There is no whitelist of legal pairs; category × daily, season × weekly, space × limited, quest × today all resolve through the same `board:slice` function and return the proper slice of tasks, progressions, and quest panels.
- **Rendering:** a task in the slice becomes a card in dense worlds (`Today`, `Seasons`) and a row in scan worlds (`Household`, `Weekly`). A progression becomes a bar, which itself renders as a card in `Progress` and as a row inside `Health`. A quest becomes a dedicated panel in the `Quests` world with locked, available, and done steps; emergent steps show as a quiet "next step unlocks when this is done".

**Alternate A — Calendar-first.** Vertical axis is windows (days, weeks, months); horizontal axis is categories. The same slice query is called with the axes swapped. Cards become time-block chips; deadlines render as end caps. Everything else — links, quests, progressions — is unchanged data.

**Alternate B — Campaign map.** Vertical axis is seasons/quests; horizontal axis is acts or steps. Progressions become long bars across the top, quest steps become nodes, and limited windows become timed gates. This is the layout a `gacha-night` pack would ship by default.

**Presentation-pack seam.** A pack is a row with `slug`, `tokens`, `copy`, and `layoutHints`. Entities store `presentationId?`; clients resolve the id to a registered component set. Unknown ids fall back to `plain`. A pack changes colors, copy, density, default axes, and which entity kind uses card vs row. It never forks the schema, adds a validation rule, or encodes "seasons must be 30 days".

## 5. User flows

1. **Dishes replace.** Agent says "wash dishes daily". Manager creates a `daily` series with `behavior: "replace"`. Today's instance is undone at midnight; tomorrow the rollover patches that same instance to tomorrow's date. Yesterday's missed dish is gone from the board; done history still counts toward the household progression.
2. **Journal stack.** Agent creates a `daily` series with `behavior: "stack"`. Skipping Monday leaves Monday's journal task open. On Wednesday the user sees Monday, Tuesday, and Wednesday as three rows and can complete them in any order; no backlog cap exists in core (the UI may collapse old ones).
3. **Taxes deadline with escalate.** Agent reads "taxes due Nov 30" from email and creates a `finance` task with `dueAt` = a quiet work block, `deadlineAt` = Nov 30, `overduePolicy: "escalate"`, priority `high`. When the deadline passes, the policy raises priority to `urgent` and moves the task to the top of `Today` instead of deleting it.
4. **Missed limited offer retires.** Agent creates a limited window "McDonald's $3 burger" with `deadlineAt` Sunday and `overduePolicy: "retire"`. Monday it is soft-deleted from all slices and shown once in an "Expired" archive; the row is still in Convex and can be restored.
5. **Broken-window emergent quest.** Agent creates quest `broken-window`, `revealMode: "emergent"`, first step "Call landlord", `title: undefined` for steps 2–3. User completes step 1. The agent asks what the landlord said, then writes step 2 "Go to the mall" (or "Send money", or "Call repairer"). The quest panel reveals only the new step; a known checklist quest behaves the same but shows all steps up front.
6. **Book or exercise progression.** Agent creates progression `read-book`, metric `pages`, target 320, linked to the task "Read Chapter 4". User taps "+18 pages"; the bar moves to 62/320 and renders as a row inside `Project` and a card inside `Progress`. A 30-day exercise series increments the same way from completed instances.
7. **Sharing a household space.** User creates space "Flat 4", invites a partner, and attaches the `household` category, the dishes series, and the winter season. The partner sees those entities in their `Spaces → Flat 4` world and can check off dishes; ownership stays with the creator, and detaching an entity removes shared visibility without deleting it.
8. **Agent creating entities from an email.** Agent connects over MCP, calls `whoami`, then `create_window` (Nov 20–22), `create_event` (named "Christmas market", cadence `named`, primary window), `create_task` (visit market with friends, linked to the event), `create_season` ("Winter"), and `create_progression` ("snowy walks", 5 days) in one pass. The user opens Manager and sees the event under `Winter × This event` and the walk task under `Health × Daily` without refreshing.

## 6. Technical plan

### Convex tables and indexes

Keep everything in `packages/backend/convex`; split service modules by entity (`taskService`, `windowService`, `seriesService`, `spaceService`, `sliceService`) but keep one schema and one auth gate.

| Table | Key fields | Indexes |
|---|---|---|
| `users` | existing + `defaultPackId?`, `defaultSpaceId?` | `by_token` |
| `tasks` | as above | `by_owner` (existing), `by_owner_deleted` on `["ownerId", "deletedAt"]`, `by_series` on `["seriesId", "occurrenceKey"]`, `by_deadline` on `["deadlineAt"]` |
| `windows` | owner, from, to, granularity, label | `by_owner`, `by_owner_deleted`, `by_from` |
| `events` | owner, title, primaryWindowId, cadence, seriesId, deadlineAt, policy | `by_owner`, `by_owner_deleted`, `by_window`, `by_deadline` |
| `seasons` | owner, title, windowId, pack | `by_owner`, `by_owner_deleted` |
| `categories` | owner, slug, title, isSeed | `by_owner`, `by_owner_slug` |
| `series` | owner, rule, behavior, anchorAt, lastMaterializedPeriod | `by_owner`, `by_owner_deleted` |
| `progressions` | owner, title, metric, target, current | `by_owner`, `by_owner_deleted` |
| `quests` | owner, title, revealMode, steps, currentStepId | `by_owner`, `by_owner_deleted` |
| `spaces` | owner, title, slug | `by_owner`, `by_slug` |
| `space_members` | spaceId, userId, role | `by_space`, `by_user` |
| `space_entities` | spaceId, entityType, entityId | `by_space`, `by_entity` on `["entityType", "entityId"]` |
| `links` | from/to type+id, relation, isPrimary | `by_from` on `["fromType", "fromId"]`, `by_to` on `["toType", "toId"]` |
| `presentation_packs` | owner, slug, tokens, copy, layoutHints, isSeed | `by_owner`, `by_slug` |
| `overdue_policies` | slug, handler, params, isSeed | `by_slug` |

Seed slugs are `v.string()` with service-level lookup. `behavior`, `cadence`, `metric`, `rule`, `overduePolicy` are strings validated against an in-Convex registry so a new value is a registry entry plus seed row, not a migration. All timestamps are `v.optional(v.number())`.

### Soft-delete query rule

Every public `list*`/`get*` function applies `deletedAt === undefined`. With the `by_owner_deleted` index: `.withIndex("by_owner_deleted", q => q.eq("ownerId", user._id).eq("deletedAt", undefined))`. No live query changes shape: `taskView` keeps `id/title/done/dueAt/ownerId` and adds optional fields with defaults. `remove` becomes a patch of `deletedAt = Date.now()`; add `restore` and a later `purge`. `space_members` and `links` are soft-deleted too, so detaching is reversible and history survives.

### Occurrence engine

`seriesService.materialize(seriesId, now)` is idempotent and called by mutation and scheduler. For `replace`, if the live undone occurrence exists, patch its `dueAt`/`occurrenceKey` to the new period; if it is done, insert one fresh occurrence. For `stack`, insert one occurrence per elapsed `(rule, periodKey)` and leave every missed one open. Backfill caps live only in `layoutHints`, never in the core. Overdue policy is computed on read in M1 (derived `effectivePriority`, `isExpired`) so no scheduler is needed for the first milestone; M2 adds a scheduled handler that applies `retire` or `escalate`.

### MCP tools (thin wrappers, all call Convex)

- `whoami` — return `{ role, clerkUserId }` for the authenticated user.
- `create_task` / `update_task` / `list_tasks` / `complete_task` / `reopen_task` / `delete_task` / `restore_task` — soft-delete-aware task CRUD; `update_task` sets `dueAt`, `deadlineAt`, `location`, `priority`, `overduePolicy`, `presentationId`.
- `create_window` / `update_window` / `list_windows` / `delete_window` — spans with `from`/`to`/`granularity`.
- `create_event` / `update_event` / `list_events` / `delete_event` — named happenings, cadence, primary window, deadline.
- `create_season` / `update_season` / `list_seasons` / `delete_season` — long containers, no length rule.
- `create_series` / `update_series` / `list_series` / `delete_series` — rule plus `replace`/`stack` behavior.
- `create_progression` / `list_progressions` / `record_progress` / `delete_progression` — counters and targets.
- `create_quest` / `list_quests` / `complete_quest_step` / `reveal_quest_step` / `delete_quest` — known and emergent steps.
- `create_category` / `list_categories` / `create_pack` / `list_packs` — seed catalog access.
- `create_space` / `list_spaces` / `add_entity_to_space` / `remove_entity_from_space` / `invite_to_space` / `list_space_members` — space-first sharing.
- `attach` / `detach` / `list_links` — many-to-many links with `isPrimary` guidance.
- `board_slice` — the generic vertical × horizontal query, so an agent reads exactly what the user sees.

Rebuild `api/` bundles with `pnpm build:api` after any MCP change; CI keeps `pnpm verify:api` honest.

### How clients stay thin

`packages/ui` owns the slice components, card/row/bar renderers, and pack registry; web and Tauri share it. Apple keeps `ManagerKit` pure models/views and `ManagerData` for Convex + Clerk; Android mirrors with `:managerkit`, `:managerdata`, `:app`. Native decoders read new optional fields with tagged-float helpers and ignore unknown keys, so additive schema changes do not break shipped builds. No client computes overdue, recurrence, or access rules.

### Migration from today's tasks

1. **Additive fields first.** Add all optional task fields and `deletedAt?` to the schema; keep `title`, `done`, `dueAt`, `ownerId` untouched.
2. **Flip delete semantics.** `tasks:remove` patches `deletedAt`; add `tasks:restore`. Previously hard-deleted rows cannot be recovered — say so in release notes.
3. **Filter reads.** Update `taskService.listTasks` to use `by_owner_deleted`; `taskView` gains defaults (`allDay: true`, `priority: "normal"`, `overduePolicy: "none"`, `dueAt: null`).
4. **Backfill seeds.** On next signed-in query, ensure per-user category/pack/policy rows exist. `dueAt` needs no conversion.
5. **Introduce entity tables by milestone** (below), never in one big-bang schema commit.

### Schema sequence

- M1: tasks fields + `deletedAt`, `categories`, `links`, `series`. **No seasons.**
- M2: `windows`, `events`, `seasons`, `presentation_packs`, `overdue_policies`.
- M3: `progressions`, `quests`.
- M4: `spaces`, `space_members`, `space_entities`.
- M5: pack content and custom UI registrations only; no new core tables required.

## 7. Milestones

**M0 — Vocabulary and agent notes.** Outcome: this document is accepted and agent-facing prompts/skills/harness notes exist for Grok Bot, Codex, Claude, and Antigravity. In: term table, MCP tool docs, example email→entities transcripts, `replace` vs `stack` guidance. Out: code. Why next: agents are the primary authors; writing the contract first prevents three clients from teaching them different rules.

**M1 — Rich atomic task.** Outcome: soft-delete plus meta, categories, links, and per-series replace/stack, with web/desktop card+row and a minimal `category × daily/weekly` slice. In: additive task schema, `series`, seed categories, `board_slice` v1, task/category/link/series MCP tools, derived overdue (no scheduler). Out: windows, events, seasons, quests, progressions, sharing, deep native UI. Why next: every later entity attaches to a task; building them first would force a rewrite of the list service.

**M2 — Time, limits, and the board.** Outcome: windows, events, limited windows, first-class deadlines, overdue handlers, seasons, presentation packs, and the full vertical × horizontal shell. In: M2 tables, `retire`/`escalate` scheduler, `plain` and `gacha-night` packs, agent tools for all new entities. Out: quests, progressions, spaces. Why next: it needs M1's task meta but nothing from M3/M4, and it delivers the visible "this is not a todo app" moment.

**M3 — Quest space and progression bars.** Outcome: dedicated quest vertical tab, emergent and known steps, progression bars as cards and rows. In: `progressions`, `quests`, `record_progress`, `reveal_quest_step`, quest pack copy. Out: sharing. Why next: quests need tasks/events to attach to; progressions need completed instances from M1/M2.

**M4 — Shared spaces.** Outcome: create a space, attach any entity, invite members, shared slices. In: space tables, membership gate in Convex, space UI world, agent tools. Out: achievements, social feed, hosted inference. Why next: the entity taxonomy is stable by M3, so a single gate can cover everything instead of per-entity ACLs.

**M5 — Customization and packs.** Outcome: shipped seasons/events/category packs with their own UIs, plus `focus` and `gacha-winter` packs, all without core changes. In: seed content, pack registry in all four clients, copy controls. Out: horizon items. Why next: packs only pay off once the core stops changing.

**Horizon (explicitly not first milestones):** achievement board unlocked by household tasks, sequences, quests, categories, events, or combinations; social/group play; user-paid hosted AI inference; direct email ingest so we own agent prompts. Until then we ship prompts, skills, and harness notes for existing agents.

## 8. Risks and decisions for the council

1. **Rolling replace vs materialized deletion.** I choose rolling replacement for `replace` (patch the undone instance forward) because materializing then deleting missed days invites backlog anxiety. Cost: "I skipped Tuesday" disappears from the board. Done history remains. Argue if you want an audit trail of skips.
2. **Soft delete everywhere.** I accept unbounded row growth for personal-scale data; a retention/purge job is a horizon item. The alternative — hard delete for links and members — makes "detach" irreversible and violates the atomic rule.
3. **Space-first sharing with `ownerId` retained.** Decision: private entities stay owner-only; space membership grants access to attached entities. Open question: can a `member` edit any shared entity, or only ones they created? I lean yes for shared household tasks, no for season/pack definitions.
4. **"Event" naming.** I split window/event/season and treat daily/weekly as recurrence rules. If the council wants `event` to mean any cadence, we must rename the named-happening entity now, before MCP tools ship.
5. **Extensible string slugs vs unions.** I choose strings + registry. Tradeoff: typos are runtime errors instead of compile errors; mitigated by agent tool docs and seed lookups. Unions would make every experiment a migration.
6. **Backfilling `stack` occurrences.** Automatic scheduler backfill is right for journaling but could flood an ADHD user after a long absence. Core has no cap on purpose; the pack may collapse old instances. Decide the default pack behavior, not the schema rule.
7. **Deadline vs `dueAt`.** Keeping both is deliberate but confusing for agents. `create_task` docs must state: `dueAt` = planned time, `deadlineAt` = last valid moment, `remindAt` = notification. If we collapse them, we lose the "do it Tuesday, due Friday" case that taxes need.
8. **Emergent quest blanks.** An unknown next step renders as an empty card unless the pack hides it. Decide the `plain` pack copy now; do not solve it by forcing quests to be known in advance.
9. **Presentation packs across native clients.** A pack id unknown to Apple or Android falls back to `plain`. We need a shared slug registry in each client; drift here is the most likely cross-platform bug.
10. **Scope discipline.** Achievements, social, hosted inference, and direct email ingest stay on the horizon. If the council pulls any into M1–M5, this plan's sequencing is void and should be rewritten rather than stretched.
