import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mutations: new Map<unknown, (...args: never[]) => Promise<unknown>>(),
  queries: new Map<unknown, unknown>(),
}));

vi.mock("convex/react", () => ({
  useConvex: () => ({
    query: (ref: unknown) => {
      const result = state.queries.get(ref);
      return result === undefined ? Promise.reject(new Error("function not deployed")) : Promise.resolve(result);
    },
  }),
  useMutation: (ref: unknown) => {
    return (args: unknown) => {
      const fn = state.mutations.get(ref) ?? (async () => ({}));
      return fn(args as never);
    };
  },
}));

import {
  acceptInviteRef,
  addQuestStepRef,
  answerQuestionRef,
  boardSliceRef,
  createCategoryRef,
  createInviteRef,
  createProgressionRef,
  createQuestRef,
  createResourceRef,
  createRoutingRef,
  createTaskRef,
  declineInviteRef,
  listAlertsRef,
  listCategoriesRef,
  listGroupsRef,
  listInvitesRef,
  listResourcesRef,
  listRoutingsRef,
  logProgressionRef,
  readAlertRef,
  removeTaskRef,
  setActivityRef,
  toggleTaskRef,
} from "../src/homeApi";
import type { BoardSlice } from "../src/homeTypes";
import { Shell } from "../src/Shell";

const taskId = "task-1" as Id<"tasks">;

const DESTINATIONS = ["Tasks", "Messages", "Groups", "Categories", "Resources"] as const;

const CREATE_LABEL: Record<(typeof DESTINATIONS)[number], string> = {
  Tasks: "Create task",
  Messages: "Compose message",
  Groups: "Create group",
  Categories: "Create category",
  Resources: "Create resource",
};

const MENU = [
  "Achievements",
  "Contacts",
  "Events",
  "Routings",
  "Profile",
  "Settings",
  "Docs",
  "Contact us",
  "Desktop app",
  "Changelog",
] as const;

const PLACEHOLDERS = new Set<string>([
  "Contacts",
  "Events",
  "Profile",
  "Docs",
  "Contact us",
  "Desktop app",
  "Changelog",
]);

const board: BoardSlice = {
  tasks: [
    {
      id: taskId,
      title: "Water the plants",
      done: false,
      dueAt: null,
      origin: "self",
      seenAt: 1,
    },
  ],
  progressions: [
    {
      id: "p1",
      title: "Finish the book",
      mode: "meter",
      current: 150,
      target: 320,
      unit: "pages",
    },
  ],
  quests: [
    {
      id: "quest-1",
      title: "Fix the window",
      status: "active",
      waiting: false,
      steps: [{ id: "step-1", title: "Call the landlord", gate: "available", done: false }],
    },
  ],
  alerts: [
    { id: "alert-9", title: "Landlord wrote", origin: "member", seenAt: null },
    { id: "alert-self", title: "Note to self", origin: "self", seenAt: 1 },
  ],
  questions: [
    {
      id: "q1",
      prompt: "Buy glass?",
      origin: "agent",
      seenAt: null,
      options: [
        { id: "opt-buy", label: "Buy glass" },
        { id: "opt-else", label: "Something else" },
      ],
    },
  ],
  achievements: {
    completedTasks: 4,
    missedTasks: 1,
    supersededTasks: 0,
    progressionCurrent: 150,
    progressionTarget: 320,
    questsActive: 1,
    questsCompleted: 0,
  },
};

function mutation(ref: unknown) {
  const fn = state.mutations.get(ref);
  if (!fn) throw new Error("Missing fake mutation");
  return fn as ReturnType<typeof vi.fn>;
}

function destinationButton(name: string) {
  const navigation = screen.getByRole("navigation", { name: "Destinations" });
  return within(navigation).getByRole("button", { name });
}

function primaryButton(name: string) {
  const navigation = screen.getByRole("navigation", { name: "Primary" });
  return within(navigation).getByRole("button", { name });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getAllByRole("button", { name: "Menu" })[0]);
  const drawer = await screen.findByRole("dialog", { name: "Menu" });
  await user.click(within(drawer).getByRole("button", { name: label }));
}

