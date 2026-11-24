import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { unlockNextQuestStep } from "./questService";
import {
  assertEpoch,
  assertOrigin,
  assertPlannedTime,
  isSeedPriority,
  normalizeOverduePolicy,
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
  const tasks = await db
    .query("tasks")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();

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
  presentationHint?: string;
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
    presentationHint: input.presentationHint,
    recurrenceId: input.recurrenceId,
    periodStart: input.periodStart,
    open: true,
  });

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
  done?: boolean;
};

/** Partially updates a task owned by the specified user. */
export async function updateTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  input: UpdateTaskInput,
): Promise<TaskView> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }

  const patch: Partial<Doc<"tasks">> = {};

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
  if (input.done === true && !wasDone) {
    await unlockNextQuestStep(db, task._id, ownerId);
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
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }

  let completedAt = task.completedAt;
  if (done && !task.done) {
    completedAt = Date.now();
  } else if (!done && task.done) {
    completedAt = undefined;
  }

  const wasDone = task.done;
  await db.patch(task._id, { done, completedAt });
  if (done && !wasDone) await unlockNextQuestStep(db, task._id, ownerId);
  return taskView({ ...task, done, completedAt });
}

/** Toggles the completion status of a task. */
export async function toggleTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<TaskView> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }

  const wasDone = task.done;
  const done = !wasDone;
  const completedAt = done ? Date.now() : undefined;

  await db.patch(task._id, { done, completedAt });
  if (done && !wasDone) await unlockNextQuestStep(db, task._id, ownerId);
  return taskView({ ...task, done, completedAt });
}

/** Marks a task as seen by the viewer. Sets seenAt if empty; idempotent. */
export async function markTaskSeen(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<TaskView> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }

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
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId || task.deletedAt !== undefined) {
    throw new Error("Task not found");
  }

  const deletedAt = Date.now();
  await db.patch(task._id, { deletedAt });
  return { success: true, id: taskId };
}
