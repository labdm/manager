import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import { HomeLayout, type HomeLayoutProps } from "../src/HomeLayout";
import type { BoardTask } from "../src/homeTypes";
import type { SheetTarget } from "../src/sheetTypes";

const taskId = (value: string) => value as Id<"tasks">;

function task(
  overrides: Partial<BoardTask> & Pick<BoardTask, "id" | "title">
): BoardTask {
  return {
    done: false,
    dueAt: null,
    ...overrides,
  };
}

function baseProps(overrides: Partial<HomeLayoutProps> = {}): HomeLayoutProps {
  return {
    rail: [],
    activeViewId: "home",
    tab: "tasks",
    tasks: [],
    progressions: [],
    quests: [],
    alerts: [],
    questions: [],
    categories: [],
    events: [],
    resources: [],
    timezone: "UTC",
    onSelectView: vi.fn(),
    onSelectTab: vi.fn(),
    onCreateTask: vi.fn(async () => taskId("created-task")),
    onToggleTask: vi.fn(async () => {}),
    onDeleteTask: vi.fn(async () => {}),
    onUpdateTask: vi.fn(async () => {}),
    onMarkSeen: vi.fn(async () => ({ seenAt: 1 })),
    onInstallTemplate: vi.fn(async () => {}),
    onEnableComputed: vi.fn(async () => {}),
    onRemoveView: vi.fn(async () => {}),
    onPinTask: vi.fn(async () => {}),
    onUnpinTask: vi.fn(async () => {}),
    onLoadDashboard: vi.fn(async () => ({
      categories: [],
      events: [],
      resources: [],
    })),
    onLoadResources: vi.fn(async () => []),
    onCreateSeries: vi.fn(async () => ({})),
    onSetResourceEffect: vi.fn(async () => {}),
    onSaveEntity: vi.fn(async () => {}),
    ...overrides,
  };
}

function render(props: Partial<HomeLayoutProps> = {}): string {
  return renderToStaticMarkup(createElement(HomeLayout, baseProps(props)));
}

