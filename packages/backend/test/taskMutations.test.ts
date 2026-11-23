import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import type { DatabaseWriter } from "../convex/_generated/server";
import {
  createTask,
  deleteTask,
  listTasks,
  markTaskSeen,
  setTaskDone,
  taskView,
  toggleTask,
  updateTask,
} from "../convex/lib/taskService";

type Task = {
  _id: Id<"tasks">;
  _creationTime: number;
  title: string;
  done: boolean;
  dueAt?: number;
  ownerId: Id<"users">;
  deletedAt?: number;
  completedAt?: number;
  notes?: string;
  plannedOn?: number;
  plannedTime?: number;
  location?: string;
  deadlineAt?: number;
  remindAt?: number;
  priority?: string;
  priorityRank?: number;
  overduePolicy?: string;
  outcome?: string;
  seenAt?: number;
  origin?: string;
};

const OWNER = "user_own" as Id<"users">;
const OTHER = "user_other" as Id<"users">;

function fakeDb(tasks: Task[] = []) {
  let counter = 1;
  const rows = new Map(tasks.map((task) => [task._id, { ...task }]));
  const db = {
    get: async (id: Id<"tasks">) => rows.get(id) ?? null,
    patch: async (id: Id<"tasks">, patch: Partial<Task>) => {
      const task = rows.get(id);
      if (!task) throw new Error("missing task");
      rows.set(id, { ...task, ...patch });
    },
    delete: async (id: Id<"tasks">) => {
      rows.delete(id);
    },
    insert: async (_table: string, doc: Omit<Task, "_id" | "_creationTime">) => {
      const id = `tasks/gen_${counter++}` as Id<"tasks">;
      const full: Task = { ...doc, _id: id, _creationTime: counter };
      rows.set(id, full);
      return id;
    },
    query: (_table: string) => {
      let filterOwner: Id<"users"> | undefined;
      return {
        withIndex: (_indexName: string, predicate: (q: { eq: (field: string, val: unknown) => void }) => void) => {
          predicate({
            eq: (field: string, val: unknown) => {
              if (field === "ownerId") filterOwner = val as Id<"users">;
            },
          });
          return {
            collect: async () => {
              const all = Array.from(rows.values());
              if (filterOwner) return all.filter((r) => r.ownerId === filterOwner);
              return all;
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as DatabaseWriter, rows };
}

function task(id: string, ownerId: Id<"users"> = OWNER, done = false, extra: Partial<Task> = {}): Task {
  return {
    _id: id as Id<"tasks">,
    _creationTime: 1,
    title: "Buy milk",
    done,
    ownerId,
    ...extra,
  };
}

describe("explicit task mutations", () => {
  it("sets done true and back to false instead of toggling", async () => {
    const { db, rows } = fakeDb([task("tasks/a")]);

    expect((await setTaskDone(db, OWNER, "tasks/a" as Id<"tasks">, true)).done).toBe(true);
    expect(rows.get("tasks/a" as Id<"tasks">)?.done).toBe(true);
    expect(rows.get("tasks/a" as Id<"tasks">)?.completedAt).toBeDefined();

    expect((await setTaskDone(db, OWNER, "tasks/a" as Id<"tasks">, true)).done).toBe(true);
    expect((await setTaskDone(db, OWNER, "tasks/a" as Id<"tasks">, false)).done).toBe(false);
    expect(rows.get("tasks/a" as Id<"tasks">)?.done).toBe(false);
    expect(rows.get("tasks/a" as Id<"tasks">)?.completedAt).toBeUndefined();
  });

  it("toggles task done and tracks completedAt", async () => {
    const { db, rows } = fakeDb([task("tasks/toggle_test")]);

    const doneTask = await toggleTask(db, OWNER, "tasks/toggle_test" as Id<"tasks">);
    expect(doneTask.done).toBe(true);
    expect(doneTask.completedAt).toBeDefined();
    expect(rows.get("tasks/toggle_test" as Id<"tasks">)?.completedAt).toBeDefined();

    const undoneTask = await toggleTask(db, OWNER, "tasks/toggle_test" as Id<"tasks">);
    expect(undoneTask.done).toBe(false);
    expect(undoneTask.completedAt).toBeUndefined();
    expect(rows.get("tasks/toggle_test" as Id<"tasks">)?.completedAt).toBeUndefined();
  });

  it("refuses to change another user's task", async () => {
    const { db, rows } = fakeDb([task("tasks/b", OTHER)]);
    await expect(setTaskDone(db, OWNER, "tasks/b" as Id<"tasks">, true)).rejects.toThrow("Task not found");
    expect(rows.get("tasks/b" as Id<"tasks">)?.done).toBe(false);
  });

  it("refuses to delete another user's task", async () => {
    const { db, rows } = fakeDb([task("tasks/c", OTHER)]);
    await expect(deleteTask(db, OWNER, "tasks/c" as Id<"tasks">)).rejects.toThrow("Task not found");
    expect(rows.has("tasks/c" as Id<"tasks">)).toBe(true);
  });

  it("deletes an owned task", async () => {
    const { db, rows } = fakeDb([task("tasks/d")]);
    expect(await deleteTask(db, OWNER, "tasks/d" as Id<"tasks">)).toEqual({
      success: true,
      id: "tasks/d",
    });
    expect(rows.has("tasks/d" as Id<"tasks">)).toBe(true);
    expect(rows.get("tasks/d" as Id<"tasks">)?.deletedAt).toBeDefined();
  });
});

describe("M1 task facts contract tests", () => {
  it("soft delete hides a row from listTasks", async () => {
    const { db } = fakeDb([
      task("tasks/active", OWNER, false),
      task("tasks/deleted", OWNER, false, { deletedAt: Date.now() }),
    ]);

    const list = await listTasks(db, OWNER);
    expect(list.map((t) => t.id)).toEqual(["tasks/active"]);
  });

  it("a dueAt-only create leaves deadlineAt unset and sets plannedOn", async () => {
    const { db } = fakeDb();
    const created = await createTask(db, OWNER, {
      title: "Clean kitchen",
      dueAt: 1700000000000,
    });

    expect(created.dueAt).toBe(1700000000000);
    expect(created.plannedOn).toBe(1700000000000);
    expect(created.deadlineAt).toBeUndefined();
  });

  it("a self create has seenAt and origin self", async () => {
    const { db } = fakeDb();
    const created = await createTask(db, OWNER, {
      title: "User created task",
    });

    expect(created.origin).toBe("self");
    expect(created.seenAt).toBeDefined();
    expect(typeof created.seenAt).toBe("number");
  });

  it("an agent create has no seenAt and origin agent", async () => {
    const { db } = fakeDb();
    const created = await createTask(db, OWNER, {
      title: "Agent created task",
      origin: "agent",
    });

    expect(created.origin).toBe("agent");
    expect(created.seenAt).toBeUndefined();
  });

  it("markSeen sets seenAt", async () => {
    const { db } = fakeDb();
    const created = await createTask(db, OWNER, {
      title: "Unseen agent task",
      origin: "agent",
    });
    expect(created.seenAt).toBeUndefined();

    const seen = await markTaskSeen(db, OWNER, created.id);
    expect(seen.seenAt).toBeDefined();
    expect(typeof seen.seenAt).toBe("number");

    // Idempotent: second call does not throw and preserves or returns seenAt
    const secondCall = await markTaskSeen(db, OWNER, created.id);
    expect(secondCall.seenAt).toBe(seen.seenAt);
  });

  it("a deadline does not become plannedOn", async () => {
    const { db } = fakeDb();
    const created = await createTask(db, OWNER, {
      title: "Pay tax bill",
      deadlineAt: 1700000000000,
    });

    expect(created.deadlineAt).toBe(1700000000000);
    expect(created.plannedOn).toBeUndefined();
    expect(created.dueAt).toBeNull();
  });

  it("omitted priority is normal/10", async () => {
    const { db } = fakeDb();
    const created = await createTask(db, OWNER, {
      title: "Regular errand",
    });

    expect(created.priority).toBe("normal");
    expect(created.priorityRank).toBe(10);
  });

  it("escalate changes effectiveRank on read and does not write priorityRank", async () => {
    const pastDeadline = Date.now() - 60000;
    const { db, rows } = fakeDb([
      task("tasks/escalate_test", OWNER, false, {
        priority: "high",
        priorityRank: 20,
        overduePolicy: "escalate",
        deadlineAt: pastDeadline,
      }),
    ]);

    const tasks = await listTasks(db, OWNER);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].overdue).toBe(true);
    expect(tasks[0].priorityRank).toBe(20);
    expect(tasks[0].effectiveRank).toBe(30);

    // Assert that the stored row in the database still has priorityRank 20 (not written)
    const stored = rows.get("tasks/escalate_test" as Id<"tasks">);
    expect(stored?.priorityRank).toBe(20);
  });

  it("existing rows without origin return origin self and are not treated as NEW", () => {
    const view = taskView(task("tasks/legacy", OWNER, false));
    expect(view.origin).toBe("self");
    expect(view.seenAt).toBeUndefined();
    // NEW is (origin === "agent" || origin === "member") && seenAt == null
    const isNew = (view.origin === "agent" || view.origin === "member") && view.seenAt == null;
    expect(isNew).toBe(false);
  });

  it("partially updates a task with updateTask", async () => {
    const { db } = fakeDb([task("tasks/to_update", OWNER, false)]);

    const updated = await updateTask(db, OWNER, "tasks/to_update" as Id<"tasks">, {
      title: "Updated title",
      notes: "Some notes",
      plannedTime: 600,
      priority: "urgent",
    });

    expect(updated.title).toBe("Updated title");
    expect(updated.notes).toBe("Some notes");
    expect(updated.plannedTime).toBe(600);
    expect(updated.priority).toBe("urgent");
    expect(updated.priorityRank).toBe(30);
  });
});

describe("public task surface", () => {
  it("exports the mutations the Apple client calls", () => {
    const source = readFileSync(new URL("../convex/tasks.ts", import.meta.url), "utf8");
    for (const name of ["setDone", "remove", "create", "list", "update", "markSeen"]) {
      expect(source).toMatch(new RegExp(`export const ${name} = (?:mutation|query)\\(`));
    }
  });
});
