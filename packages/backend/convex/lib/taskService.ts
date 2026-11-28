import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { unlockNextQuestStep } from "./questService";
import {
  applyTaskResourceEffects,
  reverseAppliedTaskEffects,
  setTaskResourceEffect,
  type ResourceEffect,
} from "./resourceService";
import {
  assertCanWriteGroup,
  readableDocs,
  readableGroupIds,
  resolveGroupId,
} from "./groupService";
import { fireStateRoutings, stateRevision } from "./routingService";
import {
  DEFAULT_TIMEZONE,
  nextReminderAt,
  periodId,
  readRoutine,
  resetHint,
  sectionForRoutine,
  streakFor,
  type Routine,
  type Section,
} from "./routinePeriod";
import {
  assertEpoch,
  assertOrigin,
  assertPlannedTime,
  isSeedPriority,
  normalizeOverduePolicy,
  normalizePresentation,
  normalizeTitle,
  resolvePlannedDates,
  resolvePriorityAndRank,
} from "./taskFields";

export type TaskView = {
  id: Id<"tasks">;
  title: string;
  done: boolean;
  dueAt: number | null;
  ownerId: Id<"users">;
  groupId: Id<"spaces">;
  deletedAt?: number;
  completedAt?: number;
  notes?: string;
  plannedOn?: number;
  plannedTime?: number;
  location?: string;
  deadlineAt?: number;
  remindAt?: number;
  priority: string;
  priorityRank: number;
  overduePolicy: string;
  outcome?: string;
  seenAt?: number;
  origin: string;
  effectiveRank: number;
  overdue: boolean;
  recurrenceId?: Id<"recurrences">;
  periodStart?: number;
  presentationHint?: string;
  presentation: "check" | "row" | "card";
  resourceEffect: ResourceEffect | null;
  open?: boolean;
  escalatedAt?: number;
  routineKind: Routine["kind"];
  intervalEvery?: number;
  intervalUnit?: Routine["unit"];
  routineTimezone?: string;
  waiting: boolean;
  waitingReason?: string;
  remindMinutes?: number;
  section: Section;
  streak: number;
  periodId?: string;
  resetHint: string | null;
};

export function taskView(task: Doc<"tasks">, now = Date.now()): TaskView {
  const isOverdue =
    task.deadlineAt !== undefined &&
    task.deadlineAt < now &&
    !task.done &&
    task.deletedAt === undefined;

  const priority = task.priority ?? "normal";
  const priorityRank = task.priorityRank ?? 10;
  const overduePolicy = task.overduePolicy ?? "none";
  const origin = task.origin ?? "self";
  const routine = readRoutine(task);

  // The cron may already have persisted the bump. Never add it twice.
  const effectiveRank =
    isOverdue &&
    isSeedPriority(priority) &&
    overduePolicy === "escalate" &&
    task.escalatedAt === undefined
      ? Math.min(priorityRank + 10, 30)
      : priorityRank;

  return {
    id: task._id,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt ?? null,
    ownerId: task.ownerId,
    groupId: task.groupId,
    deletedAt: task.deletedAt,
    completedAt: task.completedAt,
    notes: task.notes,
    plannedOn: task.plannedOn,
    plannedTime: task.plannedTime,
    location: task.location,
    deadlineAt: task.deadlineAt,
    remindAt: task.remindAt,
    priority,
    priorityRank,
    overduePolicy,
    outcome: task.outcome,
    seenAt: task.seenAt,
    origin,
    effectiveRank,
    overdue: isOverdue,
    recurrenceId: task.recurrenceId,
    periodStart: task.periodStart,
    presentationHint: task.presentationHint,
    presentation: normalizePresentation(task.presentation) ?? "check",
    resourceEffect: task.resourceEffect ?? null,
    open: task.open,
    escalatedAt: task.escalatedAt,
    routineKind: routine.kind,
    intervalEvery: routine.every,
    intervalUnit: routine.unit,
    routineTimezone: task.routineTimezone,
    waiting: task.waiting === true,
    waitingReason: task.waitingReason,
    remindMinutes: task.remindMinutes,
    section: sectionForRoutine(routine),
    streak: 0,
    resetHint: resetHint(routine.kind),
  };
}

