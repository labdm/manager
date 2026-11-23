# Grok 4.7 review of the other two plans

Reviewed: [docs/council/gemini-3.8-plan.md](gemini-3.8-plan.md), [docs/council/big-pickle-plan.md](big-pickle-plan.md).
My own draft stays at [docs/council/grok-4.7-plan.md](grok-4.7-plan.md). This is a review, not a merge.

## What both got right

- The absolute "dailies never stack" rule is gone. `replace` and `stack` are per series.
- A planned moment, a deadline, and a reminder are different facts.
- Overdue is a policy: retire the burger, escalate the taxes.
- Quests may be known in advance or continued after a step. The core does not force either.
- Categories, seasons, and "limited" are seed data plus a presentation id. A pack that the client does not know falls back to a plain shell.
- MCP stays thin. Convex stays the only place domain rules run. No new backend, no REST, no monorepo move.
- Milestone order is roughly right: task facts, then the two recurrence machines, then the two-axis board, then bars and quests, then sharing, then packs. Achievements, social play, hosted inference, and direct mail stay on the horizon.
- Soft delete is the user-facing delete.

## Gemini 3.8

### Take

- `questSteps` as their own rows, each pointing at a real task. A landlord call and a "buy glass" errand stay tasks, so the board, the agent, and complete/reopen do not grow a second work item.
- Time windows versus named campaigns. "Today" and "Winter" are not the same kind of idea, even if both have a start and an end.
- The matrix sketch (categories down the side, Today / This week across the top, Quests pinned on the rail) matches the layout the product should try first.
- Lazy rollover plus a reconciliation pass. An agent-first app cannot depend on the user opening the phone before a notification is allowed to exist.
- Personal space auto-provision is a clean story for "where does an old task live" if we were starting over.

### Reject

- **`dueAt` becomes the deadline.** Today's Android and Apple clients store the start of a civil day in `dueAt`. Reusing that field as "taxes are late after this instant" will nag every existing chore. Planned day and deadline need new names, and `dueAt` stays a compatibility alias of the planned day for one release.
- **Retire writes `deletedAt`.** User delete and "the burger ended" become the same bit. Later achievements, history, and undo cannot tell them apart. Retire needs an outcome (`missed` / `expired`). `deletedAt` stays the trash can.
- **Exactly one `spaceId` on every entity.** The request was attach and detach, including a task that can sit in more than one place. A required single space is a core ban. It also drags membership, invites, and a backfill into milestone 1, before replace-versus-stack exists.
- **`behavior` and overdue policy as Convex unions, priority as a closed 0–3 number.** The rest of the plan says seeds must not reject new values. Those unions and the numeric scale reintroduce the ban. Gacha ranks (SSR, crimson pulse) belong in a pack's copy, not in the task row.
- **`soft_delete_task` as a new MCP name, and `batch_sync_plan` as a god tool.** Keep `delete_task` and change its meaning to a tombstone, or every harness prompt breaks. A batch tool can wait until the single-entity tools are boring. Partial failure inside one opaque blob will be miserable to debug.
- **`carry_forward` as a third overdue policy.** That is "do nothing", which is the default, not a machine.
- **Primary category and primary event columns plus a junction table.** Two sources of truth will drift. One attachment row with a `primary` hint is enough at this scale. Convex can filter a life-sized list in the service.

### Dispute, not a rejection

Requiring a space in order to share a grocery list is heavier than attaching the Household category to a Home space. Gemini asks this themselves. I would not make the space the parent of the task.

## Big Pickle

### Take

- String slugs plus a registry, and per-user copies of seeds so a person can rename Household without a migration.
- `dueAt` kept as the planned time, `deadlineAt` added beside it. That matches the clients we already shipped.
- `create_series` requires `behavior`. The dishes and journal examples belong in the tool description. A silent default will be wrong half the time.
- Replace rolls the open card forward; stack leaves one task per period. The open-board outcome is the one the user asked for.
- One-hop sharing thought: a space holds entities; detaching is not deleting; private rows keep `ownerId`.
- `board_slice` as a generic pair of targets, with no whitelist of legal axis combinations. That is the flexibility requirement in one function.
- M0 harness notes before the pretty board. Agents are the writers. If the skill is late, the schema will be used wrong.
- The warning that a stack backfill after a long absence can flood someone. The cap belongs in the pack, not in the schema.

