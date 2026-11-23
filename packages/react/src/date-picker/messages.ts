/** Texts of the calendar and the date picker. Override them to translate. */
export interface DatePickerMessages {
  /** Name of the button that shows the previous month. */
  previousMonth: string;
  /** Name of the button that shows the next month. */
  nextMonth: string;
  /** Name of the button that opens the calendar while no date is chosen. */
  chooseDate: string;
  /** Name of the button when a date is chosen; receives the full date. */
  changeDate: (date: string) => string;
  /** Format hint under the field; receives the pattern ("DD.MM.YYYY"). */
  formatHint: (pattern: string) => string;
  /** Letters for the pattern in the format hint and placeholder. */
  patternLetters: { day: string; month: string; year: string };
  /** Error for typed text that is not a date. */
  invalidDate: (pattern: string) => string;
  /** Error for a date outside `min`/`max`; receives formatted limits or null. */
  outOfRange: (min: string | null, max: string | null) => string;
  /** Error for a date that `isDateUnavailable` rejects. */
  unavailable: string;
  /** Validation message when `required` and no date is chosen. */
  valueMissing: string;
}

/** The English texts. */
export const defaultDatePickerMessages: DatePickerMessages = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  chooseDate: "Choose date",
  changeDate: (date) => `Change date, ${date}`,
  formatHint: (pattern) => `Format: ${pattern}`,
  patternLetters: { day: "DD", month: "MM", year: "YYYY" },
  invalidDate: (pattern) => `Enter a date as ${pattern}.`,
  outOfRange: (min, max) =>
    min && max
      ? `Choose a date between ${min} and ${max}.`
      : min
        ? `Choose ${min} or later.`
        : `Choose ${max} or earlier.`,
  unavailable: "This date is not available.",
  valueMissing: "Enter a date.",
};
