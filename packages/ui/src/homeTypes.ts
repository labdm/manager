import type { TaskItem } from "./taskTypes";

/** The four date slices from `board:slice`, plus the Events filter chip. */
export type BoardTab = "tasks" | "daily" | "weekly" | "monthly" | "events";

export const BOARD_TABS: ReadonlyArray<{ id: Exclude<BoardTab, "events">; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

/** A task as it appears on the mixed board. */
export interface BoardTask extends TaskItem {
  pinned?: boolean;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  questMark?: boolean;
  progression?: { current: number; target: number; unit?: string } | null;
  resourceDelta?: number | null;
  routineKind?: string | null;
  waiting?: boolean;
  waitingReason?: string | null;
  streak?: number | null;
  resetHint?: string | null;
  remindAt?: number | null;
  remindMinutes?: number | null;
}

export interface ProgressionItem {
  id: string;
  title: string;
  mode: "meter" | "steps" | string;
  current: number;
  target: number;
  unit: string;
  icon?: string | null;
  color?: string | null;
  questMark?: boolean;
}

export interface QuestStepItem {
  id: string;
  title: string;
  gate?: string | null;
  done: boolean;
}

export interface QuestItem {
  id: string;
  title: string;
  status: string;
  waiting: boolean;
  steps: QuestStepItem[];
}

export interface AlertItem {
  id: string;
  title: string;
  body?: string | null;
  seenAt?: number | null;
  origin?: string | null;
  source?: string | null;
  groupId?: string | null;
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface QuestionItem {
  id: string;
  prompt: string;
  options: QuestionOption[];
  seenAt?: number | null;
  origin?: string | null;
  groupId?: string | null;
}

/** Counts used by the Achievements menu page. Zeros are fine when absent. */
export interface AchievementCounts {
  completedTasks: number;
  missedTasks: number;
  supersededTasks: number;
  progressionCurrent: number;
  progressionTarget: number;
  questsActive: number;
  questsCompleted: number;
}

export interface BoardSlice {
  rail?: unknown[];
  activeViewId?: string;
  tab?: BoardTab;
  tasks: BoardTask[];
  progressions: ProgressionItem[];
  quests: QuestItem[];
  alerts: AlertItem[];
  questions: QuestionItem[];
  achievements?: Partial<AchievementCounts> | null;
  unseen?: Partial<Record<BoardTab | "all", number>> | null;
}

export interface BoardSliceArgs {
  [key: string]: unknown;
  tab: BoardTab;
  viewId?: string;
  timezone: string;
  groupId?: string;
}
