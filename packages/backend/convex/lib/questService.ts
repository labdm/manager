import type { DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { readableDocs } from "./groupService";

/**
 * Completing an available quest step unlocks the next locked step in the same
 * mutation. If there is no next step the quest simply stays active and waits.
 */
export async function unlockNextQuestStep(
  db: DatabaseWriter,
  taskId: Id<"tasks">,
  ownerId: Id<"users">,
): Promise<void> {
  const ownedSteps = await db
    .query("questSteps")
    .withIndex("by_task", (q) => q.eq("ownerId", ownerId))
    .collect();
  const links = ownedSteps.filter((step) => step.taskId === taskId);

  for (const link of links) {
    if (link.deletedAt !== undefined || link.gate !== "available") {
      continue;
    }
    const siblings = await db
      .query("questSteps")
      .withIndex("by_quest", (q) => q.eq("ownerId", ownerId))
      .collect();
    const next = siblings
      .filter(
        (step) =>
          step.questId === link.questId &&
          step.deletedAt === undefined &&
          step.gate === "locked" &&
          step.position > link.position,
      )
      .sort((a, b) => a.position - b.position)[0];
    if (next) {
      await db.patch(next._id, { gate: "available" });
    }
  }
}

export type QuestStepView = {
  id: string;
  title: string;
  gate: "available" | "locked";
  done: boolean;
};

export type QuestView = {
  id: string;
  title: string;
  status: string;
  waiting: boolean;
  steps: QuestStepView[];
};

export async function questViews(
  db: DatabaseWriter,
  ownerId: Id<"users">,
): Promise<QuestView[]> {
  const quests = await readableDocs(db, ownerId, "quests");
  const readableQuestIds = new Set(quests.map((quest) => String(quest._id)));
  const ownedSteps = await db
    .query("questSteps")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const steps = ownedSteps.filter((step) =>
    readableQuestIds.has(String(step.questId)),
  );
  const taskIds = Array.from(new Set(steps.map((step) => step.taskId)));
  const tasks = await Promise.all(taskIds.map((id) => db.get(id)));
  const taskById = new Map(
    tasks.filter((task): task is Doc<"tasks"> => task !== null).map((task) => [task._id, task]),
  );

  return quests
    .filter((quest) => quest.deletedAt === undefined)
    .map((quest) => {
      const questSteps = steps
        .filter((step) => step.questId === quest._id && step.deletedAt === undefined)
        .sort((a, b) => a.position - b.position);
      const rendered = questSteps.map((step) => ({
        id: String(step._id),
        title: taskById.get(step.taskId)?.title ?? "Step",
        gate: (step.gate === "locked" ? "locked" : "available") as
          | "available"
          | "locked",
        done: taskById.get(step.taskId)?.done ?? false,
      }));
      const hasAvailable = rendered.some(
        (step) => step.gate === "available" && !step.done,
      );
      return {
        id: String(quest._id),
        title: quest.title,
        status: quest.status,
        waiting: quest.status === "active" && !hasAvailable,
        steps: rendered,
      };
    });
}
