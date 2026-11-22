/** Texts the combobox shows or announces. Override them to translate it. */
export interface ComboboxMessages {
  /** Accessible name of the button that opens the list. */
  showOptions: string;
  /** Shown while `loadOptions` runs. */
  loading: string;
  /** Shown when nothing matches. */
  noResults: string;
  /** Shown when `loadOptions` failed. */
  loadError: string;
  /** Announced when the list changes while open. */
  results: (count: number) => string;
  /** Accessible name of the remove button on a selected value (multiple). */
  remove: (label: string) => string;
  /** Accessible name of the list of selected values (multiple). */
  selectedValues: string;
  /** Announced after a value was added (multiple). */
  added: (label: string) => string;
  /** Announced after a value was removed (multiple). */
  removed: (label: string) => string;
  /** Validation message when `required` and nothing is selected. */
  valueMissing: string;
}

const count = new Intl.NumberFormat("en-US");

/** The English texts. */
export const defaultComboboxMessages: ComboboxMessages = {
  showOptions: "Show options",
  loading: "Loading…",
  noResults: "No results",
  loadError: "The options could not be loaded",
  results: (n) => (n === 0 ? "No results" : n === 1 ? "1 result" : `${count.format(n)} results`),
  remove: (label) => `Remove ${label}`,
  selectedValues: "Selected",
  added: (label) => `${label} added`,
  removed: (label) => `${label} removed`,
  valueMissing: "Select an option from the list.",
};
