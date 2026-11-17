import { describe, expect, it } from "vitest";
import { themes, vars } from "../dist/index.js";
import dark from "../tokens/color.dark.json" with { type: "json" };
import light from "../tokens/color.light.json" with { type: "json" };
import { contrastRatio } from "./contrast.ts";

type Role = keyof typeof light.color & keyof typeof dark.color;

// Foreground role, background roles it appears on, required ratio (WCAG 2.1).
// 4.5:1 for text (1.4.3), 3:1 for focus indicators and control borders (1.4.11).
const PAIRS: [Role, Role[], number][] = [
  ["text", ["bg", "surface", "surface-hover", "accent-subtle"], 4.5],
  ["text-muted", ["bg", "surface", "surface-hover", "accent-subtle"], 4.5],
  ["accent", ["bg", "surface"], 4.5],
  ["accent-text", ["accent"], 4.5],
  ["danger", ["bg", "surface"], 4.5],
  ["border-strong", ["bg", "surface"], 3],
  ["focus", ["bg", "surface", "surface-hover", "accent-subtle"], 3],
];

const sources = { light: light.color, dark: dark.color };

describe.each(Object.entries(sources))("%s theme contrast", (_name, colors) => {
  const value = (role: Role) => (colors[role] as { $value: string }).$value;

  it.each(PAIRS.flatMap(([fg, bgs, min]) => bgs.map((bg) => [fg, bg, min] as const)))(
    "%s on %s is at least %d:1",
    (fg, bg, min) => {
      expect(contrastRatio(value(fg), value(bg))).toBeGreaterThanOrEqual(min);
    },
  );
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

describe("build output", () => {
  it("exposes the resolved colours of both themes", () => {
    expect(themes.light.bg).toBe(light.color.bg.$value);
    expect(themes.dark.text).toBe(dark.color.text.$value);
  });

  it("references CSS custom properties with the tbw prefix", () => {
    expect(vars.color.accent).toBe("var(--tbw-color-accent)");
    expect(vars.size.row).toBe("var(--tbw-size-row)");
  });
});