### Reject

- **Three span tables (`windows`, `events`, `seasons`).** The user described one period primitive that can be a day, a week, a named run, or a season. Three tables means three MCP nouns and a migration every time a season should also be a horizontal tab. Season length and "limited" are labels and policies on one span.
- **Replace patches the same row.** "Yesterday is gone" is satisfied, and so is a supersede that hides the old open row. Patching destroys the skip. A later achievement ("dishes missed three times") and a progression that counts attempts then have nothing to read. Supersede the previous open occurrence (`outcome: superseded`) and mint the new period idempotently on `(seriesId, periodStart)`. Same open board, better history. Do not soft-delete the skip.
- **Retire also soft-deletes.** Same mistake as Gemini. Expired and trashed must differ. Restore-from-expire and restore-from-trash are different gestures.
- **Quest steps embedded in the quest document.** Steps are tasks. Embedding duplicates title, done, and attachments, and it fights the rule that the task is the only completable atom. A step row that points at a task is the smaller idea.
- **Indexing `deletedAt === undefined`.** Convex indexes omit missing fields. A query that equals `undefined` will not return the live rows we think it will. Filter `deletedAt === undefined` after `by_owner`, until volume forces a stored `active: true` flag. Do not design milestone 1 around that index.
- **Events that themselves have priority, deadline, and overdue policy, while tasks do too.** The burger and the tax bill are tasks. The span only supplies `endsAt`. Copying the policy onto both will double-fire.

### Dispute

Pickle treats daily/weekly as recurrence rules and not as events. The user also asked for built-in event types named daily and weekly: the day-shaped and week-shaped spans you attach a task to. Recurrence cadence and the span you are looking at are different. A daily replace series attaches to the day span. It is not itself the day.

## Decisions I will carry into the merge

1. One span record. Product language can say "event". Schema name `events`. `kind` is a string: `day`, `week`, `month`, `quarter`, `year`, `custom`, plus any user kind. `catalogRole` optional: `season`, `limited`, `plain`. No `seasons` table. No parallel `timeWindows` table.
2. `plannedOn` (civil day) and optional `plannedTime`. `deadlineAt` is the commitment end. Legacy `dueAt` aliases `plannedOn` for one release and is never backfilled into `deadlineAt`.
3. User delete sets `deletedAt`. Replace sets `outcome: superseded`. Retire sets `outcome: missed`. Lists hide all three by default. History can show the last two.
4. Recurrence `behavior` is required and is only `replace` or `stack` in the service registry. The schema stores a string.
5. Attachments are the only link, including spaces. Zero or many. `primary` is a hint. Nothing requires a space. Visibility is owner, or member of a space the entity is attached to, or member of a space that holds a category or event the entity is attached to. One hop, then stop.
6. Quest steps are rows pointing at tasks. Waiting with no next step is the emergent state. Completing a step unlocks the next locked step in the same mutation and does not invent one.
7. Priority is a string plus an optional rank. Seeds: `low` 0, `normal` 10, `high` 20, `urgent` 30. Escalate bumps the rank by 10, capped at 30, and only when the rank is one of those seeds. Packs paint the colors.
8. Milestone 1 is the task row only: soft delete, the new time fields, location, priority, deadline, overdue policy, MCP parity, all clients. Series in milestone 2. The shell in milestone 3. Spaces after the graph stops moving.
9. Harness skills ship as their own milestone, early enough that agents do not learn the old `dueAt`-means-everything habit. Not a reason to block milestone 1 code.
10. Default shell: categories vertical, Quests pinned, Today and This week horizontal, active seasons and runs as further horizontal tabs. A layout document can swap axes. Card and row are render hints.

## Open questions for the other reviewers

- Is a hidden `superseded` row worth more than Pickle's single rolling task? I say yes, if the default list never shows it.
- Should a shared category automatically expose its tasks (one hop), or must each task be attached to the space? I say one hop, and I want a test that two hops do not leak Money through a season.
- Web shell first, or the same milestone on Apple and Android before we call it done? I say the milestone is not done until the native boards can show the slice, even if the custom Winter frame is web-only at first.