async function completionMap(
  db: DatabaseReader,
  ownerId: Id<"users">,
): Promise<Map<string, Set<string>>> {
  const rows = await db
    .query("taskCompletions")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = String(row.taskId);
    const set = map.get(key) ?? new Set<string>();
    set.add(row.periodId);
    map.set(key, set);
  }
  return map;
}

function presentTask(
  task: Doc<"tasks">,
  periods: ReadonlySet<string>,
  now: number,
): TaskView {
  const view = taskView(task, now);
  const routine = readRoutine(task);
  if (routine.kind === "none") return view;
  const zone = task.routineTimezone || DEFAULT_TIMEZONE;
  const current = periodId(routine, now, zone) ?? undefined;
  const done = current !== undefined && periods.has(current);
  return {
    ...view,
    done,
    overdue:
      task.deadlineAt !== undefined &&
      task.deadlineAt < now &&
      !done &&
      task.deletedAt === undefined,
    periodId: current,
    streak: streakFor(routine, periods, now, zone),
  };
}

async function periodsForTask(
  db: DatabaseReader,
  task: Doc<"tasks">,
): Promise<Set<string>> {
  const rows = await db
    .query("taskCompletions")
    .withIndex("by_task_period", (q) => q.eq("taskId", task._id))
    .collect();
  return new Set(rows.map((row) => row.periodId));
}

/** Writes the stored done flag to match the current period so other readers are not stuck. */
export async function syncRoutineDoneFlags(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  now = Date.now(),
): Promise<void> {
  const tasks = await readableDocs(db, ownerId, "tasks");
  const periods = await completionMap(db, ownerId);
  for (const task of tasks) {
    if (task.deletedAt !== undefined) continue;
    const routine = readRoutine(task);
    if (routine.kind === "none") continue;
    const current = periodId(routine, now, task.routineTimezone || DEFAULT_TIMEZONE);
    const done = current !== null && (periods.get(String(task._id))?.has(current) ?? false);
    if (task.done === done) continue;
    await db.patch(task._id, {
      done,
      completedAt: done ? (task.completedAt ?? now) : undefined,
    });
  }
}

/** Lists all tasks for a given user, sorted by pending first, then newest creation time. */
export async function listTasks(
  db: DatabaseReader,
  ownerId: Id<"users">,
  now = Date.now(),
): Promise<TaskView[]> {
  const tasks = await readableDocs(db, ownerId, "tasks");

  // Superseded and missed rows stay in storage, but not on the open board.
  const active = tasks.filter(
    (task) => task.deletedAt === undefined && task.outcome === undefined,
  );

  active.sort((a, b) => b._creationTime - a._creationTime);
  const periods = await completionMap(db, ownerId);
  const views = active.map((task) =>
    presentTask(task, periods.get(String(task._id)) ?? new Set(), now),
  );
  views.sort((a, b) => Number(a.done) - Number(b.done));
  return views;
}

