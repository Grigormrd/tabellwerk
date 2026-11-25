# @tabellwerk/react

Accessible React components centred on a fast, keyboard-friendly data grid: a WAI-ARIA grid for
100,000 rows with sorting, filtering and column resizing, a combobox and a date picker.

- **Documentation:** [tabellwerk.vercel.app](https://tabellwerk.vercel.app) (keyboard tables,
  theming, accessibility notes, every component in light and dark)
- **Demo:** [tabellwerk-demo.vercel.app](https://tabellwerk-demo.vercel.app) (104,256 hours of German
  electricity market data)
- **Source:** [github.com/Grigormrd/tabellwerk](https://github.com/Grigormrd/tabellwerk)

## Install

```bash
npm install @tabellwerk/react
```

Requires React 19. ESM only, with TypeScript types. Import the stylesheet once (it includes the
design tokens from `@tabellwerk/tokens`):

```tsx
import "@tabellwerk/react/styles.css";
```

## Components

- `DataGrid` and `useDataGrid()`: 100,000 rows, keyboard navigation with one tab stop, sorting,
  filters (text, number range, values, date range), column resizing by pointer and keyboard
- `Combobox` and `useCombobox()`: list and inline autocomplete, groups, long lists, options from a
  server, several values, forms
- `DatePicker`, `Calendar` and `useCalendar()`: ISO date strings, a modal calendar dialog, the
  locale's week start and input format, `min`/`max`/unavailable days, forms
- `LiveAnnouncer` and `useAnnouncer()`: screen reader announcements
- `VisuallyHidden`: content for assistive technology only

```tsx
import { DataGrid, type ColumnDef } from "@tabellwerk/react";
import "@tabellwerk/react/styles.css";

interface Price {
  time: Date;
  price: number;
}

const columns: ColumnDef<Price>[] = [
  { id: "time", header: "Time", filter: "date" },
  { id: "price", header: "Price €/MWh", align: "end", filter: "number" },
];

export function Prices({ rows }: { rows: Price[] }) {
  return (
    <DataGrid aria-label="Day-ahead prices" rows={rows} columns={columns} style={{ height: 480 }} />
  );
}
```

Each component also has its own entry point (`@tabellwerk/react/data-grid`, `/combobox`,
`/date-picker`, `/live-announcer`, `/visually-hidden`).

## License

MIT
