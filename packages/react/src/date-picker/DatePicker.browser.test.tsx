// Date picker behaviour with real keys. Also runs in Firefox and WebKit in CI.

import { useState, type JSX } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DatePicker, type DatePickerProps } from "./DatePicker.tsx";
import { dayOfWeek, parseISODate } from "./plain-date.ts";

const TODAY = "2026-11-23"; // a Monday

const input = () => document.querySelector<HTMLInputElement>(".tbw-datepicker__input")!;
const button = () => document.querySelector<HTMLButtonElement>(".tbw-datepicker__button")!;
const dialog = () => document.querySelector<HTMLDialogElement>("dialog")!;
const heading = () => dialog().querySelector("h2")?.textContent;
const focusedDate = () => (document.activeElement as HTMLElement).dataset["date"];

function Harness(
  props: Partial<DatePickerProps> & { onValue?: (v: string | null) => void },
): JSX.Element {
  const { onValue, ...rest } = props;
  return (
    <div>
      <button type="button">Before</button>
      <DatePicker
        label="Delivery day"
        locale="de-DE"
        today={TODAY}
        {...rest}
        onChange={(v) => onValue?.(v)}
      />
      <button type="button">After</button>
    </div>
  );
}

async function openWithButton() {
  await userEvent.keyboard("{Tab}{Tab}{Tab}");
  expect(document.activeElement).toBe(button());
  await userEvent.keyboard("{Enter}");
  expect(dialog().open).toBe(true);
}

describe("DatePicker structure", () => {
  it("labels the field, describes the format and names the button", async () => {
    const screen = await render(<Harness />);
    await expect.element(screen.getByRole("textbox", { name: "Delivery day" })).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Delivery day" }))
      .toHaveAccessibleDescription("Format: DD.MM.YYYY");
    expect(input().placeholder).toBe("DD.MM.YYYY");
    const open = screen.getByRole("button", { name: "Choose date" });
    await expect.element(open).toHaveAttribute("aria-haspopup", "dialog");
    await expect.element(open).toHaveAttribute("aria-expanded", "false");
  });

  it("names the button with the chosen date", async () => {
    const screen = await render(<Harness defaultValue="2026-11-27" />);
    expect(input().value).toBe("27.11.2026");
    await expect
      .element(screen.getByRole("button", { name: "Change date, Freitag, 27. November 2026" }))
      .toBeVisible();
  });
});

