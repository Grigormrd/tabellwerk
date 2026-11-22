// Combobox behaviour with real keyboard and pointer input. This file also
// runs in Firefox and WebKit in CI (project "engines").

import { useState, type JSX } from "react";
import { describe, expect, it } from "vitest";
import { commands, server, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Combobox, type ComboboxProps } from "./Combobox.tsx";
import type { ComboboxOption } from "./options.ts";
import { biddingZones, cities, stations, zones } from "./stories/data.ts";

const input = () => document.querySelector<HTMLInputElement>('[role="combobox"]')!;
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]')!;
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
const optionLabels = () => options().map((o) => o.textContent ?? "");
const activeLabel = () => {
  const id = input().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : null;
};
const expanded = () => input().getAttribute("aria-expanded");
const politeText = () =>
  [...document.querySelectorAll('[data-tbw-live="polite"]')].map((r) => r.textContent).join("|");

function Harness(props: Partial<ComboboxProps> & { onValue?: (v: unknown) => void }): JSX.Element {
  const { onValue, ...rest } = props;
  const merged = {
    label: "Bidding zone",
    options: zones,
    ...rest,
    onChange: (value: unknown) => onValue?.(value),
  } as ComboboxProps;
  return (
    <div>
      <button type="button">Before</button>
      <Combobox {...merged} />
      <button type="button">After</button>
    </div>
  );
}

async function focusInput() {
  await userEvent.keyboard("{Tab}{Tab}");
  expect(document.activeElement).toBe(input());
}

describe("Combobox structure", () => {
  it("is a labelled combobox that controls a listbox", async () => {
    const screen = await render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Bidding zone" });
    await expect.element(box).toHaveAttribute("aria-expanded", "false");
    await expect.element(box).toHaveAttribute("aria-autocomplete", "list");
    expect(input().getAttribute("aria-controls")).toBe(listbox().id);
    expect(listbox().getAttribute("aria-labelledby")).toBe(document.querySelector("label")!.id);
  });

  it("has a single tab stop (the toggle button is not one)", async () => {
    const screen = await render(<Harness />);
    await focusInput();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });
});

