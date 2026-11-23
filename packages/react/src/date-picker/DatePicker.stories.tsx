import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type FormEvent } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Calendar } from "./Calendar.tsx";
import { DatePicker } from "./DatePicker.tsx";
import { dayOfWeek, parseISODate } from "./plain-date.ts";

// A fixed "today" keeps stories and screenshots the same on every day.
const TODAY = "2026-11-23";

const meta = {
  title: "Components/DatePicker",
  component: DatePicker,
  tags: ["!autodocs"],
  parameters: { layout: "padded" },
  args: { label: "Delivery day", locale: "en-GB", today: TODAY, style: { maxWidth: 280 } },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const openCalendar = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const button = within(canvasElement).getByRole("button", { name: /date/i });
  await userEvent.click(button);
  await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
};

/** Type a date, or open the calendar with the button (or Alt+Down Arrow in the field). */
export const Basic: Story = {};

/** The calendar, open on today. */
export const Open: Story = { play: openCalendar };

/** German: day.month.year, weeks start on Monday, German names. */
export const German: Story = {
  args: { label: "Liefertag", locale: "de-DE", defaultValue: "2026-11-27" },
  play: openCalendar,
};

/** US English: month/day/year, weeks start on Sunday. */
export const USEnglish: Story = {
  args: { label: "Delivery day", locale: "en-US", defaultValue: "2026-11-27" },
  play: openCalendar,
};

const isWeekend = (iso: string) => {
  const date = parseISODate(iso);
  return date ? [0, 6].includes(dayOfWeek(date)) : false;
};

/**
 * `min` and `max` limit the range; `isDateUnavailable` blocks single days
 * (here weekends). Blocked days are shown but cannot be chosen.
 */
export const Limits: Story = {
  args: {
    min: "2026-11-16",
    max: "2026-12-11",
    isDateUnavailable: isWeekend,
    description: "Weekdays from 16 November to 11 December.",
  },
  play: openCalendar,
};

/** Typed text that is not a date is reported, with the expected format. */
export const InvalidInput: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await userEvent.type(input, "31/02/2026");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
  },
};

/** An error from your own validation. */
export const WithError: Story = {
  args: { error: "Choose a day in the next two weeks.", defaultValue: "2027-03-01" },
};

/** Disabled. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: TODAY },
};

/** In a form: `name` submits the ISO date, `required` blocks submission, reset restores the default. */
export const InForm: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState("nothing yet");
    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitted(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
    };
    return (
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 280 }}>
        <DatePicker
          label="Delivery day"
          locale="en-GB"
          today={TODAY}
          name="day"
          required
          defaultValue="2026-11-30"
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="story-button">
            Submit
          </button>
          <button type="reset" className="story-button">
            Reset
          </button>
        </div>
        <p style={{ margin: 0 }}>
          Submitted: <output>{submitted}</output>
        </p>
      </form>
    );
  },
};

/** `Calendar` on its own: an always visible month grid with the same keyboard support. */
export const InlineCalendar: StoryObj<typeof Calendar> = {
  render: () => {
    const [value, setValue] = useState<string | null>("2026-11-25");
    return (
      <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
        <Calendar locale="en-GB" today={TODAY} value={value} onChange={setValue} />
        <p style={{ margin: 0 }}>
          Selected: <output>{value}</output>
        </p>
      </div>
    );
  },
};
