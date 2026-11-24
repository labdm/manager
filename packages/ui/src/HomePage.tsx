import { api } from "@manager/backend/convex/_generated/api";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { HomeLayout } from "./HomeLayout";
import {
  boardSliceRef,
  createCustomViewRef,
  enableComputedViewRef,
  installTemplateRef,
  pinRef,
  removeViewRef,
  unpinRef,
} from "./homeApi";
import type { ComputedViewSlug } from "./homeCatalog";
import type {
  BoardSlice,
  BoardTab,
  CustomViewInput,
} from "./homeTypes";
import type { TaskCreatePayload, TaskUpdatePayload } from "./taskTypes";
import "./tasks.css";
import "./home.css";

function resolvedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const TIMEZONE = resolvedTimezone();

const EMPTY_BOARD: BoardSlice = {
  rail: [],
  activeViewId: "home",
  tab: "tasks",
  tasks: [],
  progressions: [],
  quests: [],
  alerts: [],
  questions: [],
};

/** The signed-in Home shell: rail, tabs, and the mixed board column. */
export function HomePage() {
  const ensureUser = useMutation(api.users.ensure);
  const createTask = useMutation(api.tasks.create);
  const toggleTask = useMutation(api.tasks.toggle);
  const removeTask = useMutation(api.tasks.remove);
  const updateTask = useMutation(api.tasks.update);
  const markSeen = useMutation(api.tasks.markSeen);

  const installTemplate = useMutation(installTemplateRef);
  const createCustomView = useMutation(createCustomViewRef);
  const enableComputedView = useMutation(enableComputedViewRef);
  const removeView = useMutation(removeViewRef);
  const pin = useMutation(pinRef);
  const unpin = useMutation(unpinRef);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | undefined>();
  const [tab, setTab] = useState<BoardTab>("tasks");

  const board = useQuery(
    boardSliceRef,
    ready
      ? {
          tab,
          timezone: TIMEZONE,
          ...(activeViewId ? { viewId: activeViewId } : {}),
        }
      : "skip"
  );

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

  const data = board ?? EMPTY_BOARD;
  const viewId = activeViewId ?? data.activeViewId ?? "home";

  async function handleCreateTask(payload: TaskCreatePayload) {
    await createTask(payload);
  }

  async function handleToggleTask(id: Id<"tasks">) {
    await toggleTask({ id });
  }

  async function handleDeleteTask(id: Id<"tasks">) {
    await removeTask({ id });
  }

  async function handleUpdateTask(payload: TaskUpdatePayload) {
    await updateTask(payload);
  }

  async function handleMarkSeen(id: Id<"tasks">) {
    return await markSeen({ id });
  }

  async function handleInstallTemplate(slug: string) {
    await installTemplate({ slug });
  }

  async function handleCreateCustom(input: CustomViewInput) {
    await createCustomView({
      title: input.title,
      icon: input.icon,
      color: input.color,
    });
  }

  async function handleEnableComputed(slug: ComputedViewSlug) {
    await enableComputedView({ slug });
  }

  async function handleRemoveView(removeId: string) {
    await removeView({ viewId: removeId });
    if (activeViewId === removeId) setActiveViewId(undefined);
  }

  async function handlePinTask(taskId: Id<"tasks">) {
    await pin({ viewId, subject: { type: "task", id: taskId } });
  }

  async function handleUnpinTask(taskId: Id<"tasks">) {
    await unpin({ viewId, subject: { type: "task", id: taskId } });
  }

  return (
    <HomeLayout
      rail={data.rail}
      activeViewId={viewId}
      tab={tab}
      tasks={data.tasks}
      progressions={data.progressions}
      quests={data.quests}
      alerts={data.alerts}
      questions={data.questions}
      loading={!ready || board === undefined}
      notice={error}
      onSelectView={setActiveViewId}
      onSelectTab={setTab}
      onCreateTask={handleCreateTask}
      onToggleTask={handleToggleTask}
      onDeleteTask={handleDeleteTask}
      onUpdateTask={handleUpdateTask}
      onMarkSeen={handleMarkSeen}
      onInstallTemplate={handleInstallTemplate}
      onCreateCustom={handleCreateCustom}
      onEnableComputed={handleEnableComputed}
      onRemoveView={handleRemoveView}
      onPinTask={handlePinTask}
      onUnpinTask={handleUnpinTask}
    />
  );
}
