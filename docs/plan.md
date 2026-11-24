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

**View.** A saved slice. `title`, `icon?`, `color?`, `kind` (`home`, `template`, `computed`, `custom`), optional `filter` document, `deletedAt?`. Home is the Inbox and cannot be deleted. A template view is backed by a category and opens from the Categories tab. A computed view is a saved query and stores no task copies. Seeds: New (`sparkles`), High priority (`flame`), Today (`sun`), shown as Inbox filters. A custom view is a filter you fill by hand. The layout evolution section is where these sit on screen.

**Alert.** Not a task. `title`, `body?`, `source` (`agent` or `member`), `seenAt?`, `deletedAt?`. No `done`. The Home band shows alerts with no `seenAt`. Opening one sets `seenAt` and drops it from the band. The row stays in a log. Alerts do not sit in the checkbox list.

**Question.** Not a task. `prompt`, options (`label`, `position`, optional effect), `answeredAt?`, `seenAt?`, `deletedAt?`. One answer is the default. Answering records the choice, sets `answeredAt`, removes the question from the open board, and in the same mutation runs the effect: append a quest step, create a task, or only store the answer. "Something else" is an option that leaves the quest waiting. This is how a waiting quest asks without a chat, including when no agent is connected. A poll among several people waits until shared spaces exist, and is the same record with more than one voter. v1 is the board asking you.

**Pin and overrides.** `viewPins` is a view id plus a subject. Pinned rows sort above the rest of that view. A pin does not change priority, date, or deadline. `viewOverrides` is `include` or `exclude` for a subject on a computed view. The query is "matches the filter, or is included" and "is not excluded". Exclude hides a row from Today without deleting it. Guidance: one pin is a spotlight. The core allows more.

**Layout.** Inbox filters are All, Daily, Weekly, and Monthly, plus Events when a named event applies. Daily, Weekly, and Monthly are the day, week, and month events. "All" is a query mode, not a stored event. The same row types exist on every filter. Order in the feed: pinned rows, then actionable rows (open tasks, unseen messages, unanswered questions, pending invites, progression tracks). Read messages stay on the Messages screen. The screen arrangement is the layout evolution section.

### Web shell

Shipped chrome (bottom bar Tasks, Daily, Weekly, Monthly, Grid, and +, plus the category dashboard and `check` / `row` / `card` looks) is recorded in [docs/ui.md](ui.md). The layout evolution section replaces that chrome. Keep the mutation pattern: writes go through `makeFunctionReference`, and a missing deployment shows its error on the detail screen. A task still chooses its series (`none`, `replace`, `stack`) explicitly; cadence (`daily`, `weekly`, `monthly`, `every 14 days`) never implies a behavior. Appearance stays a searchable Lucide grid with palette swatches and a live preview.

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

The feed draws one row anatomy, specified in the layout evolution section. A NEW mark sits on a row when an agent or another member created it and `seenAt` is absent. A progression is its own row (a bar such as `Finish the book`, 150/300) and can also be the bar slot on a linked task. A quest step wears an exclamation beside the title. Unread messages and unanswered questions are rows in the Inbox. A waiting quest stays in the Inbox with no date, so it cannot vanish.

Find more installs a category template (icon, color, starter tasks, optional frame) into the Categories tab. You can change the icon and color, edit the tasks, or rebuild the frame.

A task in two views shows in both. Saving the extra is allowed. Seasons stay events. A Winter pack may replace the empty state. The icon and color still apply when a frame is missing. `taskService` does not mention Winter or Lucide. Stored presentation `card` is ignored; the board draws the row.

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

**M3 — Home shell.** Views, day/week/month events, attachments, icon and color, Find more installing one template, computed views New, High priority, and Today, pin and include/exclude. The screen for this data is layout milestone R2, not a left rail and not Tasks / Daily / Weekly / Monthly tabs. Out: quests, messages, sharing.

**M4 — Progressions.** A page meter and a step track drawn as a row, with a bar.

**M5 — Quests and questions.** Waiting becomes a question with options. A locked known sequence still works with no question. An answer can append the next task. On screen this is layout milestone R5.

**M6 — Alerts.** The product word is message. The record stays the shipped `alerts` table. Reading clears the Inbox row and keeps the Messages log. No checkbox. On screen this is layout milestone R4.

