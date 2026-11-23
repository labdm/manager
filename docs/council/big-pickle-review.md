# Council review — Big Pickle

Scope: review of Grok 4.7 and Gemini 3.8 against the user constraints and the shipped codebase. My own draft is only a comparison baseline. No replacement plan is proposed here.

## 1. Verdict on Grok

Grok 4.7 is the strongest of the two drafts on the domain contract and the weakest on sequencing. It gets the hard splits right — `plannedOn` versus `deadlineAt`, `outcome: missed` versus `deletedAt`, one span record with `catalogRole: season`, required `behavior`, and attachments that tolerate many targets — and it separates "UI guidance" from "core invariant" more cleanly than either other draft. Its two real mistakes are a table name it argues against itself (`events`, while admitting "Today" then sounds like a party) and parking harness skills in M8 even though agents are the primary writers. Its replace machine (supersede the old open row, mint a new one) satisfies "yesterday must not remain open," but it is not the implementation I would ship. Take the field model; drop the table name, the milestone order, and the supersede machinery.

## 2. Steal from Grok

- **`outcome` as a field distinct from `deletedAt`.** Grok uses `outcome: open | done | superseded | missed`; `deletedAt` means only "this should be gone." This is the correct answer to the burger: the opportunity expired, the row is not trash. My draft's flow 4 says the retired task is "soft-deleted from all slices," which collapses two different facts. Switch retire to `outcome: missed` plus a slice filter. This also gives history and achievements a real record of the miss without turning it into a tombstone.
- **`plannedOn` (number) plus `plannedTime` (integer minutes from midnight).** My `allDay` boolean plus dual-purpose `dueAt` is ambiguous when a planned moment *does* have a time. Grok's split matches the constraint exactly: usually a civil day, sometimes a clock time on that day. Keep `dueAt` as the wire alias of `plannedOn`; add `plannedTime` as minutes, not as another epoch.
- **One span record with `catalogRole`, not three span tables.** Grok's `shape: rhythm | run`, `cadence`, `startsAt`/`endsAt`, `catalogRole: season | limited | plain`, with season length explicitly *not* validated, is exactly the user's vocabulary. My `windows` + `events` + `seasons` split duplicates cadence terms across three tables (`windows.cadence`, `events.cadence`, `series.rule`). Collapse to one, named `spans` (see 8a).
- **One-hop space visibility.** "Members see entities attached to the space, and tasks attached to a category or event that is itself attached to the space; no further hop." That is a concrete, enforceable sharing rule that neither my draft nor Gemini states. It prevents a season from accidentally publishing a whole life. It is a visibility cap, not an attachment cap, so it does not conflict with "no hard limits in the core."
- **Required `behavior` in MCP and an idempotency key.** `create_recurrence` failing without `behavior: replace | stack` removes the silent-default trap for journals. The `(recurrenceId, periodStart)` uniqueness rule for lazy minting is the right guard against two clients opening a board at midnight. My registry-based strings were extensible but left creation semantics implicit.
- **"All" is a query mode, not a stored event.** Small rule, real consequence: it keeps the slice function from needing special rows for every no-filter selection.

## 3. Reject from Grok

- **The table name `events` for the span record.** Grok flags the risk itself in §8.1. Internal `event` plus UI copy "Today / This week" is a permanent translation tax on every agent prompt and every MCP tool name. Rename the one table `spans`; keep `catalogRole: season | limited` for the game vocabulary. I would drop the table name more readily than accept two span tables, as Grok says — but the name still has to change.
- **Harness skills in M8.** "Agents create every entity over MCP"; if the agent-facing contract ships last, M2's `behavior` choice is undefined in the wild for the whole build. Skills and tool docs belong in M0/M1, as my draft's M0 has them. Grok's M8 should be seed-catalog install only.
- **Supersede-plus-mint for `replace`.** It does not violate "yesterday must not remain open" — a superseded row is not open — but it creates one durable row per skipped day and records a failure history an ADHD-first board has no reason to surface. Done occurrences already give the progression its count. Patch the single live undone occurrence forward; insert only when the current one is done. This is a design disagreement, not a constraint finding.
- **`outcome: done` mirroring `done`, and `outcome: open` on live rows.** Two sources of truth for completion will drift. Keep `done` as the completion bit and reserve `outcome` for non-done terminal states (`missed`, `superseded`, `expired`) that the open-board filter needs.
- **Grok's M1 leaving `update_task` until MCP parity is asserted is fine, but its "no backfill into `deadlineAt`" should be a service-level test, not only a doc note.** Existing tasks must not silently become taxes. My draft already tests this; Grok states it in prose. Keep the test.

