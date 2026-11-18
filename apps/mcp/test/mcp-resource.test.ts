import { afterEach, describe, expect, it } from "vitest";
import { mcpResourceUrl } from "../src/mcp-auth";

const original = process.env.MCP_RESOURCE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.MCP_RESOURCE_URL;
  else process.env.MCP_RESOURCE_URL = original;
});

describe("mcpResourceUrl", () => {
  it("accepts the production resource URL", () => {
    process.env.MCP_RESOURCE_URL = "https://manager.labdm.dev/mcp";
    expect(mcpResourceUrl()).toEqual({
      kind: "ok",
      url: "https://manager.labdm.dev/mcp",
    });
  });

  it("rejects a trailing slash", () => {
    process.env.MCP_RESOURCE_URL = "https://manager.labdm.dev/mcp/";
    expect(mcpResourceUrl().kind).toBe("error");
  });

  it("allows localhost http", () => {
    process.env.MCP_RESOURCE_URL = "http://localhost:3000/mcp";
    expect(mcpResourceUrl()).toEqual({
      kind: "ok",
      url: "http://localhost:3000/mcp",
    });
  });
});
