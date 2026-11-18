import { afterEach, describe, expect, it } from "vitest";
import { handleMcp } from "../src/handle-mcp";

const keys = [
  "MCP_RESOURCE_URL",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CONVEX_URL",
  "MCP_ROLE_SECRET",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_CONVEX_URL",
] as const;

const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("handleMcp", () => {
  it("returns 503 when the endpoint is not configured", async () => {
    for (const key of keys) delete process.env[key];
    const response = await handleMcp(new Request("https://manager.labdm.dev/mcp"));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("MCP_RESOURCE_URL is not set");
  });
});
