import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import { follow, place } from "../internal/place.ts";
import { LiveAnnouncer, useAnnouncer } from "../live-announcer/LiveAnnouncer.tsx";
import { visibleRange } from "../data-grid/virtual.ts";
import { defaultComboboxMessages, type ComboboxMessages } from "./messages.ts";
import { groupOptions } from "./options.ts";
import {
  useCombobox,
  type ComboboxState,
  type UseComboboxMultipleOptions,
  type UseComboboxSingleOptions,
} from "./useCombobox.ts";

interface ComboboxBaseProps {
  /** Visible label. Required: placeholders are not labels. */
  label: string;
  /** Hides the label visually; it stays the accessible name. */
  hideLabel?: boolean;
  /** Help text under the field, linked with `aria-describedby`. */
  description?: string;
  /** Error message; marks the field invalid and is linked with `aria-describedby`. */
  error?: string;
  placeholder?: string;
  /** Form field name; the selected value(s) are submitted under it. */
  name?: string;
  /** The form blocks submission until a value is selected. */
  required?: boolean;
  /** Texts for translation. */
  messages?: Partial<ComboboxMessages>;
  /** Class name on the wrapper. */
  className?: string;
  style?: CSSProperties;
}

/** Props of {@link Combobox} for selecting one value. */
export type ComboboxSingleProps = ComboboxBaseProps & UseComboboxSingleOptions;
/** Props of {@link Combobox} for selecting several values. */
export type ComboboxMultipleProps = ComboboxBaseProps & UseComboboxMultipleOptions;
/** Props of {@link Combobox}. */
export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

/** Option height in CSS pixels; long lists are virtualised with it. */
const OPTION_HEIGHT = 36;
/** Lists longer than this (and without groups) render only the options in view. */
const VIRTUAL_THRESHOLD = 100;
const LIST_HEIGHT = OPTION_HEIGHT * 8;
const ANNOUNCE_DELAY = 500;

