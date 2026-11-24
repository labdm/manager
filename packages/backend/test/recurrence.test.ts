import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { civilDayStart, periodStartFor } from "../convex/lib/civilDates";
import { applyOverdue } from "../convex/lib/overdueService";
import {
  createRecurrence,
  reconcileRecurrence,
} from "../convex/lib/recurrenceService";
import { createTask, deleteTask, listTasks } from "../convex/lib/taskService";
import { fakeDb } from "./fakeDb";

const OWNER = "user_1" as Id<"users">;
const TZ = "UTC";
const NOW = civilDayStart(Date.UTC(2026, 0, 7, 15, 30), TZ) + 12 * 3_600_000;
const TWO_DAYS_AGO = periodStartFor("daily", NOW - 2 * 86_400_000, TZ);

function openTasks(db: ReturnType<typeof fakeDb>): Doc<"tasks">[] {
  return db
    .all("tasks")
    .filter(
      (row) =>
        row.deletedAt === undefined &&
        row.outcome === undefined &&
        row.done === false,
    ) as unknown as Doc<"tasks">[];
}

describe("recurrence", () => {
  it("dishes: replace daily leaves one open row and supersedes the older one", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const recurrence = await createRecurrence(
      writer,
      OWNER,
      {
        behavior: "replace",
        cadence: "daily",
        timezone: TZ,
        title: "Dishes",
        anchorOn: TWO_DAYS_AGO,
      },
      NOW,
    );

    await reconcileRecurrence(writer, recurrence, NOW);

    const open = openTasks(db);
    expect(open).toHaveLength(1);
    expect(open[0].periodStart).toBe(periodStartFor("daily", NOW, TZ));
    expect(open[0].plannedOn).toBe(open[0].periodStart);
    expect(open[0].dueAt).toBe(open[0].periodStart);
    expect(open[0].deadlineAt).toBeUndefined();
    expect(open[0].origin).toBe("self");
    expect(open[0].seenAt).toBeDefined();

    const superseded = db
      .all("tasks")
      .filter((row) => row.outcome === "superseded");
    expect(superseded).toHaveLength(1);
    expect(superseded[0].periodStart).toBe(TWO_DAYS_AGO);
    expect(superseded[0].deletedAt).toBeUndefined();
    expect(await listTasks(writer, OWNER, NOW)).toHaveLength(1);
  });

  it("journal: stack daily keeps all three periods open", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const recurrence = await createRecurrence(
      writer,
      OWNER,
      {
        behavior: "stack",
        cadence: "daily",
        timezone: TZ,
        title: "Journal",
        anchorOn: TWO_DAYS_AGO,
      },
      NOW,
    );

    await reconcileRecurrence(writer, recurrence, NOW);

    const open = openTasks(db).sort(
      (a, b) => (a.periodStart ?? 0) - (b.periodStart ?? 0),
    );
    expect(open).toHaveLength(3);
    expect(open.map((row) => row.periodStart)).toEqual([
      TWO_DAYS_AGO,
      TWO_DAYS_AGO + 86_400_000,
      TWO_DAYS_AGO + 2 * 86_400_000,
    ]);
    expect(db.all("tasks").some((row) => row.outcome !== undefined)).toBe(false);
  });

  it("a second reconcile mints nothing and changes nothing", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const recurrence = await createRecurrence(
      writer,
      OWNER,
      {
        behavior: "stack",
        cadence: "daily",
        timezone: TZ,
        title: "Journal",
        anchorOn: TWO_DAYS_AGO,
      },
      NOW,
    );
    await reconcileRecurrence(writer, recurrence, NOW);
    const before = JSON.stringify(db.all("tasks"));

    await reconcileRecurrence(writer, recurrence, NOW);

    expect(JSON.stringify(db.all("tasks"))).toBe(before);
    expect(db.all("tasks")).toHaveLength(3);
  });

  it("weekly periods start on Monday in the series timezone", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const midweek = civilDayStart(Date.UTC(2026, 0, 8, 9, 0), TZ);
    const recurrence = await createRecurrence(
      writer,
      OWNER,
      {
        behavior: "stack",
        cadence: "weekly",
        timezone: TZ,
        title: "Weekly review",
        anchorOn: midweek,
      },
      NOW,
    );

    await reconcileRecurrence(writer, recurrence, NOW);

    expect(recurrence.anchorOn).toBe(civilDayStart(Date.UTC(2026, 0, 5), TZ));
    expect(db.all("tasks")).toHaveLength(1);
    expect(db.all("tasks")[0].periodStart).toBe(recurrence.anchorOn);
  });

  it("behavior is required", async () => {
    const db = fakeDb();
    await expect(
      createRecurrence(db.asWriter(), OWNER, {
        behavior: "" as "replace",
        cadence: "daily",
        timezone: TZ,
        title: "Dishes",
        anchorOn: TWO_DAYS_AGO,
      }),
    ).rejects.toThrow("Invalid behavior");
  });
});

describe("task invariants with the new tables", () => {
  it("a dueAt-only create leaves deadlineAt unset", async () => {
    const db = fakeDb();
    const created = await createTask(db.asWriter(), OWNER, {
      title: "Water the plants",
      dueAt: TWO_DAYS_AGO,
    });
    expect(created.dueAt).toBe(TWO_DAYS_AGO);
    expect(created.plannedOn).toBe(TWO_DAYS_AGO);
    expect(created.deadlineAt).toBeUndefined();
    expect(db.all("tasks")[0].deadlineAt).toBeUndefined();
  });

  it("soft delete keeps the row", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const created = await createTask(writer, OWNER, { title: "Old" });
    await deleteTask(writer, OWNER, created.id);

    expect(db.all("tasks")).toHaveLength(1);
    expect(db.all("tasks")[0].deletedAt).toBeDefined();
    expect(await listTasks(writer, OWNER)).toHaveLength(0);
  });

  it("retire becomes missed, not trash; escalate bumps once", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const past = NOW - 86_400_000;
    const retired = await createTask(writer, OWNER, {
      title: "Market weekend",
      deadlineAt: past,
      overduePolicy: "retire",
    });
    const escalated = await createTask(writer, OWNER, {
      title: "File taxes",
      deadlineAt: past,
      overduePolicy: "escalate",
      priority: "high",
    });
    const custom = await createTask(writer, OWNER, {
      title: "Custom",
      deadlineAt: past,
      overduePolicy: "escalate",
      priority: "weird",
    });

    expect(await applyOverdue(writer, db.all("tasks")[0] as unknown as Doc<"tasks">, NOW)).toBe(true);
    expect(await applyOverdue(writer, db.all("tasks")[1] as unknown as Doc<"tasks">, NOW)).toBe(true);
    expect(await applyOverdue(writer, db.all("tasks")[2] as unknown as Doc<"tasks">, NOW)).toBe(false);
    expect(await applyOverdue(writer, db.all("tasks")[1] as unknown as Doc<"tasks">, NOW)).toBe(false);

    expect(db.all("tasks")[0].outcome).toBe("missed");
    expect(db.all("tasks")[0].deletedAt).toBeUndefined();
    expect(db.all("tasks")[1].priorityRank).toBe(30);
    expect(db.all("tasks")[1].escalatedAt).toBeDefined();
    expect(db.all("tasks")[2].priorityRank).toBe(10);
    expect(retired.title).toBe("Market weekend");
    expect(escalated.title).toBe("File taxes");
    expect(custom.title).toBe("Custom");
  });
});
