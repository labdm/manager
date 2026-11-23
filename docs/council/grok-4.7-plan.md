# Manager plan — Grok 4.7 council draft

Status: one voice in the council. Not the agreed plan.

This draft assumes today's foundation and does not treat unshipped mechanics as already built. Domain logic stays in Convex. MCP stays a thin authenticated caller. Web and desktop share `packages/ui`. Apple and Android stay native clients of the same functions.

## 1. Introduction

Manager is the life board an agent can write into, and the board has to feel like a game you want to open. The job is not to store more checkboxes. The job is to show the right slice of a life, make the next action obvious, and refuse to punish a missed day with a pile of identical chores.

The loop stays the one already chosen. An agent reads context (mail, chat, a harness skill), talks with you, and writes Manager. Manager is the system of record. Later it fans the same records out to push, calendar, reminders, and alarms. The apps are how you look at the board and how you tap something done when the agent is not in the room. Manual entry remains real, because a broken-window morning should not wait on a prompt.

A task is the only thing you can finish. Everything else — a day, a week, a season, a category, a quest, a page count, a shared kitchen — is structure around tasks, or a view of them. Structure is flexible on purpose. The core stores facts and links. It does not encode one screen layout, one season length, or a rule that a daily must behave like dishes. Those choices are data on the record, or guidance in the UI.

The recurrence rule that replaces the old "dailies never stack" line is this: every repeating series declares its behavior, and the two behaviors are different machines.

- **Replace.** Wash the dishes. The open board holds one current occurrence. If you miss Monday and wash them on Tuesday, Monday is not still sitting there. You cannot wash yesterday's dishes. The missed occurrence leaves the open board. It is not hard-deleted. It is superseded, so history and a progression can still see it.
- **Stack.** Write the journal. Monday, Tuesday, and Wednesday are three entries. Skipping a day leaves that entry open, because the words for that day still need a place to go.

Replace is about what is actionable now. It is not amnesia. A 30-day exercise track can replace the daily card and still remember how many days you have done, because that memory is a progression, not a second copy of the chore. This split is the whole reason the product exists next to Apple Reminders.

Deadlines are a third idea, not a fancy due date. The day you plan to do something, the clock time if it has one, and the instant it becomes too late are different fields. Taxes have a deadline and should get louder after it. A one-day menu item has an end and should leave when the end passes. The core stores the policy on the record. The screen is allowed to call the first "overdue" and the second "limited" or "ended". Gacha language stays inside presentation packs. The product language stays life-sized.

Quests cover the other failure of task lists: you often do not know step two. Call the landlord about the broken window. When that call ends, the next task might be a transfer, a hardware store, or a repair visit. A quest can also be a path you already know, such as "move house". The core does not require the future to be blank, and it does not require it to be filled in.

Sharing is a space you put things into, not a link pasted onto one task and forgotten. A household space can hold the Household category, the weekly chores, and a quest. Detaching is not deleting.

The screen that makes this feel like a game is a slice, not a new database. One axis picks a part of life (a category, the quest shelf, maybe a season). The other picks a span of time (today, this week, a short run, a season). The cells of that grid are tasks, progression bars, and quests. Cards and rows are two ways to draw the same record. A Winter pack can reskin that cell without a migration. Achievements, a paid inference path, and a direct mailbox are later layers on the same records. Until then, harness prompts and skills are how Grok Bot, Codex, Claude, Antigravity, and the rest learn the dishes-versus-journal rule.

## 2. Domain model

### Terms

The word "event" is doing four jobs in conversation. The core keeps one time-span record and qualifies it with data.

| Talk | Core term | What it is |
|---|---|---|
| a date, a week, a month, a quarter, a year | **event**, shape `rhythm` | A generated span with `startsAt` and `endsAt`. |
| a named happening, a trip, a market weekend | **event**, shape `run` | The same record, with a name and an optional presentation pack. |
| a season | **event**, catalog role `season` | A run the catalog suggests is long and thematic. Length is not checked. |
| a limited event | **event or task with an end and an overdue policy** | Internal flag. Default UI copy is "limited" on the task, or the pack's own word. Not a table. |

Do not add `seasons` as a table beside `events`. A season that cannot also be used as a horizontal tab has already failed the flexibility test.

**Task.** The atomic unit. You create it, edit it, mark it done, or soft-delete it.

