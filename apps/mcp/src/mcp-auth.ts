import { createClerkClient } from "@clerk/backend";
import { verifyClerkToken } from "@clerk/mcp-tools/server";
import {
  isClerkUserId,
  mcpRolePayload,
  signMcpRolePayload,
  MCP_ROLE_TTL_MS,
  type ClerkUserId,
} from "@manager/backend/convex/lib/mcpRoleSignature";
import { api } from "@manager/backend/convex/_generated/api";
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { ConvexHttpClient } from "convex/browser";

export const MCP_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource/mcp";

/** Baseline scope. `offline_access` stays off this list; the client requests it. */
export const MCP_SCOPES: readonly ["profile"] = ["profile"];

const ROLE_CHECK_FAILED =
  "MCP role check failed. Confirm MCP_ROLE_SECRET is the same value on this server and on Convex.";

const CONVEX_CONFIG_MESSAGES = [
  "MCP_ROLE_SECRET is not set",
  "CLERK_FRONTEND_API_URL is not set",
  "CLERK_FRONTEND_API_URL must not have a trailing slash",
] as const;

export type McpResourceUrlResult =
  | { kind: "ok"; url: string }
  | { kind: "error"; message: string };

export type McpOauthResult =
  | { kind: "anonymous" }
  | { kind: "invalid" }
  | { kind: "authenticated"; clerkUserId: ClerkUserId; authInfo: AuthInfo };

export function invalidMcpToken(): OAuthError {
  return new OAuthError(OAuthErrorCode.InvalidToken, "Invalid token");
}

function presentedBearer(request: Request): string | undefined {
  const header = request.headers.get("Authorization");
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

export type McpRoleLookup =
  | { kind: "role"; role: "admin" | "user" | null }
  | { kind: "misconfigured"; message: string };

export type McpRoleProof =
  | {
      kind: "ok";
      clerkUserId: ClerkUserId;
      expiresAt: number;
      signature: string;
    }
  | { kind: "misconfigured"; message: string };

const oauthByRequest = new WeakMap<Request, Promise<McpOauthResult>>();

export function clerkPublishableKey(): string {
  return (
    process.env.CLERK_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export function convexDeploymentUrl(): string {
  return (
    process.env.CONVEX_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ||
    ""
  );
}

export function mcpResourceUrl(): McpResourceUrlResult {
  const raw = process.env.MCP_RESOURCE_URL?.trim() ?? "";
  if (!raw) return { kind: "error", message: "MCP_RESOURCE_URL is not set" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      kind: "error",
      message:
        "MCP_RESOURCE_URL must be the absolute /mcp URL with no query, hash, or trailing slash",
    };
  }

  const localhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "http:" && !localhost) {
    return {
      kind: "error",
      message:
        "MCP_RESOURCE_URL must use https (http is only allowed for localhost)",
    };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      kind: "error",
      message:
        "MCP_RESOURCE_URL must be the absolute /mcp URL with no query, hash, or trailing slash",
    };
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/mcp"
  ) {
    return {
      kind: "error",
      message:
        "MCP_RESOURCE_URL must be the absolute /mcp URL with no query, hash, or trailing slash",
    };
  }

  return { kind: "ok", url: url.origin + url.pathname };
}

function clerkKeyError(
  name: "CLERK_SECRET_KEY" | "CLERK_PUBLISHABLE_KEY",
  value: string,
  prefix: "sk_" | "pk_",
): string | null {
  if (!value) return `${name} is not set`;
  if (!value.startsWith(`${prefix}test_`) && !value.startsWith(`${prefix}live_`)) {
    return name === "CLERK_SECRET_KEY"
      ? "CLERK_SECRET_KEY must be a Clerk secret key"
      : "CLERK_PUBLISHABLE_KEY must be a Clerk publishable key";
  }
  return null;
}

/** Discovery documents need the resource URL and the Clerk publishable key. */
export function mcpMetadataConfigError(): string | null {
  const problems: string[] = [];
  const resource = mcpResourceUrl();
  if (resource.kind === "error") problems.push(resource.message);
  const publishable = clerkKeyError(
    "CLERK_PUBLISHABLE_KEY",
    clerkPublishableKey(),
    "pk_",
  );
  if (publishable) problems.push(publishable);
  return problems.length > 0 ? problems.join("; ") : null;
}

