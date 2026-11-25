import type { Doc } from "../_generated/dataModel";
import { civilDayStart } from "./civilDates";
import { memberCanInvite } from "./groupService";

/**
 * Clients do not send a timezone. Cron routings created from the shell use
 * UTC and anchor on the civil day of the call. Richer triggers stay on the
 * service and on the MCP tool.
 */
export const CLIENT_CRON_TIMEZONE = "UTC";

export function flatCronRouting(input: {
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  title: string;
  groupId?: Doc<"spaces">["_id"];
  now?: number;
}): {
  name: string;
  groupId?: Doc<"spaces">["_id"];
  trigger: {
    type: "cron";
    cadence: "daily" | "weekly" | "monthly";
    timezone: string;
    anchorOn: number;
  };
  execution: { type: "createTask"; title: string };
} {
  const now = input.now ?? Date.now();
  return {
    name: input.name,
    groupId: input.groupId,
    trigger: {
      type: "cron",
      cadence: input.cadence,
      timezone: CLIENT_CRON_TIMEZONE,
      anchorOn: civilDayStart(now, CLIENT_CRON_TIMEZONE),
    },
    execution: { type: "createTask", title: input.title },
  };
}

/** Screen row for `groups:list`. `canInvite` is the effective permission. */
export function groupWire(
  group: Doc<"spaces">,
  member: Doc<"spaceMembers"> | null,
): {
  id: Doc<"spaces">["_id"];
  name: string;
  isDefault: boolean;
  role?: Doc<"spaceMembers">["role"];
  canInvite: boolean;
  icon?: string;
  color?: string;
} {
  return {
    id: group._id,
    name: group.name,
    isDefault: group.isDefault,
    role: member?.role,
    canInvite: memberCanInvite(member),
    icon: group.icon,
    color: group.color,
  };
}

export function inviteWire(
  invite: Doc<"invites">,
  groupName?: string,
): {
  id: Doc<"invites">["_id"];
  groupId: Doc<"spaces">["_id"];
  email: string;
  status: Doc<"invites">["status"];
  seenAt?: number;
  origin: Doc<"invites">["origin"];
  groupName?: string;
} {
  return {
    id: invite._id,
    groupId: invite.groupId,
    email: invite.email,
    status: invite.status,
    seenAt: invite.seenAt,
    origin: invite.origin,
    groupName,
  };
}

/**
 * Flat row the shells draw. `title` repeats the routing name because Android
 * labels the row from `title`, while web and Apple use `name`.
 */
export function routingWire(routing: Doc<"routings">): {
  id: Doc<"routings">["_id"];
  name: string;
  title: string;
  trigger: Doc<"routings">["trigger"]["type"];
  cadence?: "daily" | "weekly" | "monthly";
  executionKind: Doc<"routings">["execution"]["type"];
  execution: Doc<"routings">["execution"]["type"];
} {
  const executionKind = routing.execution.type;
  return {
    id: routing._id,
    name: routing.name,
    title: routing.name,
    trigger: routing.trigger.type,
    cadence: routing.trigger.type === "cron" ? routing.trigger.cadence : undefined,
    executionKind,
    execution: executionKind,
  };
}
