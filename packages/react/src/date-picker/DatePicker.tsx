import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { place } from "../internal/place.ts";
import { useControllableState } from "../internal/useControllableState.ts";
import { Calendar } from "./Calendar.tsx";
import { formatFullDate, formatInputDate, inputPattern, parseInputDate } from "./locale.ts";
import { defaultDatePickerMessages, type DatePickerMessages } from "./messages.ts";
import { compareDates, parseISODate, toISODate, type ISODate } from "./plain-date.ts";

/** Props of {@link DatePicker}. */
export interface DatePickerProps {
  /** Visible label. */
  label: string;
  /** Selected date (controlled), ISO `YYYY-MM-DD`, or null. */
  value?: ISODate | null;
  /** Initial date when uncontrolled. */
  defaultValue?: ISODate | null;
  /** Called with the new ISO date, or null when the field is cleared. */
  onChange?: (value: ISODate | null) => void;
  /** Earliest selectable date, ISO. */
  min?: ISODate;
  /** Latest selectable date, ISO. */
  max?: ISODate;
  /** Returns true for dates that cannot be selected. */
  isDateUnavailable?: (date: ISODate) => boolean;
  /** Locale for the input format, names and first day of the week. */
  locale?: string;
  /** Overrides the locale's first day of the week: 0 = Sunday … 6 = Saturday. */
  firstDayOfWeek?: number;
  /** "Today" as ISO date (tests and demos). */
  today?: ISODate;
  /** Help text under the field (replaces the format hint). */
  description?: string;
  /** Error message from your own validation. */
  error?: string;
  /** Form field name; the ISO date is submitted under it. */
  name?: string;
  /** The form blocks submission until a valid date is entered. */
  required?: boolean;
  /** Disables the field and the button. */
  disabled?: boolean;
  /** Texts for translation. */
  messages?: Partial<DatePickerMessages>;
  /** Class name on the wrapper. */
  className?: string;
  /** Inline styles of the wrapper. */
  style?: CSSProperties;
}

const FOCUSABLE = 'button:not([disabled]), [tabindex="0"]';

function CalendarIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect
        x="2"
        y="3"
        width="12"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * A date field with a calendar dialog, following the WAI-ARIA date picker
 * dialog pattern. Dates are ISO strings (`2026-11-23`): no `Date` objects,
 * so no time zone can shift the day.
 *
 * - Type a date in the locale's format ("23.11.2026", "11/23/2026") or ISO.
 * - The button opens a modal calendar; focus moves to the selected date (or
 *   today), arrows move by day and week, PageUp/PageDown by month,
 *   Shift+PageUp/PageDown by year, Enter selects, Escape closes; focus
 *   returns to the button.
 *
 * @example
 * ```tsx
 * <DatePicker label="Delivery day" locale="de-DE" min="2026-11-23" onChange={setDay} />
 * ```
 */
