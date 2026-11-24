import { api } from "@manager/backend/convex/_generated/api";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
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

  const sliceBoard = useMutation(boardSliceRef);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardSlice | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | undefined>();
  const [tab, setTab] = useState<BoardTab>("tasks");

  const loadBoard = useCallback(
    async (nextTab: BoardTab = tab, nextViewId: string | undefined = activeViewId) => {
      const result = await sliceBoard({
        tab: nextTab,
        timezone: TIMEZONE,
        ...(nextViewId ? { viewId: nextViewId } : {}),
      });
      setBoard(result);
      return result;
    },
    [activeViewId, sliceBoard, tab],
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

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    sliceBoard({
      tab,
      timezone: TIMEZONE,
      ...(activeViewId ? { viewId: activeViewId } : {}),
    })
      .then((result) => {
        if (!cancelled) setBoard(result);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load the board");
      });
    return () => {
      cancelled = true;
    };
  }, [activeViewId, ready, sliceBoard, tab]);

  const data = board ?? EMPTY_BOARD;
  const viewId = activeViewId ?? (board ? board.activeViewId : undefined);

  async function handleCreateTask(payload: TaskCreatePayload) {
    await createTask(payload);
    await loadBoard();
  }

  async function handleToggleTask(id: Id<"tasks">) {
    await toggleTask({ id });
    await loadBoard();
  }

  async function handleDeleteTask(id: Id<"tasks">) {
    await removeTask({ id });
    await loadBoard();
  }

  async function handleUpdateTask(payload: TaskUpdatePayload) {
    await updateTask(payload);
    await loadBoard();
  }

  async function handleMarkSeen(id: Id<"tasks">) {
    const result = await markSeen({ id });
    await loadBoard();
    return result;
  }

  async function handleInstallTemplate(slug: string) {
    await installTemplate({ slug });
    await loadBoard();
  }

  async function handleCreateCustom(input: CustomViewInput) {
    await createCustomView({
      title: input.title,
      icon: input.icon,
      color: input.color,
    });
    await loadBoard();
  }

  async function handleEnableComputed(slug: ComputedViewSlug) {
    const key = slug === "high-priority" ? "high" : slug;
    await enableComputedView({ key });
    await loadBoard();
  }

  async function handleRemoveView(removeId: string) {
    await removeView({ viewId: removeId });
    if (activeViewId === removeId) setActiveViewId(undefined);
    else await loadBoard();
  }

  async function handlePinTask(taskId: Id<"tasks">) {
    if (!viewId) return;
    await pin({ viewId, subjectType: "task", subjectId: taskId });
    await loadBoard();
  }

  async function handleUnpinTask(taskId: Id<"tasks">) {
    if (!viewId) return;
    await unpin({ viewId, subjectType: "task", subjectId: taskId });
    await loadBoard();
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
      loading={!ready || board === null}
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
