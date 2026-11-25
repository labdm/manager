import type { DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  assertCanWriteGroup,
  readableDocs,
  readableGroupIds,
  resolveGroupId,
} from "./groupService";
import { normalizeTitle } from "./taskFields";
import { createTask } from "./taskService";

async function readable<T extends { groupId: Id<"spaces"> }>(
  db: Parameters<typeof readableGroupIds>[0],
  userId: Id<"users">,
  row: T | null,
  label: string,
  write = false,
): Promise<T> {
  if (!row) throw new Error(`${label} not found`);
  const groups = await readableGroupIds(db, userId);
  if (!groups.has(String(row.groupId))) throw new Error(`${label} not found`);
  if (write) await assertCanWriteGroup(db, userId, row.groupId);
  return row;
}

export async function createProgression(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: {
    title: string;
    mode?: string;
    target: number;
    unit?: string;
    groupId?: Id<"spaces">;
  },
): Promise<Doc<"progressions">> {
  const mode = input.mode === "steps" ? "steps" : "meter";
  if (!Number.isSafeInteger(input.target) || input.target < 0) {
    throw new Error("Invalid target");
  }
  const groupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, groupId);
  const id = await db.insert("progressions", {
    ownerId,
    groupId,
    title: normalizeTitle(input.title),
    mode,
    target: input.target,
    unit: input.unit ?? "step",
    current: 0,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Progression not found");
  return created;
}

export async function logProgress(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { progressionId: Id<"progressions">; amount: number },
): Promise<Doc<"progressions">> {
  const row = await readable(
    db,
    ownerId,
    await db.get(input.progressionId),
    "Progression",
    true,
  );
  if (!Number.isSafeInteger(input.amount)) throw new Error("Invalid amount");
  const current = Math.max(0, row.current + input.amount);
  await db.patch(row._id, { current });
  const updated = await db.get(row._id);
  if (!updated) throw new Error("Progression not found");
  return updated;
}

export async function createQuest(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: {
    title: string;
    status?: string;
    scripting?: string;
    groupId?: Id<"spaces">;
  },
): Promise<Doc<"quests">> {
  const status = input.status ?? "active";
  if (!["active", "completed", "archived"].includes(status)) {
    throw new Error("Invalid quest status");
  }
  const groupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, groupId);
  const id = await db.insert("quests", {
    ownerId,
    groupId,
    title: normalizeTitle(input.title),
    status,
    scripting: input.scripting,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Quest not found");
  return created;
}

export async function addQuestStep(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: {
    questId: Id<"quests">;
    taskId: Id<"tasks">;
    position?: number;
    gate?: string;
    groupId?: Id<"spaces">;
  },
): Promise<Doc<"questSteps">> {
  const quest = await readable(db, ownerId, await db.get(input.questId), "Quest", true);
  const task = await readable(db, ownerId, await db.get(input.taskId), "Task", true);
  if (String(quest.groupId) !== String(task.groupId)) {
    throw new Error("Task not found");
  }
  const siblings = await db
    .query("questSteps")
    .withIndex("by_quest", (q) =>
      q.eq("ownerId", ownerId).eq("questId", quest._id),
    )
    .collect();
  const position = input.position ?? siblings.length;
  const gate = input.gate ?? (position === 0 ? "available" : "locked");
  if (gate !== "available" && gate !== "locked") {
    throw new Error("Invalid gate");
  }
  const id = await db.insert("questSteps", {
    ownerId,
    questId: quest._id,
    taskId: task._id,
    position,
    gate,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Quest step not found");
  return created;
}

export async function createQuestion(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: {
    prompt: string;
    options: { id?: string; label: string; effect?: unknown }[];
    groupId?: Id<"spaces">;
  },
): Promise<Doc<"questions">> {
  if (!Array.isArray(input.options) || input.options.length === 0) {
    throw new Error("Options are required");
  }
  const options = input.options.map((option, index) => ({
    id: option.id ?? `option-${index + 1}`,
    label: option.label,
    effect: option.effect,
  }));
  const groupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, groupId);
  const id = await db.insert("questions", {
    ownerId,
    groupId,
    prompt: normalizeTitle(input.prompt),
    options,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Question not found");
  return created;
}

type AnswerEffect = {
  createTaskTitle?: string;
  questId?: string;
  stepTitle?: string;
};

export async function answerQuestion(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { questionId: Id<"questions">; optionId: string },
): Promise<Doc<"questions">> {
  const question = await readable(
    db,
    ownerId,
    await db.get(input.questionId),
    "Question",
    true,
  );
  if (question.answeredAt !== undefined) throw new Error("Question answered");
  const option = question.options.find((row) => row.id === input.optionId);
  if (!option) throw new Error("Unknown option");
  const answeredAt = Date.now();
  await db.patch(question._id, { answeredAt, seenAt: answeredAt });

  const effect = option.effect as AnswerEffect | undefined;
  if (effect?.createTaskTitle) {
    await createTask(db, ownerId, {
      title: effect.createTaskTitle,
      origin: "agent",
      groupId: question.groupId,
    });
  }
  if (effect?.questId && effect.stepTitle) {
    const questId = effect.questId as Id<"quests">;
    const quest = await db.get(questId);
    if (quest && quest.ownerId === ownerId && quest.deletedAt === undefined) {
      const siblings = await db
        .query("questSteps")
        .withIndex("by_quest", (q) =>
          q.eq("ownerId", ownerId).eq("questId", questId),
        )
        .collect();
      const stepTask = await createTask(db, ownerId, {
        title: effect.stepTitle,
        origin: "agent",
        groupId: question.groupId,
      });
      await db.insert("questSteps", {
        ownerId,
        questId,
        taskId: stepTask.id,
        position: siblings.length,
        gate: siblings.length === 0 ? "available" : "locked",
        deletedAt: undefined,
      });
    }
  }

  const updated = await db.get(question._id);
  if (!updated) throw new Error("Question not found");
  return updated;
}

export type CreateAlertInput = {
  title: string;
  body?: string;
  source?: string;
  groupId?: Id<"spaces">;
  kind?: "note" | "activity";
  authorOrigin?: "self" | "agent" | "member";
};

export async function createAlert(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: CreateAlertInput,
  now = Date.now(),
): Promise<Doc<"alerts">> {
  const source = input.source ?? input.authorOrigin ?? "agent";
  if (source !== "agent" && source !== "member" && source !== "self") {
    throw new Error("Invalid source");
  }
  const kind = input.kind ?? "note";
  const authorOrigin = input.authorOrigin ?? (source === "self" ? "self" : source);
  const groupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, groupId);
  const id = await db.insert("alerts", {
    ownerId,
    groupId,
    title: normalizeTitle(input.title),
    body: input.body,
    source,
    kind,
    authorOrigin,
    // A self-created row is already seen. An agent/member row wears NEW.
    seenAt: authorOrigin === "self" ? now : undefined,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Alert not found");
  return created;
}

/** History shows every readable alert, including seen notes and activity. */
export async function listAlertHistory(
  db: Parameters<typeof readableDocs>[0],
  ownerId: Id<"users">,
): Promise<Doc<"alerts">[]> {
  const rows = await readableDocs(db, ownerId, "alerts");
  return rows
    .filter((row) => row.deletedAt === undefined)
    .sort((a, b) => b._creationTime - a._creationTime);
}
