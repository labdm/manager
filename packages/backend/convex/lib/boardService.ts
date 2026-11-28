import type { DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  addPeriods,
  assertTimezone,
  civilDayStart,
  periodStartFor,
} from "./civilDates";
import {
  assertCanReadGroup,
  defaultGroupForUser,
  readableDocs,
  readableGroupIds,
  resolveGroupId,
} from "./groupService";
import { listTasks, syncRoutineDoneFlags, taskView, type TaskView } from "./taskService";
import { listResources, type ResourceView } from "./resourceService";
import { questViews, type QuestView } from "./questService";
import { ensureHome, ownerViews, viewSummary } from "./viewService";
import { listAlertHistory } from "./phase2Service";
import { reconcileOwner } from "./recurrenceService";
import { taskSection } from "./routinePeriod";

export type SliceTab = "tasks" | "daily" | "weekly" | "monthly" | "events";

const RHYTHMS = [
  { kind: "day", cadence: "daily", labels: ["Yesterday", "Today", "Tomorrow"] },
  { kind: "week", cadence: "weekly", labels: ["Last week", "This week", "Next week"] },
  { kind: "month", cadence: "monthly", labels: ["Last month", "This month", "Next month"] },
] as const;

const TAB_KINDS: Record<Exclude<SliceTab, "tasks" | "events">, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export async function ensureRhythmEvents(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  timezone: string,
  now: number,
  groupId?: Id<"spaces">,
): Promise<Doc<"events">[]> {
  const group = await resolveGroupId(db, ownerId, groupId);
  const existing = await db
    .query("events")
    .withIndex("by_group", (q) => q.eq("groupId", group))
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
        groupId: group,
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

export type AlertView = {
  id: string;
  title: string;
  body: string;
  kind: Doc<"alerts">["kind"];
  authorOrigin: Doc<"alerts">["authorOrigin"];
  seenAt?: number;
};

export type QuestionView = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
};

