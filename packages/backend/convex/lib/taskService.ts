import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { assertDueAt, normalizeTitle } from "./taskFields";

export type TaskView = {
  id: Id<"tasks">;
  title: string;
  done: boolean;
  dueAt: number | null;
  ownerId: Id<"users">;
};

export function taskView(task: Doc<"tasks">): TaskView {
  return {
    id: task._id,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt ?? null,
    ownerId: task.ownerId,
  };
}

/** Lists all tasks for a given user, sorted by pending first, then newest creation time. */
export async function listTasks(
  db: DatabaseReader,
  ownerId: Id<"users">,
): Promise<TaskView[]> {
  const tasks = await db
    .query("tasks")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();

  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b._creationTime - a._creationTime;
  });

  return tasks.map(taskView);
}

/** Creates a task owned by the specified user. */
export async function createTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { title: string; dueAt?: number },
): Promise<TaskView> {
  const title = normalizeTitle(input.title);
  assertDueAt(input.dueAt);

  const id = await db.insert("tasks", {
    title,
    done: false,
    dueAt: input.dueAt,
    ownerId,
  });

  const task = await db.get(id);
  if (!task) throw new Error("Task not found");
  return taskView(task);
}

/** Sets the completion status of a task owned by the specified user. */
export async function setTaskDone(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
  done: boolean,
): Promise<TaskView> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId) throw new Error("Task not found");

  await db.patch(task._id, { done });
  return taskView({ ...task, done });
}

/** Toggles the completion status of a task. */
export async function toggleTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<TaskView> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId) throw new Error("Task not found");

  const done = !task.done;
  await db.patch(task._id, { done });
  return taskView({ ...task, done });
}

/** Deletes a task owned by the specified user. */
export async function deleteTask(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<{ success: true; id: Id<"tasks"> }> {
  const task = await db.get(taskId);
  if (!task || task.ownerId !== ownerId) throw new Error("Task not found");

  await db.delete(task._id);
  return { success: true, id: taskId };
}
