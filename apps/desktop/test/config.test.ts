import { describe, expect, it } from "vitest";
import { desktopConfigError } from "../src/config";

describe("desktopConfigError", () => {
  it("names both missing variables", () => {
    expect(desktopConfigError({})).toBe(
      "VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY are not set",
    );
  });

  it("names one missing variable", () => {
    expect(desktopConfigError({ convexUrl: "https://example.convex.cloud" })).toBe(
      "VITE_CLERK_PUBLISHABLE_KEY is not set",
    );
  });

  it("accepts a Convex URL and Clerk publishable key", () => {
    expect(
      desktopConfigError({
        convexUrl: "https://example.convex.cloud",
        clerkPublishableKey: "pk_test_example",
      }),
    ).toBeNull();
  });

  it("rejects a Clerk secret key", () => {
    expect(
      desktopConfigError({
        convexUrl: "https://example.convex.cloud",
        clerkPublishableKey: "sk_test_example",
      }),
    ).toBe("VITE_CLERK_PUBLISHABLE_KEY must be a Clerk publishable key");
  });
});
