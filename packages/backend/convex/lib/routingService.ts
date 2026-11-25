import type { DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  assertCanWriteGroup,
  memberCanWrite,
  membershipFor,
  readableGroupIds,
  resolveGroupId,
} from "./groupService";
import { assertTimezone, periodStartFor } from "./civilDates";
import { addQuestStep, createAlert, logProgress } from "./phase2Service";
import { applyResourceDelta } from "./resourceService";
import * as taskService from "./taskService";

export type StateEvent = "completed" | "reopened" | "deleted" | "low";

export type StateChange = {
  subjectType: "task" | "resource" | "questStep";
  subjectId: string;
  event: StateEvent;
  /** The caller passes the revision of the write that fired the routing. */
  revision: string;
};

function runKeyForCron(routing: Doc<"routings">, periodStart: number): string {
  return `cron:${String(routing._id)}:${periodStart}`;
}

function runKeyForState(routing: Doc<"routings">, change: StateChange): string {
  return `state:${String(routing._id)}:${change.subjectId}:${change.revision}`;
}

const EXECUTION_GATES = new Set(["available", "locked"]);

/** Reject a broken execution when the routing is created, not during a user write. */
function assertExecutionPayload(execution: Doc<"routings">["execution"]): void {
  if (execution.type === "createTask" || execution.type === "createMessage") {
    if (!execution.title.trim()) throw new Error("Name is required");
    return;
  }
  if (execution.type === "logProgress") {
    if (!Number.isSafeInteger(execution.amount)) throw new Error("Invalid amount");
    return;
  }
  if (execution.type === "resourceDelta") {
    if (!Number.isFinite(execution.delta)) throw new Error("Invalid delta");
    return;
  }
  if (!execution.title.trim()) throw new Error("Name is required");
  if (execution.gate !== undefined && !EXECUTION_GATES.has(execution.gate)) {
    throw new Error("Invalid gate");
  }
}

/** An execution must only touch rows in the routing's own group. */
async function assertExecutionRefs(
  db: DatabaseWriter,
  groupId: Id<"spaces">,
  execution: Doc<"routings">["execution"],
): Promise<void> {
  if (
    execution.type !== "logProgress" &&
    execution.type !== "resourceDelta" &&
    execution.type !== "addQuestStep"
  ) {
    return;
  }
  const id =
    execution.type === "logProgress"
      ? execution.progressionId
      : execution.type === "resourceDelta"
        ? execution.resourceId
        : execution.questId;
  const label =
    execution.type === "logProgress"
      ? "Progression"
      : execution.type === "resourceDelta"
        ? "Resource"
        : "Quest";
  const row = await db.get(id);
  if (
    !row ||
    row.deletedAt !== undefined ||
    String(row.groupId) !== String(groupId)
  ) {
    throw new Error(`${label} not found`);
  }
}

/**
 * Identifies one state-changing write. The random suffix keeps two genuine
 * writes in the same millisecond from sharing an idempotency key; Convex gives
 * mutations a deterministic crypto implementation, so retries stay stable.
 */
export function stateRevision(prefix: string): string {
  return `${prefix}:${Date.now()}:${crypto.randomUUID()}`;
}