describe("Combobox keyboard", () => {
  it("Down Arrow opens on the first option, moves on and wraps", async () => {
    await render(<Harness />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}");
    expect(expanded()).toBe("true");
    expect(activeLabel()).toBe("Germany-Luxembourg");
    await userEvent.keyboard("{ArrowDown}");
    expect(activeLabel()).toBe("France");
    for (let i = 0; i < zones.length - 1; i++) await userEvent.keyboard("{ArrowDown}");
    expect(activeLabel()).toBe("Germany-Luxembourg");
    // Focus never leaves the input.
    expect(document.activeElement).toBe(input());
  });

  it("Up Arrow opens on the last option and wraps", async () => {
    await render(<Harness />);
    await focusInput();
    await userEvent.keyboard("{ArrowUp}");
    expect(activeLabel()).toBe("Portugal");
    await userEvent.keyboard("{ArrowUp}");
    expect(activeLabel()).toBe("Spain");
  });

  it("Alt+Down opens without moving, Alt+Up closes", async () => {
    await render(<Harness />);
    await focusInput();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(expanded()).toBe("true");
    expect(activeLabel()).toBeNull();
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(expanded()).toBe("false");
  });

  it("Enter selects the active option and closes", async () => {
    const values: unknown[] = [];
    await render(<Harness onValue={(v) => values.push(v)} />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(input().value).toBe("France");
    expect(expanded()).toBe("false");
    expect(values).toEqual(["FR"]);
  });

  it("opening again starts at the selected option and shows all options", async () => {
    await render(<Harness defaultValue="NL" />);
    await focusInput();
    expect(input().value).toBe("Netherlands");
    await userEvent.keyboard("{ArrowDown}");
    expect(activeLabel()).toBe("Netherlands");
    expect(options()).toHaveLength(zones.length);
    const selected = options().find((o) => o.getAttribute("aria-selected") === "true");
    expect(selected?.textContent).toBe("Netherlands");
  });

  it("typing filters, ignoring case and diacritics, and announces the count", async () => {
    await render(<Harness label="City" options={cities} />);
    await focusInput();
    await userEvent.keyboard("ur");
    expect(expanded()).toBe("true");
    expect(optionLabels()).toEqual(["Nürnberg", "Zürich"]);
    expect(activeLabel()).toBeNull();
    await expect.poll(politeText).toContain("2 results");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(input().value).toBe("Nürnberg");
  });

  it("says when nothing matches", async () => {
    const screen = await render(<Harness />);
    await focusInput();
    await userEvent.keyboard("xyz");
    await expect.element(screen.getByText("No results")).toBeVisible();
    expect(options()).toHaveLength(0);
  });

  it("Escape closes the list, a second Escape clears the value", async () => {
    const values: unknown[] = [];
    await render(<Harness defaultValue="FR" onValue={(v) => values.push(v)} />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}{Escape}");
    expect(expanded()).toBe("false");
    expect(input().value).toBe("France");
    await userEvent.keyboard("{Escape}");
    expect(input().value).toBe("");
    expect(values).toEqual([null]);
  });

  it("Home and End move the cursor and return visual focus to the input", async () => {
    await render(<Harness />);
    await focusInput();
    await userEvent.keyboard("an{ArrowDown}");
    expect(activeLabel()).not.toBeNull();
    await userEvent.keyboard("{Home}");
    expect(activeLabel()).toBeNull();
    expect(input().selectionStart).toBe(0);
    await userEvent.keyboard("{End}");
    expect(input().selectionStart).toBe(2);
  });

  it("Tab selects the active option and moves on", async () => {
    const screen = await render(<Harness />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}{Tab}");
    expect(input().value).toBe("Germany-Luxembourg");
    await expect.element(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("leaving the field accepts text that names an option and reverts anything else", async () => {
    const values: unknown[] = [];
    await render(<Harness label="City" options={cities} onValue={(v) => values.push(v)} />);
    await focusInput();
    await userEvent.keyboard("ZURICH{Tab}");
    expect(input().value).toBe("Zürich");
    expect(values).toEqual(["zürich"]);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{Control>}a{/Control}nowhere{Tab}");
    expect(input().value).toBe("Zürich");
    expect(values).toEqual(["zürich"]);
  });

  it("skips disabled options", async () => {
    const withDisabled: ComboboxOption[] = [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta", disabled: true },
      { value: "c", label: "Gamma" },
    ];
    await render(<Harness options={withDisabled} />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(activeLabel()).toBe("Gamma");
    expect(options()[1]!.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("Combobox inline autocomplete", () => {
  it("completes the first match, selects the completion, Backspace removes it", async () => {
    await render(<Harness label="City" options={cities} autocomplete="both" />);
    await focusInput();
    expect(input().getAttribute("aria-autocomplete")).toBe("both");
    await userEvent.keyboard("ber");
    expect(input().value).toBe("berlin");
    expect([input().selectionStart, input().selectionEnd]).toEqual([3, 6]);
    expect(activeLabel()).toBe("Berlin");
    // Deleting the selected completion does not complete again.
    await userEvent.keyboard("{Backspace}");
    expect(input().value).toBe("ber");
    expect(activeLabel()).toBeNull();
    await userEvent.keyboard("l{Enter}");
    expect(input().value).toBe("Berlin");
  });

  it("typing on replaces the completion", async () => {
    await render(<Harness label="City" options={cities} autocomplete="both" />);
    await focusInput();
    await userEvent.keyboard("br");
    expect(input().value).toBe("bremen");
    await userEvent.keyboard("x");
    expect(input().value).toBe("brx");
  });
});

describe("Combobox pointer", () => {
  it("a click on an option selects it, focus stays in the input", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("combobox").click();
    expect(expanded()).toBe("true");
    await screen.getByRole("option", { name: "Austria" }).click();
    expect(input().value).toBe("Austria");
    expect(document.activeElement).toBe(input());
  });

  it("the toggle button opens and closes the list", async () => {
    const screen = await render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Show options" });
    await toggle.click();
    expect(expanded()).toBe("true");
    await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(input());
    await toggle.click();
    expect(expanded()).toBe("false");
  });
});

describe("Combobox groups and long lists", () => {
  it("lists grouped options in named groups, in group order", async () => {
    const screen = await render(<Harness options={biddingZones} />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(screen.getByRole("group", { name: "Nordic" })).toBeVisible();
    // Keyboard order follows the display order of the groups.
    await userEvent.keyboard("{ArrowUp}");
    expect(activeLabel()).toBe("Portugal");
  });

  it("renders only the options in view of 5,000 and keeps their position", async () => {
    await render(<Harness label="Station" options={stations} />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}");
    expect(options().length).toBeLessThan(30);
    expect(options()[0]!.getAttribute("aria-setsize")).toBe("5000");
    await userEvent.keyboard("{ArrowUp}");
    expect(activeLabel()).toBe("Station 5000");
    const active = document.getElementById(input().getAttribute("aria-activedescendant")!)!;
    expect(active.getAttribute("aria-posinset")).toBe("5000");
    // The active option is scrolled into view.
    const list = listbox().getBoundingClientRect();
    const box = active.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(list.bottom + 1);
  });
});

describe("Combobox with loadOptions", () => {
  it("shows loading, then the results of the latest query only", async () => {
    const calls: string[] = [];
    const resolvers = new Map<string, (o: ComboboxOption[]) => void>();
    const load = (query: string) =>
      new Promise<ComboboxOption[]>((resolve) => {
        calls.push(query);
        resolvers.set(query, resolve);
      });
    const screen = await render(<Harness loadOptions={load} loadDelay={0} />);
    await focusInput();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await expect.element(screen.getByText("Loading…")).toBeVisible();
    await userEvent.keyboard("fr");
    await expect.poll(() => calls.at(-1)).toBe("fr");
    // An older request resolving late must not replace newer results.
    resolvers.get("f")?.([{ value: "x", label: "Stale" }]);
    resolvers.get("fr")!([{ value: "FR", label: "France" }]);
    await expect.poll(optionLabels).toEqual(["France"]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(input().value).toBe("France");
  });

  it("shows an error when loading fails", async () => {
    const screen = await render(
      <Harness loadOptions={() => Promise.reject(new Error("down"))} loadDelay={0} />,
    );
    await focusInput();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await expect.element(screen.getByText("The options could not be loaded")).toBeVisible();
  });
});

describe("Combobox multiple", () => {
  it("Enter toggles options, the list stays open, chips show the selection", async () => {
    const values: unknown[] = [];
    const screen = await render(<Harness multiple onValue={(v) => values.push(v)} />);
    await focusInput();
    await userEvent.keyboard("{ArrowDown}{Enter}{ArrowDown}{Enter}");
    expect(expanded()).toBe("true");
    expect(values.at(-1)).toEqual(["DE-LU", "FR"]);
    expect(listbox().getAttribute("aria-multiselectable")).toBe("true");
    await expect.element(screen.getByRole("list", { name: "Selected" })).toBeVisible();
    await expect.poll(politeText).toContain("France added");
    // Enter on a selected option removes it again.
    await userEvent.keyboard("{Enter}");
    expect(values.at(-1)).toEqual(["DE-LU"]);
  });

  it("Backspace in the empty input removes the last value, chip buttons remove one", async () => {
    const values: unknown[] = [];
    const screen = await render(
      <Harness multiple defaultValue={["DE-LU", "FR", "NL"]} onValue={(v) => values.push(v)} />,
    );
    await screen.getByRole("combobox").click();
    await userEvent.keyboard("{Backspace}");
    expect(values.at(-1)).toEqual(["DE-LU", "FR"]);
    await screen.getByRole("button", { name: "Remove Germany-Luxembourg" }).click();
    expect(values.at(-1)).toEqual(["FR"]);
    expect(document.activeElement).toBe(input());
  });
});

describe("Combobox in forms", () => {
  function Form({ onSubmit }: { onSubmit: (data: Record<string, unknown>) => void }): JSX.Element {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <Combobox label="Bidding zone" options={zones} name="zone" required defaultValue="NL" />
        <button type="reset">Reset</button>
        <button type="submit">Submit</button>
      </form>
    );
  }

  it("submits the value under its name; Enter on a closed combobox submits", async () => {
    const submitted: Record<string, unknown>[] = [];
    await render(<Form onSubmit={(data) => submitted.push(data)} />);
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(submitted).toEqual([]); // Enter in the open list selects, it does not submit
    await userEvent.keyboard("{Enter}");
    expect(submitted).toEqual([{ zone: "BE" }]);
  });

  it("blocks submission while a required combobox is empty", async () => {
    const submitted: Record<string, unknown>[] = [];
    const screen = await render(<Form onSubmit={(data) => submitted.push(data)} />);
    await userEvent.keyboard("{Tab}{Escape}");
    expect(input().value).toBe("");
    await screen.getByRole("button", { name: "Submit" }).click();
    expect(submitted).toEqual([]);
    expect(input().validationMessage).toBe("Select an option from the list.");
  });

  it("form reset restores the default value", async () => {
    const screen = await render(<Form onSubmit={() => {}} />);
    // TEMPORARY trace for a Firefox-only failure; removed once understood.
    const trace: string[] = [];
    const snap = (label: string) =>
      trace.push(
        `${label}: value=${input().value} attr=${input().getAttribute("value")} active=${document.activeElement?.tagName}/${document.activeElement?.getAttribute("role") ?? ""}`,
      );
    snap("start");
    input().form!.addEventListener("reset", () => snap("reset event"));
    await userEvent.keyboard("{Tab}");
    snap("after Tab");
    await userEvent.keyboard("{ArrowDown}");
    snap("after ArrowDown");
    await userEvent.keyboard("{ArrowUp}");
    snap("after ArrowUp");
    await userEvent.keyboard("{Enter}");
    snap("after Enter");
    expect(input().value).not.toBe("Netherlands");
    await screen.getByRole("button", { name: "Reset" }).click();
    snap("after click");
    await new Promise((r) => setTimeout(r, 200));
    snap("after 200 ms");
    console.log(`RESET-TRACE\n${trace.join("\n")}`);
    await expect.poll(() => input().value).toBe("Netherlands");
  });
});

describe("Combobox controlled", () => {
  it("shows a value set from outside", async () => {
    function Controlled(): JSX.Element {
      const [value, setValue] = useState<string | null>("FR");
      return (
        <>
          <button type="button" onClick={() => setValue("PL")}>
            Set Poland
          </button>
          <Combobox label="Zone" options={zones} value={value} onChange={setValue} />
          <output>{String(value)}</output>
        </>
      );
    }
    const screen = await render(<Controlled />);
    expect(input().value).toBe("France");
    await screen.getByRole("button", { name: "Set Poland" }).click();
    await expect.poll(() => input().value).toBe("Poland");
  });
});

describe.skipIf(server.browser !== "chromium")("Combobox with an input method (IME)", () => {
  const japanese: ComboboxOption[] = [
    { value: "berlin", label: "ベルリン" },
    { value: "bern", label: "ベルン" },
    { value: "paris", label: "パリ" },
  ];

  it("does not filter while composing and filters on commit", async () => {
    await render(<Harness label="City" options={japanese} />);
    await focusInput();
    await commands.imeStart({ text: "べる" });
    // Composition text is shown, but the list is not filtered by it.
    expect(input().value).toBe("べる");
    expect(activeLabel()).toBeNull();
    await commands.imeCompose({ steps: ["べるり", "ベルリ"], commit: "ベルリ" });
    await expect.poll(optionLabels).toEqual(["ベルリン"]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(input().value).toBe("ベルリン");
  });

  it("inline completion waits for the composition to end", async () => {
    await render(<Harness label="City" options={japanese} autocomplete="both" />);
    await focusInput();
    await commands.imeStart({ text: "ベル" });
    expect(input().value).toBe("ベル");
    await commands.imeCompose({ steps: [], commit: "ベル" });
    // Committed text filters; inline completion applies to typed text only.
    await expect.poll(optionLabels).toEqual(["ベルリン", "ベルン"]);
    expect(input().value).toBe("ベル");
  });
});
