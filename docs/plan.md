# Manager plan

Agreed by the council on 23 Nov 2026: Grok 4.7, Gemini 3.8 Flash, and Big Pickle. Drafts and reviews live in [docs/council](council/). This file is the plan to build. It is not shipped.

Foundation it must fit: Convex domain logic in `packages/backend`, thin MCP, static `packages/ui` for web and desktop, native Apple and Android on the same functions, Clerk, per-user `ownerId`. Today's `tasks` row is `title`, `done`, optional `dueAt` (clients store the start of a civil day), `ownerId`, and a hard delete.

## Decisions

These were argued. This is the call.

| Question | Call | Who disagreed, and why we overruled them |
|---|---|---|
| How many time-span tables? | One table, `events`, with `startsAt`, `endsAt`, string `kind`, optional `catalogRole`. | Pickle wanted `windows` + `events` + `seasons`, then agreed on one table but named `spans`. Gemini wanted `timeWindows` plus `events`, then agreed on one. The name stays `events` so MCP matches the word we already use. Rhythm tabs are labeled "Today" and "This week", not "Event". |
| What is legacy `dueAt`? | Alias of the planned day (`plannedOn`). Never a deadline. | Gemini's draft redefined it as the deadline. Both reviews rejected that. Shipped clients already store start-of-day there. A service test must prove a `dueAt`-only create leaves `deadlineAt` unset. |
| Replace | Supersede the open row (`outcome: "superseded"`) and mint the next period. Idempotent on `(recurrenceId, periodStart)`. | Pickle wants to patch one row forward so skipped days leave no trail. The open board is identical either way. Discrete rows are what a 12-day progression and a later achievement can count, and they survive offline sync. The shame is an open pile, so default queries hide `superseded`. If a history view becomes the default, we failed. |
| Retire | `outcome: "missed"`. | Both original drafts set `deletedAt`. All three reviews rejected that. Trash is only `deletedAt`. |
| Completion bit | `done` stays the boolean. `outcome` is only `superseded` or `missed`. | Grok and Gemini also put `open` and `done` on `outcome`. Two completion fields will drift. Absent `outcome` means a normal open or completed task. |
| Spaces in milestone 1 | No. `ownerId` remains. Spaces attach later, many-to-many. | Gemini required one `spaceId` on every row. Both reviews rejected it. |
| Quest steps | Rows in `questSteps` pointing at tasks. | Pickle embedded steps, then rejected his own idea. |
| Priority | String plus `priorityRank`. Seeds `low` 0, `normal` 10, `high` 20, `urgent` 30. | Gemini's closed 0–3 scale lost. Grok's string-only scale lost the bump. Escalate adds 10, capped at 30, and only for a seed rank. Other strings stay put and still show overdue. |
| Packs and overdue handlers | Code registries. Data stores a string id. | Pickle's database tables for packs and policies lost. A handler is not a row. |
| Delete tool name | `delete_task` stays, and it soft-deletes. | Gemini's `soft_delete_task` rename lost. |

Core invariants:

- User-facing delete only sets `deletedAt`. No `ctx.db.delete()` on these tables.
- Every recurrence has `behavior` `replace` or `stack`. MCP rejects a missing behavior. No silent default.
- `plannedOn`, `plannedTime`, `deadlineAt`, and `remindAt` are not inferred from each other.
- Completing a quest step unlocks the next locked step in the same mutation. It does not invent a step.
- A task may attach to many targets. `primary` is a hint. The mutation does not reject a second one.
- Season length is not checked. Known quests and emergent quests are the same tables.
- Space visibility is one hop: members see entities attached to the space, and tasks attached to a category or event that is attached to the space. Not two hops.

UI guidance, not bans: prefer one primary attachment, prefer seasons longer than a month, prefer a row when a slice is long and a card when it is short, prefer one pin per view. The core accepts more.

The left rail in the Home sketch is a **view**, not a shared space. A shared space is still the people-and-attachments object from the council. A view is a named slice on the rail. Home is a built-in view. Household is a view you install. "New" and "High priority" are computed views. Using one word for all three makes an agent attach a task to the wrong record.

## Domain

**Task.** The atom. Create, edit, mark done, soft-delete.

