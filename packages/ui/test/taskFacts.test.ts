import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OVERDUE_POLICY,
  DEFAULT_PRIORITY,
  DEFAULT_PRIORITY_RANK,
  PRIORITY_SEEDS,
  civilDayToTimestamp,
  computeEffectiveRank,
  dateTimeLocalToTimestamp,
  formatInstant,
  formatPlannedDay,
  isOverdue,
  isTaskNew,
  mapDraftToCreatePayload,
  mapDraftToUpdatePayload,
  minutesToTimeStr,
  openTaskAction,
  timeStrToMinutes,
} from "../src/taskFacts";
import type { TaskItem } from "../src/taskTypes";

describe("NEW rule", () => {
  it("marks agent-created tasks with no seenAt as NEW", () => {
    expect(isTaskNew({ origin: "agent", seenAt: null })).toBe(true);
    expect(isTaskNew({ origin: "agent", seenAt: undefined })).toBe(true);
    expect(isTaskNew({ origin: "agent" })).toBe(true);
  });

  it("marks member-created tasks with no seenAt as NEW", () => {
    expect(isTaskNew({ origin: "member", seenAt: null })).toBe(true);
    expect(isTaskNew({ origin: "member", seenAt: undefined })).toBe(true);
    expect(isTaskNew({ origin: "member" })).toBe(true);
  });

  it("does not mark agent or member tasks as NEW once seenAt is set", () => {
    expect(isTaskNew({ origin: "agent", seenAt: 1700000000000 })).toBe(false);
    expect(isTaskNew({ origin: "member", seenAt: 1700000000000 })).toBe(false);
  });

  it("does not mark self-created tasks as NEW", () => {
    expect(isTaskNew({ origin: "self", seenAt: null })).toBe(false);
    expect(isTaskNew({ origin: "self", seenAt: undefined })).toBe(false);
    expect(isTaskNew({ origin: "self", seenAt: 1700000000000 })).toBe(false);
  });

  it("does not mark tasks with missing origin as NEW", () => {
    expect(isTaskNew({ seenAt: null })).toBe(false);
    expect(isTaskNew({ seenAt: undefined })).toBe(false);
    expect(isTaskNew({ origin: undefined, seenAt: null })).toBe(false);
    expect(isTaskNew({ origin: null, seenAt: null })).toBe(false);
    expect(isTaskNew({})).toBe(false);
  });

  it("does not mark a row NEW just because it is rendered", () => {
    const renderedRow = {
      title: "Play Witcher",
      origin: "self" as const,
      seenAt: 1700000000000,
    };
    expect(isTaskNew(renderedRow)).toBe(false);
  });
});

