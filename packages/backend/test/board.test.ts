import { describe, expect, it } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import { boardSlice } from "../convex/lib/boardService";
import { civilDayStart } from "../convex/lib/civilDates";
import { attach, clearOverride, detach, pin, setOverride } from "../convex/lib/linkService";
import {
  addQuestStep,
  answerQuestion,
  createAlert,
  createProgression,
  createQuestion,
  createQuest,
  logProgress,
} from "../convex/lib/phase2Service";
import { createTask, setTaskDone } from "../convex/lib/taskService";
import {
  enableComputedView,
  ensureHome,
  installTemplate,
  removeView,
} from "../convex/lib/viewService";
import { fakeDb, seedUser } from "./fakeDb";

const OWNER = "user_1" as Id<"users">;
const TZ = "Europe/Berlin";
const NOW = Date.UTC(2026, 5, 10, 10, 0);
const TODAY = civilDayStart(NOW, TZ);

function slice(db: ReturnType<typeof fakeDb>, tab: "tasks" | "daily" | "weekly" | "monthly" = "tasks", viewId?: Id<"views">) {
  return boardSlice(
    db.asWriter(),
    OWNER,
    { tab, viewId, timezone: TZ },
    NOW,
  );
}

describe("Home shell", () => {
  it("ensures Home and previous/current/next day, week and month events", async () => {
    const db = fakeDb();
    await seedUser(db, OWNER);
    const result = await slice(db);

    expect(result.rail).toEqual([
      { id: expect.any(String), title: "Home", icon: "house", color: "sky", kind: "home" },
    ]);
    expect(db.all("views")).toHaveLength(1);
    expect(db.all("events")).toHaveLength(9);
    expect(new Set(db.all("events").map((row) => row.kind))).toEqual(
      new Set(["day", "week", "month"]),
    );
    expect(result.activeViewId).toBe(String(db.all("views")[0]._id));
    expect(result.tab).toBe("tasks");
    expect(result.tasks).toEqual([]);
    expect(result.progressions).toEqual([]);
    expect(result.quests).toEqual([]);
    expect(result.alerts).toEqual([]);
    expect(result.questions).toEqual([]);

    await expect(
      removeView(db.asWriter(), OWNER, db.all("views")[0]._id as Id<"views">),
    ).rejects.toThrow("Home cannot be deleted");
  });

  it("installs each template once and filters by its category", async () => {
    const db = fakeDb();
    await seedUser(db, OWNER);
    const writer = db.asWriter();
    const home = await ensureHome(writer, OWNER);
    const view = await installTemplate(writer, OWNER, "household");
    const again = await installTemplate(writer, OWNER, "household");

    expect(again._id).toBe(view._id);
    expect(db.all("categories")).toHaveLength(1);
    expect(view.title).toBe("Household");
    expect(view.kind).toBe("template");

    await createTask(writer, OWNER, { title: "Mine" });
    const dishes = await createTask(writer, OWNER, { title: "Dishes" });
    const link = await attach(writer, OWNER, {
      subjectType: "task",
      subjectId: String(dishes.id),
      targetType: "category",
      targetId: String(view.categoryId),
      role: "primary",
    });

    expect((await slice(db, "tasks", view._id)).tasks.map((task) => task.title)).toEqual([
      "Dishes",
    ]);
    await detach(writer, OWNER, link._id);
    expect(await slice(db, "tasks", view._id)).toMatchObject({ tasks: [] });
    expect((await slice(db)).tasks.map((task) => task.title)).toEqual([
      "Dishes",
      "Mine",
    ]);
    expect(home.title).toBe("Home");
  });

  it("seeds computed views and applies include/exclude", async () => {
    const db = fakeDb();
    await seedUser(db, OWNER);
    const writer = db.asWriter();
    const fresh = await enableComputedView(writer, OWNER, "new");
    const high = await enableComputedView(writer, OWNER, "high");
    const today = await enableComputedView(writer, OWNER, "today");

    expect([fresh.icon, high.icon, today.icon]).toEqual(["sparkles", "flame", "sun"]);
    expect((await enableComputedView(writer, OWNER, "new"))._id).toBe(fresh._id);

    await createTask(writer, OWNER, { title: "From agent", origin: "agent" });
    await createTask(writer, OWNER, { title: "Mine" });
    await createTask(writer, OWNER, { title: "Important", priority: "high" });
    const planned = await createTask(writer, OWNER, {
      title: "Planned today",
      plannedOn: TODAY,
    });

    expect((await slice(db, "tasks", fresh._id)).tasks.map((task) => task.title)).toEqual([
      "From agent",
    ]);
    expect((await slice(db, "tasks", high._id)).tasks.map((task) => task.title)).toEqual([
      "Important",
    ]);
    expect((await slice(db, "tasks", today._id)).tasks.map((task) => task.title)).toEqual([
      "Planned today",
    ]);

    await setOverride(writer, OWNER, {
      viewId: today._id,
      subjectType: "task",
      subjectId: String(planned.id),
      mode: "exclude",
    });
    expect((await slice(db, "tasks", today._id)).tasks).toEqual([]);

    await setOverride(writer, OWNER, {
      viewId: today._id,
      subjectType: "task",
      subjectId: String(planned.id),
      mode: "include",
    });
    expect((await slice(db, "tasks", today._id)).tasks.map((task) => task.title)).toEqual([
      "Planned today",
    ]);

    await clearOverride(writer, OWNER, {
      viewId: today._id,
      subjectType: "task",
      subjectId: String(planned.id),
    });
    expect((await slice(db, "tasks", today._id)).tasks.map((task) => task.title)).toEqual([
      "Planned today",
    ]);
  });

  it("sorts pinned tasks first and includes period tasks on rhythm tabs", async () => {
    const db = fakeDb();
    await seedUser(db, OWNER);
    const writer = db.asWriter();
    const home = await ensureHome(writer, OWNER);
    await createTask(writer, OWNER, { title: "First" });
    const second = await createTask(writer, OWNER, { title: "Second" });
    await pin(writer, OWNER, {
      viewId: home._id,
      subjectType: "task",
      subjectId: String(second.id),
    });

    expect((await slice(db)).tasks.map((task) => task.title)).toEqual([
      "Second",
      "First",
    ]);

    const dayEvent = db
      .all("events")
      .find((row) => row.kind === "day" && row.startsAt === TODAY);
    expect(dayEvent).toBeDefined();
    const byAttachment = await createTask(writer, OWNER, { title: "Attached to day" });
    await attach(writer, OWNER, {
      subjectType: "task",
      subjectId: String(byAttachment.id),
      targetType: "event",
      targetId: String(dayEvent!._id),
    });

    const daily = await slice(db, "daily");
    expect(daily.tab).toBe("daily");
    expect(daily.tasks.map((task) => task.title)).toContain("Attached to day");
    expect(daily.tasks.map((task) => task.title)).not.toContain("First");
    await createTask(writer, OWNER, { title: "This week", plannedOn: NOW });
    const weekly = await slice(db, "weekly");
    expect(weekly.tasks.map((task) => task.title)).toContain("This week");
    expect(weekly.tasks.map((task) => task.title)).not.toContain("First");
  });

  it("renders progressions, unlocks quest steps, and drains alerts/questions", async () => {
    const db = fakeDb();
    await seedUser(db, OWNER);
    const writer = db.asWriter();
    const meter = await createProgression(writer, OWNER, {
      title: "Read one book",
      mode: "meter",
      target: 300,
      unit: "page",
    });
    await logProgress(writer, OWNER, { progressionId: meter._id, amount: 20 });
    const steps = await createProgression(writer, OWNER, {
      title: "Train this month",
      mode: "steps",
      target: 12,
    });
    const trainingTask = await createTask(writer, OWNER, { title: "Train" });
    await attach(writer, OWNER, {
      subjectType: "task",
      subjectId: String(trainingTask.id),
      targetType: "progression",
      targetId: String(steps._id),
    });
    await setTaskDone(writer, OWNER, trainingTask.id, true);

    const quest = await createQuest(writer, OWNER, { title: "Broken window" });
    const call = await createTask(writer, OWNER, { title: "Call the landlord" });
    const buy = await createTask(writer, OWNER, { title: "Buy glass" });
    await addQuestStep(writer, OWNER, { questId: quest._id, taskId: call.id });
    await addQuestStep(writer, OWNER, { questId: quest._id, taskId: buy.id });

    await createAlert(writer, OWNER, { title: "Flight is Thursday", body: "Gate B" });
    const question = await createQuestion(writer, OWNER, {
      prompt: "How to fix the window?",
      options: [{ id: "glass", label: "Buy glass", effect: { createTaskTitle: "Order glass" } }],
    });

    const before = await slice(db);
    expect(before.progressions).toEqual([
      { id: String(meter._id), title: "Read one book", mode: "meter", current: 20, target: 300, unit: "page" },
      { id: String(steps._id), title: "Train this month", mode: "steps", current: 1, target: 12, unit: "step" },
    ]);
    expect(before.quests[0].steps.map((step) => step.gate)).toEqual(["available", "locked"]);
    expect(before.quests[0].waiting).toBe(false);
    expect(before.alerts).toEqual([
      {
        id: expect.any(String),
        title: "Flight is Thursday",
        body: "Gate B",
        kind: "note",
        authorOrigin: "agent",
        seenAt: undefined,
      },
    ]);
    expect(before.questions[0].options).toEqual([{ id: "glass", label: "Buy glass" }]);

    await setTaskDone(writer, OWNER, call.id, true);
    expect((await slice(db)).quests[0].steps.map((step) => step.gate)).toEqual([
      "available",
      "available",
    ]);

    await answerQuestion(writer, OWNER, { questionId: question._id, optionId: "glass" });
    const after = await slice(db);
    expect(after.questions).toEqual([]);
    expect(after.tasks.map((task) => task.title)).toContain("Order glass");
  });

  it("Home stays unique across repeated slices", async () => {
    const db = fakeDb();
    await seedUser(db, OWNER);
    await slice(db);
    await slice(db);
    await slice(db, "daily");
    expect(db.all("views")).toHaveLength(1);
  });
});
