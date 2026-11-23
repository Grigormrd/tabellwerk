import { describe, expect, it } from "vitest";
import {
  firstDayOfWeek,
  formatFullDate,
  formatInputDate,
  formatMonthYear,
  inputPattern,
  parseInputDate,
  weekdayNames,
} from "./locale.ts";
import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  compareDates,
  dayOfWeek,
  daysInMonth,
  fromEpochDay,
  isLeapYear,
  monthWeeks,
  parseISODate,
  toEpochDay,
  toISODate,
  type PlainDate,
} from "./plain-date.ts";

const d = (iso: string) => parseISODate(iso)!;
const iso = (date: PlainDate) => toISODate(date);

describe("leap years and month lengths", () => {
  it("follows the Gregorian rules", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("ISO dates", () => {
  it("parses only real dates", () => {
    expect(parseISODate("2026-11-23")).toEqual({ year: 2026, month: 11, day: 23 });
    expect(parseISODate("2024-02-29")).not.toBeNull();
    expect(parseISODate("2026-02-29")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("2026-1-1")).toBeNull();
    expect(parseISODate(null)).toBeNull();
  });

  it("round-trips through the epoch day count", () => {
    for (const text of ["1970-01-01", "2000-02-29", "2026-11-23", "2099-12-31", "1969-07-20"]) {
      expect(iso(fromEpochDay(toEpochDay(d(text))))).toBe(text);
    }
    expect(toEpochDay(d("1970-01-02"))).toBe(1);
  });
});

describe("arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(iso(addDays(d("2026-12-31"), 1))).toBe("2027-01-01");
    expect(iso(addDays(d("2024-02-28"), 1))).toBe("2024-02-29");
    expect(iso(addDays(d("2026-03-01"), -1))).toBe("2026-02-28");
    expect(iso(addDays(d("2026-01-01"), -7))).toBe("2025-12-25");
  });

  it("is not affected by daylight saving changes", () => {
    // Europe switches on 29 March and 25 October 2026, the US on 8 March and 1 November.
    expect(iso(addDays(d("2026-03-28"), 1))).toBe("2026-03-29");
    expect(iso(addDays(d("2026-03-29"), 1))).toBe("2026-03-30");
    expect(iso(addDays(d("2026-10-25"), 1))).toBe("2026-10-26");
    expect(iso(addDays(d("2026-03-07"), 2))).toBe("2026-03-09");
    expect(compareDates(d("2026-10-26"), d("2026-10-25"))).toBe(1);
  });

  it("adds months and years, clamping to the end of shorter months", () => {
    expect(iso(addMonths(d("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(addMonths(d("2024-01-31"), 1))).toBe("2024-02-29");
    expect(iso(addMonths(d("2026-03-31"), -1))).toBe("2026-02-28");
    expect(iso(addMonths(d("2026-11-23"), 2))).toBe("2027-01-23");
    expect(iso(addMonths(d("2026-01-15"), -1))).toBe("2025-12-15");
    expect(iso(addYears(d("2024-02-29"), 1))).toBe("2025-02-28");
    expect(iso(addYears(d("2024-02-29"), 4))).toBe("2028-02-29");
  });

  it("knows the day of the week and clamps to limits", () => {
    expect(dayOfWeek(d("2026-11-23"))).toBe(1); // Monday
    expect(dayOfWeek(d("2023-01-01"))).toBe(0); // Sunday
    expect(dayOfWeek(d("1969-12-31"))).toBe(3); // Wednesday, before the epoch
    expect(iso(clampDate(d("2026-01-01"), d("2026-02-01"), null))).toBe("2026-02-01");
    expect(iso(clampDate(d("2026-03-01"), null, d("2026-02-01")))).toBe("2026-02-01");
  });
});

describe("monthWeeks", () => {
  it("lays out a month with Monday first", () => {
    // November 2026 starts on a Sunday.
    const weeks = monthWeeks(2026, 11, 1);
    expect(weeks[0]!.map((day) => day?.day ?? null)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      1,
    ]);
    expect(weeks.at(-1)!.map((day) => day?.day ?? null)).toEqual([
      30,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(weeks).toHaveLength(6);
  });

  it("lays out the same month with Sunday first", () => {
    const weeks = monthWeeks(2026, 11, 0);
    expect(weeks[0]![0]?.day).toBe(1);
    expect(weeks).toHaveLength(5);
  });

  it("handles a February that fits in four weeks", () => {
    // February 2026 starts on a Sunday and has 28 days.
    expect(monthWeeks(2026, 2, 0)).toHaveLength(4);
  });
});

describe("locale: first day of the week", () => {
  it("is Monday in Germany and Sunday in the US", () => {
    expect(firstDayOfWeek("de-DE")).toBe(1);
    expect(firstDayOfWeek("en-US")).toBe(0);
    expect(firstDayOfWeek("en-GB")).toBe(1);
  });

  it("falls back to Monday for unknown input", () => {
    expect(firstDayOfWeek("not a locale")).toBe(1);
  });
});

describe("locale: names and formats", () => {
  const date = d("2026-11-23");

  it("formats in German and US English without a time zone shift", () => {
    expect(formatMonthYear(date, "de-DE")).toBe("November 2026");
    expect(formatFullDate(date, "de-DE")).toBe("Montag, 23. November 2026");
    expect(formatFullDate(date, "en-US")).toBe("Monday, November 23, 2026");
    expect(formatInputDate(date, "de-DE")).toBe("23.11.2026");
    expect(formatInputDate(date, "en-US")).toBe("11/23/2026");
  });

  it("lists weekdays from the first day of the week", () => {
    // Long names: short forms differ between ICU versions ("Mo" or "Mo.").
    expect(weekdayNames(1, "de-DE").map((w) => w.long)).toEqual([
      "Montag",
      "Dienstag",
      "Mittwoch",
      "Donnerstag",
      "Freitag",
      "Samstag",
      "Sonntag",
    ]);
    expect(weekdayNames(1, "de-DE")[0]!.short).toMatch(/^Mo/);
    expect(weekdayNames(0, "en-US")[0]).toEqual({ short: "Sun", long: "Sunday" });
  });

  it("describes the input format in the locale's order", () => {
    expect(inputPattern("de-DE")).toBe("DD.MM.YYYY");
    expect(inputPattern("en-US")).toBe("MM/DD/YYYY");
    expect(inputPattern("de-DE", { day: "TT", month: "MM", year: "JJJJ" })).toBe("TT.MM.JJJJ");
  });
});

describe("locale: parsing typed dates", () => {
  it("reads the locale's order with any separator", () => {
    expect(parseInputDate("23.11.2026", "de-DE")).toEqual(d("2026-11-23"));
    expect(parseInputDate("23/11/26", "de-DE")).toEqual(d("2026-11-23"));
    expect(parseInputDate(" 1 2 2026 ", "de-DE")).toEqual(d("2026-02-01"));
    expect(parseInputDate("11/23/2026", "en-US")).toEqual(d("2026-11-23"));
    expect(parseInputDate("2/1/2026", "en-US")).toEqual(d("2026-02-01"));
  });

  it("always accepts ISO dates", () => {
    expect(parseInputDate("2026-11-23", "en-US")).toEqual(d("2026-11-23"));
    expect(parseInputDate("2026-11-23", "de-DE")).toEqual(d("2026-11-23"));
  });

  it("rejects text that is not a real date", () => {
    expect(parseInputDate("31.02.2026", "de-DE")).toBeNull();
    expect(parseInputDate("11/23/2026", "de-DE")).toBeNull(); // month 23
    expect(parseInputDate("23.11", "de-DE")).toBeNull();
    expect(parseInputDate("23.11.20261", "de-DE")).toBeNull();
    expect(parseInputDate("tomorrow", "en-US")).toBeNull();
    expect(parseInputDate("", "en-US")).toBeNull();
  });
});
