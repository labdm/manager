import { describe, expect, it } from "vitest";
import { formatDueAt } from "../src/formatDueAt";

describe("formatDueAt", () => {
  it("returns null when there is no due date", () => {
    expect(formatDueAt(null)).toBeNull();
  });

  it("formats a timestamp", () => {
    expect(formatDueAt(Date.UTC(2026, 10, 18))).toEqual(expect.any(String));
  });
});
