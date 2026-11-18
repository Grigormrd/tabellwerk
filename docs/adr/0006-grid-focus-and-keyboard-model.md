# 6. Grid focus and keyboard model

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

The WAI-ARIA grid pattern asks for one tab stop and arrow-key navigation between cells. There are
two ways to implement the focus:

- **Roving tabindex:** DOM focus moves to the cell; the active cell has `tabindex="0"`, all others
  `-1`.
- **`aria-activedescendant`:** DOM focus stays on the grid container, which points at the active
  cell by id.

Virtualisation adds a problem neither solves on its own: the active cell can be scrolled out of
view, and a virtualiser would normally remove its row from the DOM.

The pattern also leaves open how headers that sort (and later filter and resize) are operated, and
how interactive content inside cells fits a single tab stop.

## Decision

**Roving tabindex.** DOM focus is on the active cell.

- Screen readers and browsers handle real focus more consistently than `aria-activedescendant` in
  a grid: the focus ring, `:focus-visible`, scrolling, and the screen reader's own cursor all follow.
- Mouse clicks focus cells natively (every cell has `tabindex="-1"`), and a grid-level `focus`
  handler makes the clicked cell the active one. There are no per-cell event handlers.
- Cells are memoised components, so moving focus re-renders exactly the two cells whose `tabIndex`
  changes. A test counts cell renders to keep it that way.

**The active row is always rendered.** The rendered rows are the virtual range plus the active row,
wherever it is. When the user scrolls away with the mouse wheel, the focused element stays in the
DOM (absolutely positioned at its real offset, out of view), so focus is not lost to `<body>` and
the next arrow key continues from the focused row.

**Keyboard navigation moves the scroll position, not the other way round.** A navigation key
computes the target cell (a pure function, `nextPosition`, tested on its own), scrolls the minimum
amount to reveal it, renders the new range in the same update, and then moves DOM focus with
`preventScroll`. Ctrl+Home also scrolls back to the top, because the header row is sticky and would
otherwise be focused while the body stays scrolled down.

**Headers.** The header cell itself is the focus target; Enter, Space or a click sorts, Shift adds
the column to a multi-column sort. Only the primary sort column gets `aria-sort` (the ARIA
specification asks for one); further sort columns get their position as visually hidden text in
their name. Sortable headers are described by a hidden hint ("Press Enter to sort…"), and every sort
change is announced through a polite live region. The filter and resize controls that later phases
add to headers will be reached from the focused header without changing these keys.

**Interactive cell content.** Focusable elements rendered by `cell` get `tabindex="-1"`, so the grid
keeps a single tab stop. Enter or F2 on the cell focuses the first of them, Tab cycles within the
cell, Escape returns to the cell. While focus is inside a cell, arrow keys are left to the content.

## Consequences

- Every key in the documented keyboard table has a browser test with real key events.
- The DOM always contains one row more than the range when the active row is far away; the render
  budget tests allow for it.
- Cell content must render from props only, because row elements are reused by position
  ([ADR 5](0005-sorting-with-rank-permutations.md)).
- `aria-activedescendant` stays the better fit for the combobox, where focus must remain in the
  text input; that decision is made separately.
