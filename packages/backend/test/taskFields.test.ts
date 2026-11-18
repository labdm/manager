import { describe, expect, it } from "vitest";
import { normalizeTitle } from "../convex/lib/taskFields";

describe("normalizeTitle", () => {
  it("trims a usable title", () => {
    expect(normalizeTitle("  Buy milk  ")).toBe("Buy milk");
  });

  it("rejects an empty title", () => {
    expect(() => normalizeTitle("   ")).toThrow("Title is required");
  });
});