/** The MCP endpoint also needs a secret key, Convex URL, and the role secret. */
export function mcpEndpointConfigError(): string | null {
  const problems: string[] = [];
  const metadata = mcpMetadataConfigError();
  if (metadata) problems.push(metadata);
  const secret = clerkKeyError(
    "CLERK_SECRET_KEY",
    process.env.CLERK_SECRET_KEY?.trim() ?? "",
    "sk_",
  );
  if (secret) problems.push(secret);
  if (!convexDeploymentUrl()) problems.push("CONVEX_URL is not set");
  if (!process.env.MCP_ROLE_SECRET?.trim()) {
    problems.push("MCP_ROLE_SECRET is not set");
  }
  return problems.length > 0 ? problems.join("; ") : null;
}

export function mcpResourceMetadataUrl(resourceUrl: string): string {
  return new URL(MCP_RESOURCE_METADATA_PATH, resourceUrl).href;
}

async function verifyMcpOauthUncached(
  request: Request,
  resourceUrl: string,
): Promise<McpOauthResult> {
  if (!presentedBearer(request)) return { kind: "anonymous" };
  try {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: clerkPublishableKey(),
    });
    const requestState = await clerk.authenticateRequest(request, {
      acceptsToken: "oauth_token",
      audience: resourceUrl,
    });
    if (!requestState.isAuthenticated) return { kind: "invalid" };

    const authInfo = verifyClerkToken(requestState.toAuth(), requestState.token);
    if (!authInfo || !isClerkUserId(authInfo.extra.userId)) {
      return { kind: "invalid" };
    }

    return {
      kind: "authenticated",
      clerkUserId: authInfo.extra.userId,
      authInfo: {
        token: authInfo.token,
        clientId: authInfo.clientId,
        scopes: authInfo.scopes,
        extra: { userId: authInfo.extra.userId },
        resourceMetadataUrl: mcpResourceMetadataUrl(resourceUrl),
      },
    };
  } catch {
    return { kind: "invalid" };
  }
}

/** Verifies the OAuth access token. Does not read a browser session. */
export function verifyMcpOauth(
  request: Request,
  resourceUrl: string,
): Promise<McpOauthResult> {
  const cached = oauthByRequest.get(request);
  if (cached) return cached;
  const pending = verifyMcpOauthUncached(request, resourceUrl);
  oauthByRequest.set(request, pending);
  return pending;
}

export function clerkUserIdFromAuthInfo(
  authInfo: AuthInfo | undefined,
): ClerkUserId | undefined {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string" || !isClerkUserId(userId)) return undefined;
  return userId;
}

/** Short-lived HMAC the MCP route sends to Convex. The bearer is not included. */
export async function mcpRoleProof(
  clerkUserId: ClerkUserId,
): Promise<McpRoleProof> {
  const secret = process.env.MCP_ROLE_SECRET?.trim() ?? "";
  if (!secret) {
    return { kind: "misconfigured", message: "MCP_ROLE_SECRET is not set" };
  }
  if (!convexDeploymentUrl()) {
    return { kind: "misconfigured", message: "CONVEX_URL is not set" };
  }

  const expiresAt = Date.now() + MCP_ROLE_TTL_MS;
  const signature = await signMcpRolePayload(
    secret,
    mcpRolePayload(clerkUserId, expiresAt),
  );
  return { kind: "ok", clerkUserId, expiresAt, signature };
}

/**
 * Reads `users.role` for a Clerk user id that was already taken from a
 * verified OAuth token. The bearer is not passed to Convex.
 */
export async function lookupMcpRole(
  clerkUserId: ClerkUserId,
): Promise<McpRoleLookup> {
  const proof = await mcpRoleProof(clerkUserId);
  if (proof.kind !== "ok") return proof;

  try {
    const client = new ConvexHttpClient(convexDeploymentUrl());
    const result = await client.query(api.mcpAuth.roleForClerkUser, {
      clerkUserId: proof.clerkUserId,
      expiresAt: proof.expiresAt,
      signature: proof.signature,
    });
    return { kind: "role", role: result.role };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    for (const known of CONVEX_CONFIG_MESSAGES) {
      if (message.includes(known)) {
        return { kind: "misconfigured", message: known };
      }
    }
    return { kind: "misconfigured", message: ROLE_CHECK_FAILED };
  }
}
