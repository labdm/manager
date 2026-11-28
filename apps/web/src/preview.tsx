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
  { id: "task:2", type: "task", title: "Dishes", routineKind: "daily", hint: "Resets at midnight", action: "Done", taskId: "2" },
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

/** Dev-only board so the gamified shell can be exercised without Clerk. */
export function PreviewPage() {
  const [rows, setRows] = useState(STARTER);
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
    const clears = next.filter((item) => item.type === "task").every((item) => item.done);
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
        <div className="flex gap-2 overflow-x-auto border-b px-3 py-2 text-sm">
          {["Quests", "Daily", "Weekly", "Monthly", "Events"].map((label, index) => (
            <span key={label} className={index === 0 ? "rounded-md bg-white px-3 py-1 shadow-sm" : "px-3 py-1 text-muted-foreground"}>
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-3">
          <SectionMeter rows={rows} celebrate={rows.every((row) => row.done)} />
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
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
            <span>Completed {undo.title}</span>
            <button
              type="button"
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