**Recurrence.** The rule that mints task occurrences. It owns `behavior: replace | stack`. Occurrences are ordinary tasks.

**Progression.** A known-size track. Either a count of steps or a meter (pages read). It is not a task. Completing tasks, or logging a number, fills it.

**Quest.** A journey of tasks. Steps may exist in advance (locked until the previous one is done) or be appended when the current step completes. A quest with no locked future step stays open and waiting. That waiting state is the emergent case.

**Category.** A life area used as a slice axis. Household, health, work. User-defined values are normal.

**Space.** A sharing boundary with members and roles. Entities are attached and detached. Personal tasks keep today's `ownerId` and do not need a space.

**Attachment.** The link between a subject (task, progression, quest, event, category) and a target (category, event, quest, progression, space). Many are allowed. `primary` is a hint the UI uses to pick a home tab. The core accepts several primaries and several targets.

**Placement hint.** `card` or `row` (and `bar` for a progression). Stored so an agent can suggest a drawing. Any client may ignore it.

**Presentation pack.** An id plus tokens (copy, colors, icon) and, optionally, a client component registered under that id. Unknown ids render with the default shell.

### Task fields

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Short label. |
| `notes` | no | Longer text. |
| `done` | yes | Explicit boolean, same as today, so a retried tap cannot invert. |
| `completedAt` | no | Set when `done` becomes true. |
| `deletedAt` | no | Soft delete. Absent on live rows. |
| `ownerId` | yes | Creator's user row. Stays the personal ACL until a space is involved. |
| `plannedOn` | no | Civil date the person intends to act. Usually no clock time. |
| `plannedTime` | no | Clock time on that date, only when the task has one. |
| `location` | no | Free text for now. |
| `deadlineAt` | no | Instant after which the overdue policy runs. Not a synonym of `plannedOn`. |
| `priority` | no | String. Seeds: `later`, `normal`, `soon`, `now`. Other strings are valid. |
| `overduePolicy` | no | `none`, `retire`, or `escalate`. |
| `outcome` | no | `open`, `done`, `superseded`, `missed`. `done` mirrors the boolean for queries. |
| `recurrenceId` | no | Set on minted occurrences. |
| `presentationHint` | no | `card` or `row`. Guidance. |

`dueAt` remains one release as a read compatibility alias of `plannedOn` (start of that civil day, which is what Android already stores). It is not migrated into `deadlineAt`. Turning every dated chore into a deadline would make the taxes mechanic meaningless.

### Recurrence

| Field | Meaning |
|---|---|
| `behavior` | `replace` or `stack`. Required at creation. No silent default in MCP. |
| `cadence` | String. Seeds: `daily`, `weekly`, `monthly`, plus a small structured custom rule later. |
| `timezone` | IANA name used to cut periods. |
| `title` | Copied onto each occurrence; the occurrence may be edited after. |
| `overduePolicy`, `priority`, `location` | Templates copied onto new occurrences. |

**Replace machine.** At most one occurrence of that series has `outcome: open`. When a new period begins, the previous open occurrence becomes `superseded` and drops off the open board. Completing the open card completes the current period. The next period mints a fresh open card. Doing the dishes "the next day" checks off the only open card. It does not also complete a stale one, because the stale one is already superseded.

**Stack machine.** Each period mints its own occurrence and leaves older open ones open. The journal for Monday is still there on Wednesday.

Minting is lazy and idempotent: opening a board, or a scheduled pass, creates the missing occurrence for the current period (and, for stack, for elapsed periods still inside a retention horizon). An agent must not hand-mint a second open replace occurrence. If it creates a task and links it as the current occurrence, the previous open one is superseded in the same mutation.

Superseding and retiring are not deletes. `deletedAt` is only for "this should be gone". A superseded dish is history. A user-deleted dish is hidden from default history too, and recoverable until a later purge job that this plan does not schedule.

### Progression

| Field | Meaning |
|---|---|
| `mode` | `steps` or `meter`. Other modes may be stored; unknown modes render as a meter. |
| `target` | Positive number known up front. |
| `unit` | `day`, `page`, `chapter`, or any string. |
| `current` | For `meter`, the logged value. For `steps`, derived from completed linked tasks. |