export function DatePicker(props: DatePickerProps): JSX.Element {
  const messages = useMemo(
    () => ({ ...defaultDatePickerMessages, ...props.messages }),
    [props.messages],
  );
  const { locale } = props;
  const [value, setValue] = useControllableState<ISODate | null>(
    props.value,
    props.defaultValue ?? null,
    props.onChange,
  );
  const date = parseISODate(value);
  const min = parseISODate(props.min);
  const max = parseISODate(props.max);
  const pattern = inputPattern(locale, messages.patternLetters);

  const id = useId();
  const inputId = `${id}-input`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const headingId = `${id}-heading`;
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [text, setText] = useState(date ? formatInputDate(date, locale) : "");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Show a value set from outside (controlled, reset, calendar selection).
  const shown = useRef(value);
  useEffect(() => {
    if (value === shown.current) return;
    shown.current = value;
    const next = parseISODate(value);
    setText(next ? formatInputDate(next, locale) : "");
    setTypedError(null);
  }, [value, locale]);

  const format = (iso: ISODate | undefined) => {
    const parsed = parseISODate(iso);
    return parsed ? formatInputDate(parsed, locale) : null;
  };

  /** Validates typed text; commits valid dates, reports everything else. */
  const commitText = (raw: string) => {
    if (raw.trim() === "") {
      setTypedError(null);
      shown.current = null;
      if (value !== null) setValue(null);
      return;
    }
    const parsed = parseInputDate(raw, locale);
    if (!parsed) {
      setTypedError(messages.invalidDate(pattern));
      return;
    }
    if ((min && compareDates(parsed, min) < 0) || (max && compareDates(parsed, max) > 0)) {
      setTypedError(messages.outOfRange(format(props.min), format(props.max)));
      return;
    }
    const iso = toISODate(parsed);
    if (props.isDateUnavailable?.(iso)) {
      setTypedError(messages.unavailable);
      return;
    }
    setTypedError(null);
    shown.current = iso;
    setText(formatInputDate(parsed, locale));
    if (iso !== value) setValue(iso);
  };

  // The calendar dialog: modal (the page behind is inert), placed under the field.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const field = fieldRef.current;
    if (!dialog || !field) return;
    if (open && !dialog.open) {
      dialog.showModal();
      place(dialog, field);
      // showModal() focuses the first button; the pattern wants the selected
      // date (or today). The calendar's own focus ran before the dialog was
      // shown (child effects run first), so move it here.
      dialog.querySelector<HTMLElement>('[data-date][tabindex="0"]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      // Handled here, not by the native cancel: keeps focus return in one
      // place and stops a surrounding dialog from closing too.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (focusable.length === 0) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? index <= 0
          ? focusable.length - 1
          : index - 1
        : index === focusable.length - 1
          ? 0
          : index + 1;
      event.preventDefault();
      focusable[next]?.focus();
    }
  };

  // A click on the backdrop (the dialog element itself, outside its content) closes it.
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  // Native form validation and reset.
  const invalid = typedError ?? (props.required && !value ? messages.valueMissing : "");
  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid);
  }, [invalid]);
  const defaultRef = useRef(props.defaultValue ?? null);
  const setValueRef = useRef(setValue);
  useLayoutEffect(() => {
    setValueRef.current = setValue;
  });
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () =>
      setTimeout(() => {
        const initial = defaultRef.current;
        shown.current = initial;
        const parsed = parseISODate(initial);
        setText(parsed ? formatInputDate(parsed, locale) : "");
        setTypedError(null);
        setValueRef.current(initial);
      }, 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [locale]);

  const error = typedError ?? props.error;
  const describedBy = [hintId, error && errorId].filter(Boolean).join(" ");

  return (
    <div
      className={props.className ? `tbw-datepicker ${props.className}` : "tbw-datepicker"}
      style={props.style}
      data-disabled={props.disabled || undefined}
    >
      <label htmlFor={inputId} className="tbw-datepicker__label">
        {props.label}
      </label>
      <div ref={fieldRef} className="tbw-datepicker__field" data-invalid={error ? true : undefined}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="tbw-datepicker__input"
          value={text}
          placeholder={pattern}
          disabled={props.disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-required={props.required || undefined}
          onChange={(event) => {
            setText(event.target.value);
            if (typedError) setTypedError(null);
          }}
          onBlur={(event) => commitText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitText(event.currentTarget.value);
            if (event.key === "ArrowDown" && event.altKey) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />
        <button
          ref={buttonRef}
          type="button"
          className="tbw-datepicker__button"
          aria-label={
            date ? messages.changeDate(formatFullDate(date, locale)) : messages.chooseDate
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={props.disabled}
          onClick={() => setOpen(true)}
        >
          <CalendarIcon />
        </button>
      </div>
      <p id={hintId} className="tbw-datepicker__hint">
        {props.description ?? messages.formatHint(pattern)}
      </p>
      {error && (
        <p id={errorId} className="tbw-datepicker__error">
          {error}
        </p>
      )}
      {props.name && <input type="hidden" name={props.name} value={value ?? ""} />}
      {/* The dialog handles Escape and Tab for its contents. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        className="tbw-datepicker__dialog"
        onKeyDown={onDialogKeyDown}
        onClick={onDialogClick}
        onClose={() => setOpen(false)}
      >
        {open && (
          <Calendar
            value={value}
            onChange={(iso) => {
              shown.current = null;
              setValue(iso);
              close();
            }}
            onCancel={() => close()}
            focusOnMount
            headingId={headingId}
            messages={messages}
            {...(props.min !== undefined && { min: props.min })}
            {...(props.max !== undefined && { max: props.max })}
            {...(props.isDateUnavailable && { isDateUnavailable: props.isDateUnavailable })}
            {...(locale !== undefined && { locale })}
            {...(props.firstDayOfWeek !== undefined && { firstDayOfWeek: props.firstDayOfWeek })}
            {...(props.today !== undefined && { today: props.today })}
          />
        )}
      </dialog>
    </div>
  );
}
