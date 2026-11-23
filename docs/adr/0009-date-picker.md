# 9. Date picker: plain dates, modal dialog, locale handling

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Date pickers fail in a few typical ways: a `Date` object created at local midnight shows the
previous day in another time zone or after a daylight saving change; the calendar starts the week
on the wrong day; typed dates are read in the wrong order (is 03/04 March or April?); focus is lost
when the calendar closes; and the calendar dialog lets keyboard users wander into the page behind
it. The grid's date filter (Phase 2) used native date inputs as a placeholder for this component.

## Decision

**Plain dates as ISO strings.** The API takes and returns `YYYY-MM-DD` strings. Internally a date is
`{ year, month, day }`, and all arithmetic goes through the day count since 1970-01-01 in UTC
(`addDays`, `addMonths` with clamping to the month end, `addYears` with 29 February → 28
February). Formatting uses `Intl.DateTimeFormat` with `timeZone: "UTC"` on a UTC midnight. No
step reads the user's time zone except "today". Unit tests cover leap years, month ends, dates
before 1970, and the daylight saving changes in Europe and the US. `Temporal.PlainDate` would be
the natural type but is not available in every browser the library supports.

**Locale.** The first day of the week comes from `Intl.Locale#getWeekInfo` (or the older
`weekInfo` property), with a small table of CLDR regions that start on Sunday or Saturday as
fallback. The input format is derived from `formatToParts` of a sample date: the order of day,
month and year and the separator. Parsing accepts that order with any separator and always ISO, so
"03/04/2026" is 3 April in German and 4 March in US English.

**Modal dialog.** The calendar opens in a native `<dialog>` with `showModal()`: the page behind is
inert for screen readers and pointers, and the dialog is in the top layer. Focus moves to the
selected date (or today); Tab cycles between the month buttons and the day grid; Escape and
selection close it, and focus returns to the button. Escape is handled in the dialog's key handler
(and stopped there), not through the native `cancel` event, so a surrounding dialog such as the
grid's filter dialog stays open. A pitfall found while building it: React runs child effects first,
so the calendar's own focus call ran before `showModal()`, which then focused the first button. The
date picker moves focus to the day after opening the dialog.

**Calendar grid.** A `<table role="grid">`: column headers with abbreviated weekdays (full names in
`abbr`), one cell per day with a roving tabindex, the full date as the cell's name,
`aria-current="date"` for today, `aria-selected` for the value and `aria-disabled` for unavailable
days, which stay focusable so keyboard users can move past them. Days of other months are empty
cells; moving past the edge switches the month, which the month heading announces as a polite live
region.

**Typing and validation.** Text is committed on blur and Enter. Invalid, out-of-range and
unavailable dates produce a specific message, keep the previous value, mark the field
`aria-invalid` and set the field's custom validity, so a form cannot be submitted with them.

## Consequences

- `Calendar` and `useCalendar` are exported for an always visible calendar or custom markup.
- The grid's `"date"` filter now uses two date pickers (with `min`/`max` linked), and `DataGrid` has
  a `locale` prop for their format.
- Native `<dialog>` with `showModal()` is required (supported by all current browsers).
- Ranges (start and end in one calendar) are out of scope; the grid filter uses two pickers.
