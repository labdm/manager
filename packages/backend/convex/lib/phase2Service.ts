import type { DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeTitle } from "./taskFields";
import { createTask } from "./taskService";

function requireOwned<T extends { ownerId: Id<"users">; deletedAt?: number }>(
  row: T | null,
  ownerId: Id<"users">,
  label: string,
): T {
  if (!row || row.ownerId !== ownerId || row.deletedAt !== undefined) {
    throw new Error(`${label} not found`);
  }
  return row;
}

export async function createProgression(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { title: string; mode?: string; target: number; unit?: string },
): Promise<Doc<"progressions">> {
  const mode = input.mode === "steps" ? "steps" : "meter";
  if (!Number.isSafeInteger(input.target) || input.target < 0) {
    throw new Error("Invalid target");
  }
  const id = await db.insert("progressions", {
    ownerId,
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
  const row = requireOwned(
    await db.get(input.progressionId),
    ownerId,
    "Progression",
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
  input: { title: string; status?: string; scripting?: string },
): Promise<Doc<"quests">> {
  const status = input.status ?? "active";
  if (!["active", "completed", "archived"].includes(status)) {
    throw new Error("Invalid quest status");
  }
  const id = await db.insert("quests", {
    ownerId,
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
  },
): Promise<Doc<"questSteps">> {
  const quest = requireOwned(await db.get(input.questId), ownerId, "Quest");
  const task = requireOwned(await db.get(input.taskId), ownerId, "Task");
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
  const id = await db.insert("questions", {
    ownerId,
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
  const question = requireOwned(
    await db.get(input.questionId),
    ownerId,
    "Question",
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

export async function createAlert(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: { title: string; body?: string; source?: string },
): Promise<Doc<"alerts">> {
  const source = input.source ?? "agent";
  if (source !== "agent" && source !== "member") {
    throw new Error("Invalid source");
  }
  const id = await db.insert("alerts", {
    ownerId,
    title: normalizeTitle(input.title),
    body: input.body,
    source,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Alert not found");
  return created;
}