async function liveTaskForRead(
  db: DatabaseReader,
  userId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<Doc<"tasks">> {
  const task = await db.get(taskId);
  if (!task || task.deletedAt !== undefined) throw new Error("Task not found");
  const groups = await readableGroupIds(db, userId);
  if (!groups.has(String(task.groupId))) throw new Error("Task not found");
  return task;
}

async function liveTaskForWrite(
  db: DatabaseWriter,
  userId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<Doc<"tasks">> {
  const task = await liveTaskForRead(db, userId, taskId);
  await assertCanWriteGroup(db, userId, task.groupId);
  return task;
}

export type CreateTaskInput = {
  title: string;
  dueAt?: number;
  plannedOn?: number;
  plannedTime?: number;
  location?: string;
  notes?: string;
  deadlineAt?: number;
  remindAt?: number;
  priority?: string;
  priorityRank?: number;
  overduePolicy?: string;
  origin?: "self" | "agent" | "member";
  groupId?: Id<"spaces">;
  presentationHint?: string;
  presentation?: string;
  resourceEffect?: ResourceEffect;
  recurrenceId?: Id<"recurrences">;
  periodStart?: number;
  routineKind?: string;
  intervalEvery?: number;
  intervalUnit?: string;
  routineAnchor?: number;
  timezone?: string;
  waiting?: boolean;
  waitingReason?: string;
  remindMinutes?: number;
};

/** Creates a task owned by the specified user. */
export async function createTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: CreateTaskInput,
): Promise<TaskView> {
  const title = normalizeTitle(input.title);
  const { dueAt, plannedOn } = resolvePlannedDates({
    dueAt: input.dueAt,
    plannedOn: input.plannedOn,
  });
  assertPlannedTime(input.plannedTime);
  assertEpoch(input.deadlineAt, "deadlineAt");
  assertEpoch(input.remindAt, "remindAt");
  if (
    input.remindMinutes !== undefined &&
    (!Number.isInteger(input.remindMinutes) ||
      input.remindMinutes < 0 ||
      input.remindMinutes > 1439)
  ) {
    throw new Error("Invalid remindMinutes");
  }
  assertOrigin(input.origin);
  const routine = readRoutine({
    routineKind: input.routineKind,
    intervalEvery: input.intervalEvery,
    intervalUnit: input.intervalUnit,
    routineAnchor: input.routineAnchor,
  });
  if (input.waiting && !input.waitingReason?.trim()) {
    throw new Error("Waiting reason is required");
  }
  const zone = input.timezone?.trim() || DEFAULT_TIMEZONE;
  if (routine.kind !== "none") {
    // Throws "Invalid timezone" when the stored zone cannot be resolved.
    nextReminderAt(Date.now(), zone, routine, input.remindMinutes ?? 0);
  }

  const { priority, priorityRank } = resolvePriorityAndRank(
    input.priority,
    input.priorityRank,
  );
  const overduePolicy = normalizeOverduePolicy(input.overduePolicy);

  const origin = input.origin ?? "self";
  const seenAt = origin === "self" ? Date.now() : undefined;
  const presentation = normalizePresentation(input.presentation);
  const groupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, groupId);
  const now = Date.now();
  const anchor = routine.kind === "interval" ? (input.routineAnchor ?? now) : undefined;
  const storedRoutine = routine.kind === "interval" ? { ...routine, anchorOn: anchor } : routine;
  const remindAt =
    input.remindAt ??
    (input.remindMinutes !== undefined
      ? nextReminderAt(now, zone, storedRoutine, input.remindMinutes)
      : undefined);

  const id = await db.insert("tasks", {
    title,
    done: false,
    dueAt,
    plannedOn,
    plannedTime: input.plannedTime,
    location: input.location,
    notes: input.notes,
    deadlineAt: input.deadlineAt,
    remindAt,
    priority,
    priorityRank,
    overduePolicy,
    origin,
    seenAt,
    ownerId,
    groupId,
    presentationHint: input.presentationHint,
    presentation,
    recurrenceId: input.recurrenceId,
    periodStart: input.periodStart,
    open: true,
    ...(routine.kind !== "none"
      ? {
          routineKind: routine.kind,
          routineTimezone: zone,
          ...(routine.kind === "interval"
            ? {
                intervalEvery: routine.every,
                intervalUnit: routine.unit,
                routineAnchor: anchor,
              }
            : {}),
        }
      : {}),
    ...(input.waiting
      ? { waiting: true, waitingReason: input.waitingReason?.trim() }
      : {}),
    ...(input.remindMinutes !== undefined ? { remindMinutes: input.remindMinutes } : {}),
  });

  if (input.resourceEffect !== undefined) {
    await setTaskResourceEffect(
      db,
      ownerId,
      id,
      input.resourceEffect.resourceId,
      input.resourceEffect.delta,
    );
  }

  const task = await db.get(id);
  if (!task) throw new Error("Task not found");
  return presentTask(task, new Set(), Date.now());
}

