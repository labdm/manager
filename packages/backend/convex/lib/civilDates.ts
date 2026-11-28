/**
 * Civil-day arithmetic using Intl only. No date library, no server timezone
 * assumptions. A "period start" is always epoch ms at local midnight in the
 * recurrence's IANA timezone.
 */

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    throw new Error("Invalid timezone");
  }
  formatterCache.set(timezone, formatter);
  return formatter;
}

export function assertTimezone(timezone: string): void {
  formatterFor(timezone);
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
};

function partsAt(epochMs: number, timezone: string): ZonedParts {
  if (!Number.isSafeInteger(epochMs)) throw new Error("Invalid epoch");
  const values = new Map<string, string>();
  for (const part of formatterFor(timezone).formatToParts(new Date(epochMs))) {
    if (part.type !== "literal") values.set(part.type, part.value);
  }
  const weekday = WEEKDAY_INDEX[values.get("weekday") ?? ""];
  if (!weekday) throw new Error("Could not read weekday");
  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    weekday,
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}

function offsetAt(epochMs: number, timezone: string): number {
  const parts = partsAt(epochMs, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/** Epoch ms at local midnight of a civil date in `timezone`. */
export function utcFromCivil(
  year: number,
  month: number,
  day: number,
  timezone: string,
): number {
  return utcFromZoned(year, month, day, 0, 0, timezone);
}

/** Epoch ms at a civil date and clock time in `timezone`. */
export function utcFromZoned(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = guess - offsetAt(guess, timezone);
  return guess - offsetAt(first, timezone);
}

/** Clock time on the civil day that starts at `dayStart` (local midnight). */
export function instantOnCivilDay(
  dayStart: number,
  minutes: number,
  timezone: string,
): number {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
    throw new Error("Invalid remindMinutes");
  }
  const parts = partsAt(dayStart, timezone);
  return utcFromZoned(
    parts.year,
    parts.month,
    parts.day,
    Math.floor(minutes / 60),
    minutes % 60,
    timezone,
  );
}

/** Epoch ms at local midnight of the civil day containing `epochMs`. */
export function civilDayStart(epochMs: number, timezone: string): number {
  const parts = partsAt(epochMs, timezone);
  return utcFromCivil(parts.year, parts.month, parts.day, timezone);
}

/** Monday of the local week containing `epochMs`, at local midnight. */
export function weekStart(epochMs: number, timezone: string): number {
  const day = civilDayStart(epochMs, timezone);
  const parts = partsAt(day, timezone);
  const daysSinceMonday = (parts.weekday + 6) % 7;
  return utcFromCivil(parts.year, parts.month, parts.day - daysSinceMonday, timezone);
}

/** The 1st of the local month containing `epochMs`, at local midnight. */
export function monthStart(epochMs: number, timezone: string): number {
  const parts = partsAt(civilDayStart(epochMs, timezone), timezone);
  return utcFromCivil(parts.year, parts.month, 1, timezone);
}

export type Cadence = "daily" | "weekly" | "biweekly" | "monthly";

export function isCadence(value: string): value is Cadence {
  return (
    value === "daily" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly"
  );
}

/** Accepts the UI label for the 14-day cadence as well as the stored id. */
export function normalizeCadence(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "every 14 days" || trimmed === "fortnightly") return "biweekly";
  return trimmed;
}

/** Start of the period containing `epochMs` for the given cadence. */
export function periodStartFor(
  cadence: string,
  epochMs: number,
  timezone: string,
  anchorOn?: number,
): number {
  if (!isCadence(cadence)) throw new Error("Unsupported cadence");
  if (cadence === "daily") return civilDayStart(epochMs, timezone);
  if (cadence === "weekly") return weekStart(epochMs, timezone);
  if (cadence === "biweekly") {
    // A biweekly period is 14 civil days measured from the series anchor.
    // Without an anchor, the instant itself establishes one.
    const anchorParts = partsAt(civilDayStart(anchorOn ?? epochMs, timezone), timezone);
    const startedParts = partsAt(civilDayStart(epochMs, timezone), timezone);
    const anchorUtc = Date.UTC(
      anchorParts.year,
      anchorParts.month - 1,
      anchorParts.day,
    );
    const startedUtc = Date.UTC(
      startedParts.year,
      startedParts.month - 1,
      startedParts.day,
    );
    const days = Math.floor((startedUtc - anchorUtc) / 86_400_000);
    const periods = Math.floor(days / 14);
    return utcFromCivil(
      anchorParts.year,
      anchorParts.month,
      anchorParts.day + periods * 14,
      timezone,
    );
  }
  return monthStart(epochMs, timezone);
}

/** Move a normalized period start by whole periods, in civil time. */
export function addPeriods(
  cadence: string,
  start: number,
  count: number,
  timezone: string,
): number {
  if (!isCadence(cadence)) throw new Error("Unsupported cadence");
  if (!Number.isInteger(count)) throw new Error("Invalid period count");
  const parts = partsAt(start, timezone);
  if (cadence === "daily") {
    return utcFromCivil(parts.year, parts.month, parts.day + count, timezone);
  }
  if (cadence === "weekly") {
    return utcFromCivil(parts.year, parts.month, parts.day + count * 7, timezone);
  }
  if (cadence === "biweekly") {
    return utcFromCivil(parts.year, parts.month, parts.day + count * 14, timezone);
  }
  return utcFromCivil(parts.year, parts.month + count, 1, timezone);
}

/** Number of whole periods from `from` to `to`; both must be normalized. */
export function periodsBetween(
  cadence: string,
  from: number,
  to: number,
  timezone: string,
): number {
  if (!isCadence(cadence)) throw new Error("Unsupported cadence");
  const fromParts = partsAt(from, timezone);
  const toParts = partsAt(to, timezone);
  if (cadence === "monthly") {
    return (
      (toParts.year - fromParts.year) * 12 + (toParts.month - fromParts.month)
    );
  }
  const step = cadence === "weekly" ? 7 : cadence === "biweekly" ? 14 : 1;
  const fromUtc = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toUtc = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  return Math.floor((toUtc - fromUtc) / (step * 86_400_000));
}
