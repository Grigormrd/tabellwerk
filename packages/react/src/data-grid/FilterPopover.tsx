import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from "react";
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
}

const GAP = 4;
const MARGIN = 8;

function place(popover: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const left = Math.min(
    Math.max(MARGIN, rect.left),
    Math.max(MARGIN, window.innerWidth - width - MARGIN),
  );
  // Below the header if it fits, otherwise above it.
  const below = rect.bottom + GAP;
  const top =
    below + height <= window.innerHeight - MARGIN || rect.top - GAP - height < MARGIN
      ? below
      : rect.top - GAP - height;
  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

const parseNumber = (text: string): number | undefined => {
  if (text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
};

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  useLayoutEffect(() => {
    const popover = ref.current;
    if (!popover) return;
    popover.showPopover();
    place(popover, anchor);
    popover.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    let frame = 0;
    const reposition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => place(popover, anchor));
    };
    window.addEventListener("scroll", reposition, { capture: true, passive: true });
    window.addEventListener("resize", reposition);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
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
      const update = (key: "from" | "to", value: string) => {
        const next: { kind: "date"; from?: string; to?: string } = { kind: "date" };
        const from = key === "from" ? value : current.from;
        const to = key === "to" ? value : current.to;
        if (from) next.from = from;
        if (to) next.to = to;
        onChange(next);
      };
      body = (
        <div className="tbw-filter__row">
          <label className="tbw-filter__field">
            <span>{labels.from}</span>
            <input
              type="date"
              value={current.from ?? ""}
              onChange={(e) => update("from", e.target.value)}
            />
          </label>
          <label className="tbw-filter__field">
            <span>{labels.to}</span>
            <input
              type="date"
              value={current.to ?? ""}
              onChange={(e) => update("to", e.target.value)}
            />
          </label>
        </div>
      );
      break;
    }
    case "values": {
      // No filter means every value is shown, so every box starts checked.
      const selected = new Set(filter?.kind === "values" ? filter.values : values);
      const toggle = (value: string, checked: boolean) => {
        const next = new Set(selected);
        if (checked) next.add(value);
        else next.delete(value);
        onChange(
          next.size === values.length
            ? undefined
            : { kind: "values", values: values.filter((v) => next.has(v)) },
        );
      };
      body = (
        <fieldset className="tbw-filter__values">
          <legend>{labels.values}</legend>
          <div className="tbw-filter__row">
            <button type="button" className="tbw-filter__link" onClick={() => onChange(undefined)}>
              {labels.selectAll}
            </button>
            <button
              type="button"
              className="tbw-filter__link"
              onClick={() => onChange({ kind: "values", values: [] })}
            >
              {labels.selectNone}
            </button>
          </div>
          <ul className="tbw-filter__list">
            {values.map((value) => (
              <li key={value}>
                <label className="tbw-filter__check">
                  <input
                    type="checkbox"
                    checked={selected.has(value)}
                    onChange={(e) => toggle(value, e.target.checked)}
                  />
                  <span>{value}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
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
