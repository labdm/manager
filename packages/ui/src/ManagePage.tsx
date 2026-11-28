import { useState } from "react";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { RoutingForm } from "./Forms";
import type { CategoryRecord, GroupItem, InviteItem, ResourceRecord, RoutingItem } from "./shellTypes";

export type ManageTab = "events" | "resources" | "categories" | "contacts" | "groups" | "routines" | "tracks";

const TABS: ReadonlyArray<{ id: ManageTab; label: string }> = [
  { id: "events", label: "Events" },
  { id: "resources", label: "Resources" },
  { id: "categories", label: "Categories" },
  { id: "contacts", label: "Contacts" },
  { id: "groups", label: "Groups" },
  { id: "routines", label: "Routines" },
  { id: "tracks", label: "Tracks" },
];

export function ManagePage({
  events,
  resources,
  categories,
  contacts,
  groups,
  routings,
  error,
  onCreate,
  onCreateRouting,
}: {
  events: ReadonlyArray<{ id: string; title: string; kind?: string }>;
  resources: ResourceRecord[];
  categories: CategoryRecord[];
  contacts: InviteItem[];
  groups: GroupItem[];
  routings: RoutingItem[];
  error?: string | null;
  onCreate: (kind: "resource" | "category" | "group" | "invite" | "quest" | "progression") => void;
  onCreateRouting: (name: string, cadence: "daily" | "weekly" | "monthly", title: string) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<ManageTab>("events");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as ManageTab)}>
      <TabsList className="h-auto w-full flex-wrap justify-start">
        {TABS.map((item) => (
          <TabsTrigger key={item.id} value={item.id}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="events" className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Day, week and month rhythms are created as you use the board. Named events are listed here.
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {events.map((event) => (
            <li key={event.id} className="rounded-xl border bg-card px-3 py-2">
              <span className="font-medium">{event.title}</span>
              {event.kind ? <span className="ml-2 text-muted-foreground">{event.kind}</span> : null}
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="resources" className="flex flex-col gap-3">
        <Button type="button" className="self-start" onClick={() => onCreate("resource")}>
          Create resource
        </Button>
        <ul className="flex flex-col gap-2 text-sm">
          {resources.map((resource) => (
            <li key={resource.id} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
              <span className="font-medium">{resource.title}</span>
              <span className="text-muted-foreground">
                {resource.quantity ?? 0}
                {resource.unit ? ` ${resource.unit}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="categories" className="flex flex-col gap-3">
        <Button type="button" className="self-start" onClick={() => onCreate("category")}>
          Create category
        </Button>
        <ul className="flex flex-col gap-2 text-sm">
          {categories.map((category) => (
            <li key={category.id} className="rounded-xl border bg-card px-3 py-2 font-medium">
              {category.name ?? category.title}
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="contacts" className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">People you have invited into a group.</p>
        <Button type="button" className="self-start" onClick={() => onCreate("invite")}>
          Invite
        </Button>
        <ul className="flex flex-col gap-2 text-sm">
          {contacts.map((invite) => (
            <li key={invite.id} className="rounded-xl border bg-card px-3 py-2">
              {invite.email ?? "Invite"} · {invite.status ?? "pending"}
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="groups" className="flex flex-col gap-3">
        <Button type="button" className="self-start" onClick={() => onCreate("group")}>
          Create group
        </Button>
        <ul className="flex flex-col gap-2 text-sm">
          {groups.map((group) => (
            <li key={group.id} className="rounded-xl border bg-card px-3 py-2 font-medium">
              {group.name}
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="routines" className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          A task’s recurrence is chosen when you create it. Daily, weekly, monthly and every N days or weeks land on the matching tab and reset from a completion record. Automations below can also create tasks.
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {routings.map((routing) => (
            <li key={routing.id} className="rounded-xl border bg-card p-3">
              <span className="font-medium">{routing.name}</span>
              <span className="ml-2 text-muted-foreground">
                {routing.cadence ?? "daily"} · {routing.executionKind ?? "createTask"}
              </span>
            </li>
          ))}
        </ul>
        <RoutingForm onSubmit={onCreateRouting} onCancel={() => undefined} error={error} />
      </TabsContent>
      <TabsContent value="tracks" className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Quest chains and progressions are tracks. They are not the Quests tab, and they do not fill the section meter.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onCreate("quest")}>
            Create quest
          </Button>
          <Button type="button" variant="outline" onClick={() => onCreate("progression")}>
            Create progression
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