export type UpdateTaskInput = {
  title?: string;
  notes?: string;
  plannedOn?: number;
  plannedTime?: number;
  dueAt?: number;
  location?: string;
  deadlineAt?: number;
  remindAt?: number;
  priority?: string;
  priorityRank?: number;
  overduePolicy?: string;
  presentation?: string;
  done?: boolean;
  groupId?: Id<"spaces">;
  routineKind?: string;
  intervalEvery?: number;
  intervalUnit?: string;
  timezone?: string;
  waiting?: boolean;
  waitingReason?: string;
  remindMinutes?: number;
};

/** Partially updates a task owned by the specified user. */
export async function updateTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  input: UpdateTaskInput,
): Promise<TaskView> {
  const task = await db.get(taskId);
  if (!task || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }
  const groups = await readableGroupIds(db, ownerId);
  if (!groups.has(String(task.groupId))) throw new Error("Task not found");
  const targetGroupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, task.groupId);
  if (targetGroupId !== task.groupId) {
    await assertCanWriteGroup(db, ownerId, targetGroupId);
  }

  const patch: Partial<Doc<"tasks">> = {};
  if (input.groupId !== undefined) patch.groupId = targetGroupId;

  if (input.title !== undefined) {
    patch.title = normalizeTitle(input.title);
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  if (input.location !== undefined) {
    patch.location = input.location;
  }

  if (input.plannedTime !== undefined) {
    assertPlannedTime(input.plannedTime);
    patch.plannedTime = input.plannedTime;
  }

  if (input.deadlineAt !== undefined) {
    assertEpoch(input.deadlineAt, "deadlineAt");
    patch.deadlineAt = input.deadlineAt;
  }

  if (input.remindAt !== undefined) {
    assertEpoch(input.remindAt, "remindAt");
    patch.remindAt = input.remindAt;
  }

  if (input.dueAt !== undefined || input.plannedOn !== undefined) {
    const { dueAt, plannedOn } = resolvePlannedDates({
      dueAt: input.dueAt ?? (input.plannedOn !== undefined ? undefined : task.dueAt),
      plannedOn: input.plannedOn ?? (input.dueAt !== undefined ? undefined : task.plannedOn),
    });
    patch.dueAt = dueAt;
    patch.plannedOn = plannedOn;
  }

  if (input.priority !== undefined || input.priorityRank !== undefined) {
    const { priority, priorityRank } = resolvePriorityAndRank(
      input.priority ?? task.priority,
      input.priorityRank ?? (input.priority !== undefined ? undefined : task.priorityRank),
    );
    patch.priority = priority;
    patch.priorityRank = priorityRank;
  }

  if (input.overduePolicy !== undefined) {
    patch.overduePolicy = normalizeOverduePolicy(input.overduePolicy);
  }

  if (input.presentation !== undefined) {
    const presentation = normalizePresentation(input.presentation);
    if (presentation !== undefined) patch.presentation = presentation;
  }

  const nextRoutine = readRoutine({
    routineKind: input.routineKind ?? task.routineKind,
    intervalEvery: input.intervalEvery ?? task.intervalEvery,
    intervalUnit: input.intervalUnit ?? task.intervalUnit,
    routineAnchor: task.routineAnchor,
  });
  const routineTouched =
    input.routineKind !== undefined ||
    input.intervalEvery !== undefined ||
    input.intervalUnit !== undefined ||
    input.timezone !== undefined;
  if (routineTouched) {
    const zone = (input.timezone ?? task.routineTimezone ?? DEFAULT_TIMEZONE).trim();
    if (nextRoutine.kind === "none") {
      patch.routineKind = "none";
      patch.intervalEvery = undefined;
      patch.intervalUnit = undefined;
      patch.routineAnchor = undefined;
      patch.routineTimezone = undefined;
    } else {
      patch.routineKind = nextRoutine.kind;
      patch.routineTimezone = zone;
      if (nextRoutine.kind === "interval") {
        patch.intervalEvery = nextRoutine.every;
        patch.intervalUnit = nextRoutine.unit;
        patch.routineAnchor = task.routineAnchor ?? Date.now();
      } else {
        patch.intervalEvery = undefined;
        patch.intervalUnit = undefined;
        patch.routineAnchor = undefined;
      }
    }
  }
  if (input.remindMinutes !== undefined) {
    if (
      !Number.isInteger(input.remindMinutes) ||
      input.remindMinutes < 0 ||
      input.remindMinutes > 1439
    ) {
      throw new Error("Invalid remindMinutes");
    }
    patch.remindMinutes = input.remindMinutes;
    patch.remindedAt = undefined;
  }
  if (input.remindAt === undefined && (input.remindMinutes !== undefined || routineTouched)) {
    const minutes = input.remindMinutes ?? task.remindMinutes;
    if (minutes !== undefined) {
      const zone = (patch.routineTimezone ?? task.routineTimezone ?? DEFAULT_TIMEZONE) as string;
      const anchor = (patch.routineAnchor ?? task.routineAnchor) as number | undefined;
      patch.remindAt = nextReminderAt(Date.now(), zone, { ...nextRoutine, anchorOn: anchor }, minutes);
      patch.remindedAt = undefined;
    }
  }
  if (input.waiting !== undefined) {
    if (input.waiting && !input.waitingReason?.trim() && !task.waitingReason) {
      throw new Error("Waiting reason is required");
    }
    patch.waiting = input.waiting;
    if (input.waitingReason !== undefined) patch.waitingReason = input.waitingReason.trim();
    if (!input.waiting) patch.waitingReason = undefined;
  }

  const routineDone = input.done !== undefined && nextRoutine.kind !== "none";
  if (input.done !== undefined && !routineDone) {
    patch.done = input.done;
    if (input.done && !task.done) {
      patch.completedAt = Date.now();
    } else if (!input.done && task.done) {
      patch.completedAt = undefined;
    }
  }

  const wasDone = task.done;
  await db.patch(task._id, patch);
  if (routineDone && input.done !== undefined) {
    return await setTaskDone(db, ownerId, taskId, input.done);
  }
  if (input.done !== undefined && !routineDone) {
    await applyTaskResourceEffects(db, ownerId, taskId, input.done);
  }
  if (input.done === true && !wasDone && !routineDone) {
    await unlockNextQuestStep(db, task._id, ownerId);
  }
  if (input.done !== undefined && input.done !== wasDone && !routineDone) {
    const event = input.done ? "completed" : "reopened";
    await fireStateRoutings(db, task.groupId, {
      subjectType: "task",
      subjectId: String(task._id),
      event,
      revision: stateRevision(`${String(task._id)}:${event}`),
    });
  }
  const updated = await db.get(taskId);
  if (!updated) throw new Error("Task not found");
  return presentTask(updated, await periodsForTask(db, updated), Date.now());
}