beforeEach(() => {
  state.mutations.clear();
  state.queries.clear();
  state.mutations.set(boardSliceRef, vi.fn(async () => board));
  state.mutations.set(createTaskRef, vi.fn(async () => ({ id: "created-task" })));
  state.mutations.set(toggleTaskRef, vi.fn(async () => ({})));
  state.mutations.set(removeTaskRef, vi.fn(async () => ({})));
  state.mutations.set(readAlertRef, vi.fn(async () => ({})));
  state.mutations.set(acceptInviteRef, vi.fn(async () => ({})));
  state.mutations.set(declineInviteRef, vi.fn(async () => ({})));
  state.mutations.set(answerQuestionRef, vi.fn(async () => ({})));
  state.mutations.set(logProgressionRef, vi.fn(async () => ({})));
  state.mutations.set(createProgressionRef, vi.fn(async () => ({ id: "p2" })));
  state.mutations.set(createQuestRef, vi.fn(async () => ({ id: "quest-2" })));
  state.mutations.set(addQuestStepRef, vi.fn(async () => ({ id: "step-2" })));
  state.mutations.set(createCategoryRef, vi.fn(async () => ({ id: "cat-2" })));
  state.mutations.set(createResourceRef, vi.fn(async () => ({ id: "res-2" })));
  state.mutations.set(createInviteRef, vi.fn(async () => ({ id: "inv-2" })));
  state.mutations.set(createRoutingRef, vi.fn(async () => ({ id: "route-2" })));
  state.mutations.set(setActivityRef, vi.fn(async () => ({})));
  state.queries.set(listAlertsRef, []);
  state.queries.set(listGroupsRef, {
    groups: [{ id: "g1", name: "Personal", isDefault: true, role: "owner", canInvite: true }],
  });
  state.queries.set(listInvitesRef, {
    invites: [{ id: "inv1", groupId: "g1", email: "sam@example.com", status: "pending", origin: "member" }],
  });
  state.queries.set(listCategoriesRef, [{ id: "cat1", name: "Home" }]);
  state.queries.set(listResourcesRef, [{ id: "res1", title: "Milk", quantity: 1, unit: "L" }]);
  state.queries.set(listRoutingsRef, {
    routings: [{ id: "r1", name: "Morning", trigger: "cron", cadence: "daily", executionKind: "createTask" }],
  });
});

afterEach(() => cleanup());

describe("shell navigation", () => {
  it("opens every destination from the sidebar and the phone bar", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    expect(await screen.findByRole("region", { name: "Tasks" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Menu" })).toBeNull();

    for (const label of DESTINATIONS) {
      await user.click(destinationButton(label));
      expect(screen.getByRole("region", { name: label })).toBeTruthy();
      expect(destinationButton(label).getAttribute("aria-current")).toBe("page");
      expect(screen.getAllByRole("button", { name: CREATE_LABEL[label] }).length).toBeGreaterThan(0);
      expect(screen.getByText("Select an item.")).toBeTruthy();

      await user.click(primaryButton(label));
      expect(primaryButton(label).getAttribute("aria-current")).toBe("page");
      expect(screen.getByRole("region", { name: label })).toBeTruthy();
    }
  });

  it("opens every menu page", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByRole("region", { name: "Tasks" });

    for (const label of MENU) {
      await openMenu(user, label);
      const page = screen.getByRole("region", { name: label });
      expect(within(page).getByRole("heading", { name: label })).toBeTruthy();
      if (PLACEHOLDERS.has(label)) {
        expect(within(page).getByText(`This is the ${label} page. Nothing else is loaded here yet.`)).toBeTruthy();
      }
      if (label === "Achievements") {
        expect(within(page).getByText("Completed tasks").parentElement?.textContent).toContain("4");
        expect(within(page).getByText("Quests active").parentElement?.textContent).toContain("1");
      }
      if (label === "Routings") {
        expect(within(page).getByText("Morning")).toBeTruthy();
      }
    }

    await openMenu(user, "Settings");
    expect(screen.getByRole("button", { name: "Others" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Select an item.")).toBeTruthy();
  });

  it("reloads every Tasks chip and clears the open row", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(await screen.findByLabelText("Open Water the plants"));
    expect(within(screen.getByLabelText("Detail")).getByText("Water the plants")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /^Daily/ }));
    expect(screen.getByText("Select an item.")).toBeTruthy();

    const chips = [
      ["All", "tasks"],
      ["Daily", "daily"],
      ["Weekly", "weekly"],
      ["Monthly", "monthly"],
      ["Events", "events"],
    ] as const;
    expect(screen.getByRole("tab", { name: /^All/ }).textContent).toContain("3");
    for (const [label, tab] of chips) {
      await user.click(screen.getByRole("tab", { name: new RegExp(`^${label}`) }));
      expect(screen.getByText("Select an item.")).toBeTruthy();
      expect(mutation(boardSliceRef)).toHaveBeenCalledWith(expect.objectContaining({ tab }));
    }
  });

  it("switches the group and can return to all groups", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByRole("region", { name: "Tasks" });
    expect(screen.getByRole("button", { name: "Group switcher" }).textContent).toContain("Groups");

    await user.click(screen.getByRole("button", { name: "Group switcher" }));
    await user.click(await screen.findByRole("menuitem", { name: /Personal/ }));
    await waitFor(() =>
      expect(mutation(boardSliceRef)).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g1" }))
    );
    expect(screen.getByRole("button", { name: "Group switcher" }).textContent).toContain("Personal");

    await user.click(screen.getByRole("button", { name: "Group switcher" }));
    await user.click(await screen.findByRole("menuitem", { name: "All" }));
    await waitFor(() => {
      const last = mutation(boardSliceRef).mock.calls.at(-1)?.[0] as { groupId?: string; tab: string };
      expect(last.groupId).toBeUndefined();
      expect(last.tab).toBe("tasks");
    });
    expect(screen.getByRole("button", { name: "Group switcher" }).textContent).toContain("Groups");
  });

  it("clears the selection when the destination changes and keeps read messages on Messages", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    expect(await screen.findByText("Landlord wrote")).toBeTruthy();
    expect(screen.queryByText("Note to self")).toBeNull();
    expect(screen.getByText("Fix the window")).toBeTruthy();
    expect(screen.getByText("Finish the book")).toBeTruthy();
    expect(screen.getByText("Buy glass?")).toBeTruthy();

    await user.click(screen.getByLabelText("Open Water the plants"));
    await user.click(destinationButton("Messages"));
    expect(screen.getByRole("region", { name: "Messages" })).toBeTruthy();
    expect(screen.getByText("Select an item.")).toBeTruthy();
    expect(screen.getByText("Note to self")).toBeTruthy();
    expect(screen.getByText("Landlord wrote")).toBeTruthy();
  });
});