export async function createRouting(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  input: {
    name: string;
    trigger: Doc<"routings">["trigger"];
    execution: Doc<"routings">["execution"];
    groupId?: Id<"spaces">;
  },
  now = Date.now(),
): Promise<Doc<"routings">> {
  const groupId = await resolveGroupId(db, ownerId, input.groupId);
  await assertCanWriteGroup(db, ownerId, groupId);
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const cron = input.trigger.type === "cron" ? input.trigger : undefined;
  if (cron) {
    if (cron.cadence !== "daily" && cron.cadence !== "weekly" && cron.cadence !== "monthly") {
      throw new Error("Invalid cadence");
    }
    if (!Number.isFinite(cron.anchorOn)) throw new Error("Invalid anchorOn");
    try {
      assertTimezone(cron.timezone);
    } catch {
      throw new Error("Invalid timezone");
    }
  }
  assertExecutionPayload(input.execution);
  await assertExecutionRefs(db, groupId, input.execution);
  const id = await db.insert("routings", {
    ownerId,
    groupId,
    name,
    trigger: input.trigger,
    execution: input.execution,
    deletedAt: undefined,
    createdAt: now,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Routing not found");
  return created;
}

export async function listRoutings(
  db: Parameters<typeof resolveGroupId>[0],
  ownerId: Id<"users">,
): Promise<Doc<"routings">[]> {
  const groups = await readableGroupIds(db, ownerId);
  const rows = await db
    .query("routings")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  return rows.filter(
    (row) => row.deletedAt === undefined && groups.has(String(row.groupId)),
  );
}

export async function removeRouting(
  db: DatabaseWriter,
  ownerId: Id<"users">,
  routingId: Id<"routings">,
  now = Date.now(),
): Promise<{ success: true; id: Id<"routings"> }> {
  const routing = await db.get(routingId);
  if (!routing || routing.deletedAt !== undefined || routing.ownerId !== ownerId) {
    throw new Error("Routing not found");
  }
  await assertCanWriteGroup(db, ownerId, routing.groupId);
  await db.patch(routingId, { deletedAt: now });
  return { success: true, id: routingId };
}

async function alreadyRan(
  db: DatabaseWriter,
  routingId: Id<"routings">,
  key: string,
): Promise<boolean> {
  const runs = await db
    .query("routingRuns")
    .withIndex("by_routing_key", (q) =>
      q.eq("routingId", routingId).eq("key", key),
    )
    .collect();
  return runs.length > 0;
}

async function executeRouting(
  db: DatabaseWriter,
  routing: Doc<"routings">,
  now: number,
): Promise<void> {
  // A routing is an automation, not a veto on the caller's own write. If its
  // group or permission has gone away, the run is skipped silently.
  const group = await db.get(routing.groupId);
  if (!group || group.deletedAt !== undefined) return;
  const member = await membershipFor(db, routing.ownerId, routing.groupId);
  if (!memberCanWrite(member)) return;

  const execution = routing.execution;
  let cronPeriod: number | undefined;
  if (routing.trigger.type === "cron") {
    try {
      cronPeriod = periodStartFor(
        routing.trigger.cadence,
        now,
        routing.trigger.timezone,
        routing.trigger.anchorOn,
      );
    } catch {
      return;
    }
  }

  if (execution.type === "createTask") {
    if (!execution.title.trim()) return;
    await taskService.createTask(db, routing.ownerId, {
      title: execution.title,
      notes: execution.notes,
      plannedOn: execution.plannedOn ?? cronPeriod,
      groupId: routing.groupId,
      origin: "self",
    });
    return;
  }

  if (execution.type === "logProgress") {
    if (!Number.isSafeInteger(execution.amount)) return;
    const progression = await db.get(execution.progressionId);
    if (
      !progression ||
      progression.deletedAt !== undefined ||
      String(progression.groupId) !== String(routing.groupId)
    ) {
      return;
    }
    await logProgress(db, routing.ownerId, {
      progressionId: execution.progressionId,
      amount: execution.amount,
    });
    return;
  }

  if (execution.type === "createMessage") {
    if (!execution.title.trim()) return;
    await createAlert(
      db,
      routing.ownerId,
      {
        title: execution.title,
        body: execution.body,
        groupId: routing.groupId,
        kind: "activity",
        authorOrigin: "agent",
      },
      now,
    );
    return;
  }

  if (execution.type === "resourceDelta") {
    if (!Number.isFinite(execution.delta)) return;
    const resource = await db.get(execution.resourceId);
    if (
      !resource ||
      resource.deletedAt !== undefined ||
      String(resource.groupId) !== String(routing.groupId)
    ) {
      return;
    }
    await applyResourceDelta(
      db,
      routing.ownerId,
      execution.resourceId,
      execution.delta,
      now,
    );
    return;
  }

  if (!execution.title.trim()) return;
  if (execution.gate !== undefined && !EXECUTION_GATES.has(execution.gate)) return;
  const quest = await db.get(execution.questId);
  if (
    !quest ||
    quest.deletedAt !== undefined ||
    String(quest.groupId) !== String(routing.groupId)
  ) {
    return;
  }
  const task = await taskService.createTask(db, routing.ownerId, {
    title: execution.title,
    groupId: routing.groupId,
    origin: "self",
  });
  await addQuestStep(db, routing.ownerId, {
    questId: execution.questId,
    taskId: task.id,
    gate: execution.gate,
  });
}

async function runOnce(
  db: DatabaseWriter,
  routing: Doc<"routings">,
  key: string,
  now: number,
): Promise<{ ran: boolean; key: string }> {
  if (routing.deletedAt !== undefined) return { ran: false, key };
  if (await alreadyRan(db, routing._id, key)) return { ran: false, key };
  // The key is recorded in the same transaction as the execution. A failure
  // rolls both back, so a failed path never consumes the idempotency key.
  await db.insert("routingRuns", {
    routingId: routing._id,
    key,
    ownerId: routing.ownerId,
    groupId: routing.groupId,
    ranAt: now,
  });
  await executeRouting(db, routing, now);
  return { ran: true, key };
}

export async function runCronRouting(
  db: DatabaseWriter,
  routing: Doc<"routings">,
  now = Date.now(),
): Promise<{ ran: boolean; key: string }> {
  if (routing.trigger.type !== "cron") throw new Error("Not a cron routing");
  const periodStart = periodStartFor(
    routing.trigger.cadence,
    now,
    routing.trigger.timezone,
    routing.trigger.anchorOn,
  );
  return await runOnce(db, routing, runKeyForCron(routing, periodStart), now);
}

/** The cron calls this beside recurrence reconcile. It never deletes replace/stack. */
export async function runDueRoutings(
  db: DatabaseWriter,
  now = Date.now(),
): Promise<{ considered: number; ran: number }> {
  const rows = await db.query("routings").collect();
  let ran = 0;
  let considered = 0;
  for (const row of rows) {
    if (row.deletedAt !== undefined || row.trigger.type !== "cron") continue;
    considered += 1;
    try {
      const result = await runCronRouting(db, row as Doc<"routings">, now);
      if (result.ran) ran += 1;
    } catch {
      // One broken routing must not stop the rest of the tick.
    }
  }
  return { considered, ran };
}

/** Fired from task complete/reopen/delete and the resource low-stock path. */
export async function fireStateRoutings(
  db: DatabaseWriter,
  groupId: Id<"spaces">,
  change: StateChange,
  now = Date.now(),
): Promise<number> {
  const rows = await db
    .query("routings")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  let ran = 0;
  for (const row of rows) {
    if (row.deletedAt !== undefined || row.trigger.type !== "state") continue;
    if (
      row.trigger.subjectType !== change.subjectType ||
      row.trigger.event !== change.event
    ) {
      continue;
    }
    try {
      const result = await runOnce(
        db,
        row as Doc<"routings">,
        runKeyForState(row as Doc<"routings">, change),
        now,
      );
      if (result.ran) ran += 1;
    } catch {
      // A broken automation must not fail the caller's task or stock write.
    }
  }
  return ran;
}
