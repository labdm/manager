import { describe, expect, it } from "vitest";
import { webConfigError } from "../src/config";

describe("webConfigError", () => {
  it("names missing variables", () => {
    expect(webConfigError({})).toBe(
      "VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY are not set",
    );
  });

  it("accepts a Clerk publishable key", () => {
    expect(
      webConfigError({
        convexUrl: "http://127.0.0.1:3210",
        clerkPublishableKey: "pk_test_example",
      }),
    ).toBeNull();
  });
});
