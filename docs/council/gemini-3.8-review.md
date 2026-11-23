# Manager Council: Review of Grok 4.7 and Big Pickle Plans
**Reviewer:** Gemini 3.8 Flash (Manager Council)  
**Date:** November 23, 2026  
**Target:** [`docs/council/gemini-3.8-review.md`](file:///Users/dmytroafonin/Projects/manager/docs/council/gemini-3.8-review.md)

---

## 1. Verdict on Grok in one paragraph

Grok 4.7 is architecturally the cleanest and most disciplined draft, demonstrating superior data modeling by refusing schema bloat, respecting existing client wire contracts, and strictly honoring the semantic differences between history, state, and deletion. Its operational distinction between `superseded`, `missed`, and `deletedAt` solves the ADHD guilt problem without destroying auditability. However, its query strategy relies too heavily on unindexed in-memory filtering and a polymorphic `attachments` join table that will struggle under Convex's reactive query engine, while deferring spaces all the way to Milestone 7 leaves multi-user sharing unaddressed for too long.

---

## 2. Steal from Grok: concrete mechanics you now think are better than yours

1. **Explicit task lifecycle states via the `outcome` field (`open`, `done`, `superseded`, `missed`) instead of overloading `deletedAt` or boolean `done`.**
   - *Why:* In [`gemini-3.8-plan.md`](file:///Users/dmytroafonin/Projects/manager/docs/council/gemini-3.8-plan.md), retirement and replace rollovers were handled by either mutating tasks in place or setting `deletedAt`. Grok correctly recognizes that `deletedAt` is strictly for user trash. A superseded dish (replaced occurrence) or a missed limited burger (retired opportunity) is valuable historical context for streaks, stats, and progressions. Marking them with `outcome: "superseded"` or `outcome: "missed"` keeps the open board clean while preserving the audit record without polluting the trash bin.
2. **Superseding replace occurrences by minting a new row per period instead of mutating/patching a single task forward.**
   - *Why:* Grok sets the previous open occurrence's `outcome = "superseded"` and mints a new task with `outcome = "open"` for the new period (idempotent on `(recurrenceId, periodStart)`). Mutating a single task forward in place (as Gemini and Big Pickle proposed) destroys completion timestamps, confuses offline client sync, and prevents progressions from measuring how many discrete days a habit was performed or skipped.
3. **Preserving legacy `dueAt` as a compatibility read alias for `plannedOn`, NOT migrating it into `deadlineAt`.**
   - *Why:* In [`gemini-3.8-plan.md`](file:///Users/dmytroafonin/Projects/manager/docs/council/gemini-3.8-plan.md), `dueAt` was redefined as the hard deadline. Grok correctly notes that current Apple and Android clients store the start of a civil day in `dueAt`. If `dueAt` becomes a hard deadline, every existing routine chore instantly inherits aggressive deadline/escalate semantics, converting the app into the exact anxiety-inducing shame engine we are trying to eradicate. Mapping legacy `dueAt` to `plannedOn` maintains wire compatibility with existing native builds.
4. **Single unified `events` table with `shape: "rhythm" | "run"` and `catalogRole: "season" | "limited" | "plain"` instead of separate `timeWindows`, `events`, and `seasons` tables.**
   - *Why:* A calendar day/week (rhythm), a 3-week campaign (run), and a 90-day season are all just time spans with `startsAt` and `endsAt`. Splitting them into multiple tables forces duplicate indexing, triplicates the slice query logic, and creates arbitrary schema boundaries where data modelers must argue over when an event becomes a season.
5. **Separating `plannedOn` (civil date timestamp) and `plannedTime` (integer minutes from midnight) on `tasks`.**
   - *Why:* Gemini 3.8 used a string `plannedDate: "YYYY-MM-DD"`. Grok uses epoch millis at the start of the civil day for `plannedOn` and an optional integer `plannedTime` (0–1439). This matches how the native clients already handle dates on the wire and avoids string parsing in Swift/Kotlin while cleanly decoupling the planned day from time-of-day.

---

## 3. Reject from Grok: concrete mechanics that violate the user constraints or the existing codebase

1. **In-memory filtering of `deletedAt` over full table scans (`db.query("tasks").withIndex("by_owner")`).**
   - *Why:* Grok argues that indexing optional fields in Convex is awkward and advocates querying `by_owner` and filtering `deletedAt === undefined` in TypeScript memory. In Convex, this scans every soft-deleted tombstone forever. As tasks accumulate over months, reactive subscription payloads and query execution times will degrade significantly. The schema must define compound indexes such as `by_owner_deleted` on `["ownerId", "deletedAt"]` (or use active status indexes) so queries read only live records from storage.
2. **Polymorphic `attachments` table (`subjectType`, `subjectId`, `targetType`, `targetId`) for primary slices.**
   - *Why:* Resolving an intersection like `Category × Today` through a generic polymorphic table requires fetching attachment records, pulling subject IDs, and executing individual `ctx.db.get` calls for every task. In Convex's reactive document engine, this creates severe N+1 read overhead and makes reactive dependencies noisy. Fast primary slicing requires direct indexing or dedicated foreign keys (`primaryCategoryId`, `primaryEventId`) on the `tasks` table, reserving junction tables only for secondary multi-attachments.
3. **Deferring Spaces entirely to Milestone 7.**
   - *Why:* Pushing sharing to M7 means every milestone between M1 and M6 builds queries, mutations, indexes, and MCP tools hardcoded strictly to `ownerId`. When spaces finally land in M7, every read query (`tasks:list`, `get_slice`, `list_events`) will require a breaking authorization rewrite to check space membership. While every entity should not be forced into a space in M1, the multi-tenant space authorization model must be established earlier (by M3 or M4) before the entity graph solidifies.
4. **String-only priorities (`later`, `normal`, `soon`, `now`) without a numeric sort key.**
   - *Why:* Grok admits that custom priorities outside the 4 seeds cannot auto-escalate because strings have no natural ordering. Furthermore, sorting tasks on client UI tables (Apple SwiftUI `List`, Android Compose `LazyColumn`) by string priority requires client-side mapping dictionaries. Storing a normalized numeric rank or pairing the string with a numeric `rank` ensures deterministic database indexing and mathematical escalation (`rank += 10`).

---

## 4. Verdict on Big Pickle in one paragraph

Big Pickle produces an unnecessarily bloated schema with 14 tables that introduces severe relational indirection (`windows` pointing to `events` pointing to `seasons`, plus database tables for `overdue_policies` and `presentation_packs` that belong in code registries), while directly violating core user constraints by embedding quest steps as non-task JSON blobs and setting `deletedAt` on retired tasks. Its mechanics for replace recurrence (mutating the existing task forward in place) destroy habit history, and its attempt to treat windows as a standalone entity creates indirection without solving any practical user problem.

---

## 5. Steal from Big Pickle

1. **String-based priority paired with `priorityRank` (`priority: string`, `priorityRank?: number`).**
   - *Why:* Big Pickle allows extensible priority strings (`low`, `normal`, `high`, `urgent`) while providing `priorityRank: number` (0, 10, 20, 30). This allows custom priority tiers while keeping escalation deterministic (e.g., bumping rank by 10) and enables simple numeric indexing and client-side sorting without hardcoding enums.
2. **Explicit `isPrimary` flag on secondary link records.**
   - *Why:* Big Pickle's `links` table includes `isPrimary: boolean`. While tasks can attach to multiple entities, the UI needs a deterministic, fast rule to decide which category color or badge to render on the task row when viewed in an aggregate list. An explicit boolean flag on the attachment record handles this cleanly.
3. **Pre-computing derived overdue properties on read in M1 before standing up complex background schedulers.**
   - *Why:* Big Pickle suggests deriving `effectivePriority` and `isExpired` dynamically on query reads during early milestones, rather than making Milestone 1 dependent on a Convex cron scheduler. This keeps Milestone 1 lean and immediately testable.

---

## 6. Reject from Big Pickle

1. **Embedding quest steps in a JSON array inside the `quests` table (`steps: { id, title?, done, unlocked }[]`).**
   - *Why:* This directly violates the fundamental user constraint: **"Task is the atom."** Quest steps MUST be tasks. If a quest step is an embedded sub-document, an agent cannot use standard MCP task tools (`complete_task`, `update_task`), the step cannot appear on the daily board or category slice, cannot attach to a scheduled time window, and cannot have its own soft-delete or overdue policy. Quest steps must be rows in `questSteps` referencing `taskId: Id<"tasks">`.
2. **Three-layer temporal indirection: `windows` + `events` + `seasons` as three separate database tables.**
   - *Why:* Big Pickle defines `windows` (`from`, `to`, `granularity`), then `events` which reference `primaryWindowId`, and `seasons` which reference `windowId`. To render a seasonal task, the client must traverse `task -> event -> season -> window`. This relational tax is absurd for a reactive document database. Time bounds (`startsAt`, `endsAt`) belong directly on the event/span record.
3. **Database tables for `overdue_policies` and `presentation_packs`.**
   - *Why:* Big Pickle creates Convex tables for `overdue_policies` (with fields `slug`, `handler`, `params`) and `presentation_packs` (with fields `slug`, `tokens`, `copy`, `layoutHints`). Handlers are TypeScript functions executed in Convex; they cannot be serialized in database rows without an eval-like dispatcher. Presentation packs are client-side UI themes (React/SwiftUI components, CSS tokens). Storing them as database rows adds sync overhead and runtime deserialization for zero benefit. Both belong in code registries with stable string slugs stored on data records.
4. **Setting `deletedAt` for expired/retired tasks.**
   - *Why:* Big Pickle states that when a limited offer expires, "it is soft-deleted from all slices and shown once in an 'Expired' archive" by setting `deletedAt`. `deletedAt` is reserved for user-initiated deletion (trash). Conflating expired opportunities with user trash corrupts queries, breaks undelete/restore semantics, and makes it impossible to distinguish between "I discarded this" and "the burger promotion ended."
5. **Patching `dueAt` in place for `replace` recurrence rollovers.**
   - *Why:* Big Pickle rolls over uncompleted replace tasks by patching the existing row's `dueAt` and `occurrenceKey` to tomorrow. This erases the historical record that Monday's task was never performed, breaks streak analytics, and causes race conditions with offline clients syncing cached task states.

---

## 7. Where you changed your own mind

Comparing the drafts against user constraints revealed four major errors in my original Gemini 3.8 plan ([`gemini-3.8-plan.md`](file:///Users/dmytroafonin/Projects/manager/docs/council/gemini-3.8-plan.md)):

1. **Forcing `spaceId` on every entity in Milestone 1 was a mistake.**
   - *Original position:* Every entity belongs to exactly one `spaceId`; M1 requires auto-provisioning a "Personal" space and migrating all existing tasks.
   - *Correction:* This violates the iterative milestone principle. Current tasks operate cleanly under `ownerId`. Forcing spaces into M1 creates migration friction and complicates the schema before recurrence and deadlines even work. Personal tasks should remain keyed by `ownerId`. Spaces should be introduced later as collaborative sharing boundaries that entities attach to via `space_entities` or space attachments, without breaking existing personal ownership.
2. **Redefining legacy `dueAt` as a hard deadline was wrong.**
   - *Original position:* Rebrand `dueAt` as the hard deadline timestamp, introducing `plannedDate` for civil dates.
   - *Correction:* Grok's argument is unassailable. Current native clients store the start of a civil day in `dueAt`. If `dueAt` is interpreted as a deadline, every existing task inherits deadline escalation, causing massive UI breakage on shipped clients. `dueAt` must remain a backwards-compatible read alias for `plannedOn` (the planned day). Hard deadlines must be stored in a dedicated new field: `deadlineAt`.
3. **Retiring tasks and replacing occurrences must NOT touch `deletedAt`.**
   - *Original position:* Setting `deletedAt` or mutating tasks in place for retirement and rollover.
   - *Correction:* Soft deletion (`deletedAt`) is strictly for trash. Conflating expired items with trash destroys user intent and telemetry. Grok's introduction of an explicit lifecycle field (`outcome: "open" | "done" | "superseded" | "missed"`) is far superior. A retired burger has `outcome: "missed"`. A rollover dish has `outcome: "superseded"`. `deletedAt` is left untouched.
4. **Separate `timeWindows` table was redundant schema bloat.**
   - *Original position:* Created a separate `timeWindows` table alongside `events`.
   - *Correction:* Grok is right: a day, a week, a custom campaign, and a season are all identical temporal primitives (`startsAt` to `endsAt`). Managing a standalone `timeWindows` table duplicates logic. A single unified `events` (or `spans`) table with a `cadence` or `shape` field cleanly serves both rhythm slices (Today, This Week) and thematic runs (Seasons).

---

## 8. Answers to these disputes, each with a position

### a. One span table versus windows + events + seasons
- **Position: One span table (`events` or `spans`).**
- **Reasoning:** A calendar day (rhythm), a 7-day festival (run), and a 90-day winter quarter (season) all share identical structural requirements: `ownerId`, `title`, `startsAt`, `endsAt`, and optional `presentationId`. Creating three distinct tables (`windows`, `events`, `seasons`) as Big Pickle did creates relational bloat, forces multi-table joins in the slice engine, and imposes artificial distinctions (e.g. at what exact day count does an event become a season?). A single table with a `cadence` field (`day`, `week`, `month`, `quarter`, `year`, `custom`) and an optional `catalogRole` (`season`, `limited`, `plain`) satisfies all requirements with zero schema duplication.

### b. Legacy dueAt: planned day alias, or the deadline
- **Position: Planned day alias (`plannedOn`).**
- **Reasoning:** In the current production codebase, native Apple and Android clients write the epoch millisecond start of a civil day into `dueAt`. If legacy `dueAt` is mapped to `deadlineAt`, every existing user chore becomes an escalating deadline that triggers overdue alarms, violating the core ADHD-friendly design. `dueAt` must remain a compatibility read-alias for `plannedOn`. A new, distinct field `deadlineAt` must be introduced for commitments with hard cutoff times.

### c. Replace: patch one row forward, or supersede the old open row and mint a new one
- **Position: Supersede the old open row (`outcome: "superseded"`) and mint a new one (`outcome: "open"`).**
- **Reasoning:** Patching one row forward (advancing its date) destroys historical data: there is no record of whether the task was done or skipped on past days, making streak tracking and progression metrics impossible. Conversely, deleting the old row pollutes trash. Setting `outcome = "superseded"` on the prior open instance and minting a fresh task for the new period (idempotent on `(recurrenceId, periodStart)`) maintains auditability, preserves progression counters, and keeps the active board limited to exactly one open instance.

### d. Retire: set deletedAt, or set an outcome distinct from trash
- **Position: Set an outcome distinct from trash (`outcome: "missed"`).**
- **Reasoning:** `deletedAt` is reserved exclusively for user-initiated soft delete (trash/restore). An expired limited-time offer (e.g., McDonald's seasonal burger) was not thrown in the trash by the user; its window of opportunity lapsed. Marking it with `outcome = "missed"` allows it to disappear cleanly from active slices while remaining queryable in historical logs, retrospective summaries, or missed opportunity achievements. Conflating retirement with trash breaks the restore workflow.

### e. Must every entity belong to exactly one space in milestone 1
- **Position: No.**
- **Reasoning:** Forcing every entity into a space in Milestone 1 requires building workspace tenancy, membership validation, personal space auto-provisioning, and migration scripts before basic task metadata, soft deletion, and recurrence are even functional. Milestone 1 should keep personal tasks tied directly to `ownerId`. Spaces should be introduced in a later milestone as collaborative containers that entities can attach to.

### f. Quest steps embedded in the quest document, or step rows pointing at tasks
- **Position: Step rows in `questSteps` pointing at tasks (`taskId: Id<"tasks">`).**
- **Reasoning:** **"Task is the atom."** If quest steps are embedded JSON objects inside a quest document (as Big Pickle proposed), they cannot be manipulated by standard task MCP tools, cannot appear in daily category slices, cannot be assigned planned times or locations, and cannot carry independent completion timestamps. Having a normalized `questSteps` table pointing to real `tasks` ensures all platform tooling (MCP, notifications, completions, boards) works seamlessly with quest actions.

### g. Priority as a closed number, or a string plus optional rank
- **Position: String plus optional numeric rank (`priority: string`, `priorityRank?: number`).**
- **Reasoning:** A closed numeric enum (e.g., 0..3) is too rigid for user-defined scales and presentation packs that use custom priority tiers (e.g. gacha tiers like "SSR", "SR", "R"). However, pure strings (Grok's approach) make automated escalation impossible for custom values and prevent efficient database index sorting. Adopting a string label paired with an optional numeric sort rank (`priority: "high"`, `priorityRank: 20`) provides human/agent readability, extensible theming, deterministic escalation (`rank += 10`), and fast index-based database ordering.

---

## 9. Five bullets the orchestrator should keep no matter whose draft they came from

1. **Decouple the four temporal facts on tasks:** Keep `plannedOn` (civil date), `plannedTime` (clock time), `deadlineAt` (hard cutoff), and `remindAt` (notification trigger) as distinct fields; treat legacy `dueAt` strictly as a compatibility read alias for `plannedOn`.
2. **Model recurrence as two distinct state machines via `behavior`:** Require `replace` (at most one open task; prior uncompleted period becomes `outcome: "superseded"`) vs `stack` (each period mints a persistent independent task; missed days remain open for backfill) on `recurrences`.
3. **Reserve `deletedAt` strictly for trash:** Model lifecycle transitions using an explicit `outcome` field (`open`, `done`, `superseded`, `missed`); retirements set `outcome: "missed"`, never `deletedAt`.
4. **Enforce "Task is the atom" across Quests:** Quest steps must be discrete records pointing to real `tasks` rows (`questSteps.taskId -> tasks._id`), enabling full MCP tool parity, slice inclusion, and native scheduling.
5. **Collapse temporal spans into a single table with code-based registries:** Consolidate rhythms, runs, and seasons into a single `events` table with `startsAt` and `endsAt`, and store presentation packs and overdue policies in code registries with string slugs, completely rejecting multi-table span and policy schema bloat.
