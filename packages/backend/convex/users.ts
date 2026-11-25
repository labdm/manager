import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { createDefaultGroup, defaultGroupForUser } from "./lib/groupService";

/**
 * Clerk user ids (`user_…`) or full tokenIdentifiers from `ADMIN_CLERK_USER_IDS`.
 * Email allowlists are intentionally unused: Clerk's default Convex JWT omits
 * `email` / `email_verified`, so email matching is either ineffective or unsafe.
 */
function adminClerkIdSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_CLERK_USER_IDS ?? "")
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean),
  );
}

function shouldBeAdmin(identity: {
  subject?: string | null;
  tokenIdentifier: string;
}): boolean {
  const ids = adminClerkIdSet();
  if (ids.size === 0) return false;
  const subject = identity.subject?.trim();
  if (subject && ids.has(subject)) return true;
  for (const id of ids) {
    if (identity.tokenIdentifier === id || identity.tokenIdentifier.endsWith(`|${id}`)) {
      return true;
    }
  }
  return false;
}

/** Common helper to look up or provision a user by token identifier. */
export async function upsertUserByTokenIdentifier(
  ctx: MutationCtx,
  tokenIdentifier: string,
  details?: { name?: string; email?: string; clerkUserId?: string },
): Promise<Doc<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();

  const promote = shouldBeAdmin({
    subject: details?.clerkUserId,
    tokenIdentifier,
  });

  const name = details?.name ?? undefined;
  const email = details?.email ?? undefined;

  if (existing) {
    const patch: Partial<Doc<"users">> = {};
    if (name && name !== existing.name) patch.name = name;
    if (email && email !== existing.email) patch.email = email;
    if (promote && existing.role !== "admin") patch.role = "admin";
    if (existing.activityOnTasks === undefined) patch.activityOnTasks = "others";

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
    }
    // The default group is created with the user. No lazy group-less path.
    await defaultGroupForUser(ctx.db, existing._id);
    return {
      ...existing,
      ...patch,
      role: promote ? "admin" : existing.role,
    };
  }

  const id = await ctx.db.insert("users", {
    tokenIdentifier,
    name,
    email,
    role: promote ? "admin" : "user",
    activityOnTasks: "others",
  });
  await createDefaultGroup(ctx.db, id);
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Could not create user");
  return created;
}

/** Look up a user by token identifier without mutating. */
export async function findUserByTokenIdentifier(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

async function upsertFromIdentity(
  ctx: MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return await upsertUserByTokenIdentifier(ctx, identity.tokenIdentifier, {
    name: identity.name ?? undefined,
    email: identity.email ?? undefined,
    clerkUserId: identity.subject ?? undefined,
  });
}

/** First authenticated call upserts the users row. */
export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    return await upsertFromIdentity(ctx);
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  },
});

/** Which activity records appear on the Tasks page. History ignores this. */
export const setActivityOnTasks = mutation({
  args: {
    value: v.union(v.literal("others"), v.literal("all"), v.literal("none")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { activityOnTasks: args.value });
    return { ...user, activityOnTasks: args.value };
  },
});

export async function findCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
}

export async function requireUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await upsertFromIdentity(ctx);
  if (!user) {
    throw new Error("Sign in required");
  }
  return user;
}

export async function requireAdmin(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Admin required");
  }
  return user;
}