## 4. Verdict on Gemini

Gemini 3.8 is the most detailed draft and the most dangerous if adopted wholesale. Every one of its headline data decisions cuts against an explicit constraint or the shipped wire contract: `dueAt` becomes a hard deadline, every entity gets exactly one required `spaceId`, spans split into `timeWindows` plus `events`, `retire` writes `deletedAt`, and `carry_forward` joins `retire`/`escalate` as a third overdue policy. Its M1 auto-provisions a personal space and backfills production rows for a mechanic the user did not ask for in M1. What survives is at the mechanics and presentation level: step rows that point at tasks, explicit unlock conditions, atomic batch ingestion, and a clear account of how packs stay out of the schema. Use it as a UI/quest detail source, not as the data model.

## 5. Steal from Gemini

- **`questSteps` as rows with `taskId`, not embedded step objects.** My draft embeds `{ id, title?, done, unlocked, revealText? }[]` inside `quests`. That is a second task model with a second completion primitive: `complete_quest_step` cannot complete a task, the step cannot appear in a slice, and `done` on `tasks` is no longer the only way to finish something. Step rows pointing at `tasks` keep the atom atomic. This is the single most important correction from either draft.
- **`unlockCondition` as data, with the branch left to the agent.** `previous_completed` handled natively in Convex, `manual`/`external_signal` resolved by an agent appending the next step over MCP. That gives emergent quests a real primitive without building a native rule engine, and it leaves manual quests usable without an agent.
- **Derive step display state from `tasks.done`.** Gemini stores `questSteps.status`, which will desync. Keep the step row positional and gated; read completion from the task row.
- **`batch_sync_plan` as one atomic Convex mutation exposed over MCP.** Agents create every entity; an email-to-board write that creates an event, quest, first step, and task should not leave a half-built plan if a call fails. This stays thin only if the transaction lives in `packages/backend/convex` and `apps/mcp` merely forwards arguments. Adopt with that condition.
- **Explicit soft-delete index discipline.** `by_owner_deleted` on `["ownerId", "deletedAt"]` with `.eq("deletedAt", undefined)` in every live query, plus "no `ctx.db.delete()` in any business mutation," is stated more mechanically than in my draft. Keep it as a CI-checkable rule.

## 6. Reject from Gemini

