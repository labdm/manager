import { Show, SignInButton, UserButton, useAuth } from "@clerk/react";
import { api } from "@manager/backend/convex/_generated/api";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { formatDueAt } from "./formatDueAt";
import "./tasks.css";

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
  const createTask = useMutation(api.tasks.create);
  const toggleTask = useMutation(api.tasks.toggle);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, setPending] = useState(false);
  const tasks = useQuery(api.tasks.list, ready ? {} : "skip");

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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || pending) return;
    setPending(true);
    setError(null);
    try {
      const dueAt = due ? new Date(`${due}T00:00:00`).getTime() : undefined;
      await createTask({
        title: nextTitle,
        dueAt: Number.isFinite(dueAt) ? dueAt : undefined,
      });
      setTitle("");
      setDue("");
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

  return (
    <section className="panel">
      <form className="add-form" onSubmit={onSubmit}>
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
          name="due"
          aria-label="Due date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
        <button type="submit" disabled={pending || title.trim().length === 0}>
          Add
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {tasks === undefined ? <p className="status">Loading tasks…</p> : null}
      {tasks && tasks.length === 0 ? <p className="empty">No tasks yet.</p> : null}
      {tasks && tasks.length > 0 ? (
        <ul className="tasks">
          {tasks.map((task) => {
            const dueLabel = formatDueAt(task.dueAt);
            return (
              <li key={task.id} className={task.done ? "task done" : "task"}>
                <button
                  type="button"
                  className="check"
                  aria-pressed={task.done}
                  aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  onClick={() => void onToggle(task.id)}
                >
                  {task.done ? "✓" : ""}
                </button>
                <span className="title">{task.title}</span>
                {dueLabel ? <span className="due">Due {dueLabel}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
