# @tabellwerk/react

## 0.1.0

### Minor Changes

- [#7](https://github.com/Grigormrd/tabellwerk/pull/7) [`999ca1e`](https://github.com/Grigormrd/tabellwerk/commit/999ca1ece128e62672e596a13d14550374ffb2e5) Thanks [@Grigormrd](https://github.com/Grigormrd)! - Add `Combobox` and `useCombobox`: an editable combobox following the WAI-ARIA pattern with list and inline autocomplete, case- and accent-insensitive matching, correct input method (IME) handling, groups, virtualised long lists, options from a server (`loadOptions`) with loading, empty and error states, several values (`multiple`) as removable chips, and form support (`name`, `required`, reset). The grid's `"values"` filter now uses the combobox; an empty selection there means no filter. Breaking: the `selectAll` and `selectNone` filter labels are replaced by `valuesHint`.

- [#4](https://github.com/Grigormrd/tabellwerk/pull/4) [`da16b3b`](https://github.com/Grigormrd/tabellwerk/commit/da16b3bffb5f7ca301eae16e03486368770b10be) Thanks [@Grigormrd](https://github.com/Grigormrd)! - Add `DataGrid`: a WAI-ARIA grid that renders 100,000 rows with its own virtualiser, keyboard navigation with a single tab stop, and stable single and multi-column sorting announced to screen readers. `useDataGrid` exposes the sort state and display order for custom markup.

- [#6](https://github.com/Grigormrd/tabellwerk/pull/6) [`1dfaa02`](https://github.com/Grigormrd/tabellwerk/commit/1dfaa02a74f827392d0e5f2cfcac29914c5421d4) Thanks [@Grigormrd](https://github.com/Grigormrd)! - Add column filters (`filter: "text" | "number" | "values" | "date"`) in a header dialog, applied while typing, and column resizing by pointer, touch and keyboard with fit to content. New props: `filters`, `defaultFilters`, `onFiltersChange`, `columnWidths`, `defaultColumnWidths`, `onColumnWidthsChange`; new column options `minWidth`, `maxWidth`, `resizable`. Breaking: `ColumnDef.format` now receives only non-empty values, and the `sortHint` message is replaced by `headerHint`.

- [#8](https://github.com/Grigormrd/tabellwerk/pull/8) [`7ebc57a`](https://github.com/Grigormrd/tabellwerk/commit/7ebc57a2940759b383dd89d65ee43dcc583c7d47) Thanks [@Grigormrd](https://github.com/Grigormrd)! - Add `DatePicker`, `Calendar` and `useCalendar`: a date field with a modal calendar dialog following the WAI-ARIA pattern. Values are ISO date strings (no time zone shifts); the locale sets the input format, names and first day of the week; typed dates are parsed in the locale's order; `min`, `max` and `isDateUnavailable` limit the choice; forms are supported with `name`, `required` and reset. The grid's `"date"` filter now uses the date picker, and `DataGrid` gets a `locale` prop for it.

- [#13](https://github.com/Grigormrd/tabellwerk/pull/13) [`01385d1`](https://github.com/Grigormrd/tabellwerk/commit/01385d19380b2735fd3fffe769b20425fc72fee8) Thanks [@Grigormrd](https://github.com/Grigormrd)! - First release. `@tabellwerk/tokens`: design tokens as CSS custom properties for light, dark and forced-colours mode in the cascade layer `tabellwerk.tokens`, typed `var()` references and resolved theme values for JavaScript, every text colour checked against WCAG 2.1 contrast. `@tabellwerk/react`: `VisuallyHidden`, `LiveAnnouncer` with `useAnnouncer()`, and one stylesheet with the tokens and all component styles.

### Patch Changes

- Updated dependencies [[`01385d1`](https://github.com/Grigormrd/tabellwerk/commit/01385d19380b2735fd3fffe769b20425fc72fee8)]:
  - @tabellwerk/tokens@0.1.0
