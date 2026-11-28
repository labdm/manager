import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { ActivityControl } from "./Forms";
import { ManagePage } from "./ManagePage";
import { achievementCounts } from "./shellFacts";
import { playCompleteSound, readSoundMuted, writeSoundMuted } from "./feedback";
import { isIos, isStandalone, subscribeToPush } from "./pushClient";
import { savePushSubscriptionRef, sendTestPushRef } from "./homeApi";
import { CHANGELOG, DONATE_URL } from "./support";
import type { BoardSlice } from "./homeTypes";
import type {
  ActivityValue,
  CategoryRecord,
  GroupItem,
  InviteItem,
  MenuPage,
  ResourceRecord,
  RoutingItem,
} from "./shellTypes";

export interface BuildInfo {
  version: string;
  sha: string;
  builtAt: string;
}

export interface MenuPageViewProps {
  page: MenuPage;
  board: BoardSlice | null;
  activity: ActivityValue;
  routings: RoutingItem[];
  events: ReadonlyArray<{ id: string; title: string; kind?: string }>;
  resources: ResourceRecord[];
  categories: CategoryRecord[];
  contacts: InviteItem[];
  groups: GroupItem[];
  error?: string | null;
  buildInfo?: BuildInfo;
  vapidPublicKey?: string;
  onActivityChange: (value: ActivityValue) => void;
  onCreateRouting: (name: string, cadence: "daily" | "weekly" | "monthly", title: string) => Promise<void> | void;
  onCreate: (kind: "resource" | "category" | "group" | "invite" | "quest" | "progression") => void;
  onBack: () => void;
}

const TITLES: Record<MenuPage, string> = {
  achievements: "Achievements",
  manage: "Manage",
  settings: "Settings",
  about: "About",
  changelog: "Changelog",
};

function Notifications({ vapidPublicKey }: { vapidPublicKey?: string }) {
  const save = useMutation(savePushSubscriptionRef);
  const sendTest = useMutation(sendTestPushRef);
  const [message, setMessage] = useState<string | null>(null);
  const showInstallHint = isIos() && !isStandalone();

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <h3 className="text-sm font-medium">Notifications</h3>
      {showInstallHint ? (
        <p className="text-sm text-muted-foreground">
          On iPhone, notifications work from iOS 16.4 after you install Manager. In Safari, tap Share, then Add to Home Screen, and open the app from the icon.
        </p>
      ) : null}
      {!vapidPublicKey ? (
        <p className="text-sm text-muted-foreground">Notifications are not configured on this build.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            void subscribeToPush(vapidPublicKey ?? "")
              .then((subscription) => save(subscription))
              .then(() => setMessage("Notifications are on for this device."))
              .catch((caught: unknown) => {
                setMessage(caught instanceof Error ? caught.message : "Could not enable notifications");
              });
          }}
        >
          Enable notifications
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void sendTest({})
              .then(() => setMessage("Test notification sent."))
              .catch((caught: unknown) => {
                setMessage(caught instanceof Error ? caught.message : "Could not send a test");
              });
          }}
        >
          Send test notification
        </Button>
      </div>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </section>
  );
}

function SoundToggle() {
  const [muted, setMuted] = useState(readSoundMuted);
  return (
    <section className="flex items-center justify-between rounded-xl border bg-card p-3">
      <div>
        <h3 className="text-sm font-medium">Sound</h3>
        <p className="text-xs text-muted-foreground">A short chime when you complete a task.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        aria-pressed={!muted}
        onClick={() => {
          const next = !muted;
          writeSoundMuted(next);
          setMuted(next);
          if (!next) playCompleteSound();
        }}
      >
        {muted ? "Muted" : "On"}
      </Button>
    </section>
  );
}

/** Menu pages are plain pages with a title. None is a primary destination. */
export function MenuPageView({
  page,
  board,
  activity,
  routings,
  events,
  resources,
  categories,
  contacts,
  groups,
  error,
  buildInfo,
  vapidPublicKey,
  onActivityChange,
  onCreateRouting,
  onCreate,
  onBack,
}: MenuPageViewProps) {
  const title = TITLES[page];
  const counts = achievementCounts(board);
  const version = buildInfo?.version ?? "0.1.0";
  const sha = buildInfo?.sha ?? "dev";
  const builtAt = buildInfo?.builtAt ?? "";

  return (
    <section className="flex h-full flex-col gap-4 overflow-y-auto p-4" aria-label={title}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {error && page !== "manage" ? (
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
            <div key={String(label)} className="flex items-center justify-between rounded-xl border bg-card p-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd><Badge variant="secondary">{value}</Badge></dd>
            </div>
          ))}
        </dl>
      ) : null}

      {page === "settings" ? (
        <div className="flex flex-col gap-3">
          <ActivityControl value={activity} onChange={onActivityChange} />
          <SoundToggle />
          <Notifications vapidPublicKey={vapidPublicKey} />
        </div>
      ) : null}

      {page === "manage" ? (
        <ManagePage
          events={events}
          resources={resources}
          categories={categories}
          contacts={contacts}
          groups={groups}
          routings={routings}
          error={error}
          onCreate={onCreate}
          onCreateRouting={onCreateRouting}
        />
      ) : null}

      {page === "about" ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-lg font-semibold">Manager</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Version</dt>
            <dd>{version}</dd>
            <dt className="text-muted-foreground">Commit</dt>
            <dd className="font-mono">{sha}</dd>
            {builtAt ? (
              <>
                <dt className="text-muted-foreground">Built</dt>
                <dd>{builtAt}</dd>
              </>
            ) : null}
          </dl>
          <a className="text-primary underline-offset-4 hover:underline" href="https://manager.labdm.dev">
            manager.labdm.dev
          </a>
          <a className="text-primary underline-offset-4 hover:underline" href="https://github.com/labdm/manager">
            Source
          </a>
          <a className="text-primary underline-offset-4 hover:underline" href="/download">
            Downloads
          </a>
          <a className="text-primary underline-offset-4 hover:underline" href={DONATE_URL}>
            Support
          </a>
        </div>
      ) : null}

      {page === "changelog" ? (
        <ol className="flex flex-col gap-4">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="rounded-xl border bg-card p-3">
              <p className="font-medium">
                {entry.version} <span className="text-sm font-normal text-muted-foreground">{entry.date}</span>
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
