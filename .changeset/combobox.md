---
"@tabellwerk/react": minor
---

Add `Combobox` and `useCombobox`: an editable combobox following the WAI-ARIA pattern with list and inline autocomplete, case- and accent-insensitive matching, correct input method (IME) handling, groups, virtualised long lists, options from a server (`loadOptions`) with loading, empty and error states, several values (`multiple`) as removable chips, and form support (`name`, `required`, reset). The grid's `"values"` filter now uses the combobox; an empty selection there means no filter. Breaking: the `selectAll` and `selectNone` filter labels are replaced by `valuesHint`.