| Field | Meaning |
|---|---|
| `title`, `notes?` | Label and longer text. |
| `done`, `completedAt?` | Explicit boolean, so a retried tap cannot invert. |
| `deletedAt?` | Trash. |
| `outcome?` | `superseded` or `missed` only. |
| `ownerId` | Personal ACL until a space is involved. |
| `plannedOn?` | Civil day, epoch ms at local start of that day. Usually no clock. |
| `plannedTime?` | Minutes from midnight, 0–1439, only when there is a clock time. |
| `dueAt?` | Legacy read/write alias of `plannedOn` for one release. |
| `deadlineAt?` | Instant the overdue policy runs. |
| `remindAt?` | When to notify. Stored in M1. Fan-out waits. |
| `location?` | Free text. |
| `priority?`, `priorityRank?` | Seed string and numeric order. |
| `overduePolicy?` | `none` (default), `retire`, `escalate`. |
| `recurrenceId?`, `periodStart?` | Set on minted occurrences. |
| `presentationHint?` | `card` or `row`. A client may ignore it. |
| `seenAt?` | When the viewer opened the row. Absent, and created by an agent or another person, means NEW. Your own create sets `seenAt` immediately. |

Open board: `deletedAt` unset, `outcome` unset, `done` false. Done tab: `done` true and not trashed. Missed and superseded stay queryable and off the open board.

**Recurrence.** `behavior`, `cadence` (string; seeds `daily`, `weekly`, `monthly`, custom later), `timezone`, template fields copied onto new occurrences.

Replace: at most one open occurrence. On a new period, the previous open row becomes `superseded` and a new open task is inserted for `periodStart`. Doing the dishes "tomorrow" checks off the only open card. Stack: each period inserts its own open task and leaves older ones open. Minting is lazy on read and idempotent. A cron reconciles so a closed app can still be told. Stack backfill has no core cap. A pack may collapse old rows.

**Event.** `title?`, `kind` (`day`, `week`, `month`, `quarter`, `year`, `custom`, or any other string), `startsAt`, `endsAt`, `catalogRole?` (`season`, `limited`, `plain`), `presentationId?`, `icon?`, `color?`, `deletedAt?`. Rhythms are materialized for the previous, current, and next period in the user's timezone, not forever. A season is a row with a theme and a role. Limited is a role plus an overdue policy on the task. The event supplies the end. The policy is not copied onto both and run twice.

**Category.** `name`, `slug`, `hidden?`, `presentationId?`, `icon?`, `color?`.

**Appearance.** `icon` is a Lucide icon name (`house`, `sun`, `flame`). `color` is a palette token (`gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`). Both are optional strings. The schema does not enumerate Lucide. An unknown icon draws as `circle`. An unknown color draws as `gray`. Web and desktop render the Lucide set. Apple and Android map the same names and fall back when a name is not in the shipped subset. The picker offers the palette and the Lucide names. A template may ship a custom frame on top of the icon and color. The editor can change the icon, the color, and rebuild that frame. Icon and color live on views, events, categories, and shared spaces.

**Progression.** `mode` `steps` or `meter` (unknown modes render as a meter), `target`, `unit`, `current` for meters. Steps derive from completed linked tasks. A replace series may feed a step track: one open card, one increment per completion.

**Quest.** `status` `active`, `completed`, or `archived`. Steps: `questId`, `taskId`, `position`, `gate` `available` or `locked`. No second `done` on the step. If the available step is completed and another locked step exists, it becomes available. If none exists, the quest stays active and **waiting**. Waiting is the emergent case. `scripting` (`emergent` or `scripted`) is a hint. The core allows a scripted quest to gain a step and an emergent quest to be prefilled.

**Attachment.** `subjectType`, `subjectId`, `targetType`, `targetId`, `role` `primary` or `extra`. Subjects: task, progression, quest, event, category. Targets: category, event, quest, progression, space. This is the only link. No `primaryCategoryId` column beside it. Life-sized lists do not need a second source of truth. If a slice profile is slow, a denormalized hint can be added later as a cache, not as the write path.

**Shared space.** `name`, `icon?`, `color?`, members (`owner`, `editor`, `viewer`), attachments. Personal tasks do not require one. `canRead` starts as "owner matches" in M1. Every later query uses that helper, so sharing extends the helper instead of rewriting each list.

**View.** A left-rail entry. `title`, `icon?`, `color?`, `kind` (`home`, `template`, `computed`, `custom`), optional `filter` document, `deletedAt?`. Home is built in and cannot be deleted. A template view is backed by a category. A computed view is a saved query and stores no task copies. Seeds: New (`sparkles`), High priority (`flame`), Today (`sun`). A custom view is an empty rail entry you fill by hand.

