import type { Chip } from "./shellTypes";

export const CHIP_ORDER: readonly Chip[] = ["all", "daily", "weekly", "monthly", "events"];

/** Horizontal swipe. A mostly vertical gesture leaves the tab alone. */
export function chipAfterSwipe(current: Chip, dx: number, dy: number): Chip | null {
  if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return null;
  const index = CHIP_ORDER.indexOf(current);
  if (index < 0) return null;
  const next = index + (dx < 0 ? 1 : -1);
  if (next < 0 || next >= CHIP_ORDER.length) return null;
  return CHIP_ORDER[next];
}
