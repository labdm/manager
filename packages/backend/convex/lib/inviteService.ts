import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  addMembership,
  assertCanInvite,
  readableGroupIds,
  resolveGroupId,
} from "./groupService";

export type InviteOrigin = "self" | "agent" | "member";

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Invalid email");
  return email;
}

/** Only owner, admin, or an explicit canInvite member may send an invite. */
export async function createInvite(
  db: DatabaseWriter,
  inviterId: Id<"users">,
  input: { groupId?: Id<"spaces">; email: string; origin?: InviteOrigin },
  now = Date.now(),
): Promise<Doc<"invites">> {
  const groupId = await resolveGroupId(db, inviterId, input.groupId);
  await assertCanInvite(db, inviterId, groupId);
  const email = normalizeEmail(input.email);
  const origin = input.origin ?? "self";
  const id = await db.insert("invites", {
    groupId,
    inviterId,
    email,
    status: "pending",
    origin,
    seenAt: origin === "self" ? now : undefined,
    deletedAt: undefined,
  });
  const created = await db.get(id);
  if (!created) throw new Error("Invite not found");
  return created;
}

export async function listInvites(
  db: DatabaseReader,
  userId: Id<"users">,
): Promise<Doc<"invites">[]> {
  const user = await db.get(userId);
  const groups = await readableGroupIds(db, userId);
  const rows = await db.query("invites").collect();
  return rows
    .filter(
      (row) =>
        row.deletedAt === undefined &&
        (groups.has(String(row.groupId)) ||
          (user?.email !== undefined && row.email === user.email.toLowerCase())),
    )
    .sort((a, b) => b._creationTime - a._creationTime);
}

async function invitableInvite(
  db: DatabaseReader,
  userId: Id<"users">,
  inviteId: Id<"invites">,
): Promise<{ invite: Doc<"invites">; user: Doc<"users"> }> {
  const invite = await db.get(inviteId);
  const user = await db.get(userId);
  if (!invite || invite.deletedAt !== undefined) {
    throw new Error("Invite not found");
  }
  if (!user?.email || invite.email !== user.email.toLowerCase()) {
    throw new Error("Invite not found");
  }
  if (invite.status !== "pending") throw new Error("Invite already answered");
  return { invite, user };
}

/** Accept creates a membership only. No starter rows, no default-group removal. */
export async function acceptInvite(
  db: DatabaseWriter,
  userId: Id<"users">,
  inviteId: Id<"invites">,
  now = Date.now(),
): Promise<Doc<"invites">> {
  const { invite } = await invitableInvite(db, userId, inviteId);
  await addMembership(db, userId, invite.groupId, {
    role: "editor",
    canInvite: false,
  });
  await db.patch(inviteId, { status: "accepted", seenAt: now });
  const updated = await db.get(inviteId);
  if (!updated) throw new Error("Invite not found");
  return updated;
}

/** Decline changes the status and marks the row read. Nothing else. */
export async function declineInvite(
  db: DatabaseWriter,
  userId: Id<"users">,
  inviteId: Id<"invites">,
  now = Date.now(),
): Promise<Doc<"invites">> {
  await invitableInvite(db, userId, inviteId);
  await db.patch(inviteId, { status: "declined", seenAt: now });
  const updated = await db.get(inviteId);
  if (!updated) throw new Error("Invite not found");
  return updated;
}

export async function markInviteSeen(
  db: DatabaseWriter,
  userId: Id<"users">,
  inviteId: Id<"invites">,
  now = Date.now(),
): Promise<Doc<"invites">> {
  const invite = await db.get(inviteId);
  const user = await db.get(userId);
  if (
    !invite ||
    invite.deletedAt !== undefined ||
    !user?.email ||
    invite.email !== user.email.toLowerCase()
  ) {
    throw new Error("Invite not found");
  }
  if (invite.seenAt === undefined) {
    await db.patch(inviteId, { seenAt: now });
  }
  const updated = await db.get(inviteId);
  if (!updated) throw new Error("Invite not found");
  return updated;
}
