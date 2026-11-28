import { describe, expect, it } from "vitest";
import { addPeriods, civilDayStart, weekStart } from "../convex/lib/civilDates";
import {
  DEFAULT_TIMEZONE,
  nextReminderAt,
  periodId,
  periodStartEpoch,
  readRoutine,
  sectionForRoutine,
  streakFor,
  taskSection,
} from "../convex/lib/routinePeriod";
import type { Id } from "../convex/_generated/dataModel";
import {
  createTask,
  listTasks,
  setTaskDone,
  setTaskWaiting,
  syncRoutineDoneFlags,
  toggleTask,
  updateTask,
} from "../convex/lib/taskService";
import { boardSlice } from "../convex/lib/boardService";
import { fakeDb, seedUser } from "./fakeDb";

const ZONE = "Europe/Warsaw";
const OWNER = "user_routine" as Id<"users">;

describe("routine periods", () => {
  it("defaults to Europe/Warsaw and starts the week on Monday", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/Warsaw");
    const thursday = Date.UTC(2026, 0, 15, 12, 0);
    const start = periodStartEpoch({ kind: "weekly" }, thursday, ZONE);
    expect(start).toBe(weekStart(thursday, ZONE));
    const monday = civilDayStart(Date.UTC(2026, 0, 12, 0, 0), ZONE);
    expect(start).toBe(monday);
  });

  it("rolls a daily period at Warsaw midnight", () => {
    const before = Date.UTC(2026, 0, 15, 22, 30);
    const after = Date.UTC(2026, 0, 15, 23, 30);
    const earlier = periodId({ kind: "daily" }, before, ZONE);
    const later = periodId({ kind: "daily" }, after, ZONE);
    expect(earlier).not.toBe(later);
    expect(earlier?.startsWith("daily:")).toBe(true);
  });

  it("keeps every 2 weeks inside one period for 13 days and opens the next on day 14", () => {
    const anchor = Date.UTC(2026, 0, 5, 12, 0);
    const routine = readRoutine({
      routineKind: "interval",
      intervalEvery: 2,
      intervalUnit: "weeks",
      routineAnchor: anchor,
    });
    const start = periodStartEpoch(routine, anchor, ZONE);
    const day13 = addPeriods("daily", start, 13, ZONE);
    const day14 = addPeriods("daily", start, 14, ZONE);
    expect(periodId(routine, day13 + 3_600_000, ZONE)).toBe(periodId(routine, anchor, ZONE));
    expect(periodId(routine, day14 + 3_600_000, ZONE)).not.toBe(periodId(routine, anchor, ZONE));
    expect(sectionForRoutine(routine)).toBe("weekly");
  });

  it("places every N days on Daily and quests on Quests", () => {
    expect(sectionForRoutine({ kind: "none" })).toBe("quests");
    expect(sectionForRoutine({ kind: "daily" })).toBe("daily");
    expect(sectionForRoutine({ kind: "monthly" })).toBe("monthly");
    expect(taskSection({ routineKind: "interval", intervalUnit: "days" })).toBe("daily");
    expect(taskSection({}, "biweekly")).toBe("weekly");
    expect(taskSection({})).toBe("quests");
  });

  it("counts a streak only across consecutive period ids", () => {
    const now = Date.UTC(2026, 2, 10, 10, 0);
    const routine = { kind: "daily" as const };
    const today = periodStartEpoch(routine, now, ZONE);
    const yesterday = addPeriods("daily", today, -1, ZONE);
    const twoAgo = addPeriods("daily", today, -2, ZONE);
    const ids = new Set([
      `daily:${today}`,
      `daily:${yesterday}`,
      `daily:${twoAgo}`,
    ]);
    expect(streakFor(routine, ids, now, ZONE)).toBe(3);
    ids.delete(`daily:${yesterday}`);
    expect(streakFor(routine, ids, now, ZONE)).toBe(1);
  });

  it("schedules a time-of-day reminder after now", () => {
    const now = Date.UTC(2026, 0, 15, 8, 0);
    const at = nextReminderAt(now, ZONE, { kind: "daily" }, 9 * 60);
    expect(at).toBeGreaterThan(now);
    const later = nextReminderAt(at + 60_000, ZONE, { kind: "daily" }, 9 * 60);
    expect(later).toBeGreaterThan(at);
  });
});

