# 8. Combobox: focus model, popup, input methods and several values

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

The combobox is the widget that component libraries most often get subtly wrong: focus jumps into
the list and typing stops working, input methods for Japanese or Chinese trigger filtering on every
uncommitted keystroke, Enter submits the surrounding form while the list is open, the list is
clipped by a scroll container, or a long list renders thousands of options. It also has to work as
the "choose values" filter of the grid, which needs several values.

## Decision

**Focus stays in the text field.** The input has `role="combobox"`, `aria-expanded`,
`aria-controls` (the listbox) and `aria-autocomplete` (`list`, or `both` with inline completion).
The option with visual focus is referenced with `aria-activedescendant`, unlike the grid's roving
tabindex ([ADR 6](0006-grid-focus-and-keyboard-model.md)), because the user keeps typing while
moving through the list. Options and the popup prevent `mousedown`, so pointer presses never move
focus; the toggle button has `tabindex="-1"`, so the combobox is a single tab stop.

**Keys follow the APG examples.** Down/Up open the list on the first/last (or selected) option and
wrap; Alt+Down opens without moving, Alt+Up closes; Enter selects (and only then prevents the form
from submitting; with the list closed, Enter submits); Escape closes, and with the list closed clears
the field; Tab selects the option with visual focus; Home/End move the text cursor and return visual
focus to the field. Leaving the field accepts text that names an option (ignoring case and
diacritics) and otherwise returns to the selected option.

**Matching folds case and diacritics** (`NFD` without combining marks, then locale lower case), so
"zurich" finds "Zürich". Inline completion appends only the rest of the first matching label and
selects it, so the next key replaces it and Backspace removes it without completing again (the
completion runs only for `insert*` input events with the cursor at the end).

**Input methods.** Between `compositionstart` and `compositionend` the field shows the uncommitted
text but neither filters nor completes, and key handling is skipped (`isComposing`). Filtering
happens on commit. A browser test drives a real composition through the DevTools protocol
(`Input.imeSetComposition`, `Input.insertText`).

**Popup in the top layer.** The list is a `popover="manual"` element next to the field, placed by
the same function as the grid's filter dialog (`internal/place.ts`), so it is never clipped and
works inside that dialog, which is itself in the top layer.

**Long lists and groups.** Lists with more than 100 options and no groups render only the options in
view (fixed 36 px option height, the grid's `visibleRange`), plus the option with visual focus;
rendered options carry `aria-setsize` and `aria-posinset`. Grouped lists render fully with
`role="group"` and a labelled heading, and the keyboard order follows the order on screen.

**Server options.** `loadOptions(query, { signal })` runs `loadDelay` ms after the last change.
Each request gets its own `AbortController`; a result is shown only if it belongs to the current
query, so a slow answer to an older query never replaces a newer list. The loading state is derived
("the last result belongs to another query") rather than set in an effect.

**Several values.** `multiple` sets `aria-multiselectable`; Enter adds or removes the option and
keeps the list open; selected values are chips with remove buttons; Backspace in an empty field
removes the last value; additions and removals are announced. The grid's `"values"` filter is this
combobox, so it now scales to long value lists and gains search, which the checkbox list of Phase 2
did not have. An empty selection now means "no filter" in the dialog.

**Forms.** `name` renders hidden inputs with the selected value(s). `required` uses the field's
`setCustomValidity`, so the browser's own validation blocks submission and shows a message. A form
reset restores `defaultValue`.

## Consequences

- The keyboard tests run in Chromium, Firefox and WebKit in CI (Vitest project `engines`, enabled
  with `TBW_ENGINES=all`); the IME tests need the DevTools protocol and run in Chromium only.
- The grid bundle grows by the combobox (from 7.3 to 10.7 kB, minified and brotli); the combobox on
  its own is 4.7 kB.
- No free-text values: the value is always one of the options. Creating new options from typed text
  is out of scope.
