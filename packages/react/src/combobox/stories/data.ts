import type { ComboboxOption } from "../options.ts";

/** European bidding zones of the electricity market, grouped by region. */
export const biddingZones: ComboboxOption[] = [
  { value: "DE-LU", label: "Germany-Luxembourg", group: "Central Western Europe" },
  { value: "FR", label: "France", group: "Central Western Europe" },
  { value: "NL", label: "Netherlands", group: "Central Western Europe" },
  { value: "BE", label: "Belgium", group: "Central Western Europe" },
  { value: "AT", label: "Austria", group: "Central Western Europe" },
  { value: "CH", label: "Switzerland", group: "Central Western Europe" },
  { value: "PL", label: "Poland", group: "Central Eastern Europe" },
  { value: "CZ", label: "Czechia", group: "Central Eastern Europe" },
  { value: "HU", label: "Hungary", group: "Central Eastern Europe" },
  { value: "DK1", label: "Denmark West", group: "Nordic" },
  { value: "DK2", label: "Denmark East", group: "Nordic" },
  { value: "NO2", label: "Norway South-West", group: "Nordic" },
  { value: "SE4", label: "Sweden South", group: "Nordic" },
  { value: "FI", label: "Finland", group: "Nordic" },
  { value: "IT-N", label: "Italy North", group: "Southern Europe" },
  { value: "ES", label: "Spain", group: "Southern Europe" },
  { value: "PT", label: "Portugal", group: "Southern Europe" },
];

/** The same zones without groups. */
export const zones: ComboboxOption[] = biddingZones.map(({ value, label }) => ({ value, label }));

/** Cities with diacritics, to show accent-insensitive matching. */
export const cities: ComboboxOption[] = [
  "Århus",
  "Berlin",
  "Bremen",
  "Düsseldorf",
  "Göteborg",
  "Köln",
  "Kraków",
  "Łódź",
  "Málaga",
  "München",
  "Nürnberg",
  "Zürich",
].map((label) => ({ value: label.toLowerCase(), label }));

/** 5,000 synthetic measuring stations, for the virtualised list. */
export const stations: ComboboxOption[] = Array.from({ length: 5000 }, (_, i) => {
  const id = String(i + 1).padStart(4, "0");
  return { value: `station-${id}`, label: `Station ${id}` };
});

/**
 * A fake server: filters the zones after a delay, or fails when the query is
 * "error". Respects the abort signal like a real `fetch` would.
 */
export function fakeLoadZones(delay = 600) {
  return (query: string, { signal }: { signal: AbortSignal }) =>
    new Promise<ComboboxOption[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (query.trim().toLowerCase() === "error") reject(new Error("Server error"));
        else {
          const q = query.trim().toLowerCase();
          resolve(zones.filter((z) => z.label.toLowerCase().includes(q)));
        }
      }, delay);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
}
