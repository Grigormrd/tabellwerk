import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from "react";
import { useControllableState } from "../internal/useControllableState.ts";
import { firstDayOfWeek, formatFullDate, formatMonthYear, weekdayNames } from "./locale.ts";
import { defaultDatePickerMessages, type DatePickerMessages } from "./messages.ts";
import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  compareDates,
  dayOfWeek,
  isSameDay,
  monthWeeks,
  parseISODate,
  toISODate,
  todayDate,
  type ISODate,
  type PlainDate,
} from "./plain-date.ts";

/** Options of {@link useCalendar}. */
export interface UseCalendarOptions {
  /** The selected date. */
  value: PlainDate | null;
  /** Earliest selectable date. */
  min?: PlainDate | null;
  /** Latest selectable date. */
  max?: PlainDate | null;
  /** Returns true for dates that cannot be selected (holidays, weekends). */
  isDateUnavailable?: (date: ISODate) => boolean;
  /** Locale for names and the first day of the week. */
  locale?: string;
  /** Overrides the locale's first day of the week: 0 = Sunday … 6 = Saturday. */
  firstDayOfWeek?: number;
  /** "Today" as an ISO date (tests and demos); defaults to the user's local date. */
  today?: ISODate;
  /** Called when the user selects an available date. */
  onSelect: (date: PlainDate) => void;
}

/** What {@link useCalendar} returns. */
export interface CalendarState {
  /** The month shown (day is 1). */
  month: PlainDate;
  /** The date with the roving tab stop. */
  focused: PlainDate;
  /** The weeks of the month shown; days of other months are null. */
  weeks: (PlainDate | null)[][];
  /** Weekday names in calendar order. */
  weekdays: { short: string; long: string }[];
  /** Today, for `aria-current="date"`. */
  today: PlainDate;
  /** Whether a date can be selected (inside min/max and available). */
  isSelectable: (date: PlainDate) => boolean;
  /** Moves the month shown (header buttons); the focused date follows. */
  showMonth: (offset: number) => void;
  /** False when the previous month is entirely before `min`. */
  canShowPrevious: boolean;
  /** False when the next month is entirely after `max`. */
  canShowNext: boolean;
  /** Moves the tab stop (and the month, if needed). */
  focus: (date: PlainDate) => void;
  /** Keyboard handling for a day cell; returns true if the key was handled. */
  onDayKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Calendar navigation without markup, following the WAI-ARIA date picker
 * dialog pattern: arrows by day and week, Home/End within the week,
 * PageUp/PageDown by month, Shift+PageUp/PageDown by year, Enter/Space to
 * select.
 */
export function useCalendar(options: UseCalendarOptions): CalendarState {
  const { value, min = null, max = null, locale } = options;
  const today = useMemo(() => parseISODate(options.today) ?? todayDate(), [options.today]);
  const firstDay = options.firstDayOfWeek ?? firstDayOfWeek(locale);
  const [focused, setFocused] = useState<PlainDate>(() => clampDate(value ?? today, min, max));
  const month = { year: focused.year, month: focused.month, day: 1 };
  const weeks = useMemo(
    () => monthWeeks(focused.year, focused.month, firstDay),
    [focused.year, focused.month, firstDay],
  );
  const weekdays = useMemo(() => weekdayNames(firstDay, locale), [firstDay, locale]);

  const isSelectable = (date: PlainDate) =>
    (!min || compareDates(date, min) >= 0) &&
    (!max || compareDates(date, max) <= 0) &&
    !options.isDateUnavailable?.(toISODate(date));

  const focus = (date: PlainDate) => setFocused(clampDate(date, min, max));

  const showMonth = (offset: number) => focus(addMonths(focused, offset));

  const lastOfPrevious = addDays(month, -1);
  const firstOfNext = addMonths(month, 1);

  const onDayKeyDown = (event: KeyboardEvent): boolean => {
    const startOfWeek = addDays(focused, -((dayOfWeek(focused) - firstDay + 7) % 7));
    let next: PlainDate | null = null;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(focused, -1);
        break;
      case "ArrowRight":
        next = addDays(focused, 1);
        break;
      case "ArrowUp":
        next = addDays(focused, -7);
        break;
      case "ArrowDown":
        next = addDays(focused, 7);
        break;
      case "Home":
        next = startOfWeek;
        break;
      case "End":
        next = addDays(startOfWeek, 6);
        break;
      case "PageUp":
        next = event.shiftKey ? addYears(focused, -1) : addMonths(focused, -1);
        break;
      case "PageDown":
        next = event.shiftKey ? addYears(focused, 1) : addMonths(focused, 1);
        break;
      case "Enter":
      case " ":
        if (isSelectable(focused)) options.onSelect(focused);
        return true;
      default:
        return false;
    }
    focus(next);
    return true;
  };

  return {
    month,
    focused,
    weeks,
    weekdays,
    today,
    isSelectable,
    showMonth,
    canShowPrevious: !min || compareDates(lastOfPrevious, min) >= 0,
    canShowNext: !max || compareDates(firstOfNext, max) <= 0,
    focus,
    onDayKeyDown,
  };
}

