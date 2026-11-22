/** One choice of a {@link Combobox}. */
export interface ComboboxOption {
  /** Stable value; submitted with forms and passed to `onChange`. */
  value: string;
  /** Text shown in the list and in the input once selected. */
  label: string;
  /** Shown but not selectable. */
  disabled?: boolean;
  /** Options with the same group are listed together under this heading. */
  group?: string;
}

/** How typed text matches options. A function receives the folded query and label. */
export type ComboboxFilter =
  "contains" | "startsWith" | ((option: ComboboxOption, query: string) => boolean);

/**
 * Folds text for matching: lower case and without diacritics, so "zurich"
 * finds "Zürich" and "ANGSTROM" finds "Ångström".
 */
export function fold(text: string, locale?: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase(locale);
}

/** The options that match `query`, in their original order. An empty query matches all. */
export function filterOptions(
  options: readonly ComboboxOption[],
  query: string,
  filter: ComboboxFilter = "contains",
  locale?: string,
): ComboboxOption[] {
  const needle = fold(query.trim(), locale);
  if (needle === "") return [...options];
  if (typeof filter === "function") return options.filter((o) => filter(o, needle));
  return options.filter((option) => {
    const label = fold(option.label, locale);
    return filter === "startsWith" ? label.startsWith(needle) : label.includes(needle);
  });
}

export interface Completion {
  option: ComboboxOption;
  /** Input text with the completed part appended. */
  text: string;
  /** Start of the completed (selected) part in `text`. */
  selectionStart: number;
}

/**
 * Inline completion for `aria-autocomplete="both"`: the first enabled option
 * whose label starts with the typed text. The typed characters are kept as
 * typed; only the rest of the label is appended (and selected in the input,
 * so the next key press replaces it).
 */
export function inlineCompletion(
  options: readonly ComboboxOption[],
  typed: string,
  locale?: string,
): Completion | null {
  if (typed === "") return null;
  const needle = fold(typed, locale);
  for (const option of options) {
    if (option.disabled) continue;
    if (fold(option.label, locale).startsWith(needle) && option.label.length > typed.length) {
      return {
        option,
        text: typed + option.label.slice(typed.length),
        selectionStart: typed.length,
      };
    }
  }
  return null;
}

/** The enabled option whose label equals `text`, ignoring case and diacritics. */
export function matchLabel(
  options: readonly ComboboxOption[],
  text: string,
  locale?: string,
): ComboboxOption | undefined {
  const needle = fold(text.trim(), locale);
  if (needle === "") return undefined;
  return options.find((o) => !o.disabled && fold(o.label, locale) === needle);
}

export interface OptionGroup {
  /** Group heading; `undefined` for options without a group. */
  label: string | undefined;
  options: { option: ComboboxOption; index: number }[];
}

/**
 * Splits options into groups in order of first appearance, keeping each
 * option's index in the flat list (keyboard navigation works on that list).
 */
export function groupOptions(options: readonly ComboboxOption[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const byLabel = new Map<string | undefined, OptionGroup>();
  options.forEach((option, index) => {
    let group = byLabel.get(option.group);
    if (!group) {
      group = { label: option.group, options: [] };
      byLabel.set(option.group, group);
      groups.push(group);
    }
    group.options.push({ option, index });
  });
  return groups;
}

/**
 * The display order: grouped options are listed group by group, so the flat
 * index used for keyboard navigation must follow the same order.
 */
export function displayOrder(options: readonly ComboboxOption[]): ComboboxOption[] {
  return groupOptions(options).flatMap((group) => group.options.map(({ option }) => option));
}

/** Next enabled index in a direction, wrapping around; -1 if there is none. */
export function stepIndex(options: readonly ComboboxOption[], from: number, step: 1 | -1): number {
  const n = options.length;
  if (n === 0) return -1;
  let index = from;
  for (let i = 0; i < n; i++) {
    index = index < 0 ? (step === 1 ? 0 : n - 1) : (index + step + n) % n;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}