describe("shell item actions", () => {
  it("creates a task", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByRole("region", { name: "Tasks" });
    await user.click(screen.getByRole("button", { name: "Create task" }));
    const form = screen.getByLabelText("New task");
    await user.type(within(form).getByLabelText("Title"), "Take the bins out");
    await user.click(within(form).getByRole("button", { name: "Create task" }));
    await waitFor(() =>
      expect(mutation(createTaskRef)).toHaveBeenCalledWith(expect.objectContaining({ title: "Take the bins out" }))
    );
  });

  it("creates a quest and adds a step from an existing task", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByText("Fix the window");

    await user.click(screen.getByRole("button", { name: "Create quest" }));
    const form = screen.getByLabelText("New quest");
    await user.type(within(form).getByLabelText("Title"), "Paint the hall");
    await user.click(within(form).getByRole("button", { name: "Create quest" }));
    await waitFor(() => expect(mutation(createQuestRef)).toHaveBeenCalledWith({ title: "Paint the hall" }));

    await user.click(screen.getByRole("button", { name: "Add step" }));
    expect(mutation(addQuestStepRef)).not.toHaveBeenCalled();
    const detail = screen.getByLabelText("Row detail");
    expect(within(detail).getByRole("list", { name: "Quest steps" }).textContent).toContain("Call the landlord");
    await user.click(within(detail).getByRole("button", { name: "Add step" }));
    await waitFor(() =>
      expect(mutation(addQuestStepRef)).toHaveBeenCalledWith({ questId: "quest-1", taskId: String(taskId) })
    );
    expect(screen.queryByText(/opens with its own flow/)).toBeNull();
  });

  it("creates a progression and logs an amount from the row and the detail", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByText("Finish the book");

    await user.click(screen.getByRole("button", { name: "Create progression" }));
    const form = screen.getByLabelText("New progression");
    await user.type(within(form).getByLabelText("Title"), "Read");
    await user.type(within(form).getByLabelText("Target"), "320");
    await user.type(within(form).getByLabelText("Unit"), "pages");
    await user.click(within(form).getByRole("button", { name: "Create progression" }));
    await waitFor(() =>
      expect(mutation(createProgressionRef)).toHaveBeenCalledWith({ title: "Read", target: 320, unit: "pages" })
    );

    await user.click(screen.getByRole("button", { name: "Log" }));
    await waitFor(() =>
      expect(mutation(logProgressionRef)).toHaveBeenCalledWith({ progressionId: "p1", amount: 1 })
    );

    await user.click(screen.getByLabelText("Open Finish the book"));
    const detail = screen.getByLabelText("Row detail");
    const amount = within(detail).getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "20");
    await user.click(within(detail).getByRole("button", { name: "Log" }));
    await waitFor(() =>
      expect(mutation(logProgressionRef)).toHaveBeenCalledWith({ progressionId: "p1", amount: 20 })
    );
    expect(screen.queryByText(/opens with its own flow/)).toBeNull();
  });

  it("marks a task done and deletes it after confirmation", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(await screen.findByRole("button", { name: "Done" }));
    await waitFor(() => expect(mutation(toggleTaskRef)).toHaveBeenCalledWith({ id: String(taskId) }));

    await user.click(screen.getByLabelText("Open Water the plants"));
    await user.click(within(screen.getByLabelText("Row detail")).getByRole("button", { name: "Delete task" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mutation(removeTaskRef)).toHaveBeenCalledWith({ id: String(taskId) }));
  });

  it("shows the mutation error when marking a task done fails", async () => {
    state.mutations.set(toggleTaskRef, vi.fn(async () => {
      throw new Error("toggle failed");
    }));
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect((await screen.findByRole("alert")).textContent).toContain("toggle failed");
  });

  it("marks a message read, accepts an invite, and declines an invite", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByText("Landlord wrote");

    await user.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(mutation(readAlertRef)).toHaveBeenCalledWith({ id: "alert-9" }));

    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mutation(acceptInviteRef)).toHaveBeenCalledWith({ inviteId: "inv1" }));

    await user.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(mutation(declineInviteRef)).toHaveBeenCalledWith({ inviteId: "inv1" }));
  });

  it("answers a question by choosing an option", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(await screen.findByRole("button", { name: "Answer" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mutation(answerQuestionRef)).not.toHaveBeenCalled();

    const detail = screen.getByLabelText("Row detail");
    await user.click(within(detail).getByRole("button", { name: "Buy glass" }));
    await waitFor(() =>
      expect(mutation(answerQuestionRef)).toHaveBeenCalledWith({ questionId: "q1", optionId: "opt-buy" })
    );
  });

  it("creates a category, a resource, and an invite", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByRole("region", { name: "Tasks" });

    await user.click(destinationButton("Categories"));
    expect(await screen.findByText("Home")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Create category" })[0]);
    const category = screen.getByLabelText("New category");
    await user.type(within(category).getByLabelText("Name"), "Health");
    await user.click(within(category).getByRole("button", { name: "Create category" }));
    await waitFor(() => expect(mutation(createCategoryRef)).toHaveBeenCalledWith({ name: "Health" }));

    await user.click(destinationButton("Resources"));
    expect(await screen.findByText("Milk")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Create resource" })[0]);
    const resource = screen.getByLabelText("New resource");
    await user.type(within(resource).getByLabelText("Title"), "Rice");
    await user.clear(within(resource).getByLabelText("Quantity"));
    await user.type(within(resource).getByLabelText("Quantity"), "2");
    await user.click(within(resource).getByRole("button", { name: "Create resource" }));
    await waitFor(() =>
      expect(mutation(createResourceRef)).toHaveBeenCalledWith({ title: "Rice", quantity: 2 })
    );

    await user.click(destinationButton("Groups"));
    expect(await screen.findByText("Personal")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Send invite" }));
    const invite = screen.getByLabelText("Invite to group");
    await user.type(within(invite).getByLabelText("Email"), "sam2@example.com");
    await user.click(within(invite).getByRole("button", { name: "Send invite" }));
    await waitFor(() =>
      expect(mutation(createInviteRef)).toHaveBeenCalledWith({ groupId: "g1", email: "sam2@example.com" })
    );
  });

  it("saves the Tasks activity setting and creates a routing", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByRole("region", { name: "Tasks" });

    await openMenu(user, "Settings");
    await user.click(screen.getByRole("button", { name: "None" }));
    await waitFor(() => expect(mutation(setActivityRef)).toHaveBeenCalledWith({ value: "none" }));

    await openMenu(user, "Routings");
    const page = screen.getByRole("region", { name: "Routings" });
    expect(within(page).getByText("Morning")).toBeTruthy();
    await user.type(within(page).getByLabelText("Name"), "Evening");
    await user.type(within(page).getByLabelText("Task title"), "Lock the door");
    await user.click(within(page).getByRole("button", { name: "Create routing" }));
    await waitFor(() =>
      expect(mutation(createRoutingRef)).toHaveBeenCalledWith({
        name: "Evening",
        trigger: "cron",
        cadence: "daily",
        executionKind: "createTask",
        title: "Lock the door",
      })
    );
  });
});