**Alert.** Not a task. `title`, `body?`, `source` (`agent` or `member`), `seenAt?`, `deletedAt?`. No `done`. The Home band shows alerts with no `seenAt`. Opening one sets `seenAt` and drops it from the band. The row stays in a log. Alerts do not sit in the checkbox list.

**Question.** Not a task. `prompt`, options (`label`, `position`, optional effect), `answeredAt?`, `seenAt?`, `deletedAt?`. One answer is the default. Answering records the choice, sets `answeredAt`, removes the question from the open board, and in the same mutation runs the effect: append a quest step, create a task, or only store the answer. "Something else" is an option that leaves the quest waiting. This is how a waiting quest asks without a chat, including when no agent is connected. A poll among several people waits until shared spaces exist, and is the same record with more than one voter. v1 is the board asking you.

**Pin and overrides.** `viewPins` is a view id plus a subject. Pinned rows sort above the rest of that view. A pin does not change priority, date, or deadline. `viewOverrides` is `include` or `exclude` for a subject on a computed view. The query is "matches the filter, or is included" and "is not excluded". Exclude hides a row from Today without deleting it. Guidance: one pin is a spotlight. The core allows more.

**Layout.** Home's horizontal tabs are Tasks, Daily, Weekly, Monthly, plus a create button. Tasks means no time filter inside the view. Daily, Weekly, and Monthly are the day, week, and month events. Active seasons can appear as further tabs. Changing tabs does not change which row types exist. The column, top to bottom: unread alerts, open questions, pinned rows, then tasks, progression bars, and quest steppers. A layout document can still move facets between axes. "All" is a query mode, not a stored event.

**Presentation pack.** A string id plus a token bag (accent, icon, copy overrides such as `limitedLabel`). Clients register components. Unknown ids use the default shell and still apply tokens. No pack id is branched on inside `taskService`.

## Prebuilt catalog

Seed data, cloned so a person can rename or hide a row. Slugs are strings. "Boat" does not need a migration.

### Categories

| Slug | Name | Default drawing |
|---|---|---|
| `household` | Household | row |
| `health` | Health | row |
| `body` | Body | card |
| `relationships` | Relationships | card |
| `work` | Work | row |
| `projects` | Projects | card |
| `money` | Money | row |
| `admin` | Admin | row |
| `learning` | Learning | card |
| `social` | Social | card |
| `creative` | Creative | card |

Health is care and appointments. Body is training, sleep, and food, so a progression has a home. Either can be hidden.

### Events

Built-in kinds: `day`, `week`, `month`, `quarter`, `year`, `custom`. Phone default shows day and week. The others exist and can be turned on.

Example seasons, off until enabled:

| Name | Suggested window | Sample tasks |
|---|---|---|
| Winter | 1 Dec – 28 Feb | Walk on a snowy night. Christmas market with friends. |
| Tax season | 1 Feb through the filing day | Gather documents. File. Pay. |
| Moving | the dates you set | Measure. Boxes. Address changes. |
| A trip | the dates you set | Book, pack, go, unpack. |

Example runs with role `limited`: a market weekend, a one-day menu (policy retire), a concert week. The filing deadline is a run whose task policy is escalate, not retire.

### Behaviors

| Template | Behavior | Deadline | Overdue | Drawing |
|---|---|---|---|---|
| Chore | replace | none | none | row |
| Log | stack | none | none | row |
| Practice | replace, plus a step progression | none | none | bar and one row |
| Appointment | none | planned time only | none | card |
| Commitment | optional replace | `deadlineAt` | escalate | card |
| Offer | none | event end | retire | card |
| Quest step | none | optional | whatever the step needs | card on the quest |
| Reading | meter progression | optional | none | bar |

### Quests and tracks

- Broken window. Emergent. Step 1: call the landlord. Then waiting.
- See a friend. Scripted: propose a time, confirm a place, go. Later steps start locked.
- Move house. A known list, still editable.
- Train this month. Steps, target 12.
- Read one book. Meter, unit `page`, target is the page count.
- Journal week. Steps, target 7, fed by a **stack** so each day remains.

Priority seeds: `low`, `normal`, `high`, `urgent`. Omitted means `normal` / 10.

## Board

The default shell matches the Home sketch.

Left rail: **Home** (`house`, `sky`), then computed views you turn on (New, High priority, Today), then any template you installed from **Find more**. Find more searches the catalog. Each hit is a template: a category, a suggested icon and color, starter tasks, and an optional frame. Installing copies it onto the rail. You can change the icon and color, edit the tasks, or rebuild the frame. You can also create a custom view with no template.

