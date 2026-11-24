import { useState } from "react";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import {
  COMPUTED_VIEWS,
  VIEW_TEMPLATES,
  normalizeColorToken,
  type ComputedViewSlug,
} from "./homeCatalog";
import {
  BOARD_TABS,
  withHomeView,
  type AlertItem,
  type BoardTab,
  type BoardTask,
  type BoardView,
  type ProgressionItem,
  type QuestionItem,
  type QuestItem,
} from "./homeTypes";
import { ViewIcon } from "./ViewIcon";
import {
  buildDraftFromTask,
  formatInstant,
  formatPlannedDay,
  isOverdue,
  isTaskNew,
  mapDraftToCreatePayload,
  mapDraftToUpdatePayload,
  openTaskAction,
} from "./taskFacts";
import type {
  TaskCreatePayload,
  TaskDraft,
  TaskUpdatePayload,
} from "./taskTypes";
import {
  buildDashboardTiles,
  dashboardDataFrom,
  emptyTaskDraft,
  entityInputForTarget,
  normalizeTaskLook,
  seriesInputFromDraft,
} from "./sheetFacts";
import { sheetTitle } from "./sheetTypes";
import type {
  CategoryItem,
  DashboardData,
  DashboardTile,
  EntityInput,
  EventItem,
  ResourceEffectInput,
  ResourceItem,
  SeriesInput,
  SheetTarget,
} from "./sheetTypes";
import { Sheet } from "./Sheet";
import { TaskSheet } from "./TaskSheet";
import { EntitySheet } from "./EntitySheet";
import { Dashboard } from "./Dashboard";

export interface HomeLayoutProps {
  rail: BoardView[];
  activeViewId?: string | null;
  tab: BoardTab;
  tasks: BoardTask[];
  progressions: ProgressionItem[];
  quests: QuestItem[];
  alerts: AlertItem[];
  questions: QuestionItem[];
  categories?: CategoryItem[];
  events?: EventItem[];
  resources?: ResourceItem[];
  timezone?: string;
  onSelectView: (viewId: string) => void;
  onSelectTab: (tab: BoardTab) => void;
  onCreateTask: (payload: TaskCreatePayload) => Promise<Id<"tasks">>;
  onToggleTask: (id: Id<"tasks">) => Promise<void>;
  onDeleteTask: (id: Id<"tasks">) => Promise<void>;
  onUpdateTask: (payload: TaskUpdatePayload) => Promise<void>;
  onMarkSeen: (id: Id<"tasks">) => Promise<unknown>;
  onInstallTemplate: (slug: string) => Promise<void>;
  onEnableComputed: (slug: ComputedViewSlug) => Promise<void>;
  onRemoveView: (viewId: string) => Promise<void>;
  onPinTask: (taskId: Id<"tasks">) => Promise<void>;
  onUnpinTask: (taskId: Id<"tasks">) => Promise<void>;
  onAnswerQuestion?: (questionId: string, optionId: string) => Promise<void>;
  onLoadDashboard?: () => Promise<DashboardData>;
  onLoadResources?: () => Promise<ResourceItem[]>;
  onCreateSeries?: (input: SeriesInput) => Promise<unknown>;
  onSetResourceEffect?: (input: ResourceEffectInput) => Promise<void>;
  onSaveEntity?: (input: EntityInput, id?: string) => Promise<void>;
  initialDashboard?: boolean;
  initialSheet?: SheetTarget | null;
  initialSheetError?: string | null;
  loading?: boolean;
  notice?: string | null;
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function transitionWidth(current: number, target: number): string {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
    return "0%";
  }
  const pct = Math.max(0, Math.min(100, (current / target) * 100));
  return `${pct}%`;
}

function draftForSheet(
  target: SheetTarget | null,
  tasks: BoardTask[]
): TaskDraft {
  if (target?.kind === "editTask") {
    const found = tasks.find((task) => task.id === target.id);
    if (found) return buildDraftFromTask(found);
  }
  return emptyTaskDraft();
}

