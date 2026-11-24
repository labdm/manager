import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import { HomeLayout, type HomeLayoutProps } from "../src/HomeLayout";
import type { BoardTask } from "../src/homeTypes";

const taskId = (value: string) => value as Id<"tasks">;

function task(overrides: Partial<BoardTask> & Pick<BoardTask, "id" | "title">): BoardTask {
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
    onSelectView: vi.fn(),
    onSelectTab: vi.fn(),
    onCreateTask: vi.fn(async () => {}),
    onToggleTask: vi.fn(async () => {}),
    onDeleteTask: vi.fn(async () => {}),
    onUpdateTask: vi.fn(async () => {}),
    onMarkSeen: vi.fn(async () => ({ seenAt: 1 })),
    onInstallTemplate: vi.fn(async () => {}),
    onCreateCustom: vi.fn(async () => {}),
    onEnableComputed: vi.fn(async () => {}),
    onRemoveView: vi.fn(async () => {}),
    onPinTask: vi.fn(async () => {}),
    onUnpinTask: vi.fn(async () => {}),
    ...overrides,
  };
}

function render(props: Partial<HomeLayoutProps> = {}): string {
  return renderToStaticMarkup(createElement(HomeLayout, baseProps(props)));
}

describe("Home layout", () => {
  it("renders Home, the four tabs, and Find more", () => {
    const markup = render({ initialFindMoreOpen: true });

    expect(markup).toContain("Home");
    expect(markup).toContain("Find more");
    expect(markup).toContain('aria-current="page"');

    for (const label of ["Tasks", "Daily", "Weekly", "Monthly"]) {
      expect(markup).toContain(label);
    }

    for (const template of [
      "Household",
      "Health",
      "Body",
      "Relationships",
      "Work",
      "Projects",
      "Money",
      "Admin",
      "Learning",
      "Social",
      "Creative",
    ]) {
      expect(markup).toContain(template);
    }
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