A replace recurrence can feed a step progression: the open card is single, and each completion increments the track. A meter progression can also move by `log_progress` without a task per page. Both are progressions so the UI can draw one bar.

### Quest

| Field | Meaning |
|---|---|
| `status` | `active`, `completed`, `archived`. |
| `scripting` | `emergent` or `scripted`. Guidance for the UI and the agent. The core allows a scripted quest to gain an extra step, and an emergent quest to be preloaded. |

Steps are tasks plus a position and a gate: `available` or `locked`. Completing the available task unlocks the next locked step in the same mutation. If there is no next step, the quest stays `active` and **waiting**. Waiting is the signal for a person or an agent to append the continuation. Completing the quest is explicit, so an emergent quest does not auto-close after step one.

### Event

| Field | Meaning |
|---|---|
| `title` | Optional for rhythms ("Today"), required for runs. |
| `shape` | `rhythm` or `run`. |
| `cadence` | `day`, `week`, `month`, `quarter`, `year`, `custom`, or empty. |
| `startsAt`, `endsAt` | Bounds. A task planned on a date attaches to the day event that contains that date, and can also attach to a week, a season, or a quest. |
| `catalogRole` | Optional hint: `season`, `limited`, `plain`. Not validated against length. |
| `presentationId` | Optional pack id. |

Rhythms are materialized for a rolling horizon (previous period, current, next) per user timezone, not as an infinite pre-insert.

### Attachment and the slice

An attachment row: `subjectType`, `subjectId`, `targetType`, `targetId`, `role` (`primary` or `extra`).

The open slice for a selection is:

- tasks that are not soft-deleted and not `superseded` or `missed`,
- whose attachments include the selected vertical target and the selected horizontal target,
- plus progressions and quests attached to that same intersection.

A task with only one attachment still appears when that axis is selected and the other axis is "All". "All" is a query mode, not a stored event.

**UI guidance, not core bans**

- Prefer one `primary` attachment per axis.
- Prefer seasons longer than a month.
- Prefer the Quests tab as its own vertical entry.
- Prefer card for runs and row for a long daily list.
- A client may warn on a second primary. The mutation still succeeds.

**Core invariants**

- Soft delete only, on every user-facing table (`deletedAt`).
- `behavior` is present on every recurrence and is either `replace` or `stack`.
- `plannedOn` and `deadlineAt` are different fields; neither is inferred from the other.
- Overdue policy runs once per record: `retire` sets `outcome: missed`; `escalate` raises priority one seed-step and leaves it open; `none` leaves it open.
- Completing a quest step unlocks at most the following locked step. It does not invent a step.
- Space visibility is one hop: members see entities attached to the space, and tasks attached to a category or event that is itself attached to the space. No further hop, so a season does not accidentally publish a whole life.

### Priority and overdue

Seed order, low to high: `later`, `normal`, `soon`, `now`. Escalate moves one step, and `now` stays `now`. Custom priorities that are not in the seed list do not auto-bump; the policy still marks them overdue in the UI. Retire never deletes. The row remains with `outcome: missed` so an achievement or a history view can see the miss.

## 3. Prebuilt catalog

All of the following is seed data. The schema stores strings. Creating a category named "Boat" or a cadence named "market-week" does not require a migration. Packs reference these ids; they do not own the tables.

### Categories

| Id | Name | Default hint | Notes |
|---|---|---|---|
| `household` | Household | row | Chores, home, shared life. |
| `health` | Health | row | Meds, appointments, body admin. |
| `body` | Body | card | Training, sleep, food. Split from health so a progression has a home. |
| `relationships` | Relationships | card | People, check-ins, dates. |
| `work` | Work | row | Job obligations. |
| `projects` | Projects | card | Finite personal builds. |
| `money` | Money | row | Bills, taxes, transfers. |
| `admin` | Admin | row | Paperwork that is not money. |
| `learning` | Learning | card | Books, courses, practice. |
| `social` | Social | card | Friends, outings. |
| `creative` | Creative | card | Making things. |

The user can hide any seed and add any name. "Project" in the request is `projects`.

### Built-in events

| Id pattern | Shape | Cadence | How it appears |
|---|---|---|---|
| day | rhythm | `day` | Horizontal tab "Today". |
| week | rhythm | `week` | Horizontal tab "This week". |
| month | rhythm | `month` | Off by default on phones; available. |
| quarter | rhythm | `quarter` | Off by default. |
| year | rhythm | `year` | Off by default. |
| custom | run | `custom` | User or agent names the bounds. |

