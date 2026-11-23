import { Show, SignInButton, UserButton, useAuth } from "@clerk/react";
import { api } from "@manager/backend/convex/_generated/api";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
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
import type { OverduePolicy, TaskDraft, TaskItem } from "./taskTypes";
import "./tasks.css";

// Cast at the Convex boundary for M1 fields until generated API is updated
type ExtendedTasksApi = {
  list: typeof api.tasks.list;
  create: typeof api.tasks.create;
  toggle: typeof api.tasks.toggle;
  remove: typeof api.tasks.remove;
  update: unknown;
  markSeen: unknown;
};

const tasksApi = api.tasks as unknown as ExtendedTasksApi;

export function TasksPage({ showDownloadsLink = true }: { showDownloadsLink?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="shell">
      <header>
        <div>
          <p className="mark">Manager</p>
          <h1>Tasks</h1>
        </div>
        <div className="top-actions">
          {showDownloadsLink ? (
            <a className="top-link" href="/download">
              Downloads
            </a>
          ) : null}
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>
      {!isLoaded ? <p className="status">Loading…</p> : null}
      <Show when="signed-out">
        <section className="panel">
          <p>Sign in to see your tasks.</p>
          <SignInButton mode="modal">
            <button type="button">Sign in</button>
          </SignInButton>
        </section>
      </Show>
      {isSignedIn ? <TaskBoard /> : null}
    </main>
  );
}

