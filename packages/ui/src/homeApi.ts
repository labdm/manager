import { makeFunctionReference } from "convex/server";
import type {
  AchievementCounts,
  AlertItem,
  BoardSlice,
  BoardSliceArgs,
} from "./homeTypes";
import type { TaskCreatePayload } from "./taskTypes";
import type {
  CategoryRecord,
  GroupItem,
  InviteItem,
  ResourceRecord,
  RoutingItem,
  ActivityValue,
} from "./shellTypes";

/**
 * Every call in the shell uses makeFunctionReference. Some handlers land with
 * later layout milestones; until then a rejection is shown on the detail pane
 * rather than hidden behind a local-only edit.
 */
export const ensureUserRef = makeFunctionReference<"mutation", Record<string, never>, unknown>(
  "users:ensure"
);

export const boardSliceRef = makeFunctionReference<
  "mutation",
  BoardSliceArgs,
  BoardSlice
>("board:slice");

export const markSeenRef = makeFunctionReference<
  "mutation",
  { id: string },
  { seenAt?: number } | unknown
>("tasks:markSeen");

export const toggleTaskRef = makeFunctionReference<
  "mutation",
  { id: string },
  unknown
>("tasks:toggle");

export const removeTaskRef = makeFunctionReference<
  "mutation",
  { id: string },
  unknown
>("tasks:remove");

export const createTaskRef = makeFunctionReference<
  "mutation",
  TaskCreatePayload,
  { id: string }
>("tasks:create");

export const createRecurrenceRef = makeFunctionReference<
  "mutation",
  {
    behavior: "replace" | "stack";
    cadence: string;
    timezone: string;
    title: string;
    anchorOn?: number;
  },
  unknown
>("recurrences:create");

export const listAlertsRef = makeFunctionReference<
  "query",
  Record<string, never>,
  AlertItem[]
>("alerts:list");

export const createAlertRef = makeFunctionReference<
  "mutation",
  { title: string; body?: string },
  unknown
>("alerts:create");

export const readAlertRef = makeFunctionReference<
  "mutation",
  { id: string },
  unknown
>("alerts:read");

export const listGroupsRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { groups: GroupItem[] }
>("groups:list");

export const createGroupRef = makeFunctionReference<
  "mutation",
  { name: string },
  { id: string }
>("groups:create");

export const listInvitesRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { invites: InviteItem[] }
>("invites:list");

export const createInviteRef = makeFunctionReference<
  "mutation",
  { groupId: string; email: string },
  { id: string }
>("invites:create");

export const acceptInviteRef = makeFunctionReference<
  "mutation",
  { inviteId: string },
  unknown
>("invites:accept");

export const declineInviteRef = makeFunctionReference<
  "mutation",
  { inviteId: string },
  unknown
>("invites:decline");

export const listRoutingsRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { routings: RoutingItem[] }
>("routings:list");

export const createRoutingRef = makeFunctionReference<
  "mutation",
  {
    name: string;
    trigger: "cron";
    cadence: "daily" | "weekly" | "monthly";
    executionKind: "createTask";
    title: string;
  },
  unknown
>("routings:create");

export const setActivityRef = makeFunctionReference<
  "mutation",
  { value: ActivityValue },
  unknown
>("users:setActivityOnTasks");

export const listCategoriesRef = makeFunctionReference<
  "query",
  Record<string, never>,
  CategoryRecord[]
>("categories:list");

export const createCategoryRef = makeFunctionReference<
  "mutation",
  { name: string; icon?: string; color?: string },
  unknown
>("categories:create");

export const listResourcesRef = makeFunctionReference<
  "query",
  Record<string, never>,
  ResourceRecord[]
>("resources:list");

export const createResourceRef = makeFunctionReference<
  "mutation",
  { title: string; quantity: number; unit?: string },
  unknown
>("resources:create");

export const listEventsRef = makeFunctionReference<
  "query",
  Record<string, never>,
  unknown[]
>("events:list");

/** `board:slice` may carry counts; the Achievements page falls back to zeros. */
export const ZERO_ACHIEVEMENTS: AchievementCounts = {
  completedTasks: 0,
  missedTasks: 0,
  supersededTasks: 0,
  progressionCurrent: 0,
  progressionTarget: 0,
  questsActive: 0,
  questsCompleted: 0,
};