- **`dueAt` as "hard deadline timestamp" plus `plannedDate` as `YYYY-MM-DD` string.** This is the biggest violation. AGENTS.md and all four clients already treat `dueAt` as the start of a civil day; Apple decodes it with `@OptionalConvexFloat`, Android with `Float64`. Reinterpreting it as a deadline makes every dated chore into taxes and destroys the planned-day/deadline distinction. A string `plannedDate` also forces conversion on every client. Keep `dueAt` as the alias of a numeric `plannedOn`; add `deadlineAt` separately.
- **Required `spaceId` on every entity, auto-provisioned personal space, and backfill in M1.** The user says spaces are things you attach and detach entities from, a task may attach to several places, and single attachment is UI guidance. Gemini's tenancy model plus `taskAttachments.spaceId` makes "exactly one" a core fact and adds a production migration for a mechanic that belongs after the entity graph settles. No spaces in M1; when they land, attachment is many-to-many via `space_entities`.
- **`retire` → `deletedAt: Date.now()`.** The burger's opportunity is gone; that is not the same as the user putting a row in Trash. It kills the "you missed it" history and makes `restore` answer the wrong question. Use `outcome: missed`.
- **`carry_forward` as an overdue policy.** The user names exactly two overdue behaviors: `retire` and `escalate`. `carry_forward` is recurrence behavior wearing a policy badge; keeping both invites contradictory configurations on the same row.
- **`timeWindows` plus `events` as two span tables.** One table with `kind`/`cadence` and `catalogRole` covers daily, weekly, month, quarter, year, custom, seasons, and limited runs. Two tables mean two identity spaces for "this week" and two sets of MCP tools.
- **Closed numeric priority `0..3` with P0–P3 gacha tiers in the core.** Custom scales become impossible, and the tier names belong in a pack's copy map. Use `priority` string plus optional `priorityRank`, with a registered order for the seeds so escalation is deterministic.
- **Renaming `delete_task` to `soft_delete_task`.** Existing agents and clients call `delete_task`; changing the name to describe the implementation breaks the MCP contract for no gain. Keep `delete_task` and make it soft.
- **`unlockCondition: "external_signal"` evaluated natively.** Gemini floats a native condition evaluator in its risks. Do not build it in the milestones; the agent appends the step over MCP.

## 7. Where I changed my own mind

- **Quest steps.** Embedded steps were wrong. Step rows with `taskId` are the only shape consistent with "task is the atom" and `complete_task`. Unknown future steps mean no row yet — the quest shows `waiting` until an agent appends one.
- **Retire.** My flow 4 called the expired offer "soft-deleted from all slices." That is trash vocabulary applied to an outcome. Retire now means `outcome: missed` plus a slice filter; `deletedAt` is untouched.
- **Planned time.** `allDay: false` plus a dual-purpose `dueAt` was muddled. `plannedOn` number plus `plannedTime` minutes, with `dueAt` as the compat alias, is cleaner and matches "usually no time, but may."
- **Span count.** My `windows` + `events` + `seasons` tables were over-modeled. One `spans` table with `kind: rhythm | run`, `cadence`, `startsAt`/`endsAt`, and optional `catalogRole` covers the user's list. Daily and weekly remain recurrence rules in `series`, not a second storage vocabulary.
- **MCP strictness.** `behavior` should be required at `create_series` with no default, and minting should be idempotent on `(seriesId, occurrenceKey)`. My registry approach was extensible but too permissive at the boundary.
- **Priority escalation.** I kept string plus `priorityRank`, but I was vague on how a bump chooses the next value. Add a registered seed order so `escalate` is a deterministic one-step move and a no-op at the top; unknown strings are not auto-bumped but still get the overdue mark.
- **M1 scope.** My M1 pulled `categories`, `links`, and `series` in alongside task facts. Grok's smaller M1 is better sequencing: soft delete plus planned/deadline fields first, recurrence and the slice in the next milestone.

I did not change my mind on `replace` implementation: patch the single live undone occurrence forward, insert fresh when it is done. Grok's supersede rows are legitimate but unnecessary.

## 8. Dispute answers

**a. One span table versus windows + events + seasons.**
One table, named `spans`. Fields: `ownerId`, `kind: rhythm | run`, `cadence`, `startsAt`, `endsAt`, optional `title`, optional `catalogRole: season | limited | plain`, `presentationId?`, `deletedAt?`. Seasons are rows with a name and any length; `limited` is internal logic with plain copy "limited task" / "closes Friday." Recurrence rules stay in `series`. Grok is right on the shape and wrong on the name; Gemini's `timeWindows` + `events` split is wrong. Renaming now, before MCP tools ship, is cheaper than translating "event" forever.

**b. Legacy dueAt: planned day alias, or the deadline.**
Planned-day alias. `dueAt` remains the start of the civil day on the wire and reads/writes `plannedOn`. `deadlineAt` is a separate, opt-in field; optional `plannedTime` carries the clock time when there is one. Every existing dated task becoming a nagging deadline would erase the difference between the burger and taxes, and would contradict the tagged-float decoding already shipped in Apple and Android. Gemini is wrong; Grok is right. Add a service test that a `dueAt`-only create leaves `deadlineAt` undefined.

