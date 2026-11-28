import type { Id } from "@manager/backend/convex/_generated/dataModel";

export type Destination = "tasks" | "messages" | "groups" | "categories" | "resources";

export const DESTINATIONS: ReadonlyArray<{ id: Destination; label: string; icon: string }> = [
  { id: "tasks", label: "Tasks", icon: "list-checks" },
  { id: "messages", label: "Messages", icon: "message-circle" },
  { id: "groups", label: "Groups", icon: "users" },
  { id: "categories", label: "Categories", icon: "shapes" },
  { id: "resources", label: "Resources", icon: "package" },
];

export type MenuPage = "achievements" | "manage" | "settings" | "about" | "changelog";

export const MENU_ITEMS: ReadonlyArray<{ id: MenuPage; label: string }> = [
  { id: "achievements", label: "Achievements" },
  { id: "manage", label: "Manage" },
  { id: "settings", label: "Settings" },
  { id: "about", label: "About" },
  { id: "changelog", label: "Changelog" },
];

export type Chip = "all" | "daily" | "weekly" | "monthly" | "events";

export const CHIPS: ReadonlyArray<{ id: Chip; label: string }> = [
  { id: "all", label: "Quests" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "events", label: "Events" },
];

/** Shown on the tab, never on the task. */
export const CHIP_HINTS: Partial<Record<Chip, string>> = {
  daily: "Resets at midnight",
  weekly: "Resets Monday",
  monthly: "Resets on the 1st",
};

export type ActivityValue = "others" | "all" | "none";

export const ACTIVITY_OPTIONS: ReadonlyArray<{ id: ActivityValue; label: string }> = [
  { id: "others", label: "Others" },
  { id: "all", label: "All" },
  { id: "none", label: "None" },
];

export type RowType = "task" | "message" | "question" | "invite" | "progression" | "quest";

/** One anatomy for every entity. Empty slots are omitted, never placeholders. */
export interface FeedRow {
  id: string;
  type: RowType;
  title: string;
  body?: string | null;
  isNew?: boolean;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  progress?: string | null;
  action?: string | null;
  groupMark?: boolean;
  dueText?: string | null;
  resourceDelta?: string | null;
  questMark?: boolean;
  taskId?: Id<"tasks"> | string;
  alertId?: string;
  inviteId?: string;
  progressionId?: string;
  questionId?: string;
  options?: ReadonlyArray<{ id: string; label: string }>;
  questId?: string;
  steps?: ReadonlyArray<{ id: string; title: string; done: boolean }>;
  done?: boolean;
  origin?: string | null;
  waiting?: boolean;
  waitingReason?: string | null;
  routineKind?: string | null;
  hint?: string | null;
}

export interface GroupItem {
  id: string;
  name: string;
  isDefault?: boolean;
  role?: string;
  canInvite?: boolean;
}

export interface InviteItem {
  id: string;
  groupId: string;
  email?: string;
  status?: string;
  seenAt?: number | null;
  origin?: string | null;
  groupName?: string | null;
}

export interface AlertRecord {
  id: string;
  title: string;
  body?: string | null;
  seenAt?: number | null;
  origin?: string | null;
  source?: string | null;
  groupId?: string | null;
}

export interface RoutingItem {
  id: string;
  name: string;
  trigger?: string;
  cadence?: string;
  executionKind?: string;
  title?: string;
}

export interface CategoryRecord {
  id: string;
  name?: string;
  title?: string;
  icon?: string | null;
  color?: string | null;
}

export interface ResourceRecord {
  id: string;
  title: string;
  quantity?: number | null;
  unit?: string | null;
  icon?: string | null;
  color?: string | null;
}

export type FormKind =
  | "task"
  | "message"
  | "group"
  | "invite"
  | "category"
  | "resource"
  | "routing"
  | "quest"
  | "progression";

export interface TaskFormDraft {
  title: string;
  plannedDay: string;
  series: "none" | "replace" | "stack";
  cadence: "daily" | "weekly" | "monthly" | "every 14 days";
  routine: "none" | "daily" | "weekly" | "monthly" | "interval";
  every: number;
  everyUnit: "days" | "weeks";
  waiting: boolean;
  waitingReason: string;
  remindAt: string;
  remindTime: string;
}