function Check({ visible }: { visible: boolean }): JSX.Element {
  return (
    <svg
      className="tbw-combobox__check"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function OptionRow({
  state,
  index,
  style,
  extra,
}: {
  state: ComboboxState;
  index: number;
  style?: CSSProperties;
  extra?: Record<string, number>;
}): JSX.Element {
  const option = state.items[index]!;
  const props = state.getOptionProps(index);
  return (
    // Options take no focus (aria-activedescendant); the input handles keys.
    <div {...props} {...extra} className="tbw-combobox__option" style={style}>
      <Check visible={props["aria-selected"]} />
      <span className="tbw-combobox__option-label">{option.label}</span>
    </div>
  );
}

function Listbox({ state }: { state: ComboboxState }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const grouped = state.items.some((o) => o.group !== undefined);
  const virtual = !grouped && state.items.length > VIRTUAL_THRESHOLD;

  // Keep the option with visual focus in view.
  useLayoutEffect(() => {
    const list = ref.current;
    const index = state.activeIndex;
    if (!list || index < 0) return;
    if (virtual) {
      const top = index * OPTION_HEIGHT;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + OPTION_HEIGHT > list.scrollTop + list.clientHeight) {
        list.scrollTop = top + OPTION_HEIGHT - list.clientHeight;
      }
      setScrollTop(list.scrollTop);
    } else {
      document.getElementById(state.optionId(index))?.scrollIntoView({ block: "nearest" });
    }
  }, [state, virtual]);

  const common = {
    ref,
    id: state.ids.listbox,
    role: "listbox" as const,
    "aria-labelledby": state.ids.label,
    "aria-multiselectable": state.multiple || undefined,
    // Firefox makes scroll containers without focusable children tab stops;
    // Tab from the input would land in the list and lose focus when it closes.
    tabIndex: -1,
    className: "tbw-combobox__listbox",
  };

  if (virtual) {
    const range = visibleRange(scrollTop, LIST_HEIGHT, OPTION_HEIGHT, state.items.length, 4);
    const indexes: number[] = [];
    for (let i = range.start; i < range.end; i++) indexes.push(i);
    if (state.activeIndex >= 0 && !indexes.includes(state.activeIndex)) {
      indexes.push(state.activeIndex);
    }
    return (
      <div
        {...common}
        style={{ maxHeight: LIST_HEIGHT }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ position: "relative", height: state.items.length * OPTION_HEIGHT }}>
          {indexes.map((index) => (
            <OptionRow
              key={index}
              state={state}
              index={index}
              extra={{ "aria-setsize": state.items.length, "aria-posinset": index + 1 }}
              style={{
                position: "absolute",
                insetInline: 0,
                top: index * OPTION_HEIGHT,
                height: OPTION_HEIGHT,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (grouped) {
    return (
      <div {...common} style={{ maxHeight: LIST_HEIGHT }}>
        {groupOptions(state.items).map((group, g) =>
          group.label === undefined ? (
            group.options.map(({ index }) => <OptionRow key={index} state={state} index={index} />)
          ) : (
            <div
              key={group.label}
              role="group"
              aria-labelledby={`${state.ids.listbox}-group-${g}`}
              className="tbw-combobox__group"
            >
              <div
                id={`${state.ids.listbox}-group-${g}`}
                role="presentation"
                className="tbw-combobox__group-label"
              >
                {group.label}
              </div>
              {group.options.map(({ index }) => (
                <OptionRow key={index} state={state} index={index} />
              ))}
            </div>
          ),
        )}
      </div>
    );
  }

  return (
    <div {...common} style={{ maxHeight: LIST_HEIGHT }}>
      {state.items.map((option, index) => (
        <OptionRow key={option.value} state={state} index={index} />
      ))}
    </div>
  );
}

function ComboboxInner(props: ComboboxProps): JSX.Element {
  const messages = useMemo(
    () => ({ ...defaultComboboxMessages, ...props.messages }),
    [props.messages],
  );
  const state = useCombobox(props);
  const announce = useAnnouncer();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const descriptionId = `${state.scope}-description`;
  const errorId = `${state.scope}-error`;
  const describedBy =
    [props.description && descriptionId, props.error && errorId].filter(Boolean).join(" ") ||
    undefined;

  // Show the popup in the top layer while open, placed under the field.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    const field = fieldRef.current;
    if (!popup || !field) return;
    if (!state.open) {
      if (popup.matches(":popover-open")) popup.hidePopover();
      return;
    }
    if (!popup.matches(":popover-open")) popup.showPopover();
    place(popup, field, true);
    return follow(popup, field, true);
  }, [state.open, state.items.length, state.loading]);

  // Announce how many options match, once the list has settled.
  const settled = state.open && !state.loading;
  useEffect(() => {
    if (!settled) return;
    const timer = setTimeout(
      () => announce(state.error ? messages.loadError : messages.results(state.items.length)),
      ANNOUNCE_DELAY,
    );
    return () => clearTimeout(timer);
  }, [announce, messages, settled, state.error, state.items.length]);

  // Announce additions and removals of a multiple combobox.
  const previous = useRef(state.selected);
  useEffect(() => {
    const before = previous.current;
    previous.current = state.selected;
    if (!state.multiple || before === state.selected) return;
    const added = state.selected.filter((v) => !before.includes(v));
    const removed = before.filter((v) => !state.selected.includes(v));
    for (const value of added) announce(messages.added(state.labelOf(value)));
    for (const value of removed) announce(messages.removed(state.labelOf(value)));
  }, [announce, messages, state]);

  // Native form validation: an empty required combobox blocks submission.
  const missing = Boolean(props.required) && state.selected.length === 0;
  useEffect(() => {
    inputRef.current?.setCustomValidity(missing ? messages.valueMissing : "");
  }, [missing, messages.valueMissing]);

  // Form reset restores the default value.
  const { defaultValue } = props;
  const defaultRef = useRef(defaultValue);
  const { select, remove } = state;
  const resetRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    resetRef.current = () => {
      const initial = defaultRef.current;
      const values =
        initial === undefined || initial === null
          ? []
          : typeof initial === "string"
            ? [initial]
            : [...initial];
      for (const value of state.selected) if (!values.includes(value)) remove(value);
      for (const value of values) {
        if (!state.selected.includes(value)) select({ value, label: state.labelOf(value) });
      }
    };
  });
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    // The reset event fires before the form resets its own fields.
    const onReset = () => setTimeout(() => resetRef.current(), 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const statusText = state.loading
    ? messages.loading
    : state.error
      ? messages.loadError
      : state.items.length === 0
        ? messages.noResults
        : "";

  const { ref: hookInputRef, ...inputProps } = state.inputProps;

  return (
    <div
      ref={wrapperRef}
      className={props.className ? `tbw-combobox ${props.className}` : "tbw-combobox"}
      style={props.style}
      data-tbw-combobox={state.scope}
      data-disabled={props.disabled || undefined}
    >
      <label
        id={state.ids.label}
        htmlFor={state.ids.input}
        className={
          props.hideLabel ? "tbw-combobox__label tbw-visually-hidden" : "tbw-combobox__label"
        }
      >
        {props.label}
      </label>
      {state.multiple && state.selected.length > 0 && (
        <ul className="tbw-combobox__chips" aria-label={messages.selectedValues}>
          {state.selected.map((value) => (
            <li key={value} className="tbw-combobox__chip">
              <span>{state.labelOf(value)}</span>
              <button
                type="button"
                className="tbw-combobox__chip-remove"
                aria-label={messages.remove(state.labelOf(value))}
                disabled={props.disabled}
                onClick={() => {
                  remove(value);
                  inputRef.current?.focus();
                }}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        ref={fieldRef}
        className="tbw-combobox__field"
        data-invalid={props.error ? true : undefined}
      >
        <input
          {...inputProps}
          ref={(element) => {
            inputRef.current = element;
            hookInputRef(element);
          }}
          className="tbw-combobox__input"
          placeholder={props.placeholder}
          aria-describedby={describedBy}
          aria-invalid={props.error ? true : undefined}
          aria-required={props.required || undefined}
        />
        <button
          type="button"
          tabIndex={-1}
          className="tbw-combobox__toggle"
          aria-label={messages.showOptions}
          aria-expanded={state.open}
          aria-controls={state.ids.listbox}
          disabled={props.disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            inputRef.current?.focus();
            state.setOpen(!state.open);
          }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>
      {props.description && (
        <p id={descriptionId} className="tbw-combobox__description">
          {props.description}
        </p>
      )}
      {props.error && (
        <p id={errorId} className="tbw-combobox__error">
          {props.error}
        </p>
      )}
      {props.name &&
        (state.selected.length > 0 ? state.selected : [""]).map((value) => (
          <input key={value || "empty"} type="hidden" name={props.name} value={value} />
        ))}
      {/* The popup takes no focus: presses inside it keep focus in the input. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={popupRef}
        popover="manual"
        className="tbw-combobox__popup"
        data-tbw-combobox={state.scope}
        onMouseDown={(event) => event.preventDefault()}
      >
        {statusText && <div className="tbw-combobox__status">{statusText}</div>}
        <Listbox state={state} />
      </div>
    </div>
  );
}

/**
 * An editable combobox with a list of options, following the WAI-ARIA
 * combobox pattern.
 *
 * - Typing filters the options (case- and accent-insensitive);
 *   `autocomplete="both"` also completes the first match inline.
 * - Down/Up Arrow open the list and move through it, Enter selects, Escape
 *   closes (and clears when closed), Alt+Down opens without moving.
 * - `loadOptions` loads options from a server, with loading, empty and error
 *   states; `multiple` selects several values, shown as removable chips.
 * - Works in forms: `name`, `required` (native validation) and form reset.
 *
 * @example
 * ```tsx
 * <Combobox label="Bidding zone" options={zones} onChange={setZone} />
 * ```
 */
export function Combobox(props: ComboboxProps): JSX.Element {
  return (
    <LiveAnnouncer>
      <ComboboxInner {...props} />
    </LiveAnnouncer>
  );
}
