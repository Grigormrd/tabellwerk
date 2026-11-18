# 7. Header controls: filtering and column resizing

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

Column headers now offer three things: sorting (Phase 1), a filter and a width. The WAI-ARIA grid
pattern says how to move between cells, but not how several controls inside one header cell are
operated, and [ADR 6](0006-grid-focus-and-keyboard-model.md) promised that the existing keys would
not change. Filtering must stay responsive on 100,000 rows while the user types, resizing must work
with mouse, pen, touch and keyboard, and a filter form must not break the grid's ARIA structure
(a `grid` may only contain rows).

## Decision

**Keyboard model for headers.** The header cell stays the focus target and Enter/Space still
sort. Two keys are added:

- **Alt+Down Arrow** opens the column's filter, as it opens the list of a select or combobox.
- **F2** moves into the header's controls (filter button, resize handle), the same key that moves
  into interactive content of body cells. Tab cycles between the controls, Escape returns to the
  header. The controls have `tabindex="-1"`, so the grid keeps a single tab stop.

Each header is named by its text alone (`aria-labelledby` on the text, so the button inside does
not become part of the name), with hidden suffixes for sort position and active filters, and is
described by a hint that lists what it offers.

**Filter dialog.** A non-modal `role="dialog"` with the native Popover API (`popover="manual"`),
rendered next to the grid element, not inside it:

- the top layer is never clipped by the grid's scroll container, without a portal;
- outside the `grid` element, the dialog does not break the grid's required-children structure;
- `manual` instead of `auto`: light dismiss would close the dialog on the press of its own toggle
  button and reopen it on the click. Outside presses are handled by the component, which ignores
  the dialog's own header.

The dialog is placed under its header by a small function (below, or above if there is no room;
kept inside the viewport) and follows scrolling. The plan named Floating UI for this; for one
placement rule it would add a dependency for about 20 lines of code, so it is not used. Focus moves
into the dialog, Tab stays inside, Enter and Escape close it and return focus to the header, and a
press outside closes it without moving focus back (the user is going elsewhere).

**Filtering.** Filters apply while typing. `filterMask` builds one predicate per filter and marks
matching rows in a `Uint8Array`; `applyMask` keeps the sorted order's matching entries. The mask and
the sort are cached independently, so typing never sorts again and sorting never filters again. The
display texts of a column (formatted, lower-cased) are cached per rows array, so a key press tests
100,000 cached strings instead of formatting 100,000 values. The mask is computed from
`useDeferredValue(filters)`: the typed character is painted first, the filtered rows follow in a
deferred render. The result count is announced 600 ms after the last change.

**Resizing.** The handle is a focusable `role="separator"` with `aria-valuenow`, `-min`, `-max`
and a value text, the ARIA "window splitter" semantics. Pointer events with `setPointerCapture`
cover mouse, pen and touch (`touch-action: none` on the handle); the hit area is 24 px wide (WCAG
2.5.8). Widths live in one CSS custom property on the grid, so a width change renders the header
row but no body row; a test counts cell renders during resizing (zero). Fitting a column measures
the content of the header and the rows in view.

## Measurements

Production Storybook build, 100,000 rows, CPU throttled 4×, same machine and conditions as in
[ADR 4](0004-own-virtualiser.md), first single runs on 2026-11-18 (the 5-run medians are in the
README):

| Interaction                                        | Measured |
| -------------------------------------------------- | -------: |
| Key press in the text filter, until the next paint |    24 ms |
| Key press until the filtered rows are painted      |    79 ms |
| Worst frame while dragging a column edge 200 px    |  < 50 ms |

"< 50 ms": the Long Animation Frames API reported no frame at all, and it reports only frames over
50 ms.

## Consequences

- `"values"` filters list at most 200 distinct values; longer lists need the combobox of Phase 3,
  which will replace the checkbox list. The date filter uses native date inputs until the date
  picker of Phase 4 replaces them.
- Fitting a column to content does not look at rows outside the view, which keeps it instant on
  100,000 rows but can leave longer values in other rows truncated.
- The Popover API is required (Chrome 114, Firefox 125, Safari 17).
