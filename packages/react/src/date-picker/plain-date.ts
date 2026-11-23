// Calendar dates without time or time zone. A date is three numbers; all
// arithmetic goes through the day count since 1970-01-01 in UTC, so daylight
// saving changes and the user's time zone can never shift a date.

/** A calendar date. `month` is 1–12. */
export interface PlainDate {
  /** Full year, 1–9999. */
  year: number;
  /** Month, 1–12. */
  month: number;
  /** Day of the month, 1–31. */
  day: number;
}

/** An ISO calendar date string, `YYYY-MM-DD`. */
export type ISODate = string;

const MS_PER_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

export function isValid(date: PlainDate): boolean {
  return (
    Number.isInteger(date.year) &&
    Number.isInteger(date.month) &&
    Number.isInteger(date.day) &&
    date.year >= 1 &&
    date.year <= 9999 &&
    date.month >= 1 &&
    date.month <= 12 &&
    date.day >= 1 &&
    date.day <= daysInMonth(date.year, date.month)
  );
}

/** Parses `YYYY-MM-DD`; returns `null` for anything else, including 2026-02-30. */
export function parseISODate(text: string | null | undefined): PlainDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? "");
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValid(date) ? date : null;
}

/** Formats a date as `YYYY-MM-DD`. */
export function toISODate(date: PlainDate): ISODate {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Days since 1970-01-01. */
export function toEpochDay(date: PlainDate): number {
  const utc = new Date(0);
  utc.setUTCFullYear(date.year, date.month - 1, date.day);
  return Math.round(utc.getTime() / MS_PER_DAY);
}

export function fromEpochDay(day: number): PlainDate {
  const utc = new Date(day * MS_PER_DAY);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/** A UTC midnight `Date` for formatting with `Intl` and `timeZone: "UTC"`. */
export function toUTCDate(date: PlainDate): Date {
  return new Date(toEpochDay(date) * MS_PER_DAY);
}

/** Adds (or with a negative number subtracts) days. */
export function addDays(date: PlainDate, days: number): PlainDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Adds months, keeping the day where possible: 31 January + 1 month = 28/29 February. */
export function addMonths(date: PlainDate, months: number): PlainDate {
  const index = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

/** Adds years: 29 February + 1 year = 28 February. */
export function addYears(date: PlainDate, years: number): PlainDate {
  return addMonths(date, years * 12);
}

/** Negative if `a` is earlier, positive if later, 0 if the same day. */
export function compareDates(a: PlainDate, b: PlainDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

export function isSameDay(
  a: PlainDate | null | undefined,
  b: PlainDate | null | undefined,
): boolean {
  return Boolean(a && b && a.year === b.year && a.month === b.month && a.day === b.day);
}

export function isSameMonth(a: PlainDate, b: PlainDate): boolean {
  return a.year === b.year && a.month === b.month;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: PlainDate): number {
  // 1970-01-01 was a Thursday.
  return (((toEpochDay(date) + 4) % 7) + 7) % 7;
}

export function clampDate(
  date: PlainDate,
  min: PlainDate | null | undefined,
  max: PlainDate | null | undefined,
): PlainDate {
  if (min && compareDates(date, min) < 0) return min;
  if (max && compareDates(date, max) > 0) return max;
  return date;
}

/**
 * The weeks of a month for a calendar grid, starting on `firstDay`
 * (0 = Sunday … 6 = Saturday). Days outside the month are `null`, so every
 * week has seven entries and a month has four to six weeks.
 */
export function monthWeeks(year: number, month: number, firstDay: number): (PlainDate | null)[][] {
  const first = { year, month, day: 1 };
  const offset = (dayOfWeek(first) - firstDay + 7) % 7;
  const total = daysInMonth(year, month);
  const weeks: (PlainDate | null)[][] = [];
  let week: (PlainDate | null)[] = new Array(offset).fill(null);
  for (let day = 1; day <= total; day++) {
    week.push({ year, month, day });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push([...week, ...new Array(7 - week.length).fill(null)]);
  return weeks;
}

/** Today in the user's time zone (or `now`'s local date). */
export function todayDate(now: Date = new Date()): PlainDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
