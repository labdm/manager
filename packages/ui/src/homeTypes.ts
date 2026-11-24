import type { TaskItem } from "./taskTypes";

/** The four horizontal slices on Home. `tasks` has no date filter. */
export type BoardTab = "tasks" | "daily" | "weekly" | "monthly";

export const BOARD_TABS: ReadonlyArray<{ id: BoardTab; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

export type ViewKind = "home" | "computed" | "template" | "custom" | string;

export interface BoardView {
  id: string;
  title: string;
  icon: string;
  color: string;
  kind: ViewKind;
}

/**
 * A task as it appears on the board. The board query returns the same shape as
 * `tasks.list`, with the view pin flag included when the row is pinned.
 */
export interface BoardTask extends TaskItem {
  pinned?: boolean;
}

export interface ProgressionItem {
  id: string;
  title: string;
  mode: "meter" | "steps" | string;
  current: number;
  target: number;
  unit: string;
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
  body: string;
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface QuestionItem {
  id: string;
  prompt: string;
  options: QuestionOption[];
}

export interface BoardSlice {
  rail: BoardView[];
  activeViewId: string;
  tab: BoardTab;
  tasks: BoardTask[];
  progressions: ProgressionItem[];
  quests: QuestItem[];
  alerts: AlertItem[];
  questions: QuestionItem[];
}

export interface ViewTemplate {
  slug: string;
  title: string;
  icon: string;
  color: string;
}

export interface CustomViewInput {
  title: string;
  icon: string;
  color: string;
}

export interface BoardSliceArgs {
  tab: BoardTab;
  viewId?: string;
  timezone: string;
}

export const HOME_VIEW: BoardView = {
  id: "home",
  title: "Home",
  icon: "house",
  color: "sky",
  kind: "home",
};

/** A board without a server rail still has Home, and Home is always first. */
export function withHomeView(rail: BoardView[] | null | undefined): BoardView[] {
  const views = rail ?? [];
  const homeIndex = views.findIndex(
    (view) => view.kind === "home" || view.id === HOME_VIEW.id
  );
  if (homeIndex === -1) return [HOME_VIEW, ...views];
  if (homeIndex === 0) return views;
  const home = views[homeIndex];
  return [home, ...views.filter((_, index) => index !== homeIndex)];
}