function entityForSheet(
  target: SheetTarget | null,
  input: {
    views?: BoardView[];
    categories?: CategoryItem[];
    events?: EventItem[];
    progressions?: ProgressionItem[];
    resources?: ResourceItem[];
  }
): EntityInput {
  if (target?.kind === "entity") {
    return entityInputForTarget(target, input);
  }
  return {
    kind: "view",
    title: "",
    icon: "layers",
    color: "sky",
  };
}

interface TaskRowProps {
  task: BoardTask;
  isNew: boolean;
  pinned: boolean;
  overdue: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}

function TaskRow({
  task,
  isNew,
  pinned,
  overdue,
  onToggle,
  onOpen,
  onPin,
  onDelete,
}: TaskRowProps) {
  const look = normalizeTaskLook(task.presentation);
  const plannedLabel = formatPlannedDay(task.plannedOn ?? task.dueAt, task.plannedTime);
  const deadlineLabel = formatInstant(task.deadlineAt);
  const remindLabel = formatInstant(task.remindAt);

  return (
    <li className={`task look-${look} ${task.done ? "done" : ""} ${pinned ? "pinned" : ""}`}>
      <div className="task-row-main">
        {look === "check" ? (
          <button
            type="button"
            className="check"
            aria-pressed={task.done}
            aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            onClick={onToggle}
          >
            {task.done ? "✓" : ""}
          </button>
        ) : null}

        <div
          className="task-summary"
          role="button"
          tabIndex={0}
          aria-label={`Open ${task.title}`}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
        >
          <div className="task-title-line">
            {isNew ? (
              <span className="badge-new" aria-label="New">
                NEW
              </span>
            ) : null}
            <span className="title">{task.title}</span>
            {pinned ? <span className="badge-pinned">Pinned</span> : null}
            {task.priority && task.priority !== "normal" ? (
              <span className={`badge-priority priority-${task.priority}`}>
                {task.priority}
              </span>
            ) : null}
            {overdue ? <span className="badge-overdue">Overdue</span> : null}
          </div>

          {task.notes ? <p className="task-notes-preview">{task.notes}</p> : null}

          <div className="task-meta-chips">
            {plannedLabel ? (
              <span className="meta-chip meta-planned">Planned: {plannedLabel}</span>
            ) : null}
            {deadlineLabel ? (
              <span className={`meta-chip ${overdue ? "meta-overdue" : "meta-deadline"}`}>
                {overdue ? "Overdue: " : "Deadline: "}
                {deadlineLabel}
              </span>
            ) : null}
            {task.location ? (
              <span className="meta-chip meta-location">📍 {task.location}</span>
            ) : null}
            {remindLabel ? (
              <span className="meta-chip meta-remind">🔔 {remindLabel}</span>
            ) : null}
            {task.overduePolicy && task.overduePolicy !== "none" ? (
              <span className="meta-chip meta-policy">
                Policy: {task.overduePolicy}
              </span>
            ) : null}
          </div>
        </div>

        <div className="task-row-actions">
          <button type="button" className="btn-row-pin" onClick={onPin}>
            {pinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" className="btn-row-open" onClick={onOpen}>
            Edit
          </button>
          <button type="button" className="btn-row-delete" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

export function HomeLayout({
  rail,
  activeViewId,
  tab,
  tasks,
  progressions,
  quests,
  alerts,
  questions,
  categories,
  events,
  resources = [],
  timezone = "UTC",
  onSelectView,
  onSelectTab,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onMarkSeen,
  onInstallTemplate,
  onEnableComputed,
  onRemoveView,
  onPinTask,
  onUnpinTask,
  onAnswerQuestion,
  onLoadDashboard,
  onLoadResources,
  onCreateSeries,
  onSetResourceEffect,
  onSaveEntity,
  initialDashboard = false,
  initialSheet = null,
  initialSheetError = null,
  loading = false,
  notice = null,
}: HomeLayoutProps) {
  const views = withHomeView(rail);
  const selectedViewId =
    activeViewId ?? views.find((view) => view.kind === "home")?.id ?? views[0]?.id;
  const selectedView = views.find((view) => view.id === selectedViewId) ?? views[0];

  const [dashboardOpen, setDashboardOpen] = useState(initialDashboard);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loadedDashboard, setLoadedDashboard] = useState<DashboardData | null>(null);
  const [sheetResources, setSheetResources] = useState<ResourceItem[]>(resources);

  const [sheet, setSheet] = useState<SheetTarget | null>(initialSheet);
  const [sheetError, setSheetError] = useState<string | null>(initialSheetError);
  const [sheetPending, setSheetPending] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() =>
    draftForSheet(initialSheet, tasks)
  );
  const [entityInput, setEntityInput] = useState<EntityInput>(() =>
    entityForSheet(initialSheet, {
      views,
      categories,
      events,
      progressions,
      resources,
    })
  );

  const [error, setError] = useState<string | null>(null);
  const [localSeenAt, setLocalSeenAt] = useState<Record<string, number>>({});
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, boolean>>(
    {}
  );

  const fallbackDashboard: DashboardData = {
    categories: categories ?? [],
    events: events ?? [],
    resources,
  };
  const dashboardData = dashboardDataFrom(loadedDashboard, fallbackDashboard);
  const availableResources = sheetResources.length > 0 ? sheetResources : resources;
  const tiles = buildDashboardTiles({
    views,
    ...dashboardData,
    progressions,
  });

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught, fallback));
    }
  }

  async function openDashboard() {
    setDashboardOpen(true);
    setDashboardError(null);
    if (!onLoadDashboard) return;
    setDashboardLoading(true);
    try {
      setLoadedDashboard(await onLoadDashboard());
    } catch (caught) {
      setDashboardError(errorMessage(caught, "Could not load the dashboard"));
    } finally {
      setDashboardLoading(false);
    }
  }

  function closeDashboard() {
    setDashboardOpen(false);
    setDashboardError(null);
  }

  function closeSheet() {
    setSheet(null);
    setSheetError(null);
    setSheetPending(false);
  }

  async function openTaskSheet(task?: BoardTask) {
    setSheetError(null);
    if (onLoadResources) {
      try {
        setSheetResources(await onLoadResources());
      } catch (caught) {
        setSheetError(errorMessage(caught, "Could not load resources"));
      }
    }
    if (!task) {
      setTaskDraft(emptyTaskDraft());
      setSheet({ kind: "createTask" });
      return;
    }

    setTaskDraft(buildDraftFromTask(task));
    setSheet({ kind: "editTask", id: task.id });

    const effectiveSeenAt = localSeenAt[task.id] ?? task.seenAt;
    if (effectiveSeenAt != null) return;
    try {
      const result = await openTaskAction(
        { id: task.id, seenAt: effectiveSeenAt, origin: task.origin },
        (args) => onMarkSeen(args.id)
      );
      if (result) {
        setLocalSeenAt((previous) => ({ ...previous, [task.id]: result.seenAt }));
      }
    } catch (caught) {
      console.error("Failed to mark task as seen", caught);
    }
  }

  function openEntitySheet(target: Extract<SheetTarget, { kind: "entity" }>) {
    setSheetError(null);
    setEntityInput(
      entityForSheet(target, {
        views,
        categories: dashboardData.categories,
        events: dashboardData.events,
        progressions,
        resources: dashboardData.resources,
      })
    );
    setSheet(target);
  }

  async function selectTile(tile: DashboardTile) {
    if (tile.viewId) {
      onSelectView(tile.viewId);
      closeDashboard();
      return;
    }
    if (tile.target?.kind === "entity") openEntitySheet(tile.target);
  }

  async function saveSheet() {
    if (!sheet || sheetPending) return;
    setSheetPending(true);
    setSheetError(null);

    try {
      if (sheet.kind === "createTask") {
        if (taskDraft.series === "none") {
          const id = await onCreateTask(
            mapDraftToCreatePayload({
              ...taskDraft,
              presentation: taskDraft.look,
            })
          );
          const resourceId = taskDraft.resourceId.trim();
          const delta = Number(taskDraft.resourceDelta);
          if (resourceId && Number.isFinite(delta)) {
            if (!onSetResourceEffect) {
              throw new Error("tasks.setResourceEffect is not deployed");
            }
            await onSetResourceEffect({ taskId: id, resourceId, delta });
          }
        } else {
          if (!onCreateSeries) {
            throw new Error("recurrences.create is not deployed");
          }
          await onCreateSeries(seriesInputFromDraft(taskDraft, timezone));
        }
      } else if (sheet.kind === "editTask") {
        await onUpdateTask(
          mapDraftToUpdatePayload(sheet.id, {
            ...taskDraft,
            presentation: taskDraft.look,
          })
        );
        const resourceId = taskDraft.resourceId.trim();
        const delta = Number(taskDraft.resourceDelta);
        if (resourceId && Number.isFinite(delta)) {
          if (!onSetResourceEffect) {
            throw new Error("tasks:setResourceEffect is not deployed");
          }
          await onSetResourceEffect({ taskId: sheet.id, resourceId, delta });
        }
      } else {
        if (!onSaveEntity) {
          throw new Error(`${sheet.entity} mutations are not deployed`);
        }
        await onSaveEntity(entityInput, sheet.id);
        if (dashboardOpen && onLoadDashboard) {
          try {
            setLoadedDashboard(await onLoadDashboard());
          } catch {
            // The entity itself saved; stale tiles are better than a closed grid.
          }
        }
      }
      closeSheet();
    } catch (caught) {
      setSheetError(errorMessage(caught, "Could not save"));
    } finally {
      setSheetPending(false);
    }
  }

  async function deleteTaskFromSheet(id: Id<"tasks">) {
    setSheetPending(true);
    setSheetError(null);
    try {
      await onDeleteTask(id);
      closeSheet();
    } catch (caught) {
      setSheetError(errorMessage(caught, "Could not delete task"));
    } finally {
      setSheetPending(false);
    }
  }

  async function onToggle(id: Id<"tasks">) {
    await run(() => onToggleTask(id), "Could not update task");
  }

  async function onDelete(id: Id<"tasks">) {
    await run(() => onDeleteTask(id), "Could not delete task");
  }

  async function togglePin(task: BoardTask) {
    const pinned = pinnedOverrides[task.id] ?? task.pinned ?? false;
    await run(async () => {
      if (pinned) {
        await onUnpinTask(task.id);
      } else {
        await onPinTask(task.id);
      }
      setPinnedOverrides((previous) => ({ ...previous, [task.id]: !pinned }));
    }, "Could not change the pin");
  }

  async function onTemplateClick(slug: string) {
    await run(async () => {
      await onInstallTemplate(slug);
      closeDashboard();
    }, "Could not install the view");
  }

  async function onComputedClick(slug: ComputedViewSlug) {
    await run(async () => {
      await onEnableComputed(slug);
      closeDashboard();
    }, "Could not enable the view");
  }

  async function onQuestionOption(questionId: string, optionId: string) {
    if (!onAnswerQuestion) return;
    await run(
      () => onAnswerQuestion(questionId, optionId),
      "Could not answer the question"
    );
  }

  function taskSheet() {
    if (sheet?.kind !== "createTask" && sheet?.kind !== "editTask") return null;
    const editingTask =
      sheet.kind === "editTask"
        ? tasks.find((task) => task.id === sheet.id)
        : undefined;
    return (
      <Sheet titleId="sheet-title" title={sheetTitle(sheet)} onClose={closeSheet}>
        <TaskSheet
          draft={taskDraft}
          resources={availableResources}
          isEdit={sheet.kind === "editTask"}
          pending={sheetPending}
          error={sheetError}
          onChange={(patch) =>
            setTaskDraft((previous) => ({ ...previous, ...patch }))
          }
          onSave={() => void saveSheet()}
          onCancel={closeSheet}
          onDelete={
            editingTask
              ? () => void deleteTaskFromSheet(editingTask.id)
              : undefined
          }
        />
      </Sheet>
    );
  }

  function entitySheet() {
    if (sheet?.kind !== "entity") return null;
    return (
      <Sheet titleId="sheet-title" title={sheetTitle(sheet)} onClose={closeSheet}>
        <EntitySheet
          input={entityInput}
          isEdit={Boolean(sheet.id)}
          pending={sheetPending}
          error={sheetError}
          onChange={(patch) =>
            setEntityInput((previous) => ({ ...previous, ...patch }))
          }
          onSave={() => void saveSheet()}
          onCancel={closeSheet}
        />
      </Sheet>
    );
  }

  return (
    <div className="home-frame">
      <section className="board" aria-label={selectedView?.title ?? "Home"}>
        <header className="board-head">
          <p className="mark">Home</p>
          <h1>{selectedView?.title ?? "Home"}</h1>
        </header>

        {error ? <p className="error home-error" role="alert">{error}</p> : null}
        {notice ? <p className="error home-error" role="alert">{notice}</p> : null}
        {loading ? <p className="status">Loading board…</p> : null}

        {alerts.length > 0 ? (
          <section className="alert-band" aria-label="Unread alerts">
            <h2>Alerts</h2>
            <ul>
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <strong>{alert.title}</strong>
                  {alert.body ? <p>{alert.body}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {questions.length > 0 ? (
          <section className="questions" aria-label="Open questions">
            <h2>Questions</h2>
            {questions.map((question) => (
              <article className="question" key={question.id}>
                <p>{question.prompt}</p>
                <div className="question-options">
                  {question.options.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className="question-option"
                      onClick={() =>
                        void onQuestionOption(question.id, option.id)
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {tasks.length > 0 ? (
          <ul className="tasks">
            {tasks.map((task) => {
              const effectiveSeenAt = localSeenAt[task.id] ?? task.seenAt;
              const effectiveTask: BoardTask = {
                ...task,
                seenAt: effectiveSeenAt,
              };
              const pinned = pinnedOverrides[task.id] ?? task.pinned ?? false;
              return (
                <TaskRow
                  key={task.id}
                  task={effectiveTask}
                  isNew={isTaskNew(effectiveTask)}
                  pinned={pinned}
                  overdue={
                    effectiveTask.overdue ??
                    isOverdue(effectiveTask.deadlineAt, effectiveTask.done)
                  }
                  onToggle={() => void onToggle(task.id)}
                  onOpen={() => void openTaskSheet(effectiveTask)}
                  onPin={() => void togglePin(task)}
                  onDelete={() => void onDelete(task.id)}
                />
              );
            })}
          </ul>
        ) : null}

        {progressions.length > 0 ? (
          <section className="progressions" aria-label="Progressions">
            <h2>Progressions</h2>
            <ul>
              {progressions.map((progression) => {
                const value = Number.isFinite(progression.current)
                  ? progression.current
                  : 0;
                const target = Number.isFinite(progression.target)
                  ? progression.target
                  : 0;
                return (
                  <li className="progression" key={progression.id}>
                    <div className="progression-heading">
                      <span className="progression-title">{progression.title}</span>
                      <span className="progression-count">
                        {value}/{target}
                        {progression.unit ? ` ${progression.unit}` : ""}
                      </span>
                    </div>
                    <div
                      className="progression-track"
                      role="progressbar"
                      aria-label={progression.title}
                      aria-valuemin={0}
                      aria-valuemax={target}
                      aria-valuenow={value}
                    >
                      <div
                        className="progression-fill"
                        style={{ width: transitionWidth(value, target) }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {quests.length > 0 ? (
          <section className="quests" aria-label="Quests">
            <h2>Quests</h2>
            <ul>
              {quests.map((quest) => {
                const currentIndex = quest.steps.findIndex((step) => !step.done);
                return (
                  <li className="quest" key={quest.id}>
                    <div className="quest-heading">
                      <span className="quest-title">{quest.title}</span>
                      {quest.waiting ? (
                        <span className="badge-waiting">Waiting</span>
                      ) : null}
                    </div>
                    <ol className="quest-steps">
                      {quest.steps.map((step, index) => {
                        const state = step.done
                          ? "done"
                          : index === currentIndex
                            ? "current"
                            : "later";
                        return (
                          <li className={`quest-step ${state}`} key={step.id}>
                            <span className="quest-marker" aria-hidden="true">
                              {step.done ? "✓" : ""}
                            </span>
                            <span className="quest-step-title">{step.title}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </section>

      <nav className="bottom-bar" aria-label="Home navigation">
        {BOARD_TABS.map((slice) => (
          <button
            type="button"
            role="tab"
            key={slice.id}
            className={`bottom-tab ${tab === slice.id ? "selected" : ""}`}
            aria-selected={tab === slice.id}
            onClick={() => onSelectTab(slice.id)}
          >
            <ViewIcon
              name={
                slice.id === "tasks"
                  ? "list-checks"
                  : slice.id === "daily"
                    ? "sun"
                    : "calendar-days"
              }
              size={18}
            />
            <span>{slice.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="bottom-tab bottom-grid"
          aria-label="Open dashboard"
          onClick={() => void openDashboard()}
        >
          <ViewIcon name="layout-grid" size={18} />
          <span>Grid</span>
        </button>
        <button
          type="button"
          className="bottom-tab bottom-add"
          aria-label="Create a task"
          onClick={() => void openTaskSheet()}
        >
          <ViewIcon name="plus" size={20} />
          <span>Add</span>
        </button>
      </nav>

      {dashboardOpen ? (
        <Dashboard
          tiles={tiles}
          error={dashboardError}
          loading={dashboardLoading}
          onSelectTile={(tile) => void selectTile(tile)}
          onEditTile={(tile) => {
            if (tile.target?.kind === "entity") openEntitySheet(tile.target);
          }}
          onRemoveView={(viewId) => void run(() => onRemoveView(viewId), "Could not remove the view")}
          onClose={closeDashboard}
        >
          <section className="dashboard-find" aria-label="Find more">
            <h2>Find more</h2>
            <h3>Computed views</h3>
            <div className="template-grid">
              {COMPUTED_VIEWS.map((view) => (
                <button
                  type="button"
                  className="template-button"
                  key={view.slug}
                  onClick={() => void onComputedClick(view.slug)}
                >
                  <span className={`rail-icon color-${normalizeColorToken(view.color)}`}>
                    <ViewIcon name={view.icon} size={16} />
                  </span>
                  {view.title}
                </button>
              ))}
            </div>
            <h3>Templates</h3>
            <div className="template-grid">
              {VIEW_TEMPLATES.map((template) => (
                <button
                  type="button"
                  className="template-button"
                  key={template.slug}
                  data-slug={template.slug}
                  onClick={() => void onTemplateClick(template.slug)}
                >
                  <span className={`rail-icon color-${normalizeColorToken(template.color)}`}>
                    <ViewIcon name={template.icon} size={16} />
                  </span>
                  {template.title}
                </button>
              ))}
            </div>
          </section>
        </Dashboard>
      ) : null}

      {sheet?.kind === "createTask" || sheet?.kind === "editTask"
        ? taskSheet()
        : null}
      {sheet?.kind === "entity" ? entitySheet() : null}
    </div>
  );
}
