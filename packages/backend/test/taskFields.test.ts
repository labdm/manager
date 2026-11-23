import { describe, expect, it } from "vitest";
import {
  assertEpoch,
  assertOrigin,
  assertPlannedTime,
  normalizeOverduePolicy,
  normalizeTitle,
  resolvePlannedDates,
  resolvePriorityAndRank,
} from "../convex/lib/taskFields";

describe("normalizeTitle", () => {
  it("trims a usable title", () => {
    expect(normalizeTitle("  Buy milk  ")).toBe("Buy milk");
  });

  it("rejects an empty title", () => {
    expect(() => normalizeTitle("   ")).toThrow("Title is required");
  });
});

describe("plannedTime", () => {
  it("accepts valid plannedTime minutes (0 to 1439)", () => {
    expect(() => assertPlannedTime(0)).not.toThrow();
    expect(() => assertPlannedTime(720)).not.toThrow();
    expect(() => assertPlannedTime(1439)).not.toThrow();
    expect(() => assertPlannedTime(undefined)).not.toThrow();
  });

  it("rejects invalid plannedTime", () => {
    expect(() => assertPlannedTime(-1)).toThrow("Invalid plannedTime");
    expect(() => assertPlannedTime(1440)).toThrow("Invalid plannedTime");
    expect(() => assertPlannedTime(12.5)).toThrow("Invalid plannedTime");
  });
});

describe("epoch validation", () => {
  it("accepts safe integers", () => {
    expect(() => assertEpoch(1700000000000, "deadlineAt")).not.toThrow();
    expect(() => assertEpoch(undefined, "deadlineAt")).not.toThrow();
  });

  it("rejects non-safe integers", () => {
    expect(() => assertEpoch(1.5, "deadlineAt")).toThrow("Invalid deadlineAt");
    expect(() => assertEpoch(Number.NaN, "remindAt")).toThrow("Invalid remindAt");
  });
});

describe("resolvePriorityAndRank", () => {
  it("defaults omitted priority to normal and rank 10", () => {
    expect(resolvePriorityAndRank(undefined, undefined)).toEqual({
      priority: "normal",
      priorityRank: 10,
    });
  });

  it("forces seed rank regardless of passed priorityRank", () => {
    expect(resolvePriorityAndRank("low", 99)).toEqual({
      priority: "low",
      priorityRank: 0,
    });
    expect(resolvePriorityAndRank("normal", 99)).toEqual({
      priority: "normal",
      priorityRank: 10,
    });
    expect(resolvePriorityAndRank("high", 99)).toEqual({
      priority: "high",
      priorityRank: 20,
    });
    expect(resolvePriorityAndRank("urgent", 99)).toEqual({
      priority: "urgent",
      priorityRank: 30,
    });
  });

  it("keeps custom string rank if passed, or defaults to 10", () => {
    expect(resolvePriorityAndRank("custom-tier", 25)).toEqual({
      priority: "custom-tier",
      priorityRank: 25,
    });
    expect(resolvePriorityAndRank("custom-tier", undefined)).toEqual({
      priority: "custom-tier",
      priorityRank: 10,
    });
  });

  it("rejects non-safe integer priorityRank", () => {
    expect(() => resolvePriorityAndRank("custom", 1.5)).toThrow("Invalid priorityRank");
  });
});

describe("normalizeOverduePolicy", () => {
  it("defaults omitted overduePolicy to none", () => {
    expect(normalizeOverduePolicy(undefined)).toBe("none");
  });

  it("accepts valid policies", () => {
    expect(normalizeOverduePolicy("none")).toBe("none");
    expect(normalizeOverduePolicy("retire")).toBe("retire");
    expect(normalizeOverduePolicy("escalate")).toBe("escalate");
  });

  it("rejects any other policy", () => {
    expect(() => normalizeOverduePolicy("carry_forward")).toThrow("Invalid overduePolicy");
    expect(() => normalizeOverduePolicy("unknown")).toThrow("Invalid overduePolicy");
  });
});

describe("assertOrigin", () => {
  it("allows self, agent, member", () => {
    expect(() => assertOrigin("self")).not.toThrow();
    expect(() => assertOrigin("agent")).not.toThrow();
    expect(() => assertOrigin("member")).not.toThrow();
    expect(() => assertOrigin(undefined)).not.toThrow();
  });

  it("rejects invalid origin", () => {
    expect(() => assertOrigin("alien")).toThrow("Invalid origin");
  });
});

describe("resolvePlannedDates", () => {
  it("mirrors dueAt to plannedOn", () => {
    expect(resolvePlannedDates({ dueAt: 1000 })).toEqual({
      dueAt: 1000,
      plannedOn: 1000,
    });
  });

  it("mirrors plannedOn to dueAt", () => {
    expect(resolvePlannedDates({ plannedOn: 2000 })).toEqual({
      dueAt: 2000,
      plannedOn: 2000,
    });
  });

  it("keeps both if both provided", () => {
    expect(resolvePlannedDates({ dueAt: 1000, plannedOn: 1000 })).toEqual({
      dueAt: 1000,
      plannedOn: 1000,
    });
  });
});