describe("Opening clearing NEW", () => {
  it("calls tasks.markSeen with the id when opening an unseen row", async () => {
    const now = 1700000500000;
    const markSeenMock = vi.fn().mockResolvedValue({ seenAt: now });
    const taskId = "task_123" as Id<"tasks">;
    const task: TaskItem = {
      id: taskId,
      title: "Install Omarchy",
      done: false,
      dueAt: null,
      origin: "agent",
      seenAt: null,
    };

    expect(isTaskNew(task)).toBe(true);

    const result = await openTaskAction(task, markSeenMock, now);

    expect(markSeenMock).toHaveBeenCalledTimes(1);
    expect(markSeenMock).toHaveBeenCalledWith({ id: taskId });
    expect(result).toEqual({ seenAt: now });

    // With seenAt set after opening, the NEW mark leaves
    const openedTask: TaskItem = { ...task, seenAt: result?.seenAt };
    expect(isTaskNew(openedTask)).toBe(false);
  });

  it("uses the seenAt returned by tasks.markSeen", async () => {
    const backendSeenAt = 1700000999999;
    const markSeenMock = vi.fn().mockResolvedValue({ seenAt: backendSeenAt });
    const taskId = "task_456" as Id<"tasks">;
    const task: TaskItem = {
      id: taskId,
      title: "Read the brief",
      done: false,
      dueAt: null,
      origin: "member",
      seenAt: null,
    };

    const result = await openTaskAction(task, markSeenMock, 1700000500000);

    expect(result).toEqual({ seenAt: backendSeenAt });
    expect(isTaskNew({ ...task, seenAt: result?.seenAt })).toBe(false);
  });

  it("does not call tasks.markSeen when opening an already-seen row", async () => {
    const markSeenMock = vi.fn().mockResolvedValue({ success: true });
    const taskId = "task_456" as Id<"tasks">;
    const task: TaskItem = {
      id: taskId,
      title: "Review notes",
      done: false,
      dueAt: null,
      origin: "agent",
      seenAt: 1700000100000,
    };

    expect(isTaskNew(task)).toBe(false);

    const result = await openTaskAction(task, markSeenMock);
    expect(markSeenMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("does not clear NEW if markSeen fails", async () => {
    const markSeenMock = vi.fn().mockRejectedValue(new Error("Network failed"));
    const taskId = "task_789" as Id<"tasks">;
    const task: TaskItem = {
      id: taskId,
      title: "Sync files",
      done: false,
      dueAt: null,
      origin: "member",
      seenAt: null,
    };

    expect(isTaskNew(task)).toBe(true);

    await expect(openTaskAction(task, markSeenMock)).rejects.toThrow(
      "Network failed"
    );
    expect(markSeenMock).toHaveBeenCalledWith({ id: taskId });

    // seenAt is not set, row remains NEW
    expect(isTaskNew(task)).toBe(true);
  });
});

describe("Planned-day versus deadline mapping", () => {
  it("mirrors plannedDay onto plannedOn and dueAt", () => {
    const payload = mapDraftToCreatePayload({
      title: "Do dishes",
      plannedDay: "2026-11-24",
    });

    const expectedDay = civilDayToTimestamp("2026-11-24");
    expect(payload.plannedOn).toBe(expectedDay);
    expect(payload.dueAt).toBe(expectedDay);
    expect(payload.deadlineAt).toBeUndefined();
  });

  it("never copies deadline into plannedOn or dueAt", () => {
    const deadlineStr = "2026-11-24T18:00";
    const payload = mapDraftToCreatePayload({
      title: "File taxes",
      deadline: deadlineStr,
    });

    const expectedDeadline = dateTimeLocalToTimestamp(deadlineStr);
    expect(payload.deadlineAt).toBe(expectedDeadline);
    expect(payload.plannedOn).toBeUndefined();
    expect(payload.dueAt).toBeUndefined();
  });

  it("maintains separate plannedDay and deadline when both are provided", () => {
    const payload = mapDraftToCreatePayload({
      title: "File taxes",
      plannedDay: "2026-11-24",
      deadline: "2026-11-25T17:00",
    });

    const expectedPlannedDay = civilDayToTimestamp("2026-11-24");
    const expectedDeadline = dateTimeLocalToTimestamp("2026-11-25T17:00");

    expect(payload.plannedOn).toBe(expectedPlannedDay);
    expect(payload.dueAt).toBe(expectedPlannedDay);
    expect(payload.deadlineAt).toBe(expectedDeadline);
    expect(payload.plannedOn).not.toEqual(payload.deadlineAt);
  });

  it("updates plannedDay and deadline independently on edit", () => {
    const taskId = "task_edit_1" as Id<"tasks">;

    // Clearing plannedDay leaves deadline intact. Optional Convex args are
    // omitted, never sent as null.
    const update1 = mapDraftToUpdatePayload(taskId, {
      title: "Edited task",
      plannedDay: "",
      deadline: "2026-11-25T17:00",
    });
    expect(update1.plannedOn).toBeUndefined();
    expect(update1.dueAt).toBeUndefined();
    expect(update1.deadlineAt).toBe(
      dateTimeLocalToTimestamp("2026-11-25T17:00")
    );
    expect(Object.values(update1).some((value) => value === null)).toBe(false);

    // Clearing deadline leaves plannedDay intact
    const update2 = mapDraftToUpdatePayload(taskId, {
      title: "Edited task",
      plannedDay: "2026-11-24",
      deadline: "",
    });
    expect(update2.plannedOn).toBe(civilDayToTimestamp("2026-11-24"));
    expect(update2.dueAt).toBe(civilDayToTimestamp("2026-11-24"));
    expect(update2.deadlineAt).toBeUndefined();
    expect(Object.values(update2).some((value) => value === null)).toBe(false);
  });

  it("handles plannedTime in minutes from midnight (0-1439)", () => {
    expect(timeStrToMinutes("00:00")).toBe(0);
    expect(timeStrToMinutes("09:30")).toBe(570);
    expect(timeStrToMinutes("23:59")).toBe(1439);
    expect(timeStrToMinutes("24:00")).toBeNull(); // out of range
    expect(timeStrToMinutes("invalid")).toBeNull();

    expect(minutesToTimeStr(0)).toBe("00:00");
    expect(minutesToTimeStr(570)).toBe("09:30");
    expect(minutesToTimeStr(1439)).toBe("23:59");
    expect(minutesToTimeStr(1440)).toBe("");
  });

  it("seeds priority: low (0), normal (10), high (20), urgent (30), default normal", () => {
    expect(PRIORITY_SEEDS.low.rank).toBe(0);
    expect(PRIORITY_SEEDS.normal.rank).toBe(10);
    expect(PRIORITY_SEEDS.high.rank).toBe(20);
    expect(PRIORITY_SEEDS.urgent.rank).toBe(30);

    const omittedPayload = mapDraftToCreatePayload({ title: "Default priority" });
    expect(omittedPayload.priority).toBe(DEFAULT_PRIORITY);
    expect(omittedPayload.priorityRank).toBe(DEFAULT_PRIORITY_RANK);
    expect(omittedPayload.overduePolicy).toBe(DEFAULT_OVERDUE_POLICY);

    const highPayload = mapDraftToCreatePayload({
      title: "High priority task",
      priority: "high",
    });
    expect(highPayload.priority).toBe("high");
    expect(highPayload.priorityRank).toBe(20);
  });

  it("computes isOverdue and effectiveRank with escalate policy", () => {
    const past = 1000;
    const future = 5000;
    const now = 3000;

    expect(isOverdue(past, false, now)).toBe(true);
    expect(isOverdue(past, true, now)).toBe(false); // completed task is not overdue
    expect(isOverdue(future, false, now)).toBe(false);
    expect(isOverdue(null, false, now)).toBe(false);

    // Escalate bumps seed rank by 10, capped at 30
    expect(computeEffectiveRank("normal", 10, true, "escalate")).toBe(20);
    expect(computeEffectiveRank("high", 20, true, "escalate")).toBe(30);
    expect(computeEffectiveRank("urgent", 30, true, "escalate")).toBe(30); // capped at 30
    expect(computeEffectiveRank("low", 0, true, "escalate")).toBe(10);

    // Escalate has no effect if not overdue or policy is not escalate
    expect(computeEffectiveRank("normal", 10, false, "escalate")).toBe(10);
    expect(computeEffectiveRank("normal", 10, true, "none")).toBe(10);
    expect(computeEffectiveRank("normal", 10, true, "retire")).toBe(10);

    // Non-seed custom priority string keeps rank and is not bumped
    expect(computeEffectiveRank("custom_prio", 15, true, "escalate")).toBe(15);
  });

  it("formats planned day and instant labels correctly", () => {
    const day = civilDayToTimestamp("2026-11-24");
    expect(formatPlannedDay(day)).toEqual(expect.any(String));
    expect(formatPlannedDay(day, 570)).toContain("09:30");
    expect(formatPlannedDay(null)).toBeNull();

    expect(formatInstant(day)).toEqual(expect.any(String));
    expect(formatInstant(null)).toBeNull();
  });
});
