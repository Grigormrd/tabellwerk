import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  displayOrder,
  filterOptions,
  inlineCompletion,
  matchLabel,
  stepIndex,
  type ComboboxFilter,
  type ComboboxOption,
} from "./options.ts";

/** Loads options for a query; abort work when `signal` fires (a newer query started). */
export type LoadOptions = (
  query: string,
  context: { signal: AbortSignal },
) => Promise<readonly ComboboxOption[]>;

interface BaseOptions {
  /** The options, for a static list. Ignored when `loadOptions` is set. */
  options?: readonly ComboboxOption[];
  /** Loads options for the typed text, for lists from a server. */
  loadOptions?: LoadOptions;
  /** Delay after the last key press before `loadOptions` runs, in ms. Default: 250. */
  loadDelay?: number;
  /**
   * `"list"` (default): typing filters the list. `"both"`: also completes the
   * first matching option in the input (the completion is selected, so the
   * next key press replaces it).
   */
  autocomplete?: "list" | "both";
  /** How typed text matches options. Default: `"contains"`. Not used with `loadOptions`. */
  filter?: ComboboxFilter;
  /** Locale for case and diacritic folding. */
  locale?: string;
  disabled?: boolean;
}

/** Options of {@link useCombobox} for selecting one value. */
export interface UseComboboxSingleOptions extends BaseOptions {
  /** Leave out (or `false`) to select one value. */
  multiple?: false;
  /** Controlled value: the selected option's `value`, or `null`. */
  value?: string | null;
  /** Initial value when uncontrolled. */
  defaultValue?: string | null;
  /** Called with the new value when the user selects or clears. */
  onChange?: (value: string | null) => void;
}

/** Options of {@link useCombobox} for selecting several values. */
export interface UseComboboxMultipleOptions extends BaseOptions {
  /** Select several values. */
  multiple: true;
  /** Controlled value: the selected options' values. */
  value?: readonly string[];
  /** Initial values when uncontrolled. */
  defaultValue?: readonly string[];
  /** Called with all selected values after each addition or removal. */
  onChange?: (value: string[]) => void;
}

/** Options of {@link useCombobox}: one value, or several with `multiple: true`. */
export type UseComboboxOptions = UseComboboxSingleOptions | UseComboboxMultipleOptions;

/** What {@link useCombobox} returns: state and props for your own markup. */
export interface ComboboxState {
  /** Ids for the label, input and listbox. */
  ids: { label: string; input: string; listbox: string; status: string };
  /**
   * Put `data-tbw-combobox={scope}` on the wrapper and the popup: focus moving
   * between elements with the same scope does not count as leaving the field.
   */
  scope: string;
  /** Whether the list is shown. */
  open: boolean;
  /** Text in the input. */
  inputValue: string;
  /** The options shown in the list, in display order (grouped). */
  items: readonly ComboboxOption[];
  /** Index into `items` of the option with visual focus, or -1. */
  activeIndex: number;
  /** Selected values (one at most without `multiple`). */
  selected: readonly string[];
  /** Label of a selected value, also for options that are no longer loaded. */
  labelOf: (value: string) => string;
  /** `loadOptions` is running for the current text. */
  loading: boolean;
  /** `loadOptions` failed for the current text. */
  error: boolean;
  /** Several values can be selected. */
  multiple: boolean;
  /** Opens the list (the toggle button and tests use it). */
  setOpen: (open: boolean) => void;
  /** Selects (or, with `multiple`, toggles) an option. */
  select: (option: ComboboxOption) => void;
  /** Removes a value (for the chips of a multiple combobox). */
  remove: (value: string) => void;
  /** Id of the element for an option index. */
  optionId: (index: number) => string;
  /** Spread on the text input. */
  inputProps: {
    id: string;
    role: "combobox";
    value: string;
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-autocomplete": "list" | "both";
    "aria-activedescendant": string | undefined;
    autoComplete: "off";
    spellCheck: false;
    disabled: boolean | undefined;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onCompositionStart: () => void;
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => void;
    onBlur: (event: FocusEvent<HTMLInputElement>) => void;
    onClick: () => void;
    ref: (element: HTMLInputElement | null) => void;
  };
  /** Props for an option element; pointer presses keep focus in the input. */
  getOptionProps: (index: number) => {
    id: string;
    role: "option";
    "aria-selected": boolean;
    "aria-disabled": true | undefined;
    "data-active": true | undefined;
    onMouseDown: (event: MouseEvent) => void;
    onClick: () => void;
    onPointerMove: () => void;
  };
}

const EMPTY: readonly string[] = [];
const NO_OPTIONS: readonly ComboboxOption[] = [];

/**
 * The behaviour of an editable combobox following the WAI-ARIA combobox
 * pattern, without markup. Focus stays in the input; the option with visual
 * focus is referenced with `aria-activedescendant`.
 */
