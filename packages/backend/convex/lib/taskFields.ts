export const TITLE_MAX = 200;

export type Presentation = "check" | "row" | "card";

/** Blank presentation means "no override"; absent tasks render as check rows. */
export function normalizePresentation(value: string | undefined): Presentation | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === "check" || trimmed === "row" || trimmed === "card") return trimmed;
  throw new Error("Invalid presentation");
}

export function normalizeTitle(input: string): string {
  const title = input.trim();
  if (!title || title.length > TITLE_MAX) throw new Error("Title is required");
  return title;
}

export function assertDueAt(dueAt: number | undefined): void {
  if (dueAt !== undefined && !Number.isSafeInteger(dueAt)) {
    throw new Error("Invalid dueAt");
  }
}

export function assertEpoch(value: number | undefined, name: string): void {
  if (value !== undefined && !Number.isSafeInteger(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

export function assertPlannedTime(plannedTime: number | undefined): void {
  if (
    plannedTime !== undefined &&
    (!Number.isInteger(plannedTime) || plannedTime < 0 || plannedTime > 1439)
  ) {
    throw new Error("Invalid plannedTime");
  }
}

export const SEED_PRIORITIES = {
  low: 0,
  normal: 10,
  high: 20,
  urgent: 30,
} as const;

export type SeedPriority = keyof typeof SEED_PRIORITIES;

export function isSeedPriority(priority: string | undefined): priority is SeedPriority {
  return priority !== undefined && priority in SEED_PRIORITIES;
}

export function resolvePriorityAndRank(
  priority: string | undefined,
  priorityRank: number | undefined,
): { priority: string; priorityRank: number } {
  if (priorityRank !== undefined && !Number.isSafeInteger(priorityRank)) {
    throw new Error("Invalid priorityRank");
  }
  if (priority === undefined) {
    return { priority: "normal", priorityRank: 10 };
  }
  const trimmed = priority.trim();
  if (!trimmed) {
    return { priority: "normal", priorityRank: 10 };
  }
  if (isSeedPriority(trimmed)) {
    return { priority: trimmed, priorityRank: SEED_PRIORITIES[trimmed] };
  }
  return {
    priority: trimmed,
    priorityRank: priorityRank !== undefined ? priorityRank : 10,
  };
}

export type OverduePolicy = "none" | "retire" | "escalate";
export const VALID_OVERDUE_POLICIES = new Set<OverduePolicy>(["none", "retire", "escalate"]);

export function normalizeOverduePolicy(policy: string | undefined): OverduePolicy {
  if (policy === undefined) return "none";
  const trimmed = policy.trim() as OverduePolicy;
  if (!VALID_OVERDUE_POLICIES.has(trimmed)) {
    throw new Error("Invalid overduePolicy");
  }
  return trimmed;
}

export type TaskOrigin = "self" | "agent" | "member";
export const VALID_ORIGINS = new Set<TaskOrigin>(["self", "agent", "member"]);

export function assertOrigin(origin: string | undefined): void {
  if (origin !== undefined && !VALID_ORIGINS.has(origin as TaskOrigin)) {
    throw new Error("Invalid origin");
  }
}

export function resolvePlannedDates(input: {
  dueAt?: number;
  plannedOn?: number;
}): { dueAt?: number; plannedOn?: number } {
  assertDueAt(input.dueAt);
  assertEpoch(input.plannedOn, "plannedOn");
  let dueAt = input.dueAt;
  let plannedOn = input.plannedOn;
  if (dueAt !== undefined && plannedOn === undefined) {
    plannedOn = dueAt;
  } else if (plannedOn !== undefined && dueAt === undefined) {
    dueAt = plannedOn;
  }
  return { dueAt, plannedOn };
}
