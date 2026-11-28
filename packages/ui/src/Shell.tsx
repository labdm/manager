import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useConvex, useMutation } from "convex/react";
import {
  ArrowLeft,
  Plus,
  ListChecks,
  MessageCircle,
  Users,
  Shapes,
  Package,
  ChevronDown,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { ScrollArea } from "./components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  InviteForm,
  MessageForm,
  NameForm,
  ProgressionForm,
  ProgressionLogForm,
  QuestStepForm,
  ResourceForm,
  RoutingForm,
  TaskForm,
} from "./Forms";
import { MenuButton, type ShellProfile } from "./AppMenu";
import { chipAfterSwipe } from "./chipSwipe";
import { playCompleteSound, prefersReducedMotion, vibrateComplete } from "./feedback";
import { meterSegments, sectionComplete } from "./meter";
import { MenuPageView, type BuildInfo } from "./MenuPages";
import { SectionMeter } from "./SectionMeter";
import { ProductRow } from "./Row";
import {
  acceptInviteRef,
  addQuestStepRef,
  answerQuestionRef,
  boardSliceRef,
  createAlertRef,
  createCategoryRef,
  createGroupRef,
  createInviteRef,
  createProgressionRef,
  createQuestRef,
  createResourceRef,
  createRoutingRef,
  createTaskRef,
  declineInviteRef,
  ensureUserRef,
  listAlertsRef,
  listCategoriesRef,
  listEventsRef,
  listGroupsRef,
  listInvitesRef,
  listResourcesRef,
  listRoutingsRef,
  logProgressionRef,
  markSeenRef,
  readAlertRef,
  removeTaskRef,
  setActivityRef,
  setWaitingRef,
  toggleTaskRef,
} from "./homeApi";
import type { BoardSlice } from "./homeTypes";
import { resolveLucideIcon } from "./iconCatalog";
import { cn } from "./lib/utils";
import {
  alertToRow,
  chipBadge,
  chipTab,
  progressionToRow,
  questToRow,
  questionToRow,
  resolvedTimezone,
  taskPayloadFromForm,
  taskToRow,
  activityVisible,
  inviteToRow,
} from "./shellFacts";
import {
  CHIP_HINTS,
  CHIPS,
  DESTINATIONS,
  type ActivityValue,
  type AlertRecord,
  type CategoryRecord,
  type Chip,
  type Destination,
  type FeedRow,
  type FormKind,
  type GroupItem,
  type InviteItem,
  type MenuPage,
  type ResourceRecord,
  type RoutingItem,
  type TaskFormDraft,
} from "./shellTypes";
import "./styles.css";
import "./shell.css";

const TIMEZONE = resolvedTimezone();

function emptyBoard(): BoardSlice {
  return { tasks: [], progressions: [], quests: [], alerts: [], questions: [] };
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

/** iOS Safari's toolbars change the visible viewport after load. */
function useVisibleViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const viewport = typeof window === "undefined" ? null : window.visualViewport;
    if (!viewport) return;

    const update = () => setHeight(Math.round(viewport.height));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}

const DESTINATION_ICONS: Record<Destination, typeof ListChecks> = {
  tasks: ListChecks,
  messages: MessageCircle,
  groups: Users,
  categories: Shapes,
  resources: Package,
};