### Example seasons (runs, catalog role `season`)

Enable, don't force. Each can be deleted without touching the core.

| Name | Suggested window | Example tasks |
|---|---|---|
| Winter | 1 Dec – 28 Feb, local | Walk on a snowy night. Visit a Christmas market with friends. |
| Tax season | 1 Feb – filing deadline | Gather documents. File. Pay. |
| Moving | user bounds | Measure. Boxes. Address changes. |
| Trip | user bounds | Book, pack, go, unpack. |

### Example limited runs (catalog role `limited`, overdue `retire` unless said otherwise)

| Name | Why it ends |
|---|---|
| Christmas market | The market closes. |
| One-day menu | The offer is gone. Retire. |
| Concert week | The show is over. |
| Filing deadline | This one is the exception seed: policy `escalate`, not retire. |

### Behaviors (templates an agent should recognize)

| Template | Behavior | Deadline | Overdue | Drawing |
|---|---|---|---|---|
| Chore | replace | none | none | row |
| Log | stack | none | none | row |
| Practice | replace, plus a step progression | none | none | bar + one row |
| Appointment | none | planned time, no deadline | none | card |
| Commitment | none or replace | `deadlineAt` | escalate | card |
| Offer | none | event end | retire | card |
| Quest step | none | optional | whatever the step needs | card inside the quest |
| Reading | meter progression | optional | none | bar |

### Priority

`later`, `normal`, `soon`, `now`. Default when omitted: `normal`.

### Starter quests

| Name | Scripting | Steps |
|---|---|---|
| Broken window | emergent | 1. Call the landlord. Then wait. |
| See a friend | scripted | 1. Propose a time. 2. Confirm place. 3. Go. Later steps start locked. |
| Move house | scripted | A dozen known steps, still editable. |

### Starter progressions

| Name | Mode | Target |
|---|---|---|
| Train this month | steps | 12 sessions |
| Read one book | meter | the page count, unit `page` |
| Journal week | steps | 7, fed by a **stack** log so each day remains |

## 4. UI shell

The shell reads a layout document, which is user data:

```json
{
  "vertical": ["category", "quests"],
  "horizontal": ["rhythm:day", "rhythm:week", "active-runs"],
  "seasonAxis": "horizontal"
}
```

Changing the document does not change attachments. That is the flexibility requirement.

### Default layout

Vertical tabs: the categories the user has not hidden, then a pinned **Quests** tab. Horizontal tabs: **Today**, **This week**, then one tab per active run or season. Seasons sit on the horizontal axis by default so Winter does not replace Household.

Selecting Household × Today shows household tasks attached to today's event, as rows unless the task or the category hint says card. Progressions attached to Household and overlapping today render as bars above the list. Each bar is itself a card or a row according to its hint. The Quests tab ignores the category filter and lists quest cards; the horizontal tab still filters steps by time when a step has a planned date, and shows waiting quests regardless of date so an emergent quest cannot vanish.

A task attached to Household and Work appears in both vertical tabs. The UI may show "also in Work" and may suggest clearing the extra. Saving the extra is allowed.

### Alternate A — season forward

Vertical: Everyday, then each active season. Horizontal: categories. Use this when a season should own the session, for example December. Same attachments. The layout document swaps the axes.

### Alternate B — one thumb

Vertical: Today, This week, Waiting quests, Later. Horizontal: category chips, including All. An active season is a banner on top of the slice, not a tab. This is the phone default if a layout experiment says so. It is still the same query.

### Presentation packs

Convex stores `presentationId` and a token bag: accent, icon name, and copy overrides (`limitedLabel`, `emptySlice`, `completeVerb`). Clients ship a registry. The Winter pack can replace the empty state, the tab ornament, and the card frame. If the component is missing, tokens still recolor the default card. No pack id is special-cased in `taskService`. Adding a pack is a client module plus seed data, not a schema change.

Card versus row is chosen at render time: hint on the record, else hint on the category, else row when the slice has more than a handful of tasks, else card. The core does not care.

## 5. User flows

### Wash the dishes (replace)

