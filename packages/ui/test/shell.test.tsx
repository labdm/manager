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
  boardSliceRef,
  createAlertRef,
  createGroupRef,
  createTaskRef,
} from "../src/homeApi";
import type { BoardSlice } from "../src/homeTypes";
import { activityVisible } from "../src/shellFacts";
import type { FeedRow } from "../src/shellTypes";
import { Shell } from "../src/Shell";

const taskId = "task-1" as Id<"tasks">;

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
  progressions: [],
  quests: [],
  alerts: [],
  questions: [],
};

function mutation(ref: unknown) {
  const fn = state.mutations.get(ref);
  if (!fn) throw new Error("Missing fake mutation");
  return fn;
}

function destinationButton(name: string) {
  const navigation = screen.getAllByRole("navigation", { name: "Destinations" })[0];
  return within(navigation).getByRole("button", { name });
}

beforeEach(() => {
  state.mutations.clear();
  state.queries.clear();
  state.mutations.set(boardSliceRef, vi.fn(async () => board));
  state.mutations.set(createTaskRef, vi.fn(async () => ({ id: "created" })));
  state.mutations.set(createGroupRef, vi.fn(async () => ({ id: "group-2" })));
  state.mutations.set(createAlertRef, vi.fn(async () => ({ id: "alert-1" })));
});

afterEach(() => cleanup());

describe("activity on Tasks", () => {
  const message = (origin: string): FeedRow => ({
    id: origin,
    type: "message",
    title: origin,
    origin,
  });

  it("keeps other people's messages and hides your own by default", () => {
    expect(activityVisible(message("member"), "others")).toBe(true);
    expect(activityVisible(message("agent"), "others")).toBe(true);
    expect(activityVisible(message("self"), "others")).toBe(false);
    expect(activityVisible({ id: "task", type: "task", title: "Mine", origin: "self" }, "others")).toBe(
      true
    );
  });
});

describe("signed-in shell", () => {
  it("shows Tasks, no selection, detail after opening a row, and clears on a chip change", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(screen.getByText("Select an item.")).toBeTruthy();
    const row = await screen.findByLabelText("Open Water the plants");

    await user.click(row);
    const detail = screen.getByLabelText("Detail");
    expect(within(detail).getByText("Water the plants")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Daily" }));
    await waitFor(() => expect(screen.getByText("Select an item.")).toBeTruthy());
    expect(mutation(boardSliceRef)).toHaveBeenCalledWith(
      expect.objectContaining({ tab: "daily" })
    );
  });

  it("opens Settings from the menu", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(screen.getAllByRole("button", { name: "Menu" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Settings" }));

    expect(screen.getByRole("region", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Others" })).toBeTruthy();
  });

  it("submits a task title from create", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(screen.getByRole("button", { name: "Create task" }));
    const form = screen.getByLabelText("New task");
    await user.type(within(form).getByLabelText("Title"), "Take the bins out");
    await user.click(within(form).getByRole("button", { name: "Create task" }));

    await waitFor(() =>
      expect(mutation(createTaskRef)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Take the bins out" })
      )
    );
  });

  it("submits a group name on Groups", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(destinationButton("Groups"));
    await user.click(screen.getAllByRole("button", { name: "Create group" })[0]);
    const form = screen.getByLabelText("New group");
    await user.type(within(form).getByLabelText("Name"), "Household");
    await user.click(within(form).getByRole("button", { name: "Create group" }));

    await waitFor(() =>
      expect(mutation(createGroupRef)).toHaveBeenCalledWith({ name: "Household" })
    );
  });

  it("submits a message title from the Messages composer", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(destinationButton("Messages"));
    await user.click(screen.getAllByRole("button", { name: "Compose message" })[0]);
    const form = screen.getByLabelText("New message");
    await user.type(within(form).getByLabelText("Title"), "Flight is Thursday");
    await user.click(within(form).getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(mutation(createAlertRef)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Flight is Thursday" })
      )
    );
  });
});
