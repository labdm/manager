import {
  MenuButton,
  ProductRow,
  SectionMeter,
  playCompleteSound,
  prefersReducedMotion,
  vibrateComplete,
  type FeedRow,
} from "@manager/ui";
import { useState } from "react";
import "../../../packages/ui/src/styles.css";
import "../../../packages/ui/src/shell.css";

const STARTER: FeedRow[] = [
  { id: "task:1", type: "task", title: "Water the plants", routineKind: "none", action: "Done", taskId: "1" },
  { id: "task:2", type: "task", title: "Dishes", routineKind: "daily", action: "Done", taskId: "2" },
  {
    id: "task:3",
    type: "task",
    title: "Taxes",
    routineKind: "monthly",
    waiting: true,
    waitingReason: "Waiting for the accountant",
    body: "Waiting for the accountant",
    action: "Unblock",
    taskId: "3",
  },
];

const TABS = [
  { id: "quests", label: "Quests" },
  { id: "daily", label: "Daily", hint: "Resets at midnight" },
  { id: "weekly", label: "Weekly", hint: "Resets Monday" },
  { id: "monthly", label: "Monthly", hint: "Resets on the 1st" },
  { id: "events", label: "Events" },
] as const;

function matchesTab(row: FeedRow, tab: (typeof TABS)[number]["id"]): boolean {
  const kind = row.routineKind ?? "none";
  if (tab === "quests") return kind === "none";
  if (tab === "daily") return kind === "daily";
  if (tab === "weekly") return kind === "weekly";
  if (tab === "monthly") return kind === "monthly";
  return false;
}

/** Dev-only board so the gamified shell can be exercised without Clerk. */
export function PreviewPage() {
  const [rows, setRows] = useState(STARTER);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("quests");
  const [burst, setBurst] = useState<string | null>(null);
  const [xp, setXp] = useState<number | null>(null);
  const [undo, setUndo] = useState<FeedRow | null>(null);

  if (!import.meta.env.DEV) {
    return (
      <main className="p-6">
        <p>This preview is only available in development.</p>
      </main>
    );
  }

  function complete(row: FeedRow) {
    if (row.waiting) {
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, waiting: false, action: "Done", body: undefined } : item,
        ),
      );
      return;
    }
    if (row.done) return;
    const next = rows.map((item) => (item.id === row.id ? { ...item, done: true, action: null } : item));
    const visible = next.filter((item) => matchesTab(item, tab));
    const clears = visible.length > 0 && visible.every((item) => item.done);
    setRows(next);
    setBurst(row.id);
    setXp(clears ? 25 : 10);
    setUndo(row);
    if (!prefersReducedMotion()) {
      playCompleteSound();
      vibrateComplete(clears);
    }
    window.setTimeout(() => setBurst(null), 900);
  }

  return (
    <div className="shell-frame bg-background text-foreground">
      <div className="shell-main flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <MenuButton
            profile={{ name: "Ada Lovelace", email: "ada@lab.dev" }}
            onSelect={() => undefined}
            onDestination={() => undefined}
            onSignOut={() => undefined}
          />
          <p className="text-sm font-medium">Groups</p>
        </header>
        <div className="border-b px-3 py-2">
          <div className="flex gap-2 overflow-x-auto text-sm">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={"hint" in item ? item.hint : undefined}
                className={tab === item.id ? "rounded-md bg-white px-3 py-1 shadow-sm" : "px-3 py-1 text-muted-foreground"}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {(() => {
            const active = TABS.find((item) => item.id === tab);
            const hint = active && "hint" in active ? active.hint : undefined;
            return hint ? <p className="px-1 pt-1 text-xs text-muted-foreground">{hint}</p> : null;
          })()}
        </div>
        <div className="flex flex-col gap-3 p-3">
          <SectionMeter
            rows={rows.filter((row) => matchesTab(row, tab))}
            celebrate={rows.filter((row) => matchesTab(row, tab)).every((row) => row.done) && rows.some((row) => matchesTab(row, tab))}
          />
          <ul className="flex flex-col gap-2">
            {rows.filter((row) => matchesTab(row, tab)).map((row) => (
              <ProductRow
                key={row.id}
                row={row}
                selected={false}
                celebrating={burst === row.id}
                onOpen={() => undefined}
                onAction={() => complete(row)}
              />
            ))}
          </ul>
        </div>
        {xp ? <div className="xp-float">+{xp} XP</div> : null}
        {undo ? (
          <div className="undo-toast" role="status">
            <span className="undo-copy">
              <span className="undo-kicker">Completed</span>
              <span className="undo-title">{undo.title}</span>
            </span>
            <button
              type="button"
              className="shrink-0 rounded-md border px-3 py-1.5 text-sm"
              onClick={() => {
                setRows((current) =>
                  current.map((item) => (item.id === undo.id ? { ...undo, done: false, action: "Done" } : item)),
                );
                setUndo(null);
                setXp(null);
              }}
            >
              Undo
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
