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
  - Escalate does not alter the stored `priorityRank` in the database; it is derived as `effectiveRank` dynamically on read.

## 3. Recurrence Preview: Replace vs. Stack

Recurrence is scheduled for Milestone 2, but agents must understand the domain distinction now when modeling workflows:

- **`replace`**:
  - At most one open occurrence exists on the board.
  - When a new period begins, the uncompleted prior period's occurrence is marked `outcome: "superseded"` and leaves the active board (e.g. daily dishes: missing Monday's dishes must not display Monday + Tuesday cards side by side).
- **`stack`**:
  - Every period mints an occurrence and leaves older open occurrences on the board.
  - Missed periods accumulate for backfilling (e.g. daily journal entries: each day's entry remains open until completed).

## 4. Do Not Create a Task for a Summary

- **Manager is an actionable task tracker, not a notification feed or conversational echo chamber.**
- **Do not create tasks for agent summaries, meeting recaps, status updates, or context notes.**
- A task is an atomic unit of work that a human can complete and check off. If there is no specific action required from the user, do not write a task.
- Informational notes, travel notifications ("Flight is Thursday"), and background summaries belong in **alerts** (Milestone 6), which appear in a dedicated notification band without checkboxes. Until alerts land, deliver summaries directly in conversation, not in the `tasks` table.