/** Props of {@link Calendar}. */
export interface CalendarProps extends Omit<
  UseCalendarOptions,
  "value" | "onSelect" | "min" | "max"
> {
  /** Selected date (controlled), as ISO date or null. */
  value?: ISODate | null;
  /** Initial selected date when uncontrolled. */
  defaultValue?: ISODate | null;
  /** Called with the selected ISO date. */
  onChange?: (value: ISODate) => void;
  /** Earliest selectable date, ISO. */
  min?: ISODate;
  /** Latest selectable date, ISO. */
  max?: ISODate;
  /**
   * Move focus to the tab stop when the calendar mounts. The date picker
   * dialog does this, as the WAI-ARIA pattern asks.
   */
  focusOnMount?: boolean;
  /** Called on Escape (the date picker closes its dialog). */
  onCancel?: () => void;
  /** Texts for translation. */
  messages?: Partial<DatePickerMessages>;
  /** Id for the month heading, which names the grid. */
  headingId?: string;
}

function Chevron({ direction }: { direction: "left" | "right" }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={direction === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * A month calendar following the WAI-ARIA grid pattern. Used inside
 * {@link DatePicker}, and usable on its own for an always visible calendar.
 */
export function Calendar(props: CalendarProps): JSX.Element {
  const messages = { ...defaultDatePickerMessages, ...props.messages };
  const [valueIso, setValueIso] = useControllableState<ISODate | null>(
    props.value,
    props.defaultValue ?? null,
    props.onChange as ((value: ISODate | null) => void) | undefined,
  );
  const value = parseISODate(valueIso);
  const generatedId = useId();
  const headingId = props.headingId ?? `${generatedId}-heading`;
  const tableRef = useRef<HTMLTableElement>(null);
  const moveFocus = useRef(Boolean(props.focusOnMount));

  const calendar = useCalendar({
    value,
    min: parseISODate(props.min),
    max: parseISODate(props.max),
    ...(props.isDateUnavailable && { isDateUnavailable: props.isDateUnavailable }),
    ...(props.locale !== undefined && { locale: props.locale }),
    ...(props.firstDayOfWeek !== undefined && { firstDayOfWeek: props.firstDayOfWeek }),
    ...(props.today !== undefined && { today: props.today }),
    onSelect: (date) => setValueIso(toISODate(date)),
  });

  // Move DOM focus to the tab stop after keyboard navigation (and on mount
  // when asked), once the cell of the new month is rendered.
  const focusedIso = toISODate(calendar.focused);
  useLayoutEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    tableRef.current?.querySelector<HTMLElement>(`[data-date="${focusedIso}"]`)?.focus();
  }, [focusedIso]);

  const onKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
    if (event.key === "Escape" && props.onCancel) {
      event.preventDefault();
      event.stopPropagation();
      props.onCancel();
      return;
    }
    if (calendar.onDayKeyDown(event)) {
      event.preventDefault();
      moveFocus.current = true;
    }
  };

  return (
    <div className="tbw-calendar">
      <div className="tbw-calendar__header">
        <button
          type="button"
          className="tbw-calendar__nav"
          aria-label={messages.previousMonth}
          disabled={!calendar.canShowPrevious}
          onClick={() => calendar.showMonth(-1)}
        >
          <Chevron direction="left" />
        </button>
        <h2 id={headingId} className="tbw-calendar__heading" aria-live="polite">
          {formatMonthYear(calendar.month, props.locale)}
        </h2>
        <button
          type="button"
          className="tbw-calendar__nav"
          aria-label={messages.nextMonth}
          disabled={!calendar.canShowNext}
          onClick={() => calendar.showMonth(1)}
        >
          <Chevron direction="right" />
        </button>
      </div>
      {/* A table with role="grid", as in the WAI-ARIA date picker dialog
          pattern: the table gives rows and column headers (weekdays), the
          grid role gives keyboard navigation between the days. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
      <table ref={tableRef} role="grid" aria-labelledby={headingId} className="tbw-calendar__grid">
        <thead>
          <tr>
            {calendar.weekdays.map((weekday) => (
              <th key={weekday.long} scope="col" abbr={weekday.long}>
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.weeks.map((week, w) => (
            <tr key={w}>
              {week.map((date, d) => {
                if (!date) return <td key={d} className="tbw-calendar__empty" />;
                const iso = toISODate(date);
                const selectable = calendar.isSelectable(date);
                const isFocused = isSameDay(date, calendar.focused);
                return (
                  // In a table with role="grid", <td> is a gridcell.
                  <td
                    key={d}
                    data-date={iso}
                    tabIndex={isFocused ? 0 : -1}
                    aria-selected={isSameDay(date, value)}
                    aria-disabled={selectable ? undefined : true}
                    aria-current={isSameDay(date, calendar.today) ? "date" : undefined}
                    aria-label={formatFullDate(date, props.locale)}
                    className="tbw-calendar__day"
                    onKeyDown={onKeyDown}
                    onClick={() => {
                      calendar.focus(date);
                      if (selectable) setValueIso(iso);
                    }}
                  >
                    {date.day}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
