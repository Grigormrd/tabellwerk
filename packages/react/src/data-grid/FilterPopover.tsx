import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from "react";
import { Combobox } from "../combobox/Combobox.tsx";
import { DatePicker } from "../date-picker/DatePicker.tsx";
import { follow, place } from "../internal/place.ts";
import { isActive } from "./filter.ts";
import type { DataGridMessages } from "./messages.ts";
import type { ColumnFilter, FilterKind } from "./types.ts";

export interface FilterPopoverProps {
  kind: FilterKind;
  header: string;
  filter: ColumnFilter | undefined;
  /** Distinct values of the column, for `"values"` filters. */
  values: readonly string[];
  /** The header cell the popover belongs to. */
  anchor: HTMLElement;
  messages: DataGridMessages;
  onChange: (filter: ColumnFilter | undefined) => void;
  /** `restoreFocus`: move focus back to the header (Escape, Enter, Close button). */
  onClose: (restoreFocus: boolean) => void;
  /** Locale of the date pickers in `"date"` filters. */
  locale?: string;
}

const NO_VALUES: readonly string[] = [];

const parseNumber = (text: string): number | undefined => {
  if (text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
};

/** Tab stops inside the dialog: no hidden inputs, nothing with tabindex="-1". */
const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/**
 * The filter dialog of one column. A non-modal dialog in the top layer
 * (`popover="manual"`), positioned under its header. Filters apply while
 * typing; Enter or Escape closes it and returns focus to the header.
 */
export function FilterPopover({
  kind,
  header,
  filter,
  values,
  anchor,
  messages,
  onChange,
  onClose,
  locale,
}: FilterPopoverProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const labels = messages.filterLabels;
  // Number fields keep their own text while typing ("-", "1e"); clearing the
  // filter remounts the fields so they show the cleared state.
  const [generation, setGeneration] = useState(0);
  const clear = () => {
    onChange(undefined);
    setGeneration((g) => g + 1);
  };
  const valueOptions = useMemo(() => values.map((v) => ({ value: v, label: v })), [values]);

  useLayoutEffect(() => {
    const popover = ref.current;
    if (!popover) return;
    popover.showPopover();
    place(popover, anchor);
    // The first text field, or else the first control.
    (
      popover.querySelector<HTMLElement>('input:not([type="hidden"]):not([type="checkbox"])') ??
      popover.querySelector<HTMLElement>(FOCUSABLE)
    )?.focus();
    const stop = follow(popover, anchor);
    return () => {
      stop();
      if (popover.matches(":popover-open")) popover.hidePopover();
    };
  }, [anchor]);

  // A pointer press outside the dialog (and outside its header) closes it.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [anchor, onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A control inside handled the key itself (the combobox closes its list
    // on Escape and selects on Enter); the dialog stays open.
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
    } else if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
      const input = event.target as HTMLInputElement;
      if (input.type === "checkbox") return;
      event.preventDefault();
      onClose(true);
    } else if (event.key === "Tab") {
      // Keep focus inside the dialog while it is open.
      const focusable = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
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

  let body: JSX.Element;
  switch (kind) {
    case "text": {
      const query = filter?.kind === "text" ? filter.query : "";
      body = (
        <label className="tbw-filter__field">
          <span>{labels.contains}</span>
          <input
            type="text"
            value={query}
            autoComplete="off"
            onChange={(e) => onChange({ kind: "text", query: e.target.value })}
          />
        </label>
      );
      break;
    }
    case "number": {
      const current = filter?.kind === "number" ? filter : { kind: "number" as const };
      const update = (key: "min" | "max", text: string) => {
        const next: { kind: "number"; min?: number; max?: number } = { kind: "number" };
        const min = key === "min" ? parseNumber(text) : current.min;
        const max = key === "max" ? parseNumber(text) : current.max;
        if (min !== undefined) next.min = min;
        if (max !== undefined) next.max = max;
        onChange(next);
      };
      body = (
        <div className="tbw-filter__row">
          <label className="tbw-filter__field">
            <span>{labels.min}</span>
            <input
              type="number"
              inputMode="decimal"
              defaultValue={current.min ?? ""}
              onChange={(e) => update("min", e.target.value)}
            />
          </label>
          <label className="tbw-filter__field">
            <span>{labels.max}</span>
            <input
              type="number"
              inputMode="decimal"
              defaultValue={current.max ?? ""}
              onChange={(e) => update("max", e.target.value)}
            />
          </label>
        </div>
      );
      break;
    }
    case "date": {
      const current = filter?.kind === "date" ? filter : { kind: "date" as const };
      const update = (key: "from" | "to", value: string | null) => {
        const next: { kind: "date"; from?: string; to?: string } = { kind: "date" };
        const from = key === "from" ? value : current.from;
        const to = key === "to" ? value : current.to;
        if (from) next.from = from;
        if (to) next.to = to;
        onChange(next.from || next.to ? next : undefined);
      };
      // The library's own date pickers; "to" cannot be before "from".
      body = (
        <div className="tbw-filter__row">
          <DatePicker
            label={labels.from}
            value={current.from ?? null}
            onChange={(value) => update("from", value)}
            messages={messages.datePickerMessages}
            {...(current.to !== undefined && { max: current.to })}
            {...(locale !== undefined && { locale })}
          />
          <DatePicker
            label={labels.to}
            value={current.to ?? null}
            onChange={(value) => update("to", value)}
            messages={messages.datePickerMessages}
            {...(current.from !== undefined && { min: current.from })}
            {...(locale !== undefined && { locale })}
          />
        </div>
      );
      break;
    }
    case "values": {
      // The library's own multiple combobox: type to find a value, Enter to
      // add or remove it. No value chosen means no filter.
      body = (
        <Combobox
          multiple
          label={labels.values}
          description={labels.valuesHint}
          options={valueOptions}
          value={filter?.kind === "values" ? filter.values : NO_VALUES}
          onChange={(next) =>
            onChange(next.length > 0 ? { kind: "values", values: next } : undefined)
          }
          messages={messages.comboboxMessages}
        />
      );
      break;
    }
  }

  return (
    // The dialog handles keys for its own contents (Escape, Enter, Tab).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label={messages.filterDialog(header)}
      popover="manual"
      className="tbw-filter"
      onKeyDown={onKeyDown}
    >
      <div key={generation} className="tbw-filter__body">
        {body}
      </div>
      <div className="tbw-filter__actions">
        <button
          type="button"
          className="tbw-filter__button"
          disabled={!isActive(filter)}
          onClick={clear}
        >
          {labels.clear}
        </button>
        <button type="button" className="tbw-filter__button" onClick={() => onClose(true)}>
          {labels.close}
        </button>
      </div>
    </div>
  );
}
