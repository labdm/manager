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
  };
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

  active.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b._creationTime - a._creationTime;
  });

  return active.map((task) => taskView(task, now));
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
  assertOrigin(input.origin);

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

  const id = await db.insert("tasks", {
    title,
    done: false,
    dueAt,
    plannedOn,
    plannedTime: input.plannedTime,
    location: input.location,
    notes: input.notes,
    deadlineAt: input.deadlineAt,
    remindAt: input.remindAt,
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
  return taskView(task);
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

  if (input.done !== undefined) {
    patch.done = input.done;
    if (input.done && !task.done) {
      patch.completedAt = Date.now();
    } else if (!input.done && task.done) {
      patch.completedAt = undefined;
    }
  }

  const wasDone = task.done;
  await db.patch(task._id, patch);
  if (input.done !== undefined) {
    await applyTaskResourceEffects(db, ownerId, taskId, input.done);
  }
  if (input.done === true && !wasDone) {
    await unlockNextQuestStep(db, task._id, ownerId);
  }
  if (input.done !== undefined && input.done !== wasDone) {
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
  return taskView(updated);
}

/** Sets the completion status of a task owned by the specified user. */
export async function setTaskDone(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  done: boolean,
): Promise<TaskView> {
  const task = await liveTaskForWrite(db, ownerId, taskId);

  let completedAt = task.completedAt;
  if (done && !task.done) {
    completedAt = Date.now();
  } else if (!done && task.done) {
    completedAt = undefined;
  }

  const wasDone = task.done;
  await db.patch(task._id, { done, completedAt });
  await applyTaskResourceEffects(db, ownerId, taskId, done);
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
  return taskView({ ...task, done, completedAt });
}

/** Toggles the completion status of a task. */
export async function toggleTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<TaskView> {
  const task = await liveTaskForWrite(db, ownerId, taskId);

  const wasDone = task.done;
  const done = !wasDone;
  const completedAt = done ? Date.now() : undefined;

  await db.patch(task._id, { done, completedAt });
  await applyTaskResourceEffects(db, ownerId, taskId, done);
  if (done && !wasDone) await unlockNextQuestStep(db, task._id, ownerId);
  const event = done ? "completed" : "reopened";
  await fireStateRoutings(db, task.groupId, {
    subjectType: "task",
    subjectId: String(task._id),
    event,
    revision: stateRevision(`${String(task._id)}:${event}`),
  });
  return taskView({ ...task, done, completedAt });
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
