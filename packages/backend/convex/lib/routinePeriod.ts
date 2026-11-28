import {
  addPeriods,
  assertTimezone,
  civilDayStart,
  instantOnCivilDay,
  monthStart,
  periodsBetween,
  weekStart,
} from "./civilDates";

/** Used when a task has no stored timezone and the caller did not send one. */
export const DEFAULT_TIMEZONE = "Europe/Warsaw";

export type RoutineKind = "none" | "daily" | "weekly" | "monthly" | "interval";
export type IntervalUnit = "days" | "weeks";
export type Section = "quests" | "daily" | "weekly" | "monthly";

export type Routine = {
  kind: RoutineKind;
  every?: number;
  unit?: IntervalUnit;
  anchorOn?: number;
};

const KINDS = new Set<RoutineKind>(["none", "daily", "weekly", "monthly", "interval"]);

export function readRoutine(input: {
  routineKind?: string;
  intervalEvery?: number;
  intervalUnit?: string;
  routineAnchor?: number;
}): Routine {
  const kind = (input.routineKind ?? "none") as RoutineKind;
  if (!KINDS.has(kind)) throw new Error("Invalid routine");
  if (kind !== "interval") return { kind };
  const every = input.intervalEvery;
  const unit = input.intervalUnit;
  if (!Number.isInteger(every) || every === undefined || every < 1 || every > 366) {
    throw new Error("Invalid routine");
  }
  if (unit !== "days" && unit !== "weeks") throw new Error("Invalid routine");
  return { kind, every, unit, anchorOn: input.routineAnchor };
}

/** Quests are non-repeating. Day-based intervals sit on Daily; week-based on Weekly. */
export function sectionForRoutine(routine: Routine): Section {
  if (routine.kind === "daily") return "daily";
  if (routine.kind === "weekly") return "weekly";
  if (routine.kind === "monthly") return "monthly";
  if (routine.kind === "interval") return routine.unit === "weeks" ? "weekly" : "daily";
  return "quests";
}

export function sectionForCadence(cadence: string | undefined): Section | null {
  if (cadence === "daily") return "daily";
  if (cadence === "weekly" || cadence === "biweekly") return "weekly";
  if (cadence === "monthly") return "monthly";
  return null;
}

/** Section for a stored task. A series cadence is used only when the task itself has no routine. */
export function taskSection(
  task: { routineKind?: string; intervalUnit?: string },
  seriesCadence?: string,
): Section {
  if (task.routineKind === "daily") return "daily";
  if (task.routineKind === "weekly") return "weekly";
  if (task.routineKind === "monthly") return "monthly";
  if (task.routineKind === "interval") {
    return task.intervalUnit === "weeks" ? "weekly" : "daily";
  }
  return sectionForCadence(seriesCadence) ?? "quests";
}

function timezoneOf(timezone: string | undefined): string {
  const value = timezone?.trim() || DEFAULT_TIMEZONE;
  assertTimezone(value);
  return value;
}

function intervalDays(routine: Routine): number {
  const every = routine.every ?? 1;
  return routine.unit === "weeks" ? every * 7 : every;
}

/** Local midnight that opens the period containing `now`. */
export function periodStartEpoch(routine: Routine, now: number, timezone: string): number {
  const zone = timezoneOf(timezone);
  if (routine.kind === "weekly") return weekStart(now, zone);
  if (routine.kind === "monthly") return monthStart(now, zone);
  if (routine.kind === "interval") {
    const anchor = civilDayStart(routine.anchorOn ?? now, zone);
    const cursor = civilDayStart(now, zone);
    const step = intervalDays(routine);
    const fromAnchor = periodsBetween("daily", anchor, cursor, zone);
    const index = Math.floor(fromAnchor / step);
    return addPeriods("daily", anchor, index * step, zone);
  }
  return civilDayStart(now, zone);
}

export function periodIdFor(routine: Routine, start: number): string {
  if (routine.kind === "interval") {
    return `interval:${routine.every}:${routine.unit}:${start}`;
  }
  return `${routine.kind}:${start}`;
}

/** Null for a quest: quests do not reset. */
export function periodId(routine: Routine, now: number, timezone: string): string | null {
  if (routine.kind === "none") return null;
  return periodIdFor(routine, periodStartEpoch(routine, now, timezone));
}

export function shiftPeriod(
  routine: Routine,
  start: number,
  count: number,
  timezone: string,
): number {
  const zone = timezoneOf(timezone);
  if (routine.kind === "weekly") return addPeriods("weekly", start, count, zone);
  if (routine.kind === "monthly") return addPeriods("monthly", start, count, zone);
  if (routine.kind === "interval") {
    return addPeriods("daily", start, count * intervalDays(routine), zone);
  }
  return addPeriods("daily", start, count, zone);
}

export function streakFor(
  routine: Routine,
  periodIds: ReadonlySet<string>,
  now: number,
  timezone: string,
): number {
  if (routine.kind === "none") return 0;
  const zone = timezoneOf(timezone);
  let start = periodStartEpoch(routine, now, zone);
  if (!periodIds.has(periodIdFor(routine, start))) {
    start = shiftPeriod(routine, start, -1, zone);
  }
  let count = 0;
  while (count < 24 && periodIds.has(periodIdFor(routine, start))) {
    count += 1;
    start = shiftPeriod(routine, start, -1, zone);
  }
  return count;
}

/** Next future instant for a time-of-day reminder. Quests use the next civil day. */
export function nextReminderAt(
  now: number,
  timezone: string,
  routine: Routine,
  minutes: number,
): number {
  const zone = timezoneOf(timezone);
  const on = (start: number) => instantOnCivilDay(start, minutes, zone);
  if (routine.kind === "none" || routine.kind === "daily") {
    const today = civilDayStart(now, zone);
    const at = on(today);
    return at > now ? at : on(addPeriods("daily", today, 1, zone));
  }
  const start = periodStartEpoch(routine, now, zone);
  const at = on(start);
  return at > now ? at : on(shiftPeriod(routine, start, 1, zone));
}

export function resetHint(kind: string | undefined): string | null {
  if (kind === "daily") return "Resets at midnight";
  if (kind === "weekly") return "Resets Monday";
  if (kind === "monthly") return "Resets on the 1st";
  if (kind === "interval") return "Resets each period";
  return null;
}
