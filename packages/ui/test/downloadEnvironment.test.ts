import { describe, expect, it } from "vitest";
import { shouldLoadReleases } from "../src/downloadEnvironment";

describe("shouldLoadReleases", () => {
  it("loads releases on production and local builds", () => {
    expect(shouldLoadReleases("production")).toBe(true);
    expect(shouldLoadReleases("development")).toBe(true);
    expect(shouldLoadReleases(undefined)).toBe(true);
  });

  it("skips the release inventory on Vercel previews", () => {
    expect(shouldLoadReleases("preview")).toBe(false);
  });
});
