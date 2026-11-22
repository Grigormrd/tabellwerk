import { describe, expect, it } from "vitest";
import {
  displayOrder,
  filterOptions,
  fold,
  groupOptions,
  inlineCompletion,
  matchLabel,
  stepIndex,
  type ComboboxOption,
} from "./options.ts";

const cities: ComboboxOption[] = [
  { value: "ber", label: "Berlin", group: "Germany" },
  { value: "zrh", label: "Zürich", group: "Switzerland" },
  { value: "bsl", label: "Basel", group: "Switzerland" },
  { value: "bre", label: "Bremen", group: "Germany", disabled: true },
  { value: "bon", label: "Bonn", group: "Germany" },
  { value: "aar", label: "Århus" },
];

const labels = (options: ComboboxOption[]) => options.map((o) => o.label);

describe("fold", () => {
  it("removes case and diacritics", () => {
    expect(fold("Zürich")).toBe("zurich");
    expect(fold("ÅNGSTRÖM")).toBe("angstrom");
    expect(fold("Straße")).toBe("straße");
  });
});

describe("filterOptions", () => {
  it("matches anywhere by default, ignoring case and diacritics", () => {
    expect(labels(filterOptions(cities, "ur"))).toEqual(["Zürich"]);
    expect(labels(filterOptions(cities, "RE"))).toEqual(["Bremen"]);
    expect(labels(filterOptions(cities, "arh"))).toEqual(["Århus"]);
  });

  it("matches prefixes with startsWith", () => {
    expect(labels(filterOptions(cities, "b", "startsWith"))).toEqual([
      "Berlin",
      "Basel",
      "Bremen",
      "Bonn",
    ]);
  });

  it("returns everything for an empty or blank query", () => {
    expect(filterOptions(cities, "  ")).toHaveLength(cities.length);
  });

  it("accepts a custom filter that receives the folded query", () => {
    const byValue = filterOptions(cities, "ZRH", (option, query) => option.value === query);
    expect(labels(byValue)).toEqual(["Zürich"]);
  });
});

describe("inlineCompletion", () => {
  it("appends the rest of the first enabled match and keeps the typed case", () => {
    expect(inlineCompletion(cities, "be")).toEqual({
      option: cities[0],
      text: "berlin",
      selectionStart: 2,
    });
    expect(inlineCompletion(cities, "ZU")?.text).toBe("ZUrich");
  });

  it("skips disabled options and exact matches, and returns null without a match", () => {
    expect(inlineCompletion(cities, "Bre")).toBeNull(); // Bremen is disabled
    expect(inlineCompletion(cities, "Bonn")).toBeNull(); // nothing left to complete
    expect(inlineCompletion(cities, "x")).toBeNull();
    expect(inlineCompletion(cities, "")).toBeNull();
  });
});

describe("matchLabel", () => {
  it("finds an enabled option by its label", () => {
    expect(matchLabel(cities, " zurich ")?.value).toBe("zrh");
    expect(matchLabel(cities, "Bremen")).toBeUndefined();
    expect(matchLabel(cities, "")).toBeUndefined();
  });
});

describe("groupOptions and displayOrder", () => {
  it("groups in order of first appearance and keeps flat indexes", () => {
    const groups = groupOptions(cities);
    expect(groups.map((g) => g.label)).toEqual(["Germany", "Switzerland", undefined]);
    expect(groups[0]!.options.map((o) => o.index)).toEqual([0, 3, 4]);
    expect(labels(displayOrder(cities))).toEqual([
      "Berlin",
      "Bremen",
      "Bonn",
      "Zürich",
      "Basel",
      "Århus",
    ]);
  });
});

describe("stepIndex", () => {
  const ordered = displayOrder(cities); // Berlin, Bremen (disabled), Bonn, Zürich, Basel, Århus

  it("moves to the next or previous enabled option and wraps", () => {
    expect(stepIndex(ordered, -1, 1)).toBe(0);
    expect(stepIndex(ordered, -1, -1)).toBe(5);
    expect(stepIndex(ordered, 0, 1)).toBe(2); // skips disabled Bremen
    expect(stepIndex(ordered, 5, 1)).toBe(0);
    expect(stepIndex(ordered, 0, -1)).toBe(5);
  });

  it("returns -1 when nothing can be selected", () => {
    expect(stepIndex([], -1, 1)).toBe(-1);
    expect(stepIndex([{ value: "x", label: "X", disabled: true }], -1, 1)).toBe(-1);
  });
});
