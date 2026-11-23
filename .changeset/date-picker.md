---
"@tabellwerk/react": minor
---

Add `DatePicker`, `Calendar` and `useCalendar`: a date field with a modal calendar dialog following the WAI-ARIA pattern. Values are ISO date strings (no time zone shifts); the locale sets the input format, names and first day of the week; typed dates are parsed in the locale's order; `min`, `max` and `isDateUnavailable` limit the choice; forms are supported with `name`, `required` and reset. The grid's `"date"` filter now uses the date picker, and `DataGrid` gets a `locale` prop for it.
