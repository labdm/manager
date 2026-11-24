import type { DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  addPeriods,
  assertTimezone,
  civilDayStart,
  periodStartFor,
} from "./civilDates";
import { listTasks, taskView, type TaskView } from "./taskService";
import { listResources, type ResourceView } from "./resourceService";
import { questViews, type QuestView } from "./questService";
import { ensureHome, ownerViews, viewSummary } from "./viewService";
import { reconcileOwner } from "./recurrenceService";

export type SliceTab = "tasks" | "daily" | "weekly" | "monthly";

const RHYTHMS = [
  { kind: "day", cadence: "daily", labels: ["Yesterday", "Today", "Tomorrow"] },
  { kind: "week", cadence: "weekly", labels: ["Last week", "This week", "Next week"] },
  { kind: "month", cadence: "monthly", labels: ["Last month", "This month", "Next month"] },
] as const;

const TAB_KINDS: Record<Exclude<SliceTab, "tasks">, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export async function ensureRhythmEvents(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  timezone: string,
  now: number,
): Promise<Doc<"events">[]> {
  const existing = await db
    .query("events")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const live = existing.filter((event) => event.deletedAt === undefined);
  const created: Doc<"events">[] = [];

  for (const rhythm of RHYTHMS) {
    const current = periodStartFor(rhythm.cadence, now, timezone);
    for (const offset of [-1, 0, 1] as const) {
      const startsAt = addPeriods(rhythm.cadence, current, offset, timezone);
      const endsAt = addPeriods(rhythm.cadence, startsAt, 1, timezone);
      const found = live.find(
        (event) =>
          event.kind === rhythm.kind && event.startsAt === startsAt,
      );
      if (found) {
        created.push(found);
        continue;
      }
      const id = await db.insert("events", {
        ownerId,
        title: rhythm.labels[offset + 1],
        kind: rhythm.kind,
        startsAt,
        endsAt,
        deletedAt: undefined,
      });
      const event = await db.get(id);
      if (!event) throw new Error("Event not found");
      live.push(event);
      created.push(event);
    }
  }
  return created;
}

export type ProgressionView = {
  id: string;
  title: string;
  mode: "meter" | "steps";
  current: number;
  target: number;
  unit: string;
};

export type AlertView = { id: string; title: string; body: string };

export type QuestionView = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
};

export type BoardSlice = {
  rail: { id: string; title: string; icon: string | null; color: string | null; kind: string }[];
  activeViewId: string;
  tab: SliceTab;
  tasks: Array<TaskView & { pinned: boolean }>;
  resources: ResourceView[];
  progressions: ProgressionView[];
  quests: QuestView[];
  alerts: AlertView[];
  questions: QuestionView[];
};

export type SliceInput = {
  tab: SliceTab;
  viewId?: Id<"views">;
  timezone: string;
};

function attached(
  attachments: Doc<"attachments">[],
  subjectType: string,
  subjectId: string,
  targetType: string,
  targetId: string,
): boolean {
  return attachments.some(
    (row) =>
      row.subjectType === subjectType &&
      row.subjectId === subjectId &&
      row.targetType === targetType &&
      row.targetId === targetId,
  );
}

function pinned(
  pins: Doc<"viewPins">[],
  subjectType: string,
  subjectId: string,
): boolean {
  return pins.some(
    (pin) => pin.subjectType === subjectType && pin.subjectId === subjectId,
  );
}