**M7 — Shared spaces.** The product word is group. Create, invite, attach, detach, icon and color. One-hop visibility. A test that Money does not leak through a season. NEW applies to rows another member creates. `canRead` grows here. On screen this is layout milestone R3. No required personal group and no M1 backfill.

**M8 — Longer events, Winter, seeds.** Month, quarter, year, custom. Winter installed as a season with its own icon, color, and one frame. A new account can enable the catalog. The harness notes grow with each milestone. Seasons stay events and show up through the Events chip and the Events menu page.

**Horizon.** Achievements queried from completions, progressions, quests, and missed or superseded rows, as the Achievements menu page (layout milestone R6). Social play beyond a group. Paid inference and a connected mailbox, with MCP still there for people who bring a harness. Native push, calendar, reminders, and alarms driven by `plannedTime`, `deadlineAt`, and `remindAt`.

M1 and M2 stay as written. Layout milestones R1–R6 below are the shell sequence. They do not rebuild M1 or M2.

## Layout evolution

Status: decided 2026-11-24, waiting for owner review before any implementation. This section replaces the Home rail, the shipped bottom bar (Tasks, Daily, Weekly, Monthly, Grid, +), the category dashboard, and card presentation. Apple, Android, web, and desktop share this navigation. [docs/ui.md](ui.md) remains the check for the shipped build until this shell lands.

Two drafts were compared. One put Inbox, Calendar, Resources, Achievements, and Menu on the bar. The other put Tasks, Messages, Groups, Categories, and Resources on the bar and kept Settings as a button. The review settled on the five destinations below. The sketch's bottom chips were tasks, categories, resources, achievements, and setting, beside a long menu that repeated several of them. Each item now has one door.

### Primary navigation

The menu is a button on every width. It is not a tab. Nothing in the menu is also a primary destination.

| Destination | Role |
|---|---|
| Inbox | Default feed. Open tasks, unseen messages, unanswered questions, and pending invites. Filters: All, Daily, Weekly, Monthly, Events, plus saved filters New, High priority, and Today. All includes read tasks. The message archive lives on Messages. |
| Messages | The full log and the composer. Filters: All, People, Agents, Activity, Unread. History / Activity is the Activity filter. |
| Groups | Members, invites, and the shared space. Hidden until groups ship. The header switcher still says Personal until then. |
| Categories | Life slices, topics, icons, colors, templates, and custom views. Find more lives here. |
| Resources | The resource ledger and effects. |

Until Groups ships, the bar is Inbox, Messages, Categories, Resources, and the menu button. Achievements does not fill the empty slot.

Phone puts that bar on the bottom. A large screen puts the same destinations on a left icon rail, with the menu button at the bottom of the rail. The rail is navigation. It is not an expanded copy of the menu.

### Menu

The button is always on screen: the list header on phone and medium, the bottom of the rail on a large screen. The menu list itself is not pinned open.

**Achievements · Contacts · Events · Routings · Profile · Settings · Docs · Contact us · Desktop app · Changelog**

Settings holds notifications, sharing, swipe actions, and which changes become activity messages. Profile holds the Clerk account fields. Events is where seasons and named events are created. The Events chip on Inbox stays a filter. Contacts is where people are viewed and invited. Achievements is the stats page.

Dashboard is removed. A stored `card` presentation is ignored.

### Why these five

Achievements stays in the menu. It is a query over completions, tracks, and quests, and that query waits until those records are in use. Stats open from the menu onto their own page. The empty detail pane does not become a stats dashboard. Achievements can take a primary slot later only by a separate decision.

Messages is a destination because a read alert already leaves the board and stays in a log. The shipped record is `alerts`. Inbox shows the ones that still need attention. Messages keeps the rest, including read ones, and is where a person or an agent composes. A summary is a message. It is never a task.

Groups is a destination because members and invites need a home, and the wide layout follows Telegram: an icon for the space, a list, then the open item. The "all groups" control on the feed is a switcher, not that home. Personal tasks still have no required group. There is no backfill.

Categories stays a destination because the sketch put it on the bar and a category is a slice of life. Icons, colors, and templates are edited there.

Calendar stays off the bar. Daily, Weekly, and Monthly chips are the day, week, and month slices. Expanding a day is that chip's detail. A later calendar page can be pushed from the Events chip. It is not one of the five, and it is not part of R1–R6.

### Shell