Top of the main column: Tasks, Daily, Weekly, Monthly, and +. Tasks is the view with no time filter. The other three attach the slice to the day, week, or month event. + creates a row in the current slice.

The column draws mixed rows. A task is a checkbox row. A NEW mark sits on the title when an agent or another person created it and you have not opened it. A progression is a bar (`Finish the book`, 150/300). A quest is a stepper (Step 1, Step 2, an empty next). Unread alerts sit in a band above the checkboxes. An open question sits under the band and above the pins.

A task in two views shows in both. The UI may say so. Saving the extra is allowed. A waiting quest stays on Home even with no date, so it cannot vanish.

Season-forward is still a layout document: seasons on the rail, categories across the top. Same records. Card versus row: hint on the record, else the category hint, else row when the slice is long.

A Winter pack may replace the empty state and the card frame. The icon and color still apply when the frame is missing. `taskService` does not mention Winter or Lucide.

## User flows

**Dishes.** "Dishes every day" creates a recurrence with `behavior: replace`, attached to Household and the day event. Skip Monday. Tuesday shows one row. Monday's row is `superseded` and is not on the board. Checking the row completes it. The next morning mints a new open row.

**Journal.** `behavior: stack` on Creative. Two skipped days leave three open rows. Writing Monday does not close Tuesday.

**Taxes.** Mail says file by 15 April. The agent creates "File taxes" with `deadlineAt` at the end of that civil day, `overduePolicy: escalate`, `priority: high`, attached to Money and a Tax season event. It does not copy the deadline into `plannedOn`. The morning after, the task is still open at `urgent`.

**Burger.** A one-day event, `overduePolicy: retire`. After close, `outcome` is `missed`. It is not in Trash.

**Broken window.** A quest with one available step, "Call the landlord". Completing it leaves a question: Buy glass, Send money, Call a repairer, Something else. Choosing Buy glass appends that task. Something else leaves the quest waiting so you or the agent can write the step. Move-house is the same tables with later steps created locked and no question yet.

**Book and training.** 320 pages is a meter. Logging 20 fills the bar. Twelve sessions is a step progression fed by a replace recurrence, so the board still has one Train row.

**NEW.** The agent creates "Install Omarchy". You did not type it, so the row wears NEW. Opening it sets `seenAt` and the mark leaves. "Play Witcher", which you added, never wears it. The New view lists every unseen row, including ones outside Home.

**Alert.** The agent writes "Flight is Thursday" as an alert, not a task. It shows in the band. You read it. It leaves the band and stays in the log. There is no checkbox.

**Pin.** Taxes are due next month and you want them on Today's view. You pin the row. Priority and deadline stay as they are. The row sits above the daily list until you unpin it. Exclude is the opposite: hide a dish from Today without deleting the series.

**Share the household.** A shared space, one editor, icon and color of its own. Attach the Household view and the dishes recurrence. They see those tasks, and a task they create there wears NEW for you. They do not see Money. Detach hides the tasks and does not delete them.

**From mail.** The skill says: choose replace or stack in the tool call, never copy a planned day into a deadline, use retire only when the chance literally ends. Convex subscriptions update the phone.

## Technical plan

M1 touches `tasks` only.

Add optional `deletedAt`, `completedAt`, `notes`, `plannedOn`, `plannedTime`, `location`, `deadlineAt`, `remindAt`, `priority`, `priorityRank`, `overduePolicy`, `outcome`, `seenAt`. Keep `title`, `done`, `dueAt`, `ownerId`. A create from the signed-in user sets `seenAt`. A create from MCP leaves it unset, which is the NEW mark.

`deleteTask` sets `deletedAt` and never calls `db.delete`. Lists used by current clients filter trashed rows out, so old apps still see a disappearance. `taskView` keeps `id`, `title`, `done`, `dueAt`, `ownerId` and adds the new fields as optional. A create that sends only `dueAt` also writes `plannedOn`. A create that sends `deadlineAt` does not.

M1 overdue is derived in the query (`effectiveRank`, `overdue` flag) so the screen agrees before a cron exists. M2's cron persists escalate (rank + 10, cap 30) and retire (`outcome: missed`).

Do not index `deletedAt === undefined`. Convex index behavior on missing fields is the wrong thing to bet M1 on, and a life-sized `by_owner` scan is cheap. In M2, when superseded rows appear, add a required boolean `open` (true only for actionable tasks), backfill it, and index `by_owner_open`. Done and history use their own filters.

