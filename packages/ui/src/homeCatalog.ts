import type { ViewTemplate } from "./homeTypes";

/** The color tokens `appearance.color` accepts. Unknown values draw gray. */
export const COLOR_TOKENS = [
  "gray",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

export function normalizeColorToken(value: string | null | undefined): ColorToken {
  const normalized = (value ?? "").trim().toLowerCase();
  return COLOR_TOKENS.includes(normalized as ColorToken)
    ? (normalized as ColorToken)
    : "gray";
}

/**
 * The Find more catalog. Installing a slug copies the template onto the rail;
 * the backend owns starter tasks and the optional frame.
 */
export const VIEW_TEMPLATES: ReadonlyArray<ViewTemplate> = [
  { slug: "household", title: "Household", icon: "house", color: "amber" },
  { slug: "health", title: "Health", icon: "heart-pulse", color: "red" },
  { slug: "body", title: "Body", icon: "dumbbell", color: "rose" },
  { slug: "relationships", title: "Relationships", icon: "heart", color: "pink" },
  { slug: "work", title: "Work", icon: "briefcase", color: "blue" },
  { slug: "projects", title: "Projects", icon: "folder-kanban", color: "indigo" },
  { slug: "money", title: "Money", icon: "wallet", color: "emerald" },
  { slug: "admin", title: "Admin", icon: "clipboard-list", color: "gray" },
  { slug: "learning", title: "Learning", icon: "graduation-cap", color: "violet" },
  { slug: "social", title: "Social", icon: "messages-square", color: "cyan" },
  { slug: "creative", title: "Creative", icon: "palette", color: "purple" },
];

export const COMPUTED_VIEWS = [
  { slug: "new", title: "New", icon: "sparkles", color: "red" },
  { slug: "high-priority", title: "High priority", icon: "flame", color: "orange" },
  { slug: "today", title: "Today", icon: "sun", color: "amber" },
] as const;

export type ComputedViewSlug = (typeof COMPUTED_VIEWS)[number]["slug"];