1. You say "dishes every day". The agent creates a recurrence with `behavior: replace` and `cadence: daily`, attached to Household and to the day rhythm.
2. Today you see one row, "Wash dishes".
3. You do not do it. Tomorrow the same row is there once. Monday's occurrence is superseded and is not on the board.
4. You check it off. The row completes. The next morning a new open row is there.

### Journal (stack)

1. You create "Journal", `behavior: stack`, `cadence: daily`, attached to Creative.
2. You skip two days. The Creative × Today slice shows three open rows: those two days and today. Each can be written on its own day.
3. Writing Monday does not close Tuesday.

### Taxes (escalate)

1. An agent sees a mail: file by 15 April. It creates a task "File taxes", `deadlineAt` at the end of that civil day, `overduePolicy: escalate`, `priority: soon`, attached to Money and to a run titled "Tax season".
2. Before the date, the task sits in Money and in the Tax season tab. It does not spawn a daily clone.
3. The morning after the deadline it is still there, priority `now`, with an overdue mark. Nothing was deleted.

### The burger (retire)

1. An agent, or you, creates "Try the limited burger" attached to a one-day run, `overduePolicy: retire`, `deadlineAt` at closing.
2. You don't go. After closing the task leaves the open board with outcome `missed`.
3. It is not in Trash. Trash is `deletedAt`. A history line can still say you missed it.

### Broken window (emergent quest)

1. You create a quest "Broken window" with one available step, "Call the landlord", and no locked steps.
2. The quest appears on the Quests tab as a card. The step is also a task.
3. You complete the call. The quest stays active and shows waiting: "What happened?"
4. You tell the agent the landlord said to buy a pane. The agent appends "Buy glass at the mall", available immediately. The quest card now shows that step.
5. A known path works the same with the later steps created up front and locked.

### Read a book (meter) and train (steps)

1. "The book is 320 pages" creates a meter progression, target 320, unit page, attached to Learning, drawn as a bar.
2. Each sitting you log 20 pages, or the agent logs them from what you said. The bar fills. No 320 tasks are created.
3. "Train 12 times" creates a step progression and a replace recurrence "Train" attached to Body. Each completion fills one segment. The open board still shows a single Train row.

### Share the household

1. You create a space "Home" and invite one person as editor.
2. You attach the Household category and the dishes recurrence. They see the category's tasks and the current dish occurrence, one hop, not your Money tab.
3. Detaching Household hides those tasks from them. The tasks are not deleted. Their own private tasks stay on their `ownerId`.

### Agent, from mail to the board

1. The harness skill tells the agent: choose replace or stack out loud; never copy a planned day into a deadline; pick retire only when the opportunity literally expires.
2. The agent calls MCP to create the tax task, the Tax season run if missing, and the attachments.
3. Your phone's open slice updates from the Convex subscription. You did not import a calendar.

## 6. Technical plan

### Milestone 1 schema (no events, no seasons)

Additive changes on `tasks`:

- `deletedAt: v.optional(v.number())`
- `completedAt: v.optional(v.number())`
- `notes: v.optional(v.string())`
- `plannedOn: v.optional(v.number())` — UTC millis at the start of the civil day the client already uses
- `plannedTime: v.optional(v.number())` — minutes from midnight, integer
- `location: v.optional(v.string())`
- `deadlineAt: v.optional(v.number())`
- `priority: v.optional(v.string())`
- `overduePolicy: v.optional(v.union(v.literal("none"), v.literal("retire"), v.literal("escalate")))`
- `outcome: v.optional(v.string())` — keep optional so old rows still validate

Keep `dueAt` and `done`. Index: `by_owner` stays. Add `by_owner_deleted` on `["ownerId", "deletedAt"]` is unnecessary if `deletedAt` is absent rather than null; Convex indexes optional fields awkwardly. Practical rule: query `by_owner`, filter `deletedAt === undefined` in the service. Volume per user is life-sized. Revisit a partial index only if a profile says so.

`deleteTask` sets `deletedAt` and never calls `db.delete`. Lists used by clients filter it out. A `listDeleted` query can wait.

Overwrite of `dueAt`: on create, if the caller sends only `dueAt`, write it through to `plannedOn` as well. If the caller sends `deadlineAt`, do not touch `plannedOn`. Old clients keep working.

