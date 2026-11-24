import { api } from "@manager/backend/convex/_generated/api";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { HomeLayout } from "./HomeLayout";
import {
  boardSliceRef,
  createCategoryRef,
  createEventRef,
  createProgressionRef,
  createRecurrenceRef,
  createResourceRef,
  createCustomViewRef,
  createTaskRef,
  enableComputedViewRef,
  installTemplateRef,
  listCategoriesRef,
  listEventsRef,
  listResourcesRef,
  pinRef,
  removeViewRef,
  setResourceEffectRef,
  unpinRef,
  updateCategoryRef,
  updateEventRef,
  updateProgressionRef,
  updateResourceRef,
  updateTaskRef,
  updateViewRef,
} from "./homeApi";
import type { ComputedViewSlug } from "./homeCatalog";
import type { BoardSlice, BoardTab } from "./homeTypes";
import type {
  DashboardData,
  EntityInput,
  ResourceEffectInput,
  ResourceItem,
  SeriesInput,
} from "./sheetTypes";
import type { TaskCreatePayload, TaskUpdatePayload } from "./taskTypes";
import "./tasks.css";
import "./home.css";
import "./sheets.css";

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

const EMPTY_DASHBOARD: DashboardData = {
  categories: [],
  events: [],
  resources: [],
};

/** The signed-in Home shell: bottom tabs, one board column, and sheets. */
export function HomePage() {
  const convex = useConvex();
  const ensureUser = useMutation(api.users.ensure);
  const toggleTask = useMutation(api.tasks.toggle);
  const removeTask = useMutation(api.tasks.remove);
  const markSeen = useMutation(api.tasks.markSeen);

  const createTask = useMutation(createTaskRef);
  const updateTask = useMutation(updateTaskRef);
  const setResourceEffect = useMutation(setResourceEffectRef);
  const createRecurrence = useMutation(createRecurrenceRef);

  const createCategory = useMutation(createCategoryRef);
  const updateCategory = useMutation(updateCategoryRef);
  const createEvent = useMutation(createEventRef);
  const updateEvent = useMutation(updateEventRef);
  const createResource = useMutation(createResourceRef);
  const updateResource = useMutation(updateResourceRef);
  const createProgression = useMutation(createProgressionRef);
  const updateProgression = useMutation(updateProgressionRef);

  const installTemplate = useMutation(installTemplateRef);
  const createCustomView = useMutation(createCustomViewRef);
  const updateView = useMutation(updateViewRef);
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
    async (
      nextTab: BoardTab = tab,
      nextViewId: string | undefined = activeViewId
    ) => {
      const result = await sliceBoard({
        tab: nextTab,
        timezone: TIMEZONE,
        ...(nextViewId ? { viewId: nextViewId } : {}),
      });
      setBoard(result);
      return result;
    },
    [activeViewId, sliceBoard, tab]
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

  async function loadDashboard(): Promise<DashboardData> {
    const [categories, events, resources] = await Promise.all([
      convex.query(listCategoriesRef, {}),
      convex.query(listEventsRef, {}),
      convex.query(listResourcesRef, {}),
    ]);
    return { categories, events, resources };
  }

  async function loadResources(): Promise<ResourceItem[]> {
    return await convex.query(listResourcesRef, {});
  }

  async function handleCreateTask(
    payload: TaskCreatePayload
  ): Promise<Id<"tasks">> {
    const created = await createTask({ ...payload });
    await loadBoard();
    return created.id;
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
    await updateTask({ ...payload });
    await loadBoard();
  }

  async function handleMarkSeen(id: Id<"tasks">) {
    const result = await markSeen({ id });
    await loadBoard();
    return result;
  }

  async function handleCreateSeries(input: SeriesInput) {
    await createRecurrence({
      behavior: input.behavior,
      cadence: input.cadence,
      timezone: input.timezone,
      title: input.title,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.plannedTime != null ? { plannedTime: input.plannedTime } : {}),
      ...(input.location ? { location: input.location } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.priorityRank != null ? { priorityRank: input.priorityRank } : {}),
      ...(input.overduePolicy ? { overduePolicy: input.overduePolicy } : {}),
      presentation: input.presentation ?? "check",
      ...(input.anchorOn != null ? { anchorOn: input.anchorOn } : {}),
      ...(input.resourceEffect ? { resourceEffect: input.resourceEffect } : {}),
    });
    await loadBoard();
  }

  async function handleSetResourceEffect(input: ResourceEffectInput) {
    await setResourceEffect({
      taskId: input.taskId,
      resourceId: input.resourceId,
      delta: input.delta,
    });
    await loadBoard();
  }

  async function handleSaveEntity(input: EntityInput, id?: string) {
    switch (input.kind) {
      case "category":
        if (id) {
          await updateCategory({
            id,
            name: input.title,
            icon: input.icon,
            color: input.color,
          });
        } else {
          await createCategory({
            name: input.title,
            icon: input.icon,
            color: input.color,
          });
        }
        break;
      case "event": {
        const eventArgs = {
          title: input.title,
          kind: input.eventKind || "day",
          startsAt: input.startsAt ?? Date.now(),
          endsAt: input.endsAt ?? input.startsAt ?? Date.now(),
          icon: input.icon,
          color: input.color,
        };
        if (id) {
          await updateEvent({ id, ...eventArgs });
        } else {
          await createEvent(eventArgs);
        }
        break;
      }
      case "view":
        if (id) {
          await updateView({
            viewId: id,
            title: input.title,
            icon: input.icon,
            color: input.color,
          });
        } else {
          await createCustomView({
            title: input.title,
            icon: input.icon,
            color: input.color,
          });
        }
        break;
      case "progression": {
        const progressionArgs = {
          title: input.title,
          mode: input.mode ?? "meter",
          target: input.target ?? 1,
          unit: input.unit || undefined,
        };
        if (id) {
          await updateProgression({ id, ...progressionArgs });
        } else {
          await createProgression(progressionArgs);
        }
        break;
      }
      case "resource": {
        const resourceArgs = {
          title: input.title,
          quantity: input.quantity ?? 0,
          unit: input.unit || undefined,
          lowAt: input.lowAt,
          icon: input.icon,
          color: input.color,
        };
        if (id) {
          await updateResource({ id, ...resourceArgs });
        } else {
          await createResource(resourceArgs);
        }
        break;
      }
    }
    await loadBoard();
  }

  async function handleInstallTemplate(slug: string) {
    await installTemplate({ slug });
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
      categories={EMPTY_DASHBOARD.categories}
      events={EMPTY_DASHBOARD.events}
      resources={EMPTY_DASHBOARD.resources}
      timezone={TIMEZONE}
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
      onEnableComputed={handleEnableComputed}
      onRemoveView={handleRemoveView}
      onPinTask={handlePinTask}
      onUnpinTask={handleUnpinTask}
      onLoadDashboard={loadDashboard}
      onLoadResources={loadResources}
      onCreateSeries={handleCreateSeries}
      onSetResourceEffect={handleSetResourceEffect}
      onSaveEntity={handleSaveEntity}
    />
  );
}
