import { ArrowLeft } from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { ActivityControl, RoutingForm } from "./Forms";
import { achievementCounts } from "./shellFacts";
import type { BoardSlice } from "./homeTypes";
import type { ActivityValue, MenuPage, RoutingItem } from "./shellTypes";

export interface MenuPageViewProps {
  page: MenuPage;
  board: BoardSlice | null;
  activity: ActivityValue;
  routings: RoutingItem[];
  error?: string | null;
  onActivityChange: (value: ActivityValue) => void;
  onCreateRouting: (name: string, cadence: "daily" | "weekly" | "monthly", title: string) => Promise<void> | void;
  onBack: () => void;
}

const TITLES: Record<MenuPage, string> = {
  achievements: "Achievements",
  contacts: "Contacts",
  events: "Events",
  routings: "Routings",
  profile: "Profile",
  settings: "Settings",
  docs: "Docs",
  "contact-us": "Contact us",
  "desktop-app": "Desktop app",
  changelog: "Changelog",
};

/** Menu pages are plain pages with a title. None is a primary destination. */
export function MenuPageView({
  page,
  board,
  activity,
  routings,
  error,
  onActivityChange,
  onCreateRouting,
  onBack,
}: MenuPageViewProps) {
  const title = TITLES[page];
  const counts = achievementCounts(board);

  return (
    <section className="flex h-full flex-col gap-4 overflow-y-auto p-4" aria-label={title}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {page === "achievements" ? (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Completed tasks", counts.completedTasks],
            ["Missed tasks", counts.missedTasks],
            ["Superseded tasks", counts.supersededTasks],
            ["Progression current", counts.progressionCurrent],
            ["Progression target", counts.progressionTarget],
            ["Quests active", counts.questsActive],
            ["Quests completed", counts.questsCompleted],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-md border bg-card p-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd><Badge variant="secondary">{value}</Badge></dd>
            </div>
          ))}
        </dl>
      ) : null}

      {page === "settings" ? (
        <ActivityControl value={activity} onChange={onActivityChange} />
      ) : null}

      {page === "routings" ? (
        <>
          <ul className="flex flex-col gap-2 text-sm">
            {routings.map((routing) => (
              <li key={routing.id} className="rounded-md border bg-card p-3">
                <span className="font-medium">{routing.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {routing.trigger ?? "cron"} · {routing.cadence ?? "daily"} · {routing.executionKind ?? "createTask"}
                </span>
              </li>
            ))}
          </ul>
          <RoutingForm onSubmit={onCreateRouting} onCancel={onBack} error={error} />
        </>
      ) : null}

      {page !== "achievements" && page !== "settings" && page !== "routings" ? (
        <p className="text-sm text-muted-foreground">
          This is the {title} page. Nothing else is loaded here yet.
        </p>
      ) : null}
    </section>
  );
}
