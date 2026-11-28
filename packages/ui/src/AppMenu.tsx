import { useState } from "react";
import {
  Heart,
  Info,
  ListChecks,
  Menu as MenuIcon,
  MessageCircle,
  ScrollText,
  Settings,
  Trophy,
  LayoutGrid,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./components/ui/sheet";
import { cn } from "./lib/utils";
import { DONATE_URL } from "./support";
import type { Destination, MenuPage } from "./shellTypes";

export type ShellProfile = {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
};

const GO: ReadonlyArray<{ id: "tasks" | "messages" | "achievements"; label: string; icon: typeof ListChecks }> = [
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "achievements", label: "Achievements", icon: Trophy },
];

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "You";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function MenuButton({
  onSelect,
  onDestination,
  profile,
  onSignOut,
  onManageAccount,
  className,
}: {
  onSelect: (page: MenuPage) => void;
  onDestination: (destination: Destination) => void;
  profile?: ShellProfile;
  onSignOut?: () => void;
  onManageAccount?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = profile?.name?.trim() || "Signed in";
  const email = profile?.email?.trim();

  function close(run: () => void) {
    setOpen(false);
    run();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("size-10 shrink-0 p-0", className)}
          aria-label="Menu"
        >
          <MenuIcon className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" aria-label="Menu" className="flex h-full w-[min(22rem,88vw)] flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-4 pr-12">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-label="Menu pages">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Go</p>
          {GO.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className="justify-start"
                onClick={() =>
                  close(() => {
                    if (item.id === "achievements") onSelect("achievements");
                    else onDestination(item.id);
                  })
                }
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Button>
            );
          })}
          <div className="my-3 h-px bg-border" role="separator" />
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Library</p>
          <Button type="button" variant="ghost" className="justify-start" onClick={() => close(() => onSelect("manage"))}>
            <LayoutGrid aria-hidden="true" />
            Manage
          </Button>
        </nav>
        <div className="shrink-0 border-t px-3 py-3">
          <div className="mb-3 flex items-center gap-3 rounded-xl border bg-card p-3">
            {profile?.imageUrl ? (
              <img src={profile.imageUrl} alt="" className="size-10 rounded-full object-cover" />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials(profile?.name)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{name}</span>
              {email ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
            </span>
          </div>
          <div className="mb-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => close(() => (onManageAccount ?? (() => window.location.assign("/profile")))())}
            >
              Manage account
            </Button>
            <Button type="button" variant="ghost" onClick={() => onSignOut?.()}>
              Sign out
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => close(() => onSelect("settings"))}>
            <Settings aria-hidden="true" />
            Settings
          </Button>
          <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => close(() => onSelect("about"))}>
            <Info aria-hidden="true" />
            About
          </Button>
          <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => close(() => onSelect("changelog"))}>
            <ScrollText aria-hidden="true" />
            Changelog
          </Button>
          <Button type="button" variant="ghost" className="w-full justify-start" asChild>
            <a href={DONATE_URL} target="_blank" rel="noreferrer">
              <Heart aria-hidden="true" />
              Support
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
