// Locale-dependent parts of the date picker: first day of the week, names,
// and the numeric input format. Everything is formatted in UTC from a plain
// date, so the user's time zone never changes the day shown.

import { parseISODate, toUTCDate, isValid, type PlainDate } from "./plain-date.ts";

/**
 * Regions whose weeks start on Sunday or Saturday (CLDR week data); all
 * others start on Monday. Used where `Intl.Locale#getWeekInfo` is missing.
 */
const SUNDAY_START = new Set(
  "AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(
    " ",
  ),
);
const SATURDAY_START = new Set("AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" "));

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
}

/** First day of the week for a locale: 0 = Sunday … 6 = Saturday. */
export function firstDayOfWeek(locale?: string): number {
  let intlLocale: Intl.Locale;
  try {
    intlLocale = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 1;
  }
  const withWeek = intlLocale as unknown as WeekInfoLocale;
  const info = withWeek.getWeekInfo?.() ?? withWeek.weekInfo;
  // Intl uses 1 = Monday … 7 = Sunday.
  if (info && info.firstDay >= 1 && info.firstDay <= 7) return info.firstDay % 7;
  const region = intlLocale.maximize().region ?? "";
  if (SUNDAY_START.has(region)) return 0;
  if (SATURDAY_START.has(region)) return 6;
  return 1;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    formatters.set(key, f);
  }
  return f;
}

/** "November 2026" */
export function formatMonthYear(date: PlainDate, locale?: string): string {
  return formatter(locale, { month: "long", year: "numeric" }).format(toUTCDate(date));
}

/** "Monday, 23 November 2026" */
export function formatFullDate(date: PlainDate, locale?: string): string {
  return formatter(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toUTCDate(date));
}

/** The numeric form used in the text field: "23.11.2026", "11/23/2026". */
export function formatInputDate(date: PlainDate, locale?: string): string {
  return formatter(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    toUTCDate(date),
  );
}

/** Weekday names in calendar order, starting on `firstDay`. */
export function weekdayNames(firstDay: number, locale?: string): { short: string; long: string }[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const date = { year: 2023, month: 1, day: 1 + ((firstDay + i) % 7) };
    return {
      short: formatter(locale, { weekday: "short" }).format(toUTCDate(date)),
      long: formatter(locale, { weekday: "long" }).format(toUTCDate(date)),
    };
  });
}

type Part = "day" | "month" | "year";

/** Order of day, month and year in the locale's numeric date, and its separator. */
function numericPattern(locale?: string): { order: Part[]; separator: string } {
  const parts = formatter(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(toUTCDate({ year: 2026, month: 11, day: 23 }));
  const order = parts.flatMap((p) =>
    p.type === "day" || p.type === "month" || p.type === "year" ? [p.type as Part] : [],
  );
  const separator = parts.find((p) => p.type === "literal")?.value ?? "/";
  return { order: order.length === 3 ? order : ["year", "month", "day"], separator };
}

/**
 * A format hint for the text field in the locale's order, like
 * "DD.MM.YYYY" or "MM/DD/YYYY". The letters come from `letters`, so they can
 * be translated ("TT.MM.JJJJ").
 */
export function inputPattern(
  locale?: string,
  letters: Record<Part, string> = { day: "DD", month: "MM", year: "YYYY" },
): string {
  const { order, separator } = numericPattern(locale);
  return order.map((part) => letters[part]).join(separator.trim() === "" ? "/" : separator);
}

/**
 * Parses what a user typed: the locale's numeric order with any separator
 * ("23.11.2026", "23/11/26", "23 11 2026" in German; "11/23/2026" in US
 * English) or an ISO date. Two-digit years are 2000–2099. Returns `null` for
 * text that is not a real date.
 */
export function parseInputDate(text: string, locale?: string): PlainDate | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const iso = parseISODate(trimmed);
  if (iso) return iso;
  const numbers = trimmed.match(/\d+/g);
  if (!numbers || numbers.length !== 3) return null;
  const { order } = numericPattern(locale);
  const values: Partial<Record<Part, number>> = {};
  order.forEach((part, i) => {
    values[part] = Number(numbers[i]);
  });
  const yearText = numbers[order.indexOf("year")]!;
  let year = values.year!;
  if (yearText.length <= 2) year += 2000;
  else if (yearText.length !== 4) return null;
  const date = { year, month: values.month!, day: values.day! };
  return isValid(date) ? date : null;
}