Overdue evaluation is a Convex scheduled function per task that has `deadlineAt` and a non-`none` policy, plus a sweep cron for rows whose schedule was missed. Retire and escalate are mutations in `taskService`, shared by the UI and MCP.

### Later tables (not milestone 1)

- `recurrences` — ownerId, title, behavior, cadence, timezone, template fields, deletedAt. Index `by_owner`.
- `events` — ownerId, title, shape, cadence, startsAt, endsAt, catalogRole, presentationId, tokenJson, deletedAt. Index `by_owner`.
- `categories` — ownerId, name, slug, presentationId, hidden, deletedAt.
- `progressions` — ownerId, title, mode, target, unit, current, presentationHint, deletedAt.
- `quests` — ownerId, title, status, scripting, deletedAt.
- `questSteps` — questId, taskId, position, gate.
- `attachments` — subjectType, subjectId, targetType, targetId, role. Indexes `by_subject`, `by_target`.
- `spaces`, `spaceMembers` — spaceId, userId, role.
- `layouts` — ownerId, document.

Occurrences are tasks with `recurrenceId`. Do not make a second occurrence table.

### Soft-delete rule

Every list and slice in `taskService` drops rows with `deletedAt`. Get-by-id for a deleted row returns not-found to clients that are not asking for history. MCP `delete_*` is soft for tasks now and for every later entity. There is no hard-delete tool.

### MCP, grown per milestone

| Tool | When | Purpose |
|---|---|---|
| `create_task` `update_task` `list_tasks` `complete_task` `reopen_task` `delete_task` | M1 | Same names. `delete_task` soft-deletes. New optional fields. `list_tasks` hides deleted and, later, superseded. |
| `create_recurrence` `list_recurrences` | M2 | `behavior` is a required argument. Tool text states the dishes and journal examples. |
| `create_category` `create_event` `attach` `detach` `get_slice` | M3 | `get_slice` takes vertical and horizontal target ids. |
| `create_progression` `log_progress` | M4 | Meter or steps. |
| `create_quest` `add_quest_step` `complete_task` | M5 | Complete already unlocks the next step inside the service, so MCP does not do it client-side. |
| `create_space` `invite_space` `attach` | M7 | Same attach tool; target type `space`. |

`whoami` stays. Tools call Convex mutations. No domain branches in `apps/mcp`.

### Clients

`packages/ui` renders the shell for web and desktop. Apple and Android render the same slice from the same queries. Milestone 1 only extends the existing row with priority, a planned date, and a deadline. The tab shell waits until events exist, so native clients are not asked to invent a layout twice. Presentation registries live in each client; the token bag is shared JSON from Convex so a pack can theme native UI before a custom view exists.

### Migration

Existing tasks: leave `dueAt` and `done`, leave `deletedAt` unset, leave policy unset. No backfill into `deadlineAt`. Document in the client that the old date field is the planned day. Ship `update_task` so an agent can split a mistaken deadline later.

### Presentation seam

`presentationId` is an opaque string. The service stores and returns it. A pack is valid if the client has it or if the client falls back. Experimenting with a prebuilt UI means a new registry entry and seed rows, not a new task type.

## 7. Milestones

### M1 — Task facts and soft delete

Outcome: a task can carry a planned day, an optional time, a place, a priority, and a real deadline with a retire-or-escalate policy, and delete no longer destroys the row.

In: schema fields above, service rules, MCP argument parity, the current list UI showing the new facts, tests for soft delete and for "dueAt does not become a deadline".

Out: recurrence, tabs, quests, spaces, packs.

Why next: every later mechanic hangs off the task row, and the current hard delete contradicts the primitive.

### M2 — Replace and stack

Outcome: dishes do not pile up; journal days do.

In: `recurrences`, lazy idempotent minting, superseded outcome, two templates in the UI, MCP requires `behavior`, tests that a missed replace period leaves one open task and a missed stack period leaves two.

Out: the pretty two-axis shell. A flat list with a cadence label is enough.

Why next: this is the behavior the product is for. A beautiful board that stacks dishes is the wrong product.

### M3 — Categories, day, week, and the default shell

Outcome: Household × Today is a real slice. Tasks can attach to more than one place. Card and row both render.

In: categories, day and week rhythms, attachments, layout document, default vertical categories plus horizontal Today / This week, `get_slice`.

