import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { civilDayStart } from "../convex/lib/civilDates";
import {
  createRecurrence,
  reconcileRecurrence,
} from "../convex/lib/recurrenceService";
import {
  createResource,
  setTaskResourceEffect,
} from "../convex/lib/resourceService";
import {
  createTask,
  listTasks,
  setTaskDone,
  updateTask,
} from "../convex/lib/taskService";
import { fakeDb } from "./fakeDb";

const OWNER = "user_1" as Id<"users">;
const TZ = "UTC";
const ANCHOR = civilDayStart(Date.UTC(2026, 0, 1), TZ);

function resourceRows(db: ReturnType<typeof fakeDb>): Doc<"resources">[] {
  return db.all("resources") as unknown as Doc<"resources">[];
}

function alertRows(db: ReturnType<typeof fakeDb>): Doc<"alerts">[] {
  return db.all("alerts") as unknown as Doc<"alerts">[];
}

describe("task resource effects", () => {
  it("completion applies -1 once and reopening puts stock back", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const resource = await createResource(
      writer,
      OWNER,
      { title: "Milk", unit: "bottle", quantity: 3, lowAt: 1 },
      ANCHOR,
    );
    const task = await createTask(writer, OWNER, { title: "Drink milk" });
    await setTaskResourceEffect(writer, OWNER, task.id, resource.id, -1, ANCHOR);

    expect(resourceRows(db)[0].quantity).toBe(3);

    await setTaskDone(writer, OWNER, task.id, true);
    expect(resourceRows(db)[0].quantity).toBe(2);
    expect((await listTasks(writer, OWNER))[0].resourceEffect).toEqual({
      resourceId: resource.id,
      delta: -1,
    });

    await setTaskDone(writer, OWNER, task.id, false);
    expect(resourceRows(db)[0].quantity).toBe(3);

    await setTaskDone(writer, OWNER, task.id, true);
    expect(resourceRows(db)[0].quantity).toBe(2);
    // A retried completion must not apply the delta again.
    await setTaskDone(writer, OWNER, task.id, true);
    expect(resourceRows(db)[0].quantity).toBe(2);
  });

  it("low stock raises one unread resource alert and no task", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const resource = await createResource(
      writer,
      OWNER,
      { title: "Coffee", unit: "bag", quantity: 2, lowAt: 1 },
      ANCHOR,
    );
    const task = await createTask(writer, OWNER, { title: "Brew coffee" });
    await setTaskResourceEffect(writer, OWNER, task.id, resource.id, -1, ANCHOR);

    await setTaskDone(writer, OWNER, task.id, true);

    expect(resourceRows(db)[0].quantity).toBe(1);
    expect(db.all("tasks")).toHaveLength(1);
    const alerts = alertRows(db);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].source).toBe(resource.id);
    expect(alerts[0].resourceId).toBe(resource.id);
    expect(alerts[0].seenAt).toBeUndefined();
    expect(alerts[0].title).toContain("Coffee");

    await setTaskDone(writer, OWNER, task.id, true);
    expect(alertRows(db)).toHaveLength(1);

    await setTaskDone(writer, OWNER, task.id, false);
    expect(resourceRows(db)[0].quantity).toBe(2);
    expect(alertRows(db)[0].seenAt).toBeDefined();
  });
});

describe("biweekly cadence", () => {
  it("a stack series mints on the 14th day from anchorOn", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const recurrence = await createRecurrence(
      writer,
      OWNER,
      {
        behavior: "stack",
        cadence: "biweekly",
        timezone: TZ,
        title: "Pay bills",
        anchorOn: ANCHOR,
      },
      ANCHOR,
    );

    expect(recurrence.cadence).toBe("biweekly");
    expect(db.all("tasks")).toHaveLength(1);

    await reconcileRecurrence(writer, recurrence, ANCHOR + 13 * 86_400_000);
    expect(db.all("tasks")).toHaveLength(1);

    const day14 = ANCHOR + 14 * 86_400_000;
    await reconcileRecurrence(writer, recurrence, day14);

    const periods = db
      .all("tasks")
      .map((row) => row.periodStart as number)
      .sort((a, b) => a - b);
    expect(periods).toEqual([ANCHOR, day14]);
  });
});

describe("presentation", () => {
  it("round-trips through create and update without clearing on a blank string", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const card = await createTask(writer, OWNER, {
      title: "Card task",
      presentation: "card",
    });
    expect(card.presentation).toBe("card");
    expect((await listTasks(writer, OWNER))[0].presentation).toBe("card");

    await updateTask(writer, OWNER, card.id, { presentation: "row" });
    expect((await listTasks(writer, OWNER))[0].presentation).toBe("row");

    await updateTask(writer, OWNER, card.id, { presentation: "  " });
    expect((await listTasks(writer, OWNER))[0].presentation).toBe("row");

    const plain = await createTask(writer, OWNER, { title: "Plain task" });
    expect(plain.presentation).toBe("check");
  });

  it("copies presentation and one resource effect from a recurrence template", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const resource = await createResource(
      writer,
      OWNER,
      { title: "Flour", quantity: 5 },
      ANCHOR,
    );
    const recurrence = await createRecurrence(
      writer,
      OWNER,
      {
        behavior: "replace",
        cadence: "weekly",
        timezone: TZ,
        title: "Bake bread",
        presentation: "card",
        resourceEffect: { resourceId: resource.id, delta: -1 },
        anchorOn: ANCHOR,
      },
      ANCHOR,
    );

    expect(recurrence.presentation).toBe("card");
    expect(recurrence.resourceEffect).toEqual({ resourceId: resource.id, delta: -1 });
    const minted = (await listTasks(writer, OWNER))[0];
    expect(minted.presentation).toBe("card");
    expect(minted.resourceEffect).toEqual({ resourceId: resource.id, delta: -1 });
    expect(db.all("taskResourceEffects")).toHaveLength(1);
  });
});