function TaskBoard() {
  const ensureUser = useMutation(api.users.ensure);
  const createTask = useMutation(tasksApi.create);
  const toggleTask = useMutation(tasksApi.toggle);
  const removeTask = useMutation(tasksApi.remove);
  const updateTask = useMutation(tasksApi.update as never);
  const markSeen = useMutation(tasksApi.markSeen as never);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [title, setTitle] = useState("");
  const [plannedDay, setPlannedDay] = useState("");
  const [plannedTime, setPlannedTime] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [showMore, setShowMore] = useState(false);
  const [pending, setPending] = useState(false);

  // Local tracking of seen tasks so NEW mark leaves immediately on successful markSeen
  const [localSeenAt, setLocalSeenAt] = useState<Record<string, number>>({});
  // Currently opened row ID for editing
  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null);
  // Drafts for editing rows
  const [editingDrafts, setEditingDrafts] = useState<Record<string, TaskDraft>>({});

  const rawTasks = useQuery(tasksApi.list, ready ? {} : "skip");
  const tasks = rawTasks as unknown as TaskItem[] | undefined;

  useEffect(() => {
    let cancelled = false;
    ensureUser()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not sign in");
      });
    return () => {
      cancelled = true;
    };
  }, [ensureUser]);

  async function onAddSubmit(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || pending) return;
    setPending(true);
    setError(null);
    try {
      const payload = mapDraftToCreatePayload({
        title: nextTitle,
        plannedDay,
        plannedTime: showMore ? plannedTime : undefined,
        deadline: showMore ? deadline : undefined,
        priority: showMore ? priority : DEFAULT_PRIORITY,
        overduePolicy: DEFAULT_OVERDUE_POLICY,
      });

      // Cast at call boundary to pass new M1 fields
      await (createTask as (args: unknown) => Promise<unknown>)(payload);

      setTitle("");
      setPlannedDay("");
      setPlannedTime("");
      setDeadline("");
      setPriority(DEFAULT_PRIORITY);
      setShowMore(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add task");
    } finally {
      setPending(false);
    }
  }

  async function onToggle(id: Id<"tasks">) {
    setError(null);
    try {
      await toggleTask({ id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update task");
    }
  }

  async function onOpenRow(task: TaskItem) {
    setError(null);
    const isCurrentlyOpen = openTaskId === task.id;

    if (isCurrentlyOpen) {
      setOpenTaskId(null);
      return;
    }

    // Initialize editing draft
    setEditingDrafts((prev) => ({
      ...prev,
      [task.id]: buildDraftFromTask(task),
    }));
    setOpenTaskId(task.id);

    // If task is unseen, markSeen with backend and record locally
    const effectiveSeenAt = localSeenAt[task.id] ?? task.seenAt;
    if (effectiveSeenAt == null) {
      try {
        const result = await openTaskAction(
          { id: task.id, seenAt: effectiveSeenAt, origin: task.origin },
          markSeen as unknown as (args: { id: Id<"tasks"> }) => Promise<unknown>
        );
        if (result) {
          setLocalSeenAt((prev) => ({ ...prev, [task.id]: result.seenAt }));
        }
      } catch (caught) {
        console.error("Failed to mark task as seen", caught);
      }
    }
  }

  async function onSaveEdit(id: Id<"tasks">) {
    const draft = editingDrafts[id];
    if (!draft || !draft.title.trim()) return;

    setError(null);
    try {
      const payload = mapDraftToUpdatePayload(id, draft);
      // Cast at call boundary
      await (updateTask as (args: unknown) => Promise<unknown>)(payload);
      setOpenTaskId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save task changes");
    }
  }

  async function onDelete(id: Id<"tasks">) {
    setError(null);
    try {
      await removeTask({ id });
      if (openTaskId === id) {
        setOpenTaskId(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete task");
    }
  }

  function updateDraftField<K extends keyof TaskDraft>(
    id: Id<"tasks">,
    field: K,
    value: TaskDraft[K]
  ) {
    setEditingDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  return (
    <section className="panel">
      <form className="add-form" onSubmit={onAddSubmit}>
        <div className="add-form-primary">
          <input
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
            onClick={() => setShowMore(!showMore)}
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
                onChange={(e) => setPlannedTime(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="composer-deadline">Deadline</label>
              <input
                id="composer-deadline"
                type="datetime-local"
                aria-label="Deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="composer-priority">Priority</label>
              <select
                id="composer-priority"
                aria-label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {Object.keys(PRIORITY_SEEDS).map((seed) => (
                  <option key={seed} value={seed}>
                    {seed}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </form>

      {error ? <p className="error">{error}</p> : null}
      {tasks === undefined ? <p className="status">Loading tasks…</p> : null}
      {tasks && tasks.length === 0 ? <p className="empty">No tasks yet.</p> : null}
      {tasks && tasks.length > 0 ? (
        <ul className="tasks">
          {tasks.map((task) => {
            const effectiveSeenAt = localSeenAt[task.id] ?? task.seenAt;
            const effectiveTask: TaskItem = { ...task, seenAt: effectiveSeenAt };
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
            const draft = editingDrafts[task.id] ?? buildDraftFromTask(task);

            return (
              <li
                key={task.id}
                className={`task ${task.done ? "done" : ""} ${isOpen ? "open" : ""}`}
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
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
                      {task.priority && task.priority !== "normal" ? (
                        <span
                          className={`badge-priority priority-${task.priority}`}
                        >
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
                          onChange={(e) =>
                            updateDraftField(task.id, "title", e.target.value)
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
                          onChange={(e) =>
                            updateDraftField(task.id, "notes", e.target.value)
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
                          onChange={(e) =>
                            updateDraftField(
                              task.id,
                              "plannedDay",
                              e.target.value
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
                          onChange={(e) =>
                            updateDraftField(
                              task.id,
                              "plannedTime",
                              e.target.value
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
                          onChange={(e) =>
                            updateDraftField(
                              task.id,
                              "deadline",
                              e.target.value
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
                          onChange={(e) =>
                            updateDraftField(
                              task.id,
                              "remindAt",
                              e.target.value
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
                          onChange={(e) =>
                            updateDraftField(
                              task.id,
                              "location",
                              e.target.value
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
                          onChange={(e) =>
                            updateDraftField(
                              task.id,
                              "priority",
                              e.target.value
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
                          onChange={(e) =>
                            updateDraftField(
                              task.id,
                              "overduePolicy",
                              e.target.value as OverduePolicy
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
    </section>
  );
}
