import { describe, expect, it } from "vitest";
import {
  assertMcpRoleProof,
  mcpRolePayload,
  signMcpRolePayload,
} from "../convex/lib/mcpRoleSignature";

const secret = "test-secret";
const clerkUserId = "user_abcdefghij";

process.env.MCP_ROLE_SECRET = secret;

describe("mcp role proof", () => {
  it("accepts a signature it just created", async () => {
    const now = 1_700_000_000_000;
    const expiresAt = now + 10_000;
    const signature = await signMcpRolePayload(
      secret,
      mcpRolePayload(clerkUserId, expiresAt),
    );
    await expect(
      assertMcpRoleProof({ clerkUserId, expiresAt, signature }, now),
    ).resolves.toBeUndefined();
  });

  it("rejects a tampered signature", async () => {
    const now = 1_700_000_000_000;
    const expiresAt = now + 10_000;
    const signature = await signMcpRolePayload(
      secret,
      mcpRolePayload(clerkUserId, expiresAt),
    );
    await expect(
      assertMcpRoleProof(
        { clerkUserId, expiresAt, signature: signature.slice(0, -1) + "A" },
        now,
      ),
    ).rejects.toThrow("Invalid MCP role proof");
  });
});