describe("Home layout", () => {
  it("renders the bottom bar with four tabs, grid, plus, and no side rail", () => {
    const markup = render();

    for (const label of ["Tasks", "Daily", "Weekly", "Monthly", "Grid", "Add"]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('aria-label="Home navigation"');
    expect(markup).toContain('aria-label="Open dashboard"');
    expect(markup).toContain('aria-label="Create a task"');
    expect(markup).not.toContain('class="rail"');
    expect(markup).not.toContain('aria-label="Views"');
    expect(markup).not.toContain("Find more");
  });

  it("does not put NEW on a self-created task", () => {
    const markup = render({
      tasks: [
        task({
          id: taskId("task-self"),
          title: "Play Witcher",
          origin: "self",
          seenAt: null,
        }),
      ],
    });

    expect(markup).toContain("Play Witcher");
    expect(markup).not.toContain("NEW");
    expect(markup).not.toContain("badge-new");
  });

  it("puts NEW on an agent task until seenAt is set", () => {
    const unseen = render({
      tasks: [
        task({
          id: taskId("task-agent"),
          title: "Install Omarchy",
          origin: "agent",
          seenAt: null,
        }),
      ],
    });
    expect(unseen).toContain("Install Omarchy");
    expect(unseen).toContain("NEW");

    const seen = render({
      tasks: [
        task({
          id: taskId("task-agent"),
          title: "Install Omarchy",
          origin: "agent",
          seenAt: 1_700_000_000_000,
        }),
      ],
    });
    expect(seen).not.toContain("NEW");
  });

  it("draws check as a checkbox, row as a line, and card as a card", () => {
    const check = render({
      tasks: [task({ id: taskId("check"), title: "Dishes", presentation: "check" })],
    });
    const row = render({
      tasks: [task({ id: taskId("row"), title: "Journal", presentation: "row" })],
    });
    const card = render({
      tasks: [task({ id: taskId("card"), title: "Workout", presentation: "card" })],
    });

    expect(check).toContain("look-check");
    expect(check).toContain('aria-label="Complete Dishes"');
    expect(row).toContain("look-row");
    expect(row).not.toContain('aria-label="Complete Journal"');
    expect(card).toContain("look-card");
    expect(card).toContain("Workout");
  });

  it("renders the dashboard as a full-screen grid of tiles and add tiles", () => {
    const markup = render({
      initialDashboard: true,
      rail: [
        { id: "household", title: "Household", icon: "house", color: "amber", kind: "template" },
      ],
      categories: [{ id: "cat-health", name: "Health", icon: "heart-pulse", color: "red" }],
      events: [
        {
          id: "event-week",
          title: "This week",
          kind: "week",
          startsAt: 1,
          endsAt: 2,
          icon: "calendar-range",
          color: "amber",
        },
      ],
      progressions: [
        { id: "prog-book", title: "Finish the book", mode: "meter", current: 150, target: 300, unit: "pages" },
      ],
      resources: [{ id: "res-milk", title: "Milk", quantity: 2, unit: "bottles" }],
    });

    expect(markup).toContain('aria-label="Dashboard"');
    expect(markup).toContain('class="dashboard-grid"');
    for (const title of [
      "Household",
      "Health",
      "This week",
      "Finish the book",
      "Milk",
      "Add view",
      "Add category",
      "Add event",
      "Add progression",
      "Add resource",
    ]) {
      expect(markup).toContain(title);
    }
    expect(markup).toContain("Find more");
    expect(markup).not.toContain("drawer");
  });

  it("opens the task sheet with look, series, and explicit cadence", () => {
    const target: SheetTarget = { kind: "createTask" };
    const markup = render({ initialSheet: target });

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("New task");
    expect(markup).toContain("Look");
    expect(markup).toContain("Series");
    expect(markup).toContain("Every 14 days");
    expect(markup).toContain("Resource effect");
    expect(markup).not.toContain('aria-label="Lucide icon"');
  });

  it("opens entity sheets with a picked icon, never a typed icon name", () => {
    const target: SheetTarget = { kind: "entity", entity: "category" };
    const markup = render({ initialSheet: target });

    expect(markup).toContain("New category");
    expect(markup).toContain('aria-label="Use shapes icon"');
    expect(markup).toContain('aria-label="Use violet color"');
    expect(markup).not.toContain('aria-label="Lucide icon"');
  });

  it("edits a task in the same sheet with its current look selected", () => {
    const target: SheetTarget = { kind: "editTask", id: taskId("task-card") };
    const markup = render({
      initialSheet: target,
      tasks: [
        task({
          id: taskId("task-card"),
          title: "Read pages",
          presentation: "card",
        }),
      ],
    });

    expect(markup).toContain("Task details");
    expect(markup).toContain('value="Read pages"');
    expect(markup).toContain("Save changes");
    expect(markup).toContain("Delete task");
  });

  it("shows a failed function error inside the sheet", () => {
    const markup = render({
      initialSheet: { kind: "createTask" },
      initialSheetError: "recurrences.create is not deployed",
    });

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("recurrences.create is not deployed");
  });

  it("renders a progression as a bar with current and target", () => {
    const markup = render({
      progressions: [
        {
          id: "progression-book",
          title: "Finish the book",
          mode: "meter",
          current: 150,
          target: 300,
          unit: "pages",
        },
      ],
    });

    expect(markup).toContain("Finish the book");
    expect(markup).toContain("150/300");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="150"');
    expect(markup).toContain('aria-valuemax="300"');
  });

  it("renders a quest as done, current, and later steps", () => {
    const markup = render({
      quests: [
        {
          id: "quest-friend",
          title: "See a friend",
          status: "open",
          waiting: false,
          steps: [
            { id: "step-1", title: "Propose a time", done: true },
            { id: "step-2", title: "Confirm a place", done: false },
            { id: "step-3", title: "Go", done: false },
          ],
        },
      ],
    });

    expect(markup).toContain("See a friend");
    expect(markup).toContain("Propose a time");
    expect(markup).toContain("Confirm a place");
    expect(markup).toContain("Go");
    expect(markup).toContain("quest-step done");
    expect(markup).toContain("quest-step current");
    expect(markup).toContain("quest-step later");
  });

  it("hides alerts, questions, progressions, and quests when empty", () => {
    const markup = render();

    expect(markup).not.toContain("Unread alerts");
    expect(markup).not.toContain("Open questions");
    expect(markup).not.toContain("<h2>Progressions</h2>");
    expect(markup).not.toContain("<h2>Quests</h2>");
  });

  it("shows alerts without a checkbox and questions with option buttons", () => {
    const markup = render({
      alerts: [
        {
          id: "alert-flight",
          title: "Flight is Thursday",
          body: "Terminal 2, 09:40.",
        },
      ],
      questions: [
        {
          id: "question-window",
          prompt: "What next for the broken window?",
          options: [
            { id: "buy-glass", label: "Buy glass" },
            { id: "send-money", label: "Send money" },
          ],
        },
      ],
    });

    expect(markup).toContain("Flight is Thursday");
    expect(markup).not.toContain("Complete Flight is Thursday");
    expect(markup).toContain("What next for the broken window?");
    expect(markup).toContain("Buy glass");
    expect(markup).toContain("Send money");
  });
});