**Phone.** One screen. Inbox is the default. The header has the menu button, the All groups switcher, and a create button. Filter chips sit under the header and swipe sideways. Daily and Events can show counts. Tapping a row pushes a detail screen. Create opens a full-screen New page that starts as a task. A message is composed on Messages. An invite is sent from Groups. A question comes from a quest flow.

**Medium (foldable, iPad).** List plus detail. The detail starts empty: "Select an item." Nothing is preselected on load or after a filter change. Selection is the act that marks a row seen.

**Large.** Three regions: the icon rail, the list (switcher and chips), and the detail of the row the user opened. The list does not auto-open a row. Auto-selection would mark it read.

**Fourth region.** Only on a very large screen, and only after the user opens a secondary page (Achievements, a resource ledger, a calendar page). It is absent by default. It never holds an automatically selected row, the menu, or an unread band.

### Row

One row. Slots are fixed and omitted when they do not apply.

| Slot | Content |
|---|---|
| 1 | `NEW` when an agent or another member created the row and `seenAt` is absent |
| 2 | Category icon, tinted with the category color, or a neutral fallback |
| 3 | Type mark: task, message, question, invite, or progression. The mark is not a button |
| 4 | Progress, such as `8 / 15`, on a progression or a task linked to one |
| 5 | Primary action |
| 6 | People glyph when the row is attached to a group. On an invite, the source group |
| 7 | Due: planned day, planned time, deadline countdown, or overdue. Tasks only |
| 8 | Resource badge `+1` or `-1`. Never on an invite |

The title follows the leading marks. Body text sits under the title. A quest exclamation sits beside the title when the row is a quest step or is linked to a quest. An event header is a section divider, not a row.

| Type | Primary action | Also | Due | Progress | Quest mark | Resource |
|---|---|---|---|---|---|---|
| Task | Done | Mark as read while NEW. Swipe actions come from Settings | `plannedOn`, `plannedTime`, `deadlineAt` | When linked to a progression | When it is a quest step | Yes |
| Message | Mark as read | Reply on Messages | No | No | When linked | Yes |
| Question | Answer, which opens the options | Mark as read | No | No | Yes | Only through the answer's effect |
| Invite | Accept, with Decline beside it | Mark as read | No | No | No | No |
| Progression | Done or Log when a task backs it | Meter logging on the detail | Only what a linked task carries | Yes | When linked | Yes |

An invite has no due, progression, quest, or resource. It belongs to the group that sent it.

`check`, `row`, and `card` all draw as this row. Catalog templates that say "card" keep the hint in data; the board ignores it.

### Mark read

`NEW` means an agent or another member created the row and `seenAt` is absent. A missing origin reads as self. A self-created row sets `origin: self` and `seenAt` immediately. Opening the detail calls `markSeen` and clears NEW only after that mutation succeeds. A failed open leaves NEW. A blank `plannedOn` or `deadlineAt` does not clear it. Messages, questions, and invites use the same `seenAt`. Answering a question or accepting or declining an invite also sets `seenAt`. Mark as read stays available before that decision. Marking a task read is a different action from marking it done.

Medium and large screens start with an empty detail pane for this reason. A preselected first row would clear NEW without the user opening it.

### Records

| Product word | Record | What changes |
|---|---|---|
| Task | `tasks` | No new parent. `ownerId` stays. `dueAt` stays the one-release alias of `plannedOn`. Group attachment arrives with groups. |
| Message | shipped `alerts` | The screen says Message. The table stays `alerts` (`title`, `body`, `source`, optional `resourceId`, `seenAt`, `deletedAt`). R4 adds a kind, an author, and links to a task, quest, progression, or event. Low-stock notes stay rows in this table. There is no second table and no `done`. |
| Question | shipped `questions` | Reuse. `seenAt` is already there. Answer effect can append a quest step or create a task. |
| Invite | new `invites` | Group id, invitee, status, origin, `seenAt`, `deletedAt`. Accept creates membership. No due, progression, quest, or resource fields. |
| Group | planned `spaces` / `spaceMembers` | The screen says Group. The schema name stays space. Not an M1 requirement. No required `groupId` and no backfill. Visibility stays one hop. |
| Event | `events` | Unchanged. Day, week, month, season, and limited roles stay one table. |
| Category | `categories` | Unchanged. Icon, color, and template-driven styles. |
| Progression, quest | `progressions`, `quests`, `questSteps` | Unchanged mechanics. They supply the bar and the quest exclamation. A task can be both. |
| Routing | none yet | A menu page for a scheduled action that creates a task, progression, quest, or message and can attach a resource change. No table until the trigger and the idempotency key are chosen. |