export type BoardSlice = {
  rail: { id: string; title: string; icon: string | null; color: string | null; kind: string }[];
  activeViewId: string;
  tab: SliceTab;
  activeEventId: string | null;
  unseen: Record<SliceTab, number>;
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
  /** An omitted group id reads across every group the caller belongs to. */
  groupId?: Id<"spaces">;
  /** The named event selected for the Events chip. */
  eventId?: Id<"events">;
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

function isUnseen(task: TaskView): boolean {
  return (
    task.seenAt === undefined &&
    (task.origin === "agent" || task.origin === "member")
  );
}

function unseenCount(tasks: TaskView[]): number {
  return tasks.filter(isUnseen).length;
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
    input.tab !== "monthly" &&
    input.tab !== "events"
  ) {
    throw new Error("Invalid tab");
  }

  const selectedGroup = input.groupId
    ? await resolveGroupId(db, ownerId, input.groupId)
    : undefined;
  if (selectedGroup) await assertCanReadGroup(db, ownerId, selectedGroup);
  const homeGroup = await defaultGroupForUser(db, ownerId);

  await reconcileOwner(db, ownerId, now);
  await syncRoutineDoneFlags(db, ownerId, now);
  const home = await ensureHome(db, ownerId, homeGroup._id);
  const allViews = await ownerViews(db, ownerId);
  const views = selectedGroup
    ? allViews.filter((view) => view.groupId === selectedGroup)
    : allViews;
  const events = await ensureRhythmEvents(
    db,
    ownerId,
    input.timezone,
    now,
    homeGroup._id,
  );

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
  if (selectedGroup) {
    tasks = tasks.filter((task) => task.groupId === selectedGroup);
  }
  const recurrenceDocs = await readableDocs(db, ownerId, "recurrences");
  const cadenceOf = new Map(
    recurrenceDocs
      .filter((row) => row.deletedAt === undefined)
      .map((row) => [String(row._id), row.cadence]),
  );
  const sectionOf = (task: TaskView) =>
    taskSection(
      task,
      task.recurrenceId ? cadenceOf.get(String(task.recurrenceId)) : undefined,
    );
  const today = civilDayStart(now, input.timezone);

  const namedEvents = (await readableDocs(db, ownerId, "events"))
    .filter(
      (event) =>
        event.deletedAt === undefined &&
        event.kind !== "day" &&
        event.kind !== "week" &&
        event.kind !== "month" &&
        (!selectedGroup || event.groupId === selectedGroup),
    )
    .sort((a, b) => a.startsAt - b.startsAt);
  const activeEvent =
    input.eventId !== undefined
      ? namedEvents.find((event) => event._id === input.eventId)
      : namedEvents.find(
          (event) => event.startsAt <= now && now < event.endsAt,
        ) ?? null;

  const baseTasks = tasks;
  const inPeriod = (task: TaskView, kind: string): boolean => {
    const period = events.find(
      (event) => event.kind === kind && event.startsAt <= now && now < event.endsAt,
    );
    if (!period) return false;
    return (
      (task.plannedOn !== undefined &&
        task.plannedOn >= period.startsAt &&
        task.plannedOn < period.endsAt) ||
      attached(
        attachments,
        "task",
        String(task.id),
        "event",
        String(period._id),
      )
    );
  };
  const onRhythm = (task: TaskView, tab: "daily" | "weekly" | "monthly") =>
    inPeriod(task, TAB_KINDS[tab]) || sectionOf(task) === tab;
  const unseen: Record<SliceTab, number> = {
    tasks: 0,
    daily: unseenCount(baseTasks.filter((task) => onRhythm(task, "daily"))),
    weekly: unseenCount(baseTasks.filter((task) => onRhythm(task, "weekly"))),
    monthly: unseenCount(baseTasks.filter((task) => onRhythm(task, "monthly"))),
    events: 0,
  };

  if (input.tab === "events") {
    tasks = activeEvent
      ? tasks.filter((task) =>
          attached(
            attachments,
            "task",
            String(task.id),
            "event",
            String(activeEvent._id),
          ),
        )
      : [];
    unseen.events = unseenCount(tasks);
  } else if (input.tab === "tasks") {
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
    } else {
      // Home is the Quests board: non-repeating tasks. Routines live on their own tabs.
      tasks = tasks.filter((task) => sectionOf(task) === "quests");
    }
    unseen.tasks = unseenCount(tasks);
  } else if (input.tab === "daily" || input.tab === "weekly" || input.tab === "monthly") {
    const tab = input.tab;
    tasks = tasks.filter((task) => onRhythm(task, tab));
    unseen[tab] = unseenCount(tasks);
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
  const readable = await readableGroupIds(db, ownerId);
  const present = new Set(tasks.map((task) => String(task.id)));
  for (const row of included) {
    if (present.has(row.subjectId)) continue;
    const task = await db.get(row.subjectId as Id<"tasks">);
    if (
      !task ||
      task.deletedAt !== undefined ||
      task.done ||
      task.outcome !== undefined ||
      !readable.has(String(task.groupId)) ||
      (selectedGroup && String(task.groupId) !== String(selectedGroup))
    ) {
      continue;
    }
    tasks.push(taskView(task, now));
    present.add(row.subjectId);
  }

  unseen[input.tab] = unseenCount(tasks);

  const boardTasks = tasks
    .map((task) => ({
      ...task,
      pinned: pinned(pins, "task", String(task.id)),
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const inGroup = <T extends { groupId: Id<"spaces"> }>(rows: T[]): T[] =>
    selectedGroup
      ? rows.filter((row) => row.groupId === selectedGroup)
      : rows;

  const [progressionDocs, ownerTasks, resources] = await Promise.all([
    readableDocs(db, ownerId, "progressions"),
    readableDocs(db, ownerId, "tasks"),
    listResources(db, ownerId),
  ]);
  const doneTaskIds = new Set(
    inGroup(ownerTasks)
      .filter((task) => task.done && task.deletedAt === undefined)
      .map((task) => String(task._id)),
  );
  const progressions: ProgressionView[] = inGroup(progressionDocs)
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
    listAlertHistory(db, ownerId),
    readableDocs(db, ownerId, "questions"),
  ]);

  const viewer = await db.get(ownerId);
  const activityOnTasks = viewer?.activityOnTasks ?? "others";
  const boardAlerts = inGroup(alertDocs).filter((row) => {
    if (row.deletedAt !== undefined) return false;
    if (row.kind === "activity") {
      if (activityOnTasks === "none") return false;
      if (activityOnTasks === "others") return row.authorOrigin !== "self";
      return true;
    }
    // Notes keep the existing NEW contract: unseen, authored by an agent/member.
    return (
      row.seenAt === undefined &&
      (row.authorOrigin === "agent" || row.authorOrigin === "member")
    );
  });
  const alerts: AlertView[] = boardAlerts.map((row) => ({
    id: String(row._id),
    title: row.title,
    body: row.body ?? "",
    kind: row.kind,
    authorOrigin: row.authorOrigin,
    seenAt: row.seenAt,
  }));

  const questions: QuestionView[] = inGroup(questionDocs)
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
    activeEventId: activeEvent ? String(activeEvent._id) : null,
    unseen,
    tasks: boardTasks,
    resources: inGroup(resources),
    progressions,
    quests,
    alerts,
    questions,
  };
}
