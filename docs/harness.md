# Manager Harness Guide

A one-page reference for AI agent harnesses connecting to Manager over MCP (Grok Bot, Codex, Claude, and Antigravity).

Manager is an ADHD-first, gamified life manager and personal system of record. When connecting via MCP (`https://manager.labdm.dev/mcp`), adhere strictly to these concepts, invariants, and tool conventions.

## 1. The Two Clocks: Planned Day vs. Deadline

Never confuse when an action is planned with when an opportunity ends. They are separate mechanics.

- **Planned Day (`plannedOn` / legacy `dueAt`)**:
  - The civil day you or the user intend to act.
  - Stored as Unix milliseconds at the local start of that civil day.
  - Accompanied by optional `plannedTime` (minutes from midnight, integer `0`–`1439`) only when there is a specific clock time (e.g. an appointment at 14:30 = `870`).
  - **A planned day is NOT a deadline.** Missing a planned day does not expire the task; it simply rolls over on the user's board.
- **Deadline (`deadlineAt`)**:
  - The exact instant the task's overdue policy runs.
  - Stored as Unix milliseconds.
  - Independent of `plannedOn`. **Never copy a planned day into a deadline, and never copy a deadline into a planned day.** A tax filing due on April 15 has `deadlineAt` at the end of April 15, while the user might plan to prepare it on April 1 (`plannedOn`).

## 2. Overdue Policies: Retire vs. Escalate

When `deadlineAt` passes and the task remains open and not trashed, an overdue policy dictates the outcome:

- **`none` (default)**:
  - The task remains open and is marked `overdue: true` on read. Priority rank is unchanged.
- **`retire`**:
  - The opportunity or event has ended and can no longer be acted upon (e.g., concert ticket sales closed, one-day restaurant special ended, flight departed).
  - Its `outcome` becomes `missed`.
  - **Retire is not trash.** Do not set `deletedAt` for missed chances. Trash (`deletedAt`) is reserved strictly for user-facing deletion. Use `retire` only when the chance literally ends.
- **`escalate`**:
  - The task remains open, but louder.
  - For standard seed priorities (`low` 0, `normal` 10, `high` 20, `urgent` 30), `effectiveRank` is increased by +10 (capped at 30, `urgent`). Custom string priorities stay at their rank.
  - The rank bump is derived immediately on read and persisted once by the reconcile cron (`priorityRank` = min(seed + 10, 30)). A custom priority string is never bumped. `retire` persists `outcome: "missed"`; neither policy sets `deletedAt`.

## 3. Recurrence: Replace vs. Stack

Recurrence is shipped. Use `create_recurrence` with a **required** `behavior` (`replace` or `stack`), a `cadence` (`daily`, `weekly`, `biweekly` / every 14 days, `monthly`), and an IANA `timezone`. Minting is lazy and idempotent on `(recurrenceId, periodStart)`, where a period starts at local midnight in that timezone (weeks start Monday; a biweekly period starts on the 14-day cycle from `anchorOn`). `list_recurrences`, `get_slice`, and a reconcile cron all move a series forward, including when the app has been closed.

- **`replace`**:
  - At most one open occurrence exists on the board.
  - When a new period begins, the uncompleted prior period's occurrence is marked `outcome: "superseded"` and leaves the active board (e.g. daily dishes: missing Monday's dishes must not display Monday + Tuesday cards side by side).
  - Superseded rows stay in storage for later history and achievement queries; they are not trash.
- **`stack`**:
  - Every period mints an occurrence and leaves older open occurrences on the board.
  - Missed periods accumulate for backfilling with no core cap (e.g. daily journal entries: each day's entry remains open until completed).

New series default their anchor to the current period, so creation mints one row. Minted occurrences carry the recurrence's template fields, `plannedOn` and `dueAt` set to the period start, and no `deadlineAt`. A planned day is still not a deadline.

## 4. Do Not Create a Task for a Summary

- **Manager is an actionable task tracker, not a notification feed or conversational echo chamber.**
- **Do not create tasks for agent summaries, meeting recaps, status updates, or context notes.**
- A task is an atomic unit of work that a human can complete and check off. If there is no specific action required from the user, do not write a task.
- Informational notes, travel notifications ("Flight is Thursday"), and background summaries belong in **alerts**: use `create_alert`. They appear in a dedicated notification band without checkboxes, stay in the log after being read, and are never written to the `tasks` table.

## 5. Resources and Stock

A resource is a stock level, not a task. `create_resource` and `list_resources` work with its title, unit, quantity and low-at threshold. Attach one effect with `set_task_resource_effect`: completing the task applies the delta once (negative uses stock, positive adds it) and reopening reverses it once. When a quantity falls to low-at or below, the core raises one unread alert sourced from that resource; it does not create a task. An agent may read that alert and create a buy-task for the user, but the core never invents one.
