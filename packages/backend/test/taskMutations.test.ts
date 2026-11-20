import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import type { DatabaseWriter } from "../convex/_generated/server";
import { deleteTask, setTaskDone } from "../convex/lib/taskService";

type Task = {
  _id: Id<"tasks">;
  _creationTime: number;
  title: string;
  done: boolean;
  dueAt?: number;
  ownerId: Id<"users">;
};

const OWNER = "user_own" as Id<"users">;
const OTHER = "user_other" as Id<"users">;

function fakeDb(tasks: Task[]) {
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
  };
  return { db: db as unknown as DatabaseWriter, rows };
}

function task(id: string, ownerId: Id<"users"> = OWNER, done = false): Task {
  return {
    _id: id as Id<"tasks">,
    _creationTime: 1,
    title: "Buy milk",
    done,
    ownerId,
  };
}

describe("explicit task mutations", () => {
  it("sets done true and back to false instead of toggling", async () => {
    const { db, rows } = fakeDb([task("tasks/a")]);

    expect((await setTaskDone(db, OWNER, "tasks/a" as Id<"tasks">, true)).done).toBe(true);
    expect(rows.get("tasks/a" as Id<"tasks">)?.done).toBe(true);

    expect((await setTaskDone(db, OWNER, "tasks/a" as Id<"tasks">, true)).done).toBe(true);
    expect((await setTaskDone(db, OWNER, "tasks/a" as Id<"tasks">, false)).done).toBe(false);
    expect(rows.get("tasks/a" as Id<"tasks">)?.done).toBe(false);
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
    expect(rows.has("tasks/d" as Id<"tasks">)).toBe(false);
  });
});

describe("public task surface", () => {
  it("exports the mutations the Apple client calls", () => {
    const source = readFileSync(new URL("../convex/tasks.ts", import.meta.url), "utf8");
    for (const name of ["setDone", "remove", "create", "list"]) {
      expect(source).toMatch(new RegExp(`export const ${name} = (?:mutation|query)\\(`));
    }
  });
});