export function useCombobox(options: UseComboboxOptions): ComboboxState {
  const multiple = options.multiple === true;
  const autocomplete = options.autocomplete ?? "list";
  const baseId = useId();
  const ids = {
    label: `${baseId}-label`,
    input: `${baseId}-input`,
    listbox: `${baseId}-listbox`,
    status: `${baseId}-status`,
  };

  // --- selected values, controlled or uncontrolled, always as an array ---
  const toArray = (v: string | null | readonly string[] | undefined): readonly string[] =>
    v === undefined || v === null ? EMPTY : typeof v === "string" ? [v] : v;
  const controlled = options.value !== undefined;
  const [internal, setInternal] = useState<readonly string[]>(() => toArray(options.defaultValue));
  const selected = controlled ? toArray(options.value) : internal;
  const onChangeRef = useRef(options.onChange);
  useLayoutEffect(() => {
    onChangeRef.current = options.onChange;
  });
  const commit = useCallback(
    (next: readonly string[]) => {
      if (!controlled) setInternal(next);
      const onChange = onChangeRef.current as ((value: unknown) => void) | undefined;
      onChange?.(multiple ? [...next] : (next[0] ?? null));
    },
    [controlled, multiple],
  );

  // Labels of every option seen, so selected values keep their label even
  // when a server no longer returns them.
  const staticLabels = useMemo(
    () => new Map((options.options ?? []).map((o) => [o.value, o.label])),
    [options.options],
  );
  const [seenLabels, setSeenLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const remember = useCallback((list: readonly ComboboxOption[]) => {
    setSeenLabels((previous) => {
      if (list.every((o) => previous.get(o.value) === o.label)) return previous;
      const next = new Map(previous);
      for (const option of list) next.set(option.value, option.label);
      return next;
    });
  }, []);
  const labelOf = (value: string) => staticLabels.get(value) ?? seenLabels.get(value) ?? value;

  // --- input text and the query that filters the list ---
  const singleLabel = !multiple && selected[0] !== undefined ? labelOf(selected[0]) : "";
  const [inputValue, setInputValue] = useState(singleLabel);
  /** What the user typed; `null` shows all options (after selecting or opening by arrow key). */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpenState] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingSelection = useRef<[number, number] | null>(null);

  // Show the selected label when the value changes from outside.
  const lastSingleLabel = useRef(singleLabel);
  useEffect(() => {
    if (!multiple && singleLabel !== lastSingleLabel.current) {
      lastSingleLabel.current = singleLabel;
      setInputValue(singleLabel);
    }
  }, [multiple, singleLabel]);

  // --- asynchronous options ---
  // The last result and the query it belongs to; "loading" means the list
  // does not belong to the current query yet.
  const [result, setResult] = useState<{
    query: string;
    options: readonly ComboboxOption[];
    error: boolean;
  } | null>(null);
  const { loadOptions, loadDelay = 250 } = options;
  const currentQuery = query ?? "";
  useEffect(() => {
    if (!loadOptions || !open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadOptions(currentQuery, { signal: controller.signal }).then(
        (loaded) => {
          if (controller.signal.aborted) return;
          remember(loaded);
          setResult({ query: currentQuery, options: loaded, error: false });
        },
        () => {
          if (controller.signal.aborted) return;
          setResult({ query: currentQuery, options: NO_OPTIONS, error: true });
        },
      );
    }, loadDelay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadOptions, loadDelay, open, currentQuery, remember]);
  const loading = Boolean(loadOptions && open && result?.query !== currentQuery);
  const error = Boolean(loadOptions && !loading && result?.error);

  const source: readonly ComboboxOption[] = loadOptions
    ? (result?.options ?? NO_OPTIONS)
    : (options.options ?? NO_OPTIONS);
  const items = useMemo(
    () =>
      displayOrder(
        loadOptions ? source : filterOptions(source, currentQuery, options.filter, options.locale),
      ),
    [source, loadOptions, currentQuery, options.filter, options.locale],
  );
  const active = activeIndex < items.length ? activeIndex : -1;

  // Apply a selection range (inline completion) after React wrote the value.
  useLayoutEffect(() => {
    const range = pendingSelection.current;
    if (!range || !inputRef.current) return;
    pendingSelection.current = null;
    inputRef.current.setSelectionRange(range[0], range[1]);
  });

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setActiveIndex(-1);
  }, []);

  const select = (option: ComboboxOption) => {
    if (option.disabled) return;
    remember([option]);
    if (multiple) {
      const next = selected.includes(option.value)
        ? selected.filter((v) => v !== option.value)
        : [...selected, option.value];
      commit(next);
      setInputValue("");
      setQuery(null);
      return;
    }
    commit([option.value]);
    lastSingleLabel.current = option.label;
    setInputValue(option.label);
    setQuery(null);
    setOpen(false);
  };

  const remove = (value: string) => commit(selected.filter((v) => v !== value));

  /** Leaving the field: accept typed text that names an option, otherwise revert. */
  const settle = () => {
    setOpen(false);
    setQuery(null);
    if (multiple) {
      setInputValue("");
      return;
    }
    const match = matchLabel([...source, ...items], inputValue, options.locale);
    if (match) {
      if (match.value !== selected[0]) commit([match.value]);
      lastSingleLabel.current = match.label;
      setInputValue(match.label);
    } else if (inputValue.trim() === "") {
      if (selected.length > 0) commit([]);
      lastSingleLabel.current = "";
      setInputValue("");
    } else {
      setInputValue(singleLabel);
    }
  };

  const type = (text: string, inserting: boolean) => {
    setQuery(text);
    setOpenState(true);
    if (autocomplete === "both" && inserting && !loadOptions) {
      const matches = displayOrder(filterOptions(source, text, "startsWith", options.locale));
      const completion = inlineCompletion(matches, text, options.locale);
      if (completion) {
        setInputValue(completion.text);
        pendingSelection.current = [completion.selectionStart, completion.text.length];
        setActiveIndex(
          displayOrder(filterOptions(source, text, options.filter, options.locale)).indexOf(
            completion.option,
          ),
        );
        return;
      }
    }
    setInputValue(text);
    setActiveIndex(-1);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    // During IME composition the text is not final: show it, filter later.
    if (composing.current) {
      setInputValue(text);
      return;
    }
    const inputType = (event.nativeEvent as InputEvent).inputType ?? "insertText";
    const atEnd = event.target.selectionStart === text.length;
    type(text, inputType.startsWith("insert") && atEnd);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composing.current || event.nativeEvent.isComposing) return;
    const selectedIndex = items.findIndex((o) => selected.includes(o.value));
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (event.altKey) {
          setOpenState(true);
          return;
        }
        if (!open) {
          setOpenState(true);
          setQuery(null);
          setActiveIndex(
            multiple || selectedIndex < 0 ? stepIndex(displayOrder(source), -1, 1) : selectedIndex,
          );
          return;
        }
        setActiveIndex(stepIndex(items, active, 1));
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (event.altKey) {
          if (open) setOpen(false);
          return;
        }
        if (!open) {
          setOpenState(true);
          setQuery(null);
          setActiveIndex(
            multiple || selectedIndex < 0 ? stepIndex(displayOrder(source), -1, -1) : selectedIndex,
          );
          return;
        }
        setActiveIndex(stepIndex(items, active, -1));
        return;
      }
      case "Enter": {
        if (!open) return; // let the form submit
        event.preventDefault();
        const option = items[active];
        if (option) select(option);
        else settle();
        return;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          setOpen(false);
          if (!multiple) setInputValue(query === null ? singleLabel : inputValue);
          return;
        }
        if (inputValue !== "") {
          event.preventDefault();
          setInputValue("");
          setQuery(null);
          if (!multiple && selected.length > 0) commit([]);
        }
        return;
      }
      case "Tab": {
        const option = items[active];
        if (open && option && !multiple) select(option);
        return;
      }
      case "Backspace": {
        if (multiple && inputValue === "" && selected.length > 0) {
          remove(selected[selected.length - 1]!);
        }
        return;
      }
      case "Home":
      case "End":
        // These move the text cursor; visual focus returns to the input.
        setActiveIndex(-1);
        return;
    }
  };

  const onCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composing.current = false;
    type(event.currentTarget.value, false);
  };

  const onBlur = (event: FocusEvent<HTMLInputElement>) => {
    // Focus moving into the list (it never should) or to the toggle button
    // is not leaving the combobox.
    const next = event.relatedTarget as HTMLElement | null;
    if (next?.closest(`[data-tbw-combobox="${baseId}"]`)) return;
    settle();
  };

  const optionId = (index: number) => `${baseId}-option-${index}`;

  return {
    ids,
    scope: baseId,
    open,
    inputValue,
    items,
    activeIndex: active,
    selected,
    labelOf,
    loading,
    error,
    multiple,
    setOpen: (next) => {
      if (next) setQuery(null);
      setOpen(next);
    },
    select,
    remove,
    optionId,
    inputProps: {
      id: ids.input,
      role: "combobox",
      value: inputValue,
      "aria-expanded": open,
      "aria-controls": ids.listbox,
      "aria-autocomplete": autocomplete,
      "aria-activedescendant": open && active >= 0 ? optionId(active) : undefined,
      autoComplete: "off",
      spellCheck: false,
      disabled: options.disabled,
      onChange,
      onKeyDown,
      onCompositionStart: () => {
        composing.current = true;
      },
      onCompositionEnd,
      onBlur,
      onClick: () => {
        if (!open) {
          setQuery(null);
          setOpenState(true);
        }
      },
      ref: (element) => {
        inputRef.current = element;
      },
    },
    getOptionProps: (index) => {
      const option = items[index]!;
      return {
        id: optionId(index),
        role: "option",
        "aria-selected": selected.includes(option.value),
        "aria-disabled": option.disabled ? true : undefined,
        "data-active": index === active ? true : undefined,
        onMouseDown: (event) => event.preventDefault(),
        onClick: () => select(option),
        onPointerMove: () => {
          if (index !== active && !option.disabled) setActiveIndex(index);
        },
      };
    },
  };
}