describe("completion records reset a routine without a cron", () => {
  const now = Date.UTC(2026, 0, 15, 10, 0);

  async function board() {
    const db = fakeDb();
    await seedUser(db, OWNER);
    return db;
  }

  it("marks the current period done and the next period open", async () => {
    const db = await board();
    const created = await createTask(db.asWriter(), OWNER, {
      title: "Dishes",
      routineKind: "daily",
      timezone: ZONE,
    });
    await setTaskDone(db.asWriter(), OWNER, created.id, true, now);
    const today = await listTasks(db.asReader(), OWNER, now);
    expect(today.find((task) => task.title === "Dishes")?.done).toBe(true);

    const tomorrow = addPeriods("daily", now, 1, ZONE);
    const next = await listTasks(db.asReader(), OWNER, tomorrow);
    expect(next.find((task) => task.title === "Dishes")?.done).toBe(false);
    expect(db.all("taskCompletions")).toHaveLength(1);

    await setTaskDone(db.asWriter(), OWNER, created.id, true, tomorrow);
    expect(db.all("taskCompletions")).toHaveLength(2);
    const again = await listTasks(db.asReader(), OWNER, tomorrow);
    expect(again.find((task) => task.title === "Dishes")?.done).toBe(true);
  });

  it("refuses to complete a waiting task until it is unblocked", async () => {
    const db = await board();
    const created = await createTask(db.asWriter(), OWNER, {
      title: "Taxes",
      routineKind: "monthly",
      timezone: ZONE,
      waiting: true,
      waitingReason: "Waiting for the accountant",
    });
    await expect(
      setTaskDone(db.asWriter(), OWNER, created.id, true, now),
    ).rejects.toThrow("Task is waiting");
    await expect(toggleTask(db.asWriter(), OWNER, created.id, now)).rejects.toThrow(
      "Task is waiting",
    );
    const blocked = await listTasks(db.asReader(), OWNER, now);
    expect(blocked[0]?.waiting).toBe(true);
    expect(blocked[0]?.waitingReason).toBe("Waiting for the accountant");
    expect(blocked[0]?.section).toBe("monthly");

    await setTaskWaiting(db.asWriter(), OWNER, created.id, false, "Numbers arrived", now);
    const open = await setTaskDone(db.asWriter(), OWNER, created.id, true, now);
    expect(open.waiting).toBe(false);
    expect(open.done).toBe(true);
  });

  it("lands a new routine on its tab and leaves quests on the home board", async () => {
    const db = await board();
    await createTask(db.asWriter(), OWNER, { title: "Write the quest" });
    await createTask(db.asWriter(), OWNER, {
      title: "Water plants",
      routineKind: "daily",
      timezone: ZONE,
    });
    const home = await boardSlice(db.asWriter(), OWNER, { tab: "tasks", timezone: ZONE }, now);
    const daily = await boardSlice(db.asWriter(), OWNER, { tab: "daily", timezone: ZONE }, now);
    expect(home.tasks.map((task) => task.title)).toContain("Write the quest");
    expect(home.tasks.map((task) => task.title)).not.toContain("Water plants");
    expect(daily.tasks.map((task) => task.title)).toContain("Water plants");
    expect(daily.tasks.map((task) => task.title)).not.toContain("Write the quest");
  });

  it("stores a routine change and the next reminder instant", async () => {
    const db = await board();
    const created = await createTask(db.asWriter(), OWNER, { title: "Write the quest" });
    const updated = await updateTask(db.asWriter(), OWNER, created.id, {
      routineKind: "daily",
      timezone: ZONE,
      remindMinutes: 9 * 60,
    });
    expect(updated.routineKind).toBe("daily");
    expect(updated.section).toBe("daily");
    expect(updated.remindMinutes).toBe(9 * 60);
    expect(updated.remindAt).toBeGreaterThan(Date.now() - 1000);
  });

  it("clears the stored done flag when the period rolls", async () => {
    const db = await board();
    const created = await createTask(db.asWriter(), OWNER, {
      title: "Dishes",
      routineKind: "daily",
      timezone: ZONE,
    });
    await setTaskDone(db.asWriter(), OWNER, created.id, true, now);
    expect(db.all("tasks").find((row) => row.title === "Dishes")?.done).toBe(true);
    const tomorrow = addPeriods("daily", now, 1, ZONE);
    await syncRoutineDoneFlags(db.asWriter(), OWNER, tomorrow);
    expect(db.all("tasks").find((row) => row.title === "Dishes")?.done).toBe(false);
    const listed = await listTasks(db.asReader(), OWNER, tomorrow);
    expect(listed.find((task) => task.title === "Dishes")?.done).toBe(false);
  });
});