**c. Replace: patch one row forward, or supersede the old open row and mint a new one.**
Patch the live undone occurrence forward in place — update `dueAt`/`occurrenceKey` — and insert a fresh occurrence only after the current one is done. Both options satisfy "yesterday must not remain open," so this is not a constraint dispute: I reject supersede on row economy and on ADHD grounds, because a durable trail of skipped dishes is a shame engine even if it lives outside the open board. If skip statistics are ever wanted, derive them from cycle counts, not from tombstone-ish task rows. Steal Grok's `(seriesId, occurrenceKey)` idempotency key and required `behavior` regardless of which machine wins.

**d. Retire: set deletedAt, or set an outcome distinct from trash.**
Distinct outcome. `outcome: missed` (or `expired`) removes the task from open slices and remains queryable for history and achievements; `deletedAt` is only the user's Trash and is restorable. The user's burger example is an expired opportunity, not a deletion. Grok is right; Gemini is wrong; my own earlier flow was wrong. Same field also carries `superseded` if the council later chooses Grok's replace machine.

**e. Must every entity belong to exactly one space in milestone 1.**
No. Spaces attach and detach entities through `space_entities` (or the generic `links` table with relation `space`); entities keep `ownerId` for private data. Milestone 1 should not ship spaces at all. If they land early for other reasons, attachment is still many-to-many and detaching is a soft delete of the link. Gemini's required `spaceId`, personal-space auto-provision, and backfill are both a violation of "a task may attach to several places" and a needless production migration.

**f. Quest steps embedded in the quest document, or step rows pointing at tasks.**
Step rows pointing at tasks: `questSteps` with `questId`, `taskId`, `position`, `gate`/`unlockCondition`. Completion is `tasks.done`; there is no second `done` field and no second completion tool for a step. Entities created by an agent must be tasks over `complete_task`, and steps must be able to appear in slices and feed progressions. Embedded steps were my mistake. An emergent quest with no known next step has no step row and shows `waiting` until the agent appends one.

**g. Priority as a closed number, or a string plus optional rank.**
String plus optional rank. Seeds `low | normal | high | urgent` with registered ranks 0/10/20/30; custom strings are valid with a supplied `priorityRank`. `escalate` moves one step in the registered order, saturates at the top, and does not guess at unknown strings — those still get the overdue mark in the UI. Closed 0..3 blocks custom scales and hard-codes gacha tiers into the core; a bare string makes escalation fuzzy, which Grok correctly flags. My draft was directionally right and needs the explicit registered order.

## 9. Five bullets to keep regardless of draft

- **Soft delete is absolute and vocabulary is precise.** No `ctx.db.delete()` in any user-facing mutation; `delete_task` keeps its name and sets `deletedAt`. Trash (`deletedAt`) is never confused with an outcome (`missed`, `superseded`, `expired`).
- **The three time facts stay separate.** `dueAt` is the planned civil-day alias of `plannedOn`; `plannedTime` is optional minutes; `deadlineAt` is the opt-in last valid moment. Overdue has exactly two handlers — `retire` and `escalate` — enforced in Convex, never inferred from `dueAt`.
- **Recurrence declares itself and is safe to mint.** `behavior` is required and is `replace` or `stack`; `replace` never leaves a stale open occurrence, `stack` has no core cap, and minting is idempotent on `(seriesId, occurrenceKey)`.
- **Links are many; spaces are attached.** One generic attachment mechanism with `isPrimary`/`role` as UI guidance only. A task may attach to several categories, spans, quests, and spaces. The two-axis board is a query over those links; a presentation pack is tokens, copy, and layout hints, never a schema fork.
- **Convex owns the domain and agents own the writes.** Every entity is creatable over thin MCP wrappers into the same Convex mutations clients call; quest steps point at tasks; harness skills and tool docs ship in M0/M1. Hosted inference and direct email stay on the horizon.