async function finishDone(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  task: Doc<"tasks">,
  wasDone: boolean,
  done: boolean,
  now: number,
  periodKey?: string,
): Promise<TaskView> {
  await applyTaskResourceEffects(db, ownerId, task._id, done, now, periodKey);
  if (done && !wasDone) await unlockNextQuestStep(db, task._id, ownerId);
  if (done !== wasDone) {
    const event = done ? "completed" : "reopened";
    await fireStateRoutings(db, task.groupId, {
      subjectType: "task",
      subjectId: String(task._id),
      event,
      revision: stateRevision(`${String(task._id)}:${event}`),
    });
  }
  const updated = await db.get(task._id);
  if (!updated) throw new Error("Task not found");
  return presentTask(updated, await periodsForTask(db, updated), now);
}

/** Sets the completion status of a task owned by the specified user. */
export async function setTaskDone(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  done: boolean,
  now = Date.now(),
): Promise<TaskView> {
  const task = await liveTaskForWrite(db, ownerId, taskId);
  if (task.waiting === true && done) throw new Error("Task is waiting");

  const routine = readRoutine(task);
  if (routine.kind === "none") {
    const wasDone = task.done;
    if (!done) {
      await db.patch(task._id, { done: false, completedAt: undefined });
    } else if (!wasDone) {
      await db.patch(task._id, { done: true, completedAt: now });
    }
    return await finishDone(db, ownerId, task, wasDone, done, now);
  }

  const zone = task.routineTimezone || DEFAULT_TIMEZONE;
  const current = periodId(routine, now, zone);
  if (!current) throw new Error("Invalid routine");
  const existingRows = await db
    .query("taskCompletions")
    .withIndex("by_task_period", (q) => q.eq("taskId", task._id).eq("periodId", current))
    .collect();
  const existing = existingRows[0];
  const wasDone = existing !== undefined;
  if (done && !wasDone) {
    await db.insert("taskCompletions", {
      ownerId: task.ownerId,
      taskId: task._id,
      periodId: current,
      completedAt: now,
    });
    await db.patch(task._id, { done: true, completedAt: now });
  } else if (!done && wasDone && existing) {
    await db.delete(existing._id);
    await db.patch(task._id, { done: false, completedAt: undefined });
  }
  return await finishDone(db, ownerId, task, wasDone, done, now, current);
}

