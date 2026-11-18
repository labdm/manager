import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { api } from "@manager/backend/convex/_generated/api";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import {
  MCP_RESOURCE_METADATA_PATH,
  MCP_SCOPES,
  clerkUserIdFromAuthInfo,
  convexDeploymentUrl,
  invalidMcpToken,
  lookupMcpRole,
  mcpEndpointConfigError,
  mcpResourceUrl,
  mcpRoleProof,
  verifyMcpOauth,
} from "./mcp-auth.js";

const NO_STORE = { "Cache-Control": "no-store" };

const KNOWN_TOOL_ERRORS = [
  "MCP_ROLE_SECRET is not set",
  "CLERK_FRONTEND_API_URL is not set",
  "CLERK_FRONTEND_API_URL must not have a trailing slash",
  "CONVEX_URL is not set",
  "Admin required",
  "Task not found",
  "Title is required",
  "Invalid dueAt",
] as const;

function misconfigured(message: string): Response {
  return Response.json({ error: message }, { status: 503, headers: NO_STORE });
}

function toolError(text: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text }],
  };
}

function toolJson(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

function knownError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  for (const known of KNOWN_TOOL_ERRORS) {
    if (message.includes(known)) return known;
  }
  return fallback;
}

function convexClient(): ConvexHttpClient {
  return new ConvexHttpClient(convexDeploymentUrl());
}

async function signedProof(authInfo: Parameters<typeof clerkUserIdFromAuthInfo>[0]) {
  const clerkUserId = clerkUserIdFromAuthInfo(authInfo);
  if (!clerkUserId) return { kind: "error" as const, text: "Admin required" };
  const proof = await mcpRoleProof(clerkUserId);
  if (proof.kind !== "ok") return { kind: "error" as const, text: proof.message };
  return {
    kind: "ok" as const,
    proof: {
      clerkUserId: proof.clerkUserId,
      expiresAt: proof.expiresAt,
      signature: proof.signature,
    },
  };
}

function mcpHandler(resourceUrl: string) {
  const handler = createMcpHandler(
    (server) => {
      server.registerTool(
        "whoami",
        {
          title: "Who am I",
          description:
            "Returns the Manager users.role for the Clerk user in the verified OAuth token. Does not accept a user id.",
          inputSchema: z.object({}),
        },
        async (_args, ctx) => {
          const clerkUserId = clerkUserIdFromAuthInfo(ctx.http?.authInfo);
          if (!clerkUserId) return toolError("Admin required");
          const lookup = await lookupMcpRole(clerkUserId);
          if (lookup.kind === "misconfigured") return toolError(lookup.message);
          if (lookup.role !== "admin") return toolError("Admin required");
          return toolJson({ role: lookup.role, clerkUserId });
        },
      );

      server.registerTool(
        "list_tasks",
        {
          title: "List tasks",
          description:
            "Lists tasks owned by the signed-in admin. Does not accept a user id.",
          inputSchema: z.object({}),
        },
        async (_args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(await convexClient().query(api.mcpTasks.list, signed.proof));
          } catch (error) {
            return toolError(knownError(error, "Could not list tasks"));
          }
        },
      );

      server.registerTool(
        "create_task",
        {
          title: "Create task",
          description:
            "Creates a task for the signed-in admin. dueAt is optional Unix milliseconds.",
          inputSchema: z.object({
            title: z.string(),
            dueAt: z.number().optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpTasks.create, {
                ...signed.proof,
                title: args.title,
                dueAt: args.dueAt,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create task"));
          }
        },
      );

      server.registerTool(
        "complete_task",
        {
          title: "Complete task",
          description: "Marks one of the signed-in admin's tasks done.",
          inputSchema: z.object({
            id: z.string(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpTasks.complete, {
                ...signed.proof,
                id: args.id as Id<"tasks">,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not complete task"));
          }
        },
      );
    },
    {
      serverInfo: { name: "manager", version: "0.1.0" },
      instructions:
        "Manager admin MCP. Sign in once with Clerk OAuth; the client refreshes the access token. whoami reads users.role in Convex. create_task, list_tasks, and complete_task use the tasks table.",
      maxSubscriptions: 0,
    },
  );

  return withMcpAuth(
    handler,
    async (request) => {
      const oauth = await verifyMcpOauth(request, resourceUrl);
      if (oauth.kind === "invalid") throw invalidMcpToken();
      if (oauth.kind !== "authenticated") return undefined;
      return oauth.authInfo;
    },
    {
      required: true,
      requiredScopes: [...MCP_SCOPES],
      resourceUrl: new URL(resourceUrl).origin,
      resourceMetadataPath: MCP_RESOURCE_METADATA_PATH,
    },
  );
}

export async function handleMcp(request: Request): Promise<Response> {
  const configError = mcpEndpointConfigError();
  if (configError) return misconfigured(configError);

  const resource = mcpResourceUrl();
  if (resource.kind !== "ok") return misconfigured(resource.message);

  const oauth = await verifyMcpOauth(request, resource.url);
  if (oauth.kind === "authenticated") {
    const lookup = await lookupMcpRole(oauth.clerkUserId);
    if (lookup.kind === "misconfigured") return misconfigured(lookup.message);
    if (lookup.role !== "admin") {
      return Response.json(
        { error: "Admin required" },
        { status: 403, headers: NO_STORE },
      );
    }
  }

  return mcpHandler(resource.url)(request);
}
