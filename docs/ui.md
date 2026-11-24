# Web UI: sheets, bottom tabs, and the category dashboard

This is the layout contract for the shared React UI in `packages/ui`, used by the web app and the desktop client. The mechanics it exposes are described in [plan.md](plan.md); this file is about where they are drawn and which mutation a sheet calls.

## Chrome

There is no side rail at any width. The Home board is one column: alerts, questions, tasks, progressions, then quests. Navigation lives in a fixed **bottom glass bar** with six buttons:

| Button | Behavior |
|---|---|
| Tasks | Selects the unfiltered Tasks slice |
| Daily | Selects the Daily slice |
| Weekly | Selects the Weekly slice |
| Monthly | Selects the Monthly slice |
| Grid | Opens the full-screen dashboard, not a drawer |
| + | Opens the task creation sheet |

The bottom bar is translucent with a blur and stays fixed at the bottom. Navigation, the dashboard, and sheets are overlays, so the board never reflows when a sheet opens.

## Sheet shapes

Every create and every edit uses the same overlay component.

- **Wide screens (≥800px):** a centered modal dialog.
- **Narrow screens (<800px):** a fixed bottom sheet anchored to the bottom edge.

There is no inline composer and no inline task editor. A failed mutation is shown in the sheet as an error; the form stays open with its values. If a function is not deployed, that rejection is displayed in the sheet too. There is no fallback inline form.

## Task sheet

Opened by the `+` button or by a task row. It has:

- **Look** — `check` (checkbox row), `row` (a plain line with no checkbox), or `card` (a card). An absent `presentation` renders as `check`.
- **Series** — `none`, `replace`, or `stack`. This is chosen explicitly; a cadence never implies a behavior. `replace` keeps one open occurrence and supersedes a missed period. `stack` keeps one open occurrence per period.
- **Cadence** — `daily`, `weekly`, `monthly`, or `every 14 days`. The stored id for the last one is `biweekly`; the UI only says `every 14 days`.
- Planned day, planned time, deadline, remind at, location, priority, overdue policy, and notes.
- An optional resource and delta. A standalone task writes it with `tasks.setResourceEffect`; a series writes the nested `resourceEffect` on `recurrences:create`.

The overview row follows the chosen look. A task created by an agent or another person wears **NEW** until it is opened; opening it calls `tasks.markSeen` and the badge leaves. A self-created task is never NEW.

## Entity sheets

The dashboard has an add tile and an edit action for each of these. Each writes through one mutation chosen by the sheet target.

| Sheet | Fields | Create / update |
|---|---|---|
| Category | name, icon, color | `categories:create` / `categories:update` |
| Event | title, kind, start, end, icon, color | `events:create` / `events:update` |
| View | title, icon, color | `views:createCustom` / `views:update` |
| Progression | title, mode (`steps` or `meter`), target, unit | `progressions:create` / `progressions:update` |
| Resource | title, quantity, unit, low-at, icon, color | `resources:create` / `resources:update` |

Some update functions may not be deployed yet. Calling one still goes through `makeFunctionReference`; the rejection appears in that sheet rather than being hidden behind a local-only edit.

All sheet calls use `makeFunctionReference` in `src/homeApi.ts`, the same pattern `board.slice` uses. `tasks.create`, `tasks.update`, `recurrences.create`, `categories.create`, `events.create`, `resources.create`, `resources.list`, and `tasks.setResourceEffect` are called this way. Arguments match the Convex handlers: the series resource effect is the nested `{ resourceId, delta }` object even when older drafts used the flat `resourceId` / `resourceDelta` vocabulary.

## Icon picker

No appearance field accepts a typed icon name. Every sheet that edits appearance uses the same picker:

- a searchable grid of Lucide icons, chosen from the installed `lucide-react` registry;
- palette swatches for the appearance color token;
- a live preview showing the selected icon in the selected color.

Stored values are strings. An unknown icon draws as `circle` and an unknown color draws as `gray`.

## Dashboard

The grid button replaces the board with a full-screen page of tiles. Views open their slice; category, event, progression, and resource tiles open their edit sheet; add tiles open the corresponding create sheet. A "Find more" section lists computed views and templates. Closing the dashboard returns to the board, and the bottom bar stays reachable.

The dashboard is not a place to invent a new kind of record. Category, event, view, progression, and resource are the five entity sheets; everything else stays a planned mechanic until its sheet and mutation exist.
