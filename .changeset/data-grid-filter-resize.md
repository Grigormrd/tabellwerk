---
"@tabellwerk/react": minor
---

Add column filters (`filter: "text" | "number" | "values" | "date"`) in a header dialog, applied while typing, and column resizing by pointer, touch and keyboard with fit to content. New props: `filters`, `defaultFilters`, `onFiltersChange`, `columnWidths`, `defaultColumnWidths`, `onColumnWidthsChange`; new column options `minWidth`, `maxWidth`, `resizable`. Breaking: `ColumnDef.format` now receives only non-empty values, and the `sortHint` message is replaced by `headerHint`.
