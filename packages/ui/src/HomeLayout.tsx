import { useRef, useState, type FormEvent } from "react";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import {
  COLOR_TOKENS,
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
  type CustomViewInput,
  type ProgressionItem,
  type QuestionItem,
  type QuestItem,
} from "./homeTypes";
import { ViewIcon } from "./ViewIcon";
import {
  DEFAULT_OVERDUE_POLICY,
  DEFAULT_PRIORITY,
  PRIORITY_SEEDS,
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
  OverduePolicy,
  TaskCreatePayload,
  TaskDraft,
  TaskUpdatePayload,
} from "./taskTypes";

export interface HomeLayoutProps {
  rail: BoardView[];
  activeViewId?: string | null;
  tab: BoardTab;
  tasks: BoardTask[];
  progressions: ProgressionItem[];
  quests: QuestItem[];
  alerts: AlertItem[];
  questions: QuestionItem[];
  onSelectView: (viewId: string) => void;
  onSelectTab: (tab: BoardTab) => void;
  onCreateTask: (payload: TaskCreatePayload) => Promise<void>;
  onToggleTask: (id: Id<"tasks">) => Promise<void>;
  onDeleteTask: (id: Id<"tasks">) => Promise<void>;
  onUpdateTask: (payload: TaskUpdatePayload) => Promise<void>;
  onMarkSeen: (id: Id<"tasks">) => Promise<unknown>;
  onInstallTemplate: (slug: string) => Promise<void>;
  onCreateCustom: (input: CustomViewInput) => Promise<void>;
  onEnableComputed: (slug: ComputedViewSlug) => Promise<void>;
  onRemoveView: (viewId: string) => Promise<void>;
  onPinTask: (taskId: Id<"tasks">) => Promise<void>;
  onUnpinTask: (taskId: Id<"tasks">) => Promise<void>;
  onAnswerQuestion?: (questionId: string, optionId: string) => Promise<void>;
  initialFindMoreOpen?: boolean;
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

export function HomeLayout({
  rail,
  activeViewId,
  tab,
  tasks,
  progressions,
  quests,
  alerts,
  questions,
  onSelectView,
  onSelectTab,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onMarkSeen,
  onInstallTemplate,
  onCreateCustom,
  onEnableComputed,
  onRemoveView,
  onPinTask,
  onUnpinTask,
  onAnswerQuestion,
  initialFindMoreOpen = false,
  loading = false,
  notice = null,
}: HomeLayoutProps) {
  const views = withHomeView(rail);
  const selectedViewId =
    activeViewId ?? views.find((view) => view.kind === "home")?.id ?? views[0]?.id;
  const selectedView = views.find((view) => view.id === selectedViewId) ?? views[0];

  const [findMoreOpen, setFindMoreOpen] = useState(initialFindMoreOpen);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [plannedDay, setPlannedDay] = useState("");
  const [plannedTime, setPlannedTime] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [pending, setPending] = useState(false);
  const composerRef = useRef<HTMLInputElement>(null);

  const [customTitle, setCustomTitle] = useState("");
  const [customIcon, setCustomIcon] = useState("");
  const [customColor, setCustomColor] = useState<string>("sky");
  const [customPending, setCustomPending] = useState(false);

  const [localSeenAt, setLocalSeenAt] = useState<Record<string, number>>({});
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null);
  const [editingDrafts, setEditingDrafts] = useState<Record<string, TaskDraft>>(
    {}
  );
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, boolean>>(
    {}
  );

