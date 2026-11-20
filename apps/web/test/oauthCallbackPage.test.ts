import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const callbackPage = readFileSync(
  fileURLToPath(new URL("../public/oauth-callback.html", import.meta.url)),
  "utf8",
);

describe("desktop OAuth completion page", () => {
  it("forwards Clerk parameters to the registered desktop deep link", () => {
    expect(callbackPage).toContain(
      'var callbackUrl = "dev.labdm.manager://callback" + clerkParams;',
    );
    expect(callbackPage).toContain("window.location.href = callbackUrl;");
  });

  it("uses a renderable success page instead of a custom scheme navigation", () => {
    expect(callbackPage).toContain("<h1>Signed in</h1>");
    expect(callbackPage).toContain("You can close this tab");
  });
});
