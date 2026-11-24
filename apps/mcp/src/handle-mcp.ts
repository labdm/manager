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
  "User required",
  "Task not found",
  "Title is required",
  "Invalid dueAt",
  "Invalid plannedOn",
  "Invalid plannedTime",
  "Invalid deadlineAt",
  "Invalid remindAt",
  "Invalid priorityRank",
  "Invalid overduePolicy",
  "Invalid origin",
  "Invalid behavior",
  "Unsupported cadence",
  "Invalid timezone",
  "Invalid epoch",
  "Invalid tab",
  "Invalid computed key",
  "Unknown template",
  "Invalid subject type",
  "Invalid target type",
  "Invalid role",
  "Invalid override mode",
  "Home cannot be deleted",
  "View not found",
  "Attachment not found",
  "Progression not found",
  "Quest not found",
  "Question not found",
  "Question answered",
  "Unknown option",
  "Options are required",
  "Invalid amount",
  "Invalid target",
  "Invalid gate",
  "Invalid quest status",
  "Recurrence not found",
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
  if (!clerkUserId) return { kind: "error" as const, text: "User required" };
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
          if (!clerkUserId) return toolError("User required");
          const lookup = await lookupMcpRole(clerkUserId);
          if (lookup.kind === "misconfigured") return toolError(lookup.message);
          return toolJson({ role: lookup.role, clerkUserId });
        },
      );

      server.registerTool(
        "list_tasks",
        {
          title: "List tasks",
          description:
            "Lists tasks owned by the signed-in user. Does not accept a user id.",
          inputSchema: z.object({}),
        },
        async (_args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(await convexClient().mutation(api.mcpTasks.list, signed.proof));
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
            "Creates a task for the signed-in user. A planned day is not a deadline; never copy one into deadlineAt. Do not create a task for a summary: alerts exist for information.",
          inputSchema: z.object({
            title: z.string(),
            notes: z.string().optional(),
            plannedOn: z.number().optional(),
            plannedTime: z.number().int().min(0).max(1439).optional(),
            dueAt: z.number().optional(),
            location: z.string().optional(),
            deadlineAt: z.number().optional(),
            remindAt: z.number().optional(),
            priority: z.string().optional(),
            priorityRank: z.number().optional(),
            overduePolicy: z.string().optional(),
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
                notes: args.notes,
                plannedOn: args.plannedOn,
                plannedTime: args.plannedTime,
                dueAt: args.dueAt,
                location: args.location,
                deadlineAt: args.deadlineAt,
                remindAt: args.remindAt,
                priority: args.priority,
                priorityRank: args.priorityRank,
                overduePolicy: args.overduePolicy,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create task"));
          }
        },
      );

      server.registerTool(
        "update_task",
        {
          title: "Update task",
          description:
            "Updates one of the signed-in user's tasks. A planned day is not a deadline; never copy one into deadlineAt. Do not create a task for a summary.",
          inputSchema: z.object({
            id: z.string(),
            title: z.string().optional(),
            notes: z.string().optional(),
            plannedOn: z.number().optional(),
            plannedTime: z.number().int().min(0).max(1439).optional(),
            dueAt: z.number().optional(),
            location: z.string().optional(),
            deadlineAt: z.number().optional(),
            remindAt: z.number().optional(),
            priority: z.string().optional(),
            priorityRank: z.number().optional(),
            overduePolicy: z.string().optional(),
            done: z.boolean().optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpTasks.update, {
                ...signed.proof,
                id: args.id as Id<"tasks">,
                title: args.title,
                notes: args.notes,
                plannedOn: args.plannedOn,
                plannedTime: args.plannedTime,
                dueAt: args.dueAt,
                location: args.location,
                deadlineAt: args.deadlineAt,
                remindAt: args.remindAt,
                priority: args.priority,
                priorityRank: args.priorityRank,
                overduePolicy: args.overduePolicy,
                done: args.done,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not update task"));
          }
        },
      );

      server.registerTool(
        "complete_task",
        {
          title: "Complete task",
          description: "Marks one of the signed-in user's tasks done.",
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

      server.registerTool(
        "reopen_task",
        {
          title: "Reopen task",
          description: "Marks one of the signed-in user's tasks not done (reopens it).",
          inputSchema: z.object({
            id: z.string(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpTasks.reopen, {
                ...signed.proof,
                id: args.id as Id<"tasks">,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not reopen task"));
          }
        },
      );

      server.registerTool(
        "delete_task",
        {
          title: "Delete task",
          description: "Deletes one of the signed-in user's tasks.",
          inputSchema: z.object({
            id: z.string(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpTasks.remove, {
                ...signed.proof,
                id: args.id as Id<"tasks">,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not delete task"));
          }
        },
      );

      server.registerTool(
        "create_recurrence",
        {
          title: "Create recurrence",
          description:
            "Creates a recurring series. behavior is required: replace keeps one open occurrence (dishes), stack leaves every period open (journal). The planned day is never a deadline.",
          inputSchema: z.object({
            behavior: z.enum(["replace", "stack"]),
            cadence: z.string(),
            timezone: z.string(),
            title: z.string(),
            notes: z.string().optional(),
            plannedTime: z.number().int().min(0).max(1439).optional(),
            location: z.string().optional(),
            priority: z.string().optional(),
            overduePolicy: z.string().optional(),
            anchorOn: z.number().optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.createRecurrenceTool, {
                ...signed.proof,
                ...args,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create recurrence"));
          }
        },
      );

      server.registerTool(
        "list_recurrences",
        {
          title: "List recurrences",
          description: "Lists the signed-in user's recurring series and mints due occurrences.",
          inputSchema: z.object({}),
        },
        async (_args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.listRecurrencesTool, signed.proof),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not list recurrences"));
          }
        },
      );

      server.registerTool(
        "get_slice",
        {
          title: "Get Home slice",
          description:
            "Returns the Home rail, the current tab's tasks, progressions, quests, alerts and questions for a timezone.",
          inputSchema: z.object({
            tab: z.enum(["tasks", "daily", "weekly", "monthly"]),
            viewId: z.string().optional(),
            timezone: z.string(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.getSlice, {
                ...signed.proof,
                tab: args.tab,
                viewId: args.viewId as Id<"views"> | undefined,
                timezone: args.timezone,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not get slice"));
          }
        },
      );

      server.registerTool(
        "create_view",
        {
          title: "Create view",
          description:
            "Installs a catalog template by slug, enables a computed view by key (new, high, today), or creates a custom view with a title.",
          inputSchema: z.object({
            slug: z.string().optional(),
            key: z.string().optional(),
            title: z.string().optional(),
            icon: z.string().optional(),
            color: z.string().optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.createViewTool, {
                ...signed.proof,
                ...args,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create view"));
          }
        },
      );

      server.registerTool(
        "attach",
        {
          title: "Attach subject to target",
          description:
            "Links a task, progression, quest, event or category to a category, event, quest, progression or space. A second attachment is allowed.",
          inputSchema: z.object({
            subjectType: z.string(),
            subjectId: z.string(),
            targetType: z.string(),
            targetId: z.string(),
            role: z.enum(["primary", "extra"]).optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.attachTool, {
                ...signed.proof,
                ...args,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not attach"));
          }
        },
      );

      server.registerTool(
        "detach",
        {
          title: "Detach",
          description: "Soft-deletes an attachment without deleting the subject.",
          inputSchema: z.object({ attachmentId: z.string() }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.detachTool, {
                ...signed.proof,
                attachmentId: args.attachmentId as Id<"attachments">,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not detach"));
          }
        },
      );

      const pinSchemas = {
        viewId: z.string(),
        subjectType: z.string(),
        subjectId: z.string(),
      };
      const pinBody = (args: {
        viewId: string;
        subjectType: string;
        subjectId: string;
      }) => ({
        viewId: args.viewId as Id<"views">,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
      });

      server.registerTool(
        "pin",
        {
          title: "Pin to view",
          description: "Sorts a subject first in one view without changing its priority or date.",
          inputSchema: z.object(pinSchemas),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.pinTool, {
                ...signed.proof,
                ...pinBody(args),
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not pin"));
          }
        },
      );

      server.registerTool(
        "unpin",
        {
          title: "Unpin from view",
          description: "Removes a pin from one view.",
          inputSchema: z.object(pinSchemas),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.unpinTool, {
                ...signed.proof,
                ...pinBody(args),
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not unpin"));
          }
        },
      );

      for (const mode of ["include", "exclude"] as const) {
        server.registerTool(
          mode,
          {
            title: mode === "include" ? "Include in view" : "Exclude from view",
            description:
              mode === "include"
                ? "Adds a subject to a computed view without changing its fields."
                : "Hides a subject from a computed view without deleting it.",
            inputSchema: z.object(pinSchemas),
          },
          async (args, ctx) => {
            const signed = await signedProof(ctx.http?.authInfo);
            if (signed.kind !== "ok") return toolError(signed.text);
            try {
              const fn =
                mode === "include"
                  ? api.mcpBoard.includeTool
                  : api.mcpBoard.excludeTool;
              return toolJson(
                await convexClient().mutation(fn, {
                  ...signed.proof,
                  ...pinBody(args),
                }),
              );
            } catch (error) {
              return toolError(knownError(error, `Could not ${mode}`));
            }
          },
        );
      }

      server.registerTool(
        "create_progression",
        {
          title: "Create progression",
          description: "Creates a meter or step track shown as a bar in the Home column.",
          inputSchema: z.object({
            title: z.string(),
            mode: z.enum(["meter", "steps"]).optional(),
            target: z.number(),
            unit: z.string().optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.createProgressionTool, {
                ...signed.proof,
                ...args,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create progression"));
          }
        },
      );

      server.registerTool(
        "log_progress",
        {
          title: "Log progress",
          description: "Adds an amount to a meter progression.",
          inputSchema: z.object({
            progressionId: z.string(),
            amount: z.number(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.logProgressTool, {
                ...signed.proof,
                progressionId: args.progressionId as Id<"progressions">,
                amount: args.amount,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not log progress"));
          }
        },
      );

      server.registerTool(
        "create_quest",
        {
          title: "Create quest",
          description: "Creates a chain of tasks. Steps are added with add_quest_step.",
          inputSchema: z.object({
            title: z.string(),
            status: z.string().optional(),
            scripting: z.string().optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.createQuestTool, {
                ...signed.proof,
                ...args,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create quest"));
          }
        },
      );

      server.registerTool(
        "add_quest_step",
        {
          title: "Add quest step",
          description:
            "Adds a task as a quest step. Later steps start locked and unlock when the available step is completed.",
          inputSchema: z.object({
            questId: z.string(),
            taskId: z.string(),
            position: z.number().optional(),
            gate: z.enum(["available", "locked"]).optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.addQuestStepTool, {
                ...signed.proof,
                questId: args.questId as Id<"quests">,
                taskId: args.taskId as Id<"tasks">,
                position: args.position,
                gate: args.gate,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not add quest step"));
          }
        },
      );

      server.registerTool(
        "create_question",
        {
          title: "Create question",
          description: "Creates an open question with options. Not a task and has no checkbox.",
          inputSchema: z.object({
            prompt: z.string(),
            options: z.array(
              z.object({
                id: z.string().optional(),
                label: z.string(),
                effect: z.any().optional(),
              }),
            ),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.createQuestionTool, {
                ...signed.proof,
                ...args,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create question"));
          }
        },
      );

      server.registerTool(
        "answer_question",
        {
          title: "Answer question",
          description: "Records the chosen option and removes the question from the open board.",
          inputSchema: z.object({
            questionId: z.string(),
            optionId: z.string(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.answerQuestionTool, {
                ...signed.proof,
                questionId: args.questionId as Id<"questions">,
                optionId: args.optionId,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not answer question"));
          }
        },
      );

      server.registerTool(
        "create_alert",
        {
          title: "Create alert",
          description:
            "Writes an informational note to the alert band. Use this for summaries; alerts have no checkbox.",
          inputSchema: z.object({
            title: z.string(),
            body: z.string().optional(),
            source: z.enum(["agent", "member"]).optional(),
          }),
        },
        async (args, ctx) => {
          const signed = await signedProof(ctx.http?.authInfo);
          if (signed.kind !== "ok") return toolError(signed.text);
          try {
            return toolJson(
              await convexClient().mutation(api.mcpBoard.createAlertTool, {
                ...signed.proof,
                ...args,
              }),
            );
          } catch (error) {
            return toolError(knownError(error, "Could not create alert"));
          }
        },
      );
    },
    {
      serverInfo: { name: "manager", version: "0.1.0" },
      instructions:
        "Manager user MCP. Sign in once with Clerk OAuth; the client refreshes the access token. whoami reads users.role in Convex. create_task, update_task, list_tasks, complete_task, reopen_task, and delete_task use the tasks table. create_recurrence is real: choose replace for dishes (one open occurrence, older ones superseded) or stack for a journal (every period stays open); behavior is required. Views, attachments, pins, include/exclude, progressions, quests, questions and alerts are available through get_slice and the matching create tools. Never copy a planned day into a deadline, never copy a deadline into a planned day, and do not create a task for a summary: write an alert instead.",
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
  }

  return mcpHandler(resource.url)(request);
}