  const activeNonHomeView =
    selectedView && selectedView.kind !== "home" ? selectedView : null;

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught, fallback));
    }
  }

  function focusComposer() {
    composerRef.current?.focus();
    composerRef.current?.scrollIntoView?.({ block: "center" });
  }

  async function onAddSubmit(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || pending) return;

    setPending(true);
    setError(null);
    try {
      await onCreateTask(
        mapDraftToCreatePayload({
          title: nextTitle,
          plannedDay,
          plannedTime: showMore ? plannedTime : undefined,
          deadline: showMore ? deadline : undefined,
          priority: showMore ? priority : DEFAULT_PRIORITY,
          notes: showMore ? notes : undefined,
          location: showMore ? location : undefined,
          overduePolicy: DEFAULT_OVERDUE_POLICY,
        })
      );

      setTitle("");
      setPlannedDay("");
      setPlannedTime("");
      setDeadline("");
      setPriority(DEFAULT_PRIORITY);
      setNotes("");
      setLocation("");
      setShowMore(false);
    } catch (caught) {
      setError(errorMessage(caught, "Could not add task"));
    } finally {
      setPending(false);
    }
  }

  async function onToggle(id: Id<"tasks">) {
    await run(() => onToggleTask(id), "Could not update task");
  }

  async function onDelete(id: Id<"tasks">) {
    await run(async () => {
      await onDeleteTask(id);
      if (openTaskId === id) setOpenTaskId(null);
    }, "Could not delete task");
  }

  async function onOpenRow(task: BoardTask) {
    setError(null);
    if (openTaskId === task.id) {
      setOpenTaskId(null);
      return;
    }

    setEditingDrafts((previous) => ({
      ...previous,
      [task.id]: buildDraftFromTask(task),
    }));
    setOpenTaskId(task.id);

    const effectiveSeenAt = localSeenAt[task.id] ?? task.seenAt;
    if (effectiveSeenAt != null) return;

    try {
      const result = await openTaskAction(
        { id: task.id, seenAt: effectiveSeenAt, origin: task.origin },
        (args) => onMarkSeen(args.id)
      );
      if (result) {
        setLocalSeenAt((previous) => ({
          ...previous,
          [task.id]: result.seenAt,
        }));
      }
    } catch (caught) {
      console.error("Failed to mark task as seen", caught);
    }
  }

  async function onSaveEdit(id: Id<"tasks">) {
    const draft = editingDrafts[id];
    if (!draft || !draft.title.trim()) return;

    await run(async () => {
      await onUpdateTask(mapDraftToUpdatePayload(id, draft));
      setOpenTaskId(null);
    }, "Could not save task changes");
  }

  function updateDraftField<K extends keyof TaskDraft>(
    id: Id<"tasks">,
    field: K,
    value: TaskDraft[K]
  ) {
    setEditingDrafts((previous) => {
      const current = previous[id];
      if (!current) return previous;
      return {
        ...previous,
        [id]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  async function togglePin(task: BoardTask) {
    const pinned = pinnedOverrides[task.id] ?? task.pinned ?? false;
    await run(async () => {
      if (pinned) {
        await onUnpinTask(task.id);
      } else {
        await onPinTask(task.id);
      }
      setPinnedOverrides((previous) => ({
        ...previous,
        [task.id]: !pinned,
      }));
    }, "Could not change the pin");
  }

  async function onTemplateClick(slug: string) {
    await run(async () => {
      await onInstallTemplate(slug);
      setFindMoreOpen(false);
    }, "Could not install the view");
  }

  async function onComputedClick(slug: ComputedViewSlug) {
    await run(async () => {
      await onEnableComputed(slug);
      setFindMoreOpen(false);
    }, "Could not enable the view");
  }

  async function onCustomSubmit(event: FormEvent) {
    event.preventDefault();
    const nextTitle = customTitle.trim();
    if (!nextTitle || customPending) return;

    setCustomPending(true);
    setError(null);
    try {
      await onCreateCustom({
        title: nextTitle,
        icon: customIcon.trim() || "circle",
        color: normalizeColorToken(customColor),
      });
      setCustomTitle("");
      setCustomIcon("");
      setCustomColor("sky");
      setFindMoreOpen(false);
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the view"));
    } finally {
      setCustomPending(false);
    }
  }

  async function onRemoveCurrentView() {
    if (!activeNonHomeView) return;
    await run(
      () => onRemoveView(activeNonHomeView.id),
      "Could not remove the view"
    );
  }

  async function onQuestionOption(questionId: string, optionId: string) {
    if (!onAnswerQuestion) return;
    await run(
      () => onAnswerQuestion(questionId, optionId),
      "Could not answer the question"
    );
  }

  return (
    <div className="home-frame">
      <aside className="rail">
        <nav className="rail-views" aria-label="Views">
          {views.map((view) => {
            const selected = view.id === selectedViewId;
            const token = normalizeColorToken(view.color);
            return (
              <div className="rail-item" key={view.id}>
                <button
                  type="button"
                  className={`rail-view ${selected ? "selected" : ""}`}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onSelectView(view.id)}
                >
                  <span className={`rail-icon color-${token}`}>
                    <ViewIcon name={view.icon} />
                  </span>
                  <span className="rail-title">{view.title}</span>
                </button>
                {selected && view.kind !== "home" ? (
                  <button
                    type="button"
                    className="rail-remove"
                    aria-label={`Remove ${view.title}`}
                    onClick={() => void onRemoveCurrentView()}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </nav>

        <button
          type="button"
          className="rail-find-more"
          aria-expanded={findMoreOpen}
          onClick={() => setFindMoreOpen((previous) => !previous)}
        >
          <ViewIcon name="search" size={16} />
          Find more
        </button>

        {findMoreOpen ? (
          <section className="find-more" aria-label="Find more">
            <div className="find-more-heading">
              <h2>Find more</h2>
              <button
                type="button"
                className="find-more-close"
                aria-label="Close Find more"
                onClick={() => setFindMoreOpen(false)}
              >
                ×
              </button>
            </div>

            <h3>Computed views</h3>
            <div className="template-grid">
              {COMPUTED_VIEWS.map((view) => (
                <button
                  type="button"
                  className="template-button"
                  key={view.slug}
                  onClick={() => void onComputedClick(view.slug)}
                >
                  <span
                    className={`rail-icon color-${normalizeColorToken(view.color)}`}
                  >
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
                  <span
                    className={`rail-icon color-${normalizeColorToken(template.color)}`}
                  >
                    <ViewIcon name={template.icon} size={16} />
                  </span>
                  {template.title}
                </button>
              ))}
            </div>

            <h3>Custom view</h3>
            <form className="custom-view-form" onSubmit={onCustomSubmit}>
              <div className="custom-field">
                <label htmlFor="custom-view-title">Title</label>
                <input
                  id="custom-view-title"
                  type="text"
                  maxLength={80}
                  placeholder="My view"
                  required
                  value={customTitle}
                  onChange={(event) => setCustomTitle(event.target.value)}
                />
              </div>
              <div className="custom-field">
                <label htmlFor="custom-view-icon">Lucide icon</label>
                <input
                  id="custom-view-icon"
                  type="text"
                  maxLength={40}
                  placeholder="house"
                  value={customIcon}
                  onChange={(event) => setCustomIcon(event.target.value)}
                />
              </div>
              <div className="custom-field">
                <label htmlFor="custom-view-color">Color</label>
                <select
                  id="custom-view-color"
                  value={customColor}
                  onChange={(event) => setCustomColor(event.target.value)}
                >
                  {COLOR_TOKENS.map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={customPending || !customTitle.trim()}>
                Create view
              </button>
            </form>
          </section>
        ) : null}
      </aside>

      <section className="board" aria-label={selectedView?.title ?? "Home"}>
        <div className="board-tabs" role="tablist" aria-label="Board slices">
          {BOARD_TABS.map((slice) => (
            <button
              type="button"
              role="tab"
              key={slice.id}
              className={`board-tab ${tab === slice.id ? "selected" : ""}`}
              aria-selected={tab === slice.id}
              onClick={() => onSelectTab(slice.id)}
            >
              {slice.label}
            </button>
          ))}
          <button
            type="button"
            className="board-tab-add"
            aria-label="Create a task"
            onClick={focusComposer}
          >
            +
          </button>
        </div>

        {error ? <p className="error home-error">{error}</p> : null}
        {notice ? <p className="error home-error">{notice}</p> : null}
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

        <form className="add-form home-composer" onSubmit={onAddSubmit}>
          <div className="add-form-primary">
            <input
              ref={composerRef}
              type="text"
              name="title"
              aria-label="Task title"
              placeholder="Add a task"
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <input
              type="date"
              name="plannedDay"
              aria-label="Planned day"
              title="Planned day"
              value={plannedDay}
              onChange={(event) => setPlannedDay(event.target.value)}
            />
            <button
              type="button"
              className="btn-text-toggle"
              onClick={() => setShowMore((previous) => !previous)}
              aria-label="Toggle extra fields"
            >
              {showMore ? "Fewer options" : "More options"}
            </button>
            <button type="submit" disabled={pending || title.trim().length === 0}>
              Add
            </button>
          </div>

          {showMore ? (
            <div className="add-form-extra">
              <div className="form-field">
                <label htmlFor="composer-time">Planned time</label>
                <input
                  id="composer-time"
                  type="time"
                  aria-label="Planned time"
                  value={plannedTime}
                  onChange={(event) => setPlannedTime(event.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="composer-deadline">Deadline</label>
                <input
                  id="composer-deadline"
                  type="datetime-local"
                  aria-label="Deadline"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="composer-priority">Priority</label>
                <select
                  id="composer-priority"
                  aria-label="Priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  {Object.keys(PRIORITY_SEEDS).map((seed) => (
                    <option key={seed} value={seed}>
                      {seed}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="composer-location">Location</label>
                <input
                  id="composer-location"
                  type="text"
                  aria-label="Location"
                  placeholder="Where"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
              <div className="form-field full-width">
                <label htmlFor="composer-notes">Notes</label>
                <textarea
                  id="composer-notes"
                  aria-label="Notes"
                  rows={2}
                  placeholder="Add notes…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </form>

        {tasks.length > 0 ? (
          <ul className="tasks">
            {tasks.map((task) => {
              const effectiveSeenAt = localSeenAt[task.id] ?? task.seenAt;
              const effectiveTask: BoardTask = {
                ...task,
                seenAt: effectiveSeenAt,
              };
              const isNew = isTaskNew(effectiveTask);
              const isOpen = openTaskId === task.id;
              const overdue =
                effectiveTask.overdue ??
                isOverdue(effectiveTask.deadlineAt, effectiveTask.done);
              const plannedLabel = formatPlannedDay(
                effectiveTask.plannedOn ?? effectiveTask.dueAt,
                effectiveTask.plannedTime
              );
              const deadlineLabel = formatInstant(effectiveTask.deadlineAt);
              const remindLabel = formatInstant(effectiveTask.remindAt);
              const draft =
                editingDrafts[task.id] ?? buildDraftFromTask(effectiveTask);
              const pinned =
                pinnedOverrides[task.id] ?? task.pinned ?? false;

              return (
                <li
                  key={task.id}
                  className={`task ${task.done ? "done" : ""} ${
                    isOpen ? "open" : ""
                  } ${pinned ? "pinned" : ""}`}
                >
                  <div className="task-row-main">
                    <button
                      type="button"
                      className="check"
                      aria-pressed={task.done}
                      aria-label={
                        task.done ? `Reopen ${task.title}` : `Complete ${task.title}`
                      }
                      onClick={() => void onToggle(task.id)}
                    >
                      {task.done ? "✓" : ""}
                    </button>

                    <div
                      className="task-summary"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isOpen}
                      aria-label={`Open ${task.title}`}
                      onClick={() => void onOpenRow(task)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void onOpenRow(task);
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
                        {pinned ? (
                          <span className="badge-pinned">Pinned</span>
                        ) : null}
                        {task.priority && task.priority !== "normal" ? (
                          <span className={`badge-priority priority-${task.priority}`}>
                            {task.priority}
                          </span>
                        ) : null}
                        {overdue ? (
                          <span className="badge-overdue">Overdue</span>
                        ) : null}
                      </div>

                      {task.notes ? (
                        <p className="task-notes-preview">{task.notes}</p>
                      ) : null}

                      <div className="task-meta-chips">
                        {plannedLabel ? (
                          <span className="meta-chip meta-planned">
                            Planned: {plannedLabel}
                          </span>
                        ) : null}
                        {deadlineLabel ? (
                          <span
                            className={`meta-chip ${
                              overdue ? "meta-overdue" : "meta-deadline"
                            }`}
                          >
                            {overdue ? "Overdue: " : "Deadline: "}
                            {deadlineLabel}
                          </span>
                        ) : null}
                        {task.location ? (
                          <span className="meta-chip meta-location">
                            📍 {task.location}
                          </span>
                        ) : null}
                        {remindLabel ? (
                          <span className="meta-chip meta-remind">
                            🔔 {remindLabel}
                          </span>
                        ) : null}
                        {task.overduePolicy && task.overduePolicy !== "none" ? (
                          <span className="meta-chip meta-policy">
                            Policy: {task.overduePolicy}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="task-row-actions">
                      <button
                        type="button"
                        className="btn-row-pin"
                        aria-label={`${pinned ? "Unpin" : "Pin"} ${task.title}`}
                        onClick={() => void togglePin(task)}
                      >
                        {pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        className="btn-row-open"
                        onClick={() => void onOpenRow(task)}
                        aria-label={`${isOpen ? "Close" : "Open"} ${task.title}`}
                      >
                        {isOpen ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="btn-row-delete"
                        onClick={() => void onDelete(task.id)}
                        aria-label={`Delete ${task.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="task-editor">
                      <div className="editor-grid">
                        <div className="editor-field full-width">
                          <label htmlFor={`edit-title-${task.id}`}>Title</label>
                          <input
                            id={`edit-title-${task.id}`}
                            type="text"
                            value={draft.title}
                            onChange={(event) =>
                              updateDraftField(task.id, "title", event.target.value)
                            }
                            required
                          />
                        </div>

                        <div className="editor-field full-width">
                          <label htmlFor={`edit-notes-${task.id}`}>Notes</label>
                          <textarea
                            id={`edit-notes-${task.id}`}
                            rows={2}
                            value={draft.notes}
                            placeholder="Add notes…"
                            onChange={(event) =>
                              updateDraftField(task.id, "notes", event.target.value)
                            }
                          />
                        </div>

                        <div className="editor-field">
                          <label htmlFor={`edit-planned-day-${task.id}`}>
                            Planned day
                          </label>
                          <input
                            id={`edit-planned-day-${task.id}`}
                            type="date"
                            value={draft.plannedDay}
                            onChange={(event) =>
                              updateDraftField(
                                task.id,
                                "plannedDay",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="editor-field">
                          <label htmlFor={`edit-planned-time-${task.id}`}>
                            Planned time
                          </label>
                          <input
                            id={`edit-planned-time-${task.id}`}
                            type="time"
                            value={draft.plannedTime}
                            onChange={(event) =>
                              updateDraftField(
                                task.id,
                                "plannedTime",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="editor-field">
                          <label htmlFor={`edit-deadline-${task.id}`}>
                            Deadline
                          </label>
                          <input
                            id={`edit-deadline-${task.id}`}
                            type="datetime-local"
                            value={draft.deadline}
                            onChange={(event) =>
                              updateDraftField(
                                task.id,
                                "deadline",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="editor-field">
                          <label htmlFor={`edit-remind-${task.id}`}>
                            Remind at
                          </label>
                          <input
                            id={`edit-remind-${task.id}`}
                            type="datetime-local"
                            value={draft.remindAt}
                            onChange={(event) =>
                              updateDraftField(
                                task.id,
                                "remindAt",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="editor-field">
                          <label htmlFor={`edit-location-${task.id}`}>
                            Location
                          </label>
                          <input
                            id={`edit-location-${task.id}`}
                            type="text"
                            placeholder="Where"
                            value={draft.location}
                            onChange={(event) =>
                              updateDraftField(
                                task.id,
                                "location",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="editor-field">
                          <label htmlFor={`edit-priority-${task.id}`}>
                            Priority
                          </label>
                          <select
                            id={`edit-priority-${task.id}`}
                            value={draft.priority}
                            onChange={(event) =>
                              updateDraftField(
                                task.id,
                                "priority",
                                event.target.value
                              )
                            }
                          >
                            {Object.keys(PRIORITY_SEEDS).map((seed) => (
                              <option key={seed} value={seed}>
                                {seed}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="editor-field">
                          <label htmlFor={`edit-policy-${task.id}`}>
                            Overdue policy
                          </label>
                          <select
                            id={`edit-policy-${task.id}`}
                            value={draft.overduePolicy}
                            onChange={(event) =>
                              updateDraftField(
                                task.id,
                                "overduePolicy",
                                event.target.value as OverduePolicy
                              )
                            }
                          >
                            <option value="none">none</option>
                            <option value="retire">retire</option>
                            <option value="escalate">escalate</option>
                          </select>
                        </div>
                      </div>

                      <div className="editor-actions">
                        <button
                          type="button"
                          className="btn-save"
                          onClick={() => void onSaveEdit(task.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={() => setOpenTaskId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-delete-editor"
                          onClick={() => void onDelete(task.id)}
                        >
                          Delete task
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
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
                          <li
                            className={`quest-step ${state}`}
                            key={step.id}
                            data-gate={step.gate ?? undefined}
                          >
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
    </div>
  );
}