function Confirmation({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isPhone =
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches;
  const body = (
    <>
      {isPhone ? (
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
      ) : (
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </>
  );

  if (isPhone) {
    return (
      <Sheet open onOpenChange={(open) => (!open ? onCancel() : undefined)}>
        <SheetContent side="bottom" aria-label={title}>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open onOpenChange={(open) => (!open ? onCancel() : undefined)}>
      <DialogContent aria-label={title}>{body}</DialogContent>
    </Dialog>
  );
}

function RowDetail({
  row,
  tasks,
  onBack,
  onAction,
  onSecondary,
  onDelete,
  onAnswer,
  onLog,
  onAddStep,
}: {
  row: FeedRow;
  tasks: ReadonlyArray<{ id: string; title: string }>;
  onBack: () => void;
  onAction: () => void;
  onSecondary?: () => void;
  onDelete?: () => void;
  onAnswer?: (optionId: string) => void;
  onLog?: (amount: number) => void;
  onAddStep?: (taskId: string) => void;
}) {
  const specialized = row.type === "question" || row.type === "progression" || row.type === "quest";
  return (
    <section className="flex h-full flex-col gap-4 overflow-y-auto p-4" aria-label="Row detail">
      <div className="flex items-center gap-2 md:hidden">
        <Button type="button" variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </Button>
      </div>
      <div className="flex items-start gap-2">
        {row.isNew ? <Badge>NEW</Badge> : null}
        <h2 className="text-xl font-semibold">{row.title}</h2>
      </div>
      <p className="text-sm capitalize text-muted-foreground">{row.type}</p>
      {row.body ? <p className="text-sm">{row.body}</p> : null}
      {row.type === "quest" && row.steps?.length ? (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Quest steps">
          {row.steps.map((step) => (
            <li key={step.id}>{step.title}</li>
          ))}
        </ul>
      ) : null}
      <dl className="flex flex-col gap-2 text-sm">
        {row.progress ? (
          <div><dt className="inline font-medium">Progress: </dt><dd className="inline">{row.progress}</dd></div>
        ) : null}
        {row.dueText ? (
          <div><dt className="inline font-medium">Due: </dt><dd className="inline">{row.dueText}</dd></div>
        ) : null}
        {row.resourceDelta ? (
          <div><dt className="inline font-medium">Resource: </dt><dd className="inline">{row.resourceDelta}</dd></div>
        ) : null}
        {row.groupMark ? <div className="text-muted-foreground">Group item</div> : null}
      </dl>
      <div className="flex flex-col gap-3">
        {row.type === "question" && row.options?.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Answer options">
            {row.options.map((option) => (
              <Button key={option.id} type="button" onClick={() => onAnswer?.(option.id)}>
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
        {row.type === "progression" && onLog ? <ProgressionLogForm onLog={onLog} /> : null}
        {row.type === "quest" && onAddStep ? <QuestStepForm tasks={tasks} onAdd={onAddStep} /> : null}
        <div className="flex flex-wrap gap-2">
          {!specialized && row.action ? <Button type="button" onClick={onAction}>{row.action}</Button> : null}
          {onSecondary ? (
            <Button type="button" variant="outline" onClick={onSecondary}>
              Decline
            </Button>
          ) : null}
          {onDelete ? (
            <Button type="button" variant="destructive" onClick={onDelete}>
              Delete task
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * The signed-in shell shared by the web app and the desktop client.
 * Writes go through makeFunctionReference refs in homeApi.
 */
export function Shell({
  profile,
  onSignOut,
  onManageAccount,
  buildInfo,
  vapidPublicKey,
}: {
  profile?: ShellProfile;
  onSignOut?: () => void;
  onManageAccount?: () => void;
  buildInfo?: BuildInfo;
  vapidPublicKey?: string;
} = {}) {
  const convex = useConvex();
  const ensureUser = useMutation(ensureUserRef);
  const sliceBoard = useMutation(boardSliceRef);
  const markSeen = useMutation(markSeenRef);
  const readAlert = useMutation(readAlertRef);
  const toggleTask = useMutation(toggleTaskRef);
  const setWaiting = useMutation(setWaitingRef);
  const acceptInvite = useMutation(acceptInviteRef);
  const declineInviteMutation = useMutation(declineInviteRef);
  const createTask = useMutation(createTaskRef);
  const createAlert = useMutation(createAlertRef);
  const createGroup = useMutation(createGroupRef);
  const createInvite = useMutation(createInviteRef);
  const createCategory = useMutation(createCategoryRef);
  const createResource = useMutation(createResourceRef);
  const createRouting = useMutation(createRoutingRef);
  const saveActivity = useMutation(setActivityRef);
  const removeTask = useMutation(removeTaskRef);
  const createProgression = useMutation(createProgressionRef);
  const logProgression = useMutation(logProgressionRef);
  const createQuest = useMutation(createQuestRef);
  const addQuestStep = useMutation(addQuestStepRef);
  const answerQuestion = useMutation(answerQuestionRef);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardSlice | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [routings, setRoutings] = useState<RoutingItem[]>([]);
  const [activity, setActivity] = useState<ActivityValue>("others");

  const [destination, setDestination] = useState<Destination>("tasks");
  const [chip, setChip] = useState<Chip>("all");
  const [groupId, setGroupId] = useState<string | undefined>();
  const [selected, setSelected] = useState<FeedRow | null>(null);
  const [form, setForm] = useState<FormKind | null>(null);
  const [menuPage, setMenuPage] = useState<MenuPage | null>(null);
  const [locallySeen, setLocallySeen] = useState<ReadonlySet<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<FeedRow | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; title: string; kind?: string }>>([]);
  const [justDone, setJustDone] = useState<ReadonlySet<string>>(new Set());
  const [sectionClear, setSectionClear] = useState(false);
  const [burst, setBurst] = useState<{ id: string; xp: number } | null>(null);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  const [slide, setSlide] = useState<"left" | "right" | "none">("none");
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const openedFromUrl = useRef(false);
  const visibleViewportHeight = useVisibleViewportHeight();

  const loadBoard = useCallback(async () => {
    try {
      const result = await sliceBoard({
        tab: chipTab(chip),
        timezone: TIMEZONE,
        ...(groupId ? { groupId } : {}),
      });
      setBoard(result ?? emptyBoard());
      setJustDone(new Set());
    } catch (caught) {
      // Events is a later milestone. A rejected slice is an empty list, not an error.
      if (chip === "events") {
        setBoard(emptyBoard());
        return;
      }
      setError(errorMessage(caught, "Could not load the board"));
    }
  }, [chip, groupId, sliceBoard]);

  const loadQueries = useCallback(async () => {
    try {
      const [alertsResult, groupsResult, invitesResult, categoriesResult, resourcesResult, routingsResult] =
        await Promise.all([
          convex.query(listAlertsRef, {}),
          convex.query(listGroupsRef, {}),
          convex.query(listInvitesRef, {}),
          convex.query(listCategoriesRef, {}),
          convex.query(listResourcesRef, {}),
          convex.query(listRoutingsRef, {}),
        ]);
      setAlerts(Array.isArray(alertsResult) ? alertsResult : []);
      setGroups(groupsResult?.groups ?? []);
      setInvites(invitesResult?.invites ?? []);
      setCategories(Array.isArray(categoriesResult) ? categoriesResult : []);
      setResources(Array.isArray(resourcesResult) ? resourcesResult : []);
      setRoutings(routingsResult?.routings ?? []);
    } catch {
      // A function from a later milestone may not be deployed. The screens
      // stay usable and the failure surfaces when the user writes to one.
    }
    try {
      const eventsResult = await convex.query(listEventsRef, {});
      if (Array.isArray(eventsResult)) {
        setEvents(
          eventsResult.map((row) => {
            const event = row as { id?: string; _id?: string; title?: string; kind?: string };
            return {
              id: String(event.id ?? event._id ?? event.title ?? ""),
              title: event.title ?? "Event",
              kind: event.kind,
            };
          }),
        );
      }
    } catch {
      // events:list may not be deployed yet.
    }
  }, [convex]);

  useEffect(() => {
    let cancelled = false;
    ensureUser({})
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorMessage(caught, "Could not sign in"));
      });
    return () => {
      cancelled = true;
    };
  }, [ensureUser]);

  useEffect(() => {
    if (!ready) return;
    void loadBoard();
  }, [ready, loadBoard]);

  useEffect(() => {
    if (!ready) return;
    void loadQueries();
  }, [ready, loadQueries]);

  useEffect(() => {
    if (openedFromUrl.current || !board) return;
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (!taskId) return;
    const task = board.tasks.find((item) => String(item.id) === taskId);
    if (!task) return;
    openedFromUrl.current = true;
    openRow(taskToRow(task, locallySeen));
  }, [board, locallySeen]);

  const messageAlerts = useMemo(() => {
    const byId = new Map<string, AlertRecord>();
    for (const alert of board?.alerts ?? []) byId.set(alert.id, alert);
    for (const alert of alerts) byId.set(alert.id, alert);
    return [...byId.values()];
  }, [alerts, board?.alerts]);

  const rows = useMemo(() => {
    if (destination === "messages") return messageAlerts.map(alertToRow);
    if (destination !== "tasks") return [];
    const mixed: FeedRow[] = [
      ...(board?.tasks ?? []).map((task) => taskToRow(task, locallySeen)),
      ...(board?.alerts ?? []).map(alertToRow),
      ...(board?.questions ?? []).map(questionToRow),
      ...invites
        .filter((invite) => !invite.status || invite.status === "pending")
        .map((invite) => inviteToRow(invite, groups)),
      ...(board?.progressions ?? []).map(progressionToRow),
      ...(board?.quests ?? []).map(questToRow),
    ];
    return mixed.filter((row) => {
      if (!activityVisible(row, activity)) return false;
      // Quests are one-shot. A daily, weekly, monthly, or interval task stays on its own tab.
      if (chip === "all" && row.type === "task" && row.routineKind && row.routineKind !== "none") {
        return false;
      }
      return true;
    });
  }, [activity, board, chip, destination, groups, invites, locallySeen, messageAlerts]);

  const selectedGroup = groups.find((group) => group.id === groupId);

  function resetPanes() {
    setSelected(null);
    setForm(null);
    setMenuPage(null);
    setError(null);
  }

  function chooseDestination(next: Destination) {
    setDestination(next);
    resetPanes();
  }

  function chooseChip(next: Chip, direction?: "left" | "right") {
    setSlide(direction ?? "none");
    setChip(next);
    setJustDone(new Set());
    setSectionClear(false);
    setBurst(null);
    resetPanes();
  }

  function onListPointerDown(event: ReactPointerEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select")) return;
    swipe.current = { x: event.clientX, y: event.clientY };
  }

  function onListPointerUp(event: ReactPointerEvent) {
    if (!swipe.current || destination !== "tasks") return;
    const dx = event.clientX - swipe.current.x;
    const dy = event.clientY - swipe.current.y;
    swipe.current = null;
    const next = chipAfterSwipe(chip, dx, dy);
    if (next) chooseChip(next, dx < 0 ? "left" : "right");
  }

  function openMenuPage(page: MenuPage) {
    setMenuPage(page);
    setForm(null);
    setSelected(null);
    setError(null);
  }

  function openForm(next: FormKind) {
    setForm(next);
    setSelected(null);
    setMenuPage(null);
    setError(null);
  }

  function openRow(row: FeedRow) {
    setSelected(row);
    setForm(null);
    setMenuPage(null);
    setError(null);

    // Selection is the act that marks a row seen. Only a task id can call
    // tasks:markSeen, and NEW stays until the mutation succeeds.
    if (row.isNew && row.taskId && !locallySeen.has(row.id)) {
      void markSeen({ id: String(row.taskId) })
        .then(() => {
          setLocallySeen((previous) => new Set(previous).add(row.id));
        })
        .catch((caught: unknown) => {
          setError(errorMessage(caught, "Could not mark the task as read"));
        });
    }
    if (row.isNew && row.alertId && !locallySeen.has(row.id)) {
      void readAlert({ id: row.alertId })
        .then(() => {
          setLocallySeen((previous) => new Set(previous).add(row.id));
        })
        .catch((caught: unknown) => {
          setError(errorMessage(caught, "Could not mark the message as read"));
        });
    }
  }

  async function submitLog(progressionId: string, amount: number) {
    try {
      await logProgression({ progressionId, amount });
      await loadBoard();
    } catch (caught) {
      setError(errorMessage(caught, "Could not log progress"));
    }
  }

  async function submitAnswer(row: FeedRow, optionId: string) {
    if (!row.questionId) return;
    try {
      await answerQuestion({ questionId: row.questionId, optionId });
      setSelected(null);
      await loadBoard();
    } catch (caught) {
      setError(errorMessage(caught, "Could not answer the question"));
    }
  }

  async function submitQuestStep(questId: string, taskId: string) {
    try {
      await addQuestStep({ questId, taskId });
      await loadBoard();
    } catch (caught) {
      setError(errorMessage(caught, "Could not add the quest step"));
    }
  }

  async function rowAction(row: FeedRow) {
    try {
      if (row.type === "question" || row.type === "quest") {
        openRow(row);
        return;
      }
      if (row.type === "task" && row.taskId) {
        const shownDone = Boolean(row.done) || justDone.has(row.id);
        if (row.waiting && !shownDone) {
          await setWaiting({ id: String(row.taskId), waiting: false });
          await loadBoard();
          return;
        }
        const completing = !shownDone;
        if (!completing) {
          setJustDone((previous) => {
            const next = new Set(previous);
            next.delete(row.id);
            return next;
          });
          setUndo(null);
          setSectionClear(false);
        }
        const tasksOnly = rows.filter((item) => item.type === "task");
        const remaining = tasksOnly.filter((item) => item.id !== row.id && !item.done && !item.waiting);
        const waitingLeft = tasksOnly.filter((item) => item.id !== row.id && item.waiting && !item.done);
        const clears = completing && remaining.length === 0 && waitingLeft.length === 0 && tasksOnly.length > 0;
        await toggleTask({ id: String(row.taskId) });
        if (completing) {
          setJustDone((previous) => new Set(previous).add(row.id));
          setSectionClear(clears);
          setBurst({ id: row.id, xp: clears ? 25 : 10 });
          setUndo({ id: String(row.taskId), title: row.title });
          if (!prefersReducedMotion()) {
            playCompleteSound();
            vibrateComplete(clears);
          }
          window.setTimeout(() => setBurst(null), 900);
        }
        await loadBoard();
      } else if (row.type === "message" && row.alertId) {
        await readAlert({ id: row.alertId });
        setLocallySeen((previous) => new Set(previous).add(row.id));
      } else if (row.type === "invite" && row.inviteId) {
        await acceptInvite({ inviteId: row.inviteId });
        await loadQueries();
      } else if (row.type === "progression" && row.progressionId) {
        await submitLog(row.progressionId, 1);
      } else {
        setError(`${row.action ?? "That action"} is not available.`);
      }
    } catch (caught) {
      setError(errorMessage(caught, `Could not ${row.action?.toLowerCase() ?? "act"}`));
    }
  }

  async function declineInvite(row: FeedRow) {
    if (!row.inviteId) return;
    try {
      await declineInviteMutation({ inviteId: row.inviteId });
      await loadQueries();
    } catch (caught) {
      setError(errorMessage(caught, "Could not decline the invite"));
    }
  }

  async function submitTask(draft: TaskFormDraft) {
    try {
      await createTask(taskPayloadFromForm(draft, TIMEZONE));
      setForm(null);
      await loadBoard();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the task"));
    }
  }

  async function submitMessage(title: string, body: string) {
    try {
      await createAlert(body ? { title, body } : { title });
      setAlerts((previous) => [
        { id: `local-${Date.now()}`, title, body, origin: "self", seenAt: Date.now() },
        ...previous,
      ]);
      setForm(null);
    } catch (caught) {
      setError(errorMessage(caught, "Could not send the message"));
    }
  }

  async function submitGroup(name: string) {
    try {
      await createGroup({ name });
      setForm(null);
      await loadQueries();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the group"));
    }
  }

  async function submitInvite(email: string) {
    const targetGroup = groupId ?? groups.find((group) => group.isDefault)?.id ?? groups[0]?.id;
    if (!targetGroup) {
      setError("Choose a group before sending an invite");
      return;
    }
    try {
      await createInvite({ groupId: targetGroup, email });
      setForm(null);
      await loadQueries();
    } catch (caught) {
      setError(errorMessage(caught, "Could not send the invite"));
    }
  }

  async function submitCategory(name: string) {
    try {
      await createCategory({ name });
      setForm(null);
      await loadQueries();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the category"));
    }
  }

  async function submitResource(title: string, quantity: number) {
    try {
      await createResource({ title, quantity });
      setForm(null);
      await loadQueries();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the resource"));
    }
  }

  async function submitQuest(title: string) {
    try {
      await createQuest({ title });
      setForm(null);
      await loadBoard();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the quest"));
    }
  }

  async function submitProgression(title: string, target: number, unit: string) {
    try {
      await createProgression(unit ? { title, target, unit } : { title, target });
      setForm(null);
      await loadBoard();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the progression"));
    }
  }

  async function submitRouting(name: string, cadence: "daily" | "weekly" | "monthly", title: string) {
    try {
      await createRouting({
        name,
        trigger: "cron",
        cadence,
        executionKind: "createTask",
        title,
      });
      await loadQueries();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create the routing"));
    }
  }

  async function changeActivity(value: ActivityValue) {
    try {
      await saveActivity({ value });
      setActivity(value);
    } catch (caught) {
      setError(errorMessage(caught, "Could not save the activity setting"));
    }
  }

  async function deleteSelectedTask() {
    const row = confirmDelete;
    if (!row?.taskId) return;
    setConfirmDelete(null);
    try {
      await removeTask({ id: String(row.taskId) });
      setSelected(null);
      await loadBoard();
    } catch (caught) {
      setError(errorMessage(caught, "Could not delete the task"));
    }
  }

  const createByDestination: Record<Destination, { form: FormKind; label: string }> = {
    tasks: { form: "task", label: "Create task" },
    messages: { form: "message", label: "Compose message" },
    groups: { form: "group", label: "Create group" },
    categories: { form: "category", label: "Create category" },
    resources: { form: "resource", label: "Create resource" },
  };

  function renderForm(kind: FormKind): ReactNode {
    switch (kind) {
      case "task":
        return <TaskForm onSubmit={(draft) => void submitTask(draft)} onCancel={resetPanes} error={error} />;
      case "message":
        return <MessageForm onSubmit={(title, body) => void submitMessage(title, body)} onCancel={resetPanes} error={error} />;
      case "group":
        return <NameForm title="New group" label="Name" buttonLabel="Create group" onSubmit={(value) => void submitGroup(value)} onCancel={resetPanes} error={error} />;
      case "invite":
        return <InviteForm onSubmit={(email) => void submitInvite(email)} onCancel={resetPanes} error={error} />;
      case "category":
        return <NameForm title="New category" label="Name" buttonLabel="Create category" onSubmit={(value) => void submitCategory(value)} onCancel={resetPanes} error={error} />;
      case "resource":
        return <ResourceForm onSubmit={(title, quantity) => void submitResource(title, quantity)} onCancel={resetPanes} error={error} />;
      case "routing":
        return <RoutingForm onSubmit={(name, cadence, title) => void submitRouting(name, cadence, title)} onCancel={resetPanes} error={error} />;
      case "quest":
        return <NameForm title="New quest" label="Title" buttonLabel="Create quest" onSubmit={(value) => void submitQuest(value)} onCancel={resetPanes} error={error} />;
      case "progression":
        return <ProgressionForm onSubmit={(title, target, unit) => void submitProgression(title, target, unit)} onCancel={resetPanes} error={error} />;
    }
  }

  function renderList() {
    if (destination === "groups") {
      return (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => openForm("group")}>Create group</Button>
            <Button type="button" variant="outline" onClick={() => openForm("invite")}>
              Send invite
            </Button>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {groups.map((group) => (
              <li key={group.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                <span className="font-medium">{group.name}</span>
                <span className="text-xs text-muted-foreground">
                  {group.isDefault ? "Default" : group.role ?? "Member"}
                  {group.canInvite ? " · can invite" : ""}
                </span>
              </li>
            ))}
          </ul>
          {invites.length ? (
            <ul className="flex flex-col gap-2">
              {invites.map((invite) => {
                const row = inviteToRow(invite, groups);
                return (
                  <ProductRow
                    key={row.id}
                    row={row}
                    selected={selected?.id === row.id}
                    onOpen={() => openRow(row)}
                    onAction={() => void rowAction(row)}
                    onSecondary={() => void declineInvite(row)}
                  />
                );
              })}
            </ul>
          ) : null}
        </div>
      );
    }

    if (destination === "categories") {
      return (
        <div className="flex flex-col gap-3 p-4">
          <Button type="button" className="self-start" onClick={() => openForm("category")}>
            Create category
          </Button>
          <ul className="flex flex-col gap-2 text-sm">
            {categories.map((category) => {
              const Icon = resolveLucideIcon(category.icon);
              return (
                <li key={category.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{category.name ?? category.title}</span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    if (destination === "resources") {
      return (
        <div className="flex flex-col gap-3 p-4">
          <Button type="button" className="self-start" onClick={() => openForm("resource")}>
            Create resource
          </Button>
          <ul className="flex flex-col gap-2 text-sm">
            {resources.map((resource) => (
              <li key={resource.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                <span className="font-medium">{resource.title}</span>
                <span className="text-muted-foreground">
                  {resource.quantity ?? 0}
                  {resource.unit ? ` ${resource.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 p-3">
        {destination === "messages" ? (
          <Button type="button" className="self-start" onClick={() => openForm("message")}>
            Compose message
          </Button>
        ) : null}
        {destination === "tasks" ? (
          <SectionMeter
            rows={rows.map((row) => (justDone.has(row.id) ? { ...row, done: true, waiting: false } : row))}
            celebrate={sectionClear || sectionComplete(meterSegments(rows.map((row) => (justDone.has(row.id) ? { ...row, done: true } : row))))}
          />
        ) : null}
        {rows.length ? (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <ProductRow
                key={row.id}
                  row={justDone.has(row.id) ? { ...row, done: true, action: null } : row}
                  selected={selected?.id === row.id}
                  celebrating={burst?.id === row.id}
                  onOpen={() => openRow(row)}
                  onAction={() =>
                    void rowAction(justDone.has(row.id) ? { ...row, done: true } : row)
                  }
                  onSecondary={row.type === "invite" ? () => void declineInvite(row) : undefined}
                />
            ))}
          </ul>
        ) : (
          <p className="p-3 text-sm text-muted-foreground">Nothing here yet.</p>
        )}
      </div>
    );
  }

  const pane = form || menuPage || selected ? "detail" : "list";
  const shellStyle = visibleViewportHeight
    ? ({ "--shell-height": `${visibleViewportHeight}px` } as CSSProperties)
    : undefined;

  return (
    <div className="shell-frame bg-background text-foreground" style={shellStyle}>
      <aside className="sidebar hidden lg:flex lg:flex-col" aria-label="Primary navigation">
        <nav className="flex flex-col gap-1 px-2 pt-3" aria-label="Destinations">
          {DESTINATIONS.map((item) => {
            const Icon = DESTINATION_ICONS[item.id];
            return (
              <Button
                key={item.id}
                type="button"
                variant={destination === item.id ? "secondary" : "ghost"}
                className="justify-start"
                aria-current={destination === item.id ? "page" : undefined}
                onClick={() => chooseDestination(item.id)}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Button>
            );
          })}
        </nav>
        <div className="mt-auto flex justify-center border-t p-3">
          <MenuButton
            onSelect={openMenuPage}
            onDestination={chooseDestination}
            profile={profile}
            onSignOut={onSignOut}
            onManageAccount={onManageAccount}
          />
        </div>
      </aside>

      <div className="shell-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <MenuButton
            onSelect={openMenuPage}
            onDestination={chooseDestination}
            profile={profile}
            onSignOut={onSignOut}
            onManageAccount={onManageAccount}
            className="lg:hidden"
          />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Group switcher"
                  className="max-w-[12rem]"
                >
                  <span className="truncate">
                    {selectedGroup ? selectedGroup.name : "Groups"}
                  </span>
                  <ChevronDown aria-hidden="true" className="shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setGroupId(undefined)}>All</DropdownMenuItem>
                {groups.map((group) => (
                  <DropdownMenuItem key={group.id} onSelect={() => setGroupId(group.id)}>
                    {group.name}
                    {group.isDefault ? " (default)" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            type="button"
            size="icon"
            className="shrink-0"
            aria-label={createByDestination[destination].label}
            onClick={() => openForm(createByDestination[destination].form)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </header>

        {destination === "tasks" ? (
          <div className="chip-row shrink-0 border-b px-3 py-2">
            <Tabs value={chip} onValueChange={(value) => chooseChip(value as Chip)}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {CHIPS.map((item) => {
                  const count = chipBadge(board, item.id, rows);
                  return (
                    <TabsTrigger key={item.id} value={item.id} title={CHIP_HINTS[item.id]}>
                      {item.label}
                      {count > 0 ? <Badge variant="secondary">{count}</Badge> : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            {CHIP_HINTS[chip] ? (
              <p className="px-1 pt-1 text-xs text-muted-foreground">{CHIP_HINTS[chip]}</p>
            ) : null}
          </div>
        ) : null}

        <div className="shell-body flex min-h-0 flex-1 overflow-hidden">
          <div className="shell-panes flex min-h-0 w-full" data-pane={pane}>
            <ScrollArea
              className="list-pane min-h-0 border-r bg-background"
              role="region"
              aria-label={DESTINATIONS.find((item) => item.id === destination)?.label}
              onPointerDown={onListPointerDown}
              onPointerUp={onListPointerUp}
              onPointerCancel={() => {
                swipe.current = null;
              }}
            >
              <div
                key={destination === "tasks" ? `${chip}-${slide}` : destination}
                className={cn("pb-4", slide === "left" && "board-slide-left", slide === "right" && "board-slide-right")}
                style={{ touchAction: "pan-y" }}
              >
                {!ready ? <p className="px-4 text-sm text-muted-foreground">Loading…</p> : null}
                {renderList()}
              </div>
            </ScrollArea>

            <section className="detail-pane min-h-0 bg-background" aria-label="Detail">
              {error ? (
                <p role="alert" className="m-4 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {menuPage ? (
                <MenuPageView
                  page={menuPage}
                  board={board}
                  activity={activity}
                  routings={routings}
                  events={events}
                  resources={resources}
                  categories={categories}
                  contacts={invites}
                  groups={groups}
                  error={error}
                  buildInfo={buildInfo}
                  vapidPublicKey={vapidPublicKey}
                  onActivityChange={(value) => void changeActivity(value)}
                  onCreateRouting={(name, cadence, title) => submitRouting(name, cadence, title)}
                  onCreate={(kind) => openForm(kind)}
                  onBack={resetPanes}
                />
              ) : form ? (
                renderForm(form)
              ) : selected ? (
                <RowDetail
                  row={selected}
                  tasks={(board?.tasks ?? []).map((task) => ({ id: String(task.id), title: task.title }))}
                  onBack={resetPanes}
                  onAction={() => void rowAction(selected)}
                  onSecondary={
                    selected.type === "invite" ? () => void declineInvite(selected) : undefined
                  }
                  onDelete={selected.type === "task" ? () => setConfirmDelete(selected) : undefined}
                  onAnswer={(optionId) => void submitAnswer(selected, optionId)}
                  onLog={(amount) => {
                    if (selected.progressionId) void submitLog(selected.progressionId, amount);
                  }}
                  onAddStep={(taskId) => {
                    if (selected.questId) void submitQuestStep(selected.questId, taskId);
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select an item.
                </div>
              )}
            </section>
          </div>
        </div>

        <nav className="destination-bar flex shrink-0 border-t lg:hidden" aria-label="Primary">
          {DESTINATIONS.map((item) => {
            const Icon = DESTINATION_ICONS[item.id];
            return (
              <Button
                key={item.id}
                type="button"
                variant={destination === item.id ? "secondary" : "ghost"}
                className="destination-button flex-1 rounded-none"
                aria-current={destination === item.id ? "page" : undefined}
                onClick={() => chooseDestination(item.id)}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </div>

      {burst ? (
        <div className="xp-float" aria-hidden="true">
          +{burst.xp} XP
        </div>
      ) : null}
      {undo ? (
        <div className="undo-toast" role="status">
          <span className="undo-copy">
            <span className="undo-kicker">Completed</span>
            <span className="undo-title">{undo.title}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => {
              const pending = undo;
              setUndo(null);
              setJustDone((previous) => {
                const next = new Set(previous);
                next.delete(`task:${pending.id}`);
                return next;
              });
              setSectionClear(false);
              void toggleTask({ id: pending.id }).then(() => loadBoard());
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      {confirmDelete ? (
        <Confirmation
          title="Delete task?"
          description="This removes the task from the board."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void deleteSelectedTask()}
        />
      ) : null}
    </div>
  );
}