describe("DatePicker dialog keyboard", () => {
  it("opens a modal dialog named by the month, focus on today", async () => {
    const screen = await render(<Harness />);
    await openWithButton();
    await expect.element(screen.getByRole("dialog", { name: "November 2026" })).toBeVisible();
    expect(dialog().matches(":modal")).toBe(true);
    expect(focusedDate()).toBe(TODAY);
    expect(document.activeElement?.getAttribute("aria-current")).toBe("date");
    await expect
      .element(screen.getByRole("button", { name: "Choose date" }))
      .toHaveAttribute("aria-expanded", "true");
  });

  it("opens on the selected date", async () => {
    await render(<Harness defaultValue="2026-12-24" />);
    await openWithButton();
    expect(focusedDate()).toBe("2026-12-24");
    expect(heading()).toBe("Dezember 2026");
    expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
  });

  it("Alt+Down Arrow in the field opens the calendar", async () => {
    await render(<Harness />);
    await userEvent.keyboard("{Tab}{Tab}{Alt>}{ArrowDown}{/Alt}");
    expect(dialog().open).toBe(true);
    expect(focusedDate()).toBe(TODAY);
  });

  it("arrows move by day and week, across months", async () => {
    await render(<Harness defaultValue="2026-11-30" />);
    await openWithButton();
    await userEvent.keyboard("{ArrowRight}");
    expect(focusedDate()).toBe("2026-12-01");
    expect(heading()).toBe("Dezember 2026");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(focusedDate()).toBe("2026-11-29");
    await userEvent.keyboard("{ArrowUp}");
    expect(focusedDate()).toBe("2026-11-22");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(focusedDate()).toBe("2026-12-06");
  });

  it("Home and End move to the start and end of the week, by locale", async () => {
    await render(<Harness defaultValue="2026-11-25" />); // Wednesday
    await openWithButton();
    await userEvent.keyboard("{Home}");
    expect(focusedDate()).toBe("2026-11-23"); // Monday in German
    await userEvent.keyboard("{End}");
    expect(focusedDate()).toBe("2026-11-29"); // Sunday
  });

  it("Home goes to Sunday in US English", async () => {
    await render(<Harness locale="en-US" defaultValue="2026-11-25" />);
    await openWithButton();
    await userEvent.keyboard("{Home}");
    expect(focusedDate()).toBe("2026-11-22");
    await userEvent.keyboard("{End}");
    expect(focusedDate()).toBe("2026-11-28");
  });

  it("Page Up/Down move by month and clamp to the month end, Shift by year", async () => {
    await render(<Harness defaultValue="2026-01-31" />);
    await openWithButton();
    await userEvent.keyboard("{PageDown}");
    expect(focusedDate()).toBe("2026-02-28");
    expect(heading()).toBe("Februar 2026");
    await userEvent.keyboard("{PageUp}");
    expect(focusedDate()).toBe("2026-01-28");
    await userEvent.keyboard("{Shift>}{PageDown}{/Shift}");
    expect(focusedDate()).toBe("2027-01-28");
    await userEvent.keyboard("{Shift>}{PageUp}{PageUp}{/Shift}");
    expect(focusedDate()).toBe("2025-01-28");
  });

  it("Enter selects, closes and returns focus to the button", async () => {
    const values: (string | null)[] = [];
    await render(<Harness onValue={(v) => values.push(v)} />);
    await openWithButton();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    expect(dialog().open).toBe(false);
    expect(values).toEqual(["2026-11-25"]);
    expect(input().value).toBe("25.11.2026");
    expect(document.activeElement).toBe(button());
  });

  it("Space selects too", async () => {
    const values: (string | null)[] = [];
    await render(<Harness onValue={(v) => values.push(v)} />);
    await openWithButton();
    await userEvent.keyboard("{ArrowDown} ");
    expect(values).toEqual(["2026-11-30"]);
  });

  it("Escape closes without a change and returns focus to the button", async () => {
    const values: (string | null)[] = [];
    await render(<Harness defaultValue="2026-11-27" onValue={(v) => values.push(v)} />);
    await openWithButton();
    await userEvent.keyboard("{ArrowRight}{Escape}");
    expect(dialog().open).toBe(false);
    expect(values).toEqual([]);
    expect(input().value).toBe("27.11.2026");
    expect(document.activeElement).toBe(button());
  });

  it("Tab and Shift+Tab stay inside the dialog", async () => {
    const screen = await render(<Harness />);
    await openWithButton();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button", { name: "Previous month" })).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button", { name: "Next month" })).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    expect(focusedDate()).toBe(TODAY);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.element(screen.getByRole("button", { name: "Next month" })).toHaveFocus();
  });

  it("the month buttons change the month, the live heading says which", async () => {
    const screen = await render(<Harness />);
    await openWithButton();
    expect(dialog().querySelector("h2")!.getAttribute("aria-live")).toBe("polite");
    await screen.getByRole("button", { name: "Next month" }).click();
    expect(heading()).toBe("Dezember 2026");
    await screen.getByRole("button", { name: "Previous month" }).click();
    await screen.getByRole("button", { name: "Previous month" }).click();
    expect(heading()).toBe("Oktober 2026");
  });
});