/** Toggles the completion status of a task. */
export async function toggleTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  now = Date.now(),
): Promise<TaskView> {
  const task = await liveTaskForWrite(db, ownerId, taskId);
  const routine = readRoutine(task);
  let currentDone = task.done;
  if (routine.kind !== "none") {
    const periods = await periodsForTask(db, task);
    const current = periodId(routine, now, task.routineTimezone || DEFAULT_TIMEZONE);
    currentDone = current !== null && periods.has(current);
  }
  if (task.waiting === true && !currentDone) throw new Error("Task is waiting");
  return await setTaskDone(db, ownerId, taskId, !currentDone, now);
}

/** Blocks a recurring task until someone clears the reason, or clears that block. */
export async function setTaskWaiting(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  waiting: boolean,
  reason?: string,
  now = Date.now(),
): Promise<TaskView> {
  const task = await liveTaskForWrite(db, ownerId, taskId);
  if (waiting) {
    const text = reason?.trim() ?? "";
    if (!text) throw new Error("Waiting reason is required");
    await db.patch(task._id, { waiting: true, waitingReason: text });
  } else {
    const note = reason?.trim();
    await db.patch(task._id, {
      waiting: false,
      waitingReason: undefined,
      ...(note ? { notes: [task.notes, note].filter(Boolean).join("\n") } : {}),
    });
  }
  const updated = await db.get(task._id);
  if (!updated) throw new Error("Task not found");
  return presentTask(updated, await periodsForTask(db, updated), now);
}

/** Marks a task as seen by the viewer. Sets seenAt if empty; idempotent. */
export async function markTaskSeen(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<TaskView> {
  const task = await liveTaskForRead(db, ownerId, taskId);

  if (task.seenAt === undefined) {
    const seenAt = Date.now();
    await db.patch(task._id, { seenAt });
    return taskView({ ...task, seenAt });
  }

  return taskView(task);
}

/** Soft-deletes a task owned by the specified user. */
export async function deleteTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<{ success: true; id: Id<"tasks"> }> {
  const task = await liveTaskForWrite(db, ownerId, taskId);

  const deletedAt = Date.now();
  await reverseAppliedTaskEffects(db, ownerId, taskId, deletedAt);
  await db.patch(task._id, { deletedAt });
  await fireStateRoutings(db, task.groupId, {
    subjectType: "task",
    subjectId: String(task._id),
    event: "deleted",
    revision: stateRevision(`${String(task._id)}:deleted`),
  });
  return { success: true, id: taskId };
}