export async function boardSlice(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: SliceInput,
  now = Date.now(),
): Promise<BoardSlice> {
  assertTimezone(input.timezone);
  if (
    input.tab !== "tasks" &&
    input.tab !== "daily" &&
    input.tab !== "weekly" &&
    input.tab !== "monthly"
  ) {
    throw new Error("Invalid tab");
  }

  await reconcileOwner(db, ownerId, now);
  const home = await ensureHome(db, ownerId);
  const views = await ownerViews(db, ownerId);
  const events = await ensureRhythmEvents(db, ownerId, input.timezone, now);

  const activeView =
    (input.viewId && views.find((view) => view._id === input.viewId)) || home;
  const rail = [home, ...views.filter((view) => view._id !== home._id)].map(
    viewSummary,
  );

  const [allAttachments, allPins, allOverrides] = await Promise.all([
    db
      .query("attachments")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
    db
      .query("viewPins")
      .withIndex("by_owner_view", (q) =>
        q.eq("ownerId", ownerId).eq("viewId", activeView._id),
      )
      .collect(),
    db
      .query("viewOverrides")
      .withIndex("by_owner_view", (q) =>
        q.eq("ownerId", ownerId).eq("viewId", activeView._id),
      )
      .collect(),
  ]);
  const attachments = allAttachments.filter((row) => row.deletedAt === undefined);
  const pins = allPins.filter((row) => row.deletedAt === undefined);
  const overrides = allOverrides.filter((row) => row.deletedAt === undefined);

  let tasks = await listTasks(db, ownerId, now);
  const today = civilDayStart(now, input.timezone);

  if (input.tab === "tasks") {
    if (activeView.kind === "template" && activeView.categoryId) {
      tasks = tasks.filter((task) =>
        attached(
          attachments,
          "task",
          String(task.id),
          "category",
          String(activeView.categoryId),
        ),
      );
    } else if (activeView.kind === "computed") {
      if (activeView.computedKey === "new") {
        tasks = tasks.filter(
          (task) =>
            (task.origin === "agent" || task.origin === "member") &&
            task.seenAt === undefined,
        );
      } else if (activeView.computedKey === "high") {
        tasks = tasks.filter((task) => task.effectiveRank >= 20);
      } else if (activeView.computedKey === "today") {
        const dayEvent = events.find(
          (event) => event.kind === "day" && event.startsAt === today,
        );
        tasks = tasks.filter(
          (task) =>
            task.plannedOn === today ||
            (dayEvent !== undefined &&
              attached(
                attachments,
                "task",
                String(task.id),
                "event",
                String(dayEvent._id),
              )),
        );
      }
    } else if (activeView.kind === "custom") {
      tasks = tasks.filter(
        (task) =>
          pins.some(
            (pin) => pin.subjectType === "task" && pin.subjectId === String(task.id),
          ) ||
          overrides.some(
            (row) =>
              row.mode === "include" &&
              row.subjectType === "task" &&
              row.subjectId === String(task.id),
          ),
      );
    }
  } else {
    const kind = TAB_KINDS[input.tab];
    const period = events.find(
      (event) =>
        event.kind === kind && event.startsAt <= now && now < event.endsAt,
    );
    tasks = tasks.filter((task) => {
      const inPeriod =
        task.plannedOn !== undefined &&
        period !== undefined &&
        task.plannedOn >= period.startsAt &&
        task.plannedOn < period.endsAt;
      const byAttachment =
        period !== undefined &&
        attached(
          attachments,
          "task",
          String(task.id),
          "event",
          String(period._id),
        );
      return inPeriod || byAttachment;
    });
  }

  const excluded = new Set(
    overrides
      .filter((row) => row.mode === "exclude" && row.subjectType === "task")
      .map((row) => row.subjectId),
  );
  tasks = tasks.filter((task) => !excluded.has(String(task.id)));

  const included = overrides.filter(
    (row) => row.mode === "include" && row.subjectType === "task",
  );
  const present = new Set(tasks.map((task) => String(task.id)));
  for (const row of included) {
    if (present.has(row.subjectId)) continue;
    const task = await db.get(row.subjectId as Id<"tasks">);
    if (!task || task.deletedAt !== undefined || task.done || task.outcome !== undefined) {
      continue;
    }
    tasks.push(taskView(task, now));
    present.add(row.subjectId);
  }

  const boardTasks = tasks
    .map((task) => ({
      ...task,
      pinned: pinned(pins, "task", String(task.id)),
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const [progressionDocs, ownerTasks, resources] = await Promise.all([
    db
      .query("progressions")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
    db
      .query("tasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
    listResources(db, ownerId),
  ]);
  const doneTaskIds = new Set(
    ownerTasks
      .filter((task) => task.done && task.deletedAt === undefined)
      .map((task) => String(task._id)),
  );
  const progressions: ProgressionView[] = progressionDocs
    .filter((row) => row.deletedAt === undefined)
    .map((row) => {
      let current = row.current;
      if (row.mode === "steps") {
        current = attachments.filter(
          (link) =>
            link.subjectType === "task" &&
            link.targetType === "progression" &&
            link.targetId === String(row._id) &&
            doneTaskIds.has(link.subjectId),
        ).length;
      }
      return {
        id: String(row._id),
        title: row.title,
        mode: row.mode === "steps" ? "steps" : "meter",
        current,
        target: row.target,
        unit: row.unit,
      };
    });

  const [quests, alertDocs, questionDocs] = await Promise.all([
    questViews(db, ownerId),
    db
      .query("alerts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
    db
      .query("questions")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
  ]);

  const alerts: AlertView[] = alertDocs
    .filter((row) => row.deletedAt === undefined && row.seenAt === undefined)
    .map((row) => ({
      id: String(row._id),
      title: row.title,
      body: row.body ?? "",
    }));

  const questions: QuestionView[] = questionDocs
    .filter((row) => row.deletedAt === undefined && row.answeredAt === undefined)
    .map((row) => ({
      id: String(row._id),
      prompt: row.prompt,
      options: row.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
    }));

  return {
    rail,
    activeViewId: String(activeView._id),
    tab: input.tab,
    tasks: boardTasks,
    resources,
    progressions,
    quests,
    alerts,
    questions,
  };
}