describe("DatePicker limits", () => {
  const weekends = (iso: string) => [0, 6].includes(dayOfWeek(parseISODate(iso)!));

  it("keeps the focus within min and max and disables month buttons at the limits", async () => {
    const screen = await render(<Harness min="2026-11-16" max="2026-12-11" />);
    await openWithButton();
    await expect.element(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    await userEvent.keyboard("{PageUp}");
    expect(focusedDate()).toBe("2026-11-16");
    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(focusedDate()).toBe("2026-12-11");
    await expect.element(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("shows unavailable days as disabled and does not select them", async () => {
    const values: (string | null)[] = [];
    await render(<Harness isDateUnavailable={weekends} onValue={(v) => values.push(v)} />);
    await openWithButton();
    await userEvent.keyboard("{End}"); // Sunday
    expect(document.activeElement?.getAttribute("aria-disabled")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(dialog().open).toBe(true);
    expect(values).toEqual([]);
  });
});

describe("DatePicker typing", () => {
  it("accepts the locale format and ISO, and normalises the text", async () => {
    const values: (string | null)[] = [];
    await render(<Harness onValue={(v) => values.push(v)} />);
    await userEvent.keyboard("{Tab}{Tab}23/11/26{Tab}");
    expect(values).toEqual(["2026-11-23"]);
    expect(input().value).toBe("23.11.2026");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{Control>}a{/Control}2026-12-01{Enter}");
    expect(values.at(-1)).toBe("2026-12-01");
    expect(input().value).toBe("01.12.2026");
  });

  it("reads US English month/day/year", async () => {
    const values: (string | null)[] = [];
    await render(<Harness locale="en-US" onValue={(v) => values.push(v)} />);
    expect(input().placeholder).toBe("MM/DD/YYYY");
    await userEvent.keyboard("{Tab}{Tab}11/23/2026{Tab}");
    expect(values).toEqual(["2026-11-23"]);
  });

  it("reports text that is not a date, and keeps the value", async () => {
    const screen = await render(<Harness defaultValue="2026-11-27" />);
    await userEvent.keyboard("{Tab}{Tab}{Control>}a{/Control}31.02.2026{Tab}");
    expect(input().getAttribute("aria-invalid")).toBe("true");
    await expect.element(screen.getByText("Enter a date as DD.MM.YYYY.")).toBeVisible();
    await expect
      .element(screen.getByRole("textbox"))
      .toHaveAccessibleDescription("Format: DD.MM.YYYY Enter a date as DD.MM.YYYY.");
    expect(input().form).toBeNull();
    expect(input().validationMessage).toBe("Enter a date as DD.MM.YYYY.");
  });

  it("reports dates outside the range or unavailable", async () => {
    const screen = await render(
      <Harness
        min="2026-11-16"
        max="2026-12-11"
        isDateUnavailable={(iso) => iso === "2026-11-25"}
      />,
    );
    await userEvent.keyboard("{Tab}{Tab}01.01.2027{Tab}");
    await expect
      .element(screen.getByText("Choose a date between 16.11.2026 and 11.12.2026."))
      .toBeVisible();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}{Control>}a{/Control}25.11.2026{Tab}");
    await expect.element(screen.getByText("This date is not available.")).toBeVisible();
  });

  it("an empty field clears the value", async () => {
    const values: (string | null)[] = [];
    await render(<Harness defaultValue="2026-11-27" onValue={(v) => values.push(v)} />);
    await userEvent.keyboard("{Tab}{Tab}{Control>}a{/Control}{Backspace}{Tab}");
    expect(values).toEqual([null]);
  });
});

describe("DatePicker pointer", () => {
  it("a click on a day selects it", async () => {
    const values: (string | null)[] = [];
    const screen = await render(<Harness onValue={(v) => values.push(v)} />);
    await screen.getByRole("button", { name: "Choose date" }).click();
    await screen.getByRole("gridcell", { name: "Freitag, 27. November 2026" }).click();
    expect(values).toEqual(["2026-11-27"]);
    expect(dialog().open).toBe(false);
  });
});

describe("DatePicker in forms", () => {
  function Form(): JSX.Element {
    return (
      <form onSubmit={(event) => event.preventDefault()}>
        <DatePicker
          label="Day"
          locale="de-DE"
          today={TODAY}
          name="day"
          required
          defaultValue="2026-11-30"
        />
        <button type="reset">Reset</button>
      </form>
    );
  }

  it("submits the ISO date under its name", async () => {
    await render(<Form />);
    const data = Object.fromEntries(new FormData(input().form!));
    expect(data).toEqual({ day: "2026-11-30" });
  });

  it("is invalid while required and empty (checked without the native bubble)", async () => {
    await render(<Form />);
    await userEvent.keyboard("{Tab}{Control>}a{/Control}{Backspace}{Tab}");
    expect(input().form!.checkValidity()).toBe(false);
    expect(input().validationMessage).toBe("Enter a date.");
  });

  it("form reset restores the default value", async () => {
    const screen = await render(<Form />);
    await userEvent.keyboard("{Tab}{Control>}a{/Control}01.12.2026{Tab}");
    expect(input().value).toBe("01.12.2026");
    await screen.getByRole("button", { name: "Reset" }).click();
    await expect.poll(() => input().value).toBe("30.11.2026");
    expect(Object.fromEntries(new FormData(input().form!))).toEqual({ day: "2026-11-30" });
  });
});

describe("DatePicker controlled", () => {
  it("shows a value set from outside", async () => {
    function Controlled(): JSX.Element {
      const [value, setValue] = useState<string | null>("2026-11-27");
      return (
        <>
          <button type="button" onClick={() => setValue("2026-12-24")}>
            Christmas Eve
          </button>
          <DatePicker label="Day" locale="de-DE" today={TODAY} value={value} onChange={setValue} />
        </>
      );
    }
    const screen = await render(<Controlled />);
    expect(input().value).toBe("27.11.2026");
    await screen.getByRole("button", { name: "Christmas Eve" }).click();
    await expect.poll(() => input().value).toBe("24.12.2026");
  });
});