Later tables, in milestone order, not before they are needed:

- M2 `recurrences`. Occurrences are tasks. No second occurrence table.
- M3 `views`, `categories`, `events`, `attachments`, `viewPins`, `viewOverrides`. Icon and color are strings on views, events, and categories.
- M4 `progressions`.
- M5 `quests`, `questSteps`, `questions`, `questionOptions`.
- M6 `alerts`.
- M7 `spaces`, `spaceMembers`, with icon and color on the space.
- Packs add no table. The Lucide name and the color token are not a pack.

MCP, thin, same Convex mutations the clients call:

| Tool | When |
|---|---|
| `create_task`, `update_task`, `list_tasks`, `complete_task`, `reopen_task`, `delete_task` | M1. Delete is a tombstone. New fields optional. |
| `create_recurrence`, `list_recurrences` | M2. `behavior` required. Tool text includes dishes and the journal. |
| `create_category`, `create_event`, `create_view`, `attach`, `detach`, `get_slice`, `pin`, `unpin`, `include`, `exclude` | M3. Icon and color are optional arguments. |
| `create_progression`, `log_progress` | M4. |
| `create_quest`, `add_quest_step`, `create_question`, `answer_question` | M5. Unlock stays inside `complete_task` or `answer_question`. |
| `apply_plan` | M5. One Convex mutation for an email that should create an event, tasks, and steps together. MCP forwards it. Single-entity tools remain. |
| `create_alert`, `list_alerts`, `read_alert` | M6. `read_alert` sets `seenAt`. |
| `create_space`, `invite_space` | M7, target type `space` on `attach`. |

`whoami` stays. After any MCP change, `pnpm build:api`. Clients do not compute rollover, overdue, or access. Apple keeps `@OptionalConvexFloat`. Android keeps `Float64`. New fields are optional so an old binary ignores them.

`packages/ui` gets the shell. The milestone is not done until Apple and Android can show the same slice. A custom Winter frame may ship on web first. Native falls back to tokens.

There is no public REST API. There is no new backend.

## Milestones

**M1 — Task facts and NEW.** Soft delete, planned day, optional time, place, priority and rank, deadline, remind-at stored, overdue policy derived on read, `seenAt`. An MCP create shows NEW until the row is opened. Harness one-pager for Grok Bot, Codex, Claude, and Antigravity: the two behaviors, the two clocks, retire versus escalate, and "do not create a task for a summary". Tests: soft delete hides a row; `dueAt` does not become `deadlineAt`; a self-created task is not NEW. Out: recurrence, the rail, shared spaces.

**M2 — Replace and stack.** The dish test (one open row after a missed day, previous outcome superseded) and the journal test (three open rows). Idempotent mint. Cron persists overdue. `open` boolean and index. Out: the Home shell.

**M3 — Home shell.** Views, day/week/month events, attachments, icon and color, Tasks / Daily / Weekly / Monthly, Find more installing one template, computed views New, High priority, and Today, pin and include/exclude. Web, desktop, Apple, and Android all show the column. Out: quests, alerts, sharing.

**M4 — Progressions.** A page meter and a step track drawn in the column, as a bar.

**M5 — Quests and questions.** Waiting becomes a question with options. A locked known sequence still works with no question. An answer can append the next task.

**M6 — Alerts.** Agent summaries in the band. Reading clears the band and keeps the log. No checkbox.

**M7 — Shared spaces.** Create, invite, attach, detach, icon and color. One-hop visibility. A test that Money does not leak through a season. NEW applies to rows another member creates. `canRead` grows here.

**M8 — Longer events, Winter, seeds.** Month, quarter, year, custom. Winter installed as a season with its own icon, color, and one frame. A new account can enable the catalog. The harness notes grow with each milestone.

**Horizon.** Achievements queried from completions, progressions, quests, and missed or superseded rows. Social play beyond a space. Paid inference and a connected mailbox, with MCP still there for people who bring a harness. Native push, calendar, reminders, and alarms driven by `plannedTime`, `deadlineAt`, and `remindAt`.

## What we deliberately did not take

- A required personal space and a backfill in M1.
- `carry_forward` as a third overdue policy. Doing nothing is `none`.
- Gacha tier names (SSR, crimson pulse) on the task row. Packs may paint `urgent` that way.
- A batch tool as the only way to create a plan.
- Indexing a missing `deletedAt` and hoping.
- Capping a stack backlog in the schema. The pack may collapse it.