MCP stays thin and calls the same Convex mutations. No public REST. `create_alert` remains the tool that writes a message until R4 adds the extra fields. `pnpm build:api` still follows any MCP change.

### Layout milestones

These sit on top of M1–M8. Implementation waits until this section is accepted.

| Milestone | Issue | In scope | Out of scope |
|---|---|---|---|
| R1 — Row-first shell | [LAB-152](https://linear.app/labdm/issue/LAB-152) | The destinations above, the menu, chips, the one row, full-screen task detail and create on phone, empty detail on medium and large, no preselection. Messages lists existing alerts. Categories and Resources list existing records. Remove the grid dashboard and the card look. Web, desktop, Apple, and Android. | Schema changes, groups, invites, composers, achievements data |
| R2 — Categories, views, and event filters | [LAB-151](https://linear.app/labdm/issue/LAB-151) | Categories tab with icons, colors, and templates. New, High priority, and Today as Inbox filters. Pins and include/exclude. Events chip. Replaces the data half of M3 ([LAB-146](https://linear.app/labdm/issue/LAB-146)). | Groups, the message composer, invites, quests |
| R3 — Groups and invites | [LAB-154](https://linear.app/labdm/issue/LAB-154) | `spaces`, membership, `invites`, accept and decline, the group switcher, one-hop visibility, NEW on member-created rows. The Groups destination appears. Replaces M7 ([LAB-142](https://linear.app/labdm/issue/LAB-142)). | A required personal group, an M1 backfill, achievements, routings |
| R4 — Messages and activity | [LAB-156](https://linear.app/labdm/issue/LAB-156) | Kind, author, and links on `alerts`. Composer. Activity filter. Settings for which changes become messages. Inbox keeps unseen messages; Messages keeps the log. Replaces M6 ([LAB-143](https://linear.app/labdm/issue/LAB-143)). | Turning a summary into a task, question, or invite. A second table |
| R5 — Progressions, quests, and questions in the row | [LAB-153](https://linear.app/labdm/issue/LAB-153) | Bars, quest exclamation, question options, answer effects, a task that is both a quest step and a progression, Mark as read beside Done. Replaces M4 ([LAB-148](https://linear.app/labdm/issue/LAB-148)) and M5 ([LAB-147](https://linear.app/labdm/issue/LAB-147)). | New task facts, achievement queries |
| R6 — Achievements and routings | [LAB-155](https://linear.app/labdm/issue/LAB-155) | The Achievements page from real queries, an opt-in fourth region on a very large screen, the Routings menu once its trigger is chosen. | Social play beyond groups, paid inference, native fan-out |

Index: [LAB-150](https://linear.app/labdm/issue/LAB-150). M1 stays [LAB-145](https://linear.app/labdm/issue/LAB-145) and stays open. M2 stays [LAB-144](https://linear.app/labdm/issue/LAB-144). M8 ([LAB-141](https://linear.app/labdm/issue/LAB-141)) still covers longer events, Winter, and the catalog.

### Open questions

1. The sketch says "choose groups" in the plural. Recommendation: a row may attach to several groups, and the switcher selects one group or All. Confirm before R3.
2. Recommendation: a group owner or editor can invite, and accepting creates membership only, with no starter rows. Confirm before R3.
3. What fires a routing, and what idempotency key does it use when it creates a task or a message? Open for R6.
4. Which Achievements figures are real queries at R6, and which stay labeled placeholders? Open for R6.

## What we deliberately did not take

- A required personal space and a backfill in M1.
- `carry_forward` as a third overdue policy. Doing nothing is `none`.
- Gacha tier names (SSR, crimson pulse) on the task row. Packs may paint `urgent` that way.
- A batch tool as the only way to create a plan.
- Indexing a missing `deletedAt` and hoping.
- Capping a stack backlog in the schema. The pack may collapse it.
- A primary destination repeated as a menu row.
- Preselecting a row when the window gets wider. Selection marks the row seen.
- A second message table beside `alerts`.
- Renaming `spaces` in the schema. The screen says Group.
