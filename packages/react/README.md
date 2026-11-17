# @tabellwerk/react

Accessible React components centred on a fast, keyboard-friendly data grid.

> Under construction: the data grid, combobox and date picker are being built. See the
> [repository](https://github.com/Grigormrd/tabellwerk) for the roadmap.

## Install

```bash
pnpm add @tabellwerk/react
```

Requires React 19. Import the stylesheet once (it includes the design tokens):

```tsx
import "@tabellwerk/react/styles.css";
```

## Available components

- `VisuallyHidden`: content for assistive technology only
- `LiveAnnouncer` and `useAnnouncer()`: polite and assertive screen reader announcements

```tsx
import { LiveAnnouncer, useAnnouncer } from "@tabellwerk/react";

function SortButton() {
  const announce = useAnnouncer();
  return <button onClick={() => announce("Sorted by price, ascending")}>Sort</button>;
}

export function App() {
  return (
    <LiveAnnouncer>
      <SortButton />
    </LiveAnnouncer>
  );
}
```

## License

MIT
