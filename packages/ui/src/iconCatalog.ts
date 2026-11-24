import { Circle, icons, type LucideIcon } from "lucide-react";

const registry = icons as unknown as Record<string, LucideIcon>;

/** A short first page; searching opens up the rest of the Lucide set. */
const FIRST_PAGE = [
  "house",
  "sun",
  "moon",
  "flame",
  "sparkles",
  "star",
  "heart",
  "heart-pulse",
  "dumbbell",
  "book-open",
  "book-marked",
  "graduation-cap",
  "briefcase",
  "folder-kanban",
  "wallet",
  "badge-dollar-sign",
  "clipboard-list",
  "list-checks",
  "list-todo",
  "check",
  "circle",
  "circle-check",
  "calendar",
  "calendar-days",
  "calendar-range",
  "clock",
  "timer",
  "alarm-clock",
  "bell",
  "inbox",
  "mail",
  "message-circle",
  "messages-square",
  "users",
  "user",
  "palette",
  "shapes",
  "layers",
  "layout-grid",
  "target",
  "trophy",
  "settings",
  "search",
  "pin",
  "filter",
  "package",
  "shopping-basket",
  "shopping-cart",
  "refrigerator",
  "cooking-pot",
  "utensils",
  "soap-dispenser-droplet",
  "shower-head",
  "bed-double",
  "sofa",
  "car",
  "plane",
  "train-front",
  "bike",
  "wrench",
  "hammer",
  "screwdriver",
  "trash",
  "recycle",
  "sprout",
  "tree-pine",
  "flower",
  "cloud",
  "cloud-rain",
  "snowflake",
  "wind",
  "zap",
  "droplet",
  "thermometer",
  "activity",
  "pill",
  "stethoscope",
  "bandage",
  "shield",
  "lock",
  "key",
  "eye",
  "eye-off",
  "smile",
  "meh",
  "frown",
  "thumb-up",
  "gift",
  "party-popper",
  "music",
  "camera",
  "video",
  "gamepad-2",
  "dumbbell",
  "footprints",
  "map",
  "map-pin",
  "compass",
  "navigation",
  "globe",
  "newspaper",
  "file-text",
  "notebook-pen",
  "sticky-note",
  "paperclip",
  "link",
  "box",
  "boxes",
  "archive",
  "database",
  "server",
  "cog",
  "sliders-horizontal",
  "chart-column",
  "chart-line",
  "git-branch",
  "workflow",
  "route",
  "flag",
  "milestone",
  "rocket",
  "wand-sparkles",
  "x",
] as const;

export interface IconChoice {
  /** The stored name: lowercase, kebab-case, e.g. `heart-pulse`. */
  name: string;
  icon: LucideIcon;
}

function pascalCase(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/** Lucide exports PascalCase keys; the UI stores lowercase kebab-case names. */
function storedName(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fromStoredName(name: string): LucideIcon | undefined {
  const key = pascalCase(name);
  return registry[key];
}

export function resolveLucideIcon(name: string | null | undefined): LucideIcon {
  return (name ? fromStoredName(name) : undefined) ?? Circle;
}

/** The picker never asks for a typed name: every choice comes from this list. */
export function iconChoices(query: string | null | undefined): IconChoice[] {
  const needle = (query ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!needle) {
    const choices: IconChoice[] = [];
    for (const name of Array.from(new Set<string>(FIRST_PAGE))) {
      const icon = fromStoredName(name);
      if (icon) choices.push({ name, icon });
    }
    return choices;
  }

  const choices: IconChoice[] = [];
  for (const [key, icon] of Object.entries(registry)) {
    if (key.endsWith("Icon") || key.startsWith("Lucide")) continue;
    const name = storedName(key);
    if (!name.includes(needle)) continue;
    choices.push({ name, icon });
    if (choices.length >= 240) break;
  }
  return choices;
}