Out: month and custom runs, quests, progressions beyond a static empty state.

Why next: the shell is the first game-like screen, and it only needs the axes you actually switch every day.

### M4 — Progressions

Outcome: a 12-session track and a 320-page book both draw as bars, as a card or a row, inside the slice they are attached to.

In: progression table, `log_progress`, step increments from completions, bar component in the three UI stacks.

Out: quests.

Why next: the bar is the reward loop for repeated effort, and it reuses attachments.

### M5 — Quests

Outcome: a waiting quest after "call the landlord", and a locked known sequence, on a Quests vertical tab.

In: quests, steps, unlock-on-complete, waiting state, agent-oriented MCP to append a step.

Out: sharing.

Why next: emergent continuation is the other mechanic task apps lack, and it needs tasks to be completable first.

### M6 — Longer events, seasons, one custom pack

Outcome: month, quarter, year, and custom runs exist. Winter can be installed as a season on the horizontal axis with its own tokens and one custom card frame. Filing deadline and the burger use the policies from M1.

In: remaining cadences, catalog seeds, presentation registry, one Winter pack.

Out: a pack store, achievements.

Why next: the core is already flexible; this milestone proves a prebuilt UI does not fork it.

### M7 — Spaces

Outcome: two people share Household without sharing Money.

In: spaces, roles, invite, attach and detach, one-hop visibility, tests that a two-hop path does not leak.

Out: a social feed.

Why next: ACL should land after the entity graph has stopped moving.

### M8 — Catalog install and harness skills

Outcome: a new account can enable the seed categories and the starter templates. A skill file for each target harness states replace versus stack, deadline versus planned day, and retire versus escalate, with the worked examples.

In: seed installer, prompt/skill docs aimed at Grok Bot, Codex, Claude, and Antigravity.

Out: running inference on our side, reading mail on our side.

Why next: agents are the primary writers. The skill is what makes M2 actually happen in the wild.

### Horizon

- Achievements keyed off completions, progressions, quests, and catalog roles. A category or a season can open an achievement layer. Still just queries over existing rows.
- Social play beyond a shared space: a board of unlocked achievements, reactions. Not a second task model.
- Paid inference and a mailbox connected to Manager, so prompts stay under our control. The MCP and the skill pack stay for people who bring their own harness.
- Native fan-out: push, calendar, reminders, alarms, driven by `plannedTime` and `deadlineAt`, not by a new entity.

## 8. Risks and arguments for the council

1. **Naming.** I kept `events` as the only span record and refused a `seasons` table. If the product voice must say "event" in the UI for rhythms, the Today tab starts sounding like a party. The council should either accept internal `event` plus UI copy "Today / This week / Season", or rename the table `spans` and let packs say "event". I will drop the table name more easily than I will accept two span tables.

2. **`dueAt` alias.** I map the legacy field to `plannedOn`, never to `deadlineAt`. A reviewer who thinks current users expect a due date to nag them will disagree. I think nagging should be opt-in via `deadlineAt`, or every chore becomes taxes.

3. **Superseded versus soft delete.** Replace must not set `deletedAt`. If another plan equates "not on the board" with delete, history, progressions, and "you missed the burger" collapse into one bit.

4. **One-hop sharing.** Convenient and leaky if implemented as "share everything reachable". I cap visibility at one hop. Argue if Household's quests should ride along for free; I say attach the quest itself.

5. **Lazy minting races.** Two clients can open a board at midnight. The mint mutation has to be idempotent on `(recurrenceId, periodStart)`. I do not want a cron as the only minter, because an offline morning should still show today's dishes after one sync.

6. **Required `behavior` will annoy agent authors.** A default of replace is safer for ADHD and wrong for journals. I want the tool call to fail without the argument. The skill text carries the two examples. Argue if a default plus a loud warning is kinder.

7. **Three native shells.** M3 will hurt on Apple and Android if it ships the same week as web. I would rather ship the shell in `packages/ui` first and follow with native in the same milestone before calling it done, than design a web-only board. The council may prefer web-first.

8. **Priority as a string.** Flexible, and escalate-by-one-step is fuzzy for custom values. I only auto-bump the four seeds. Argue if priority should be a number.

9. **Do not build mail ingest or hosted inference into M1–M8.** The user was explicit that those follow the primitives and the harness skills.
