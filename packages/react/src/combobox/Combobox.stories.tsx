import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type FormEvent } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Combobox } from "./Combobox.tsx";
import { biddingZones, cities, fakeLoadZones, stations, zones } from "./stories/data.ts";

const meta = {
  title: "Components/Combobox",
  component: Combobox,
  tags: ["!autodocs"],
  parameters: { layout: "padded" },
  args: { label: "Bidding zone", options: zones, style: { maxWidth: 320 } },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const openList = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const input = within(canvasElement).getByRole("combobox");
  await userEvent.click(input);
  await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
};

/** Type to filter, Down Arrow to open the list, Enter to select. */
export const Basic: Story = {};

/** The list, open. */
export const Open: Story = { play: openList };

/** Typing "ger" shows only the matching zone. */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "ger");
    await waitFor(() =>
      expect(
        within(document.body)
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual(["Germany-Luxembourg"]),
    );
  },
};

/**
 * `autocomplete="both"`: the first match is completed in the input. The
 * completed part is selected, so typing on replaces it.
 */
export const InlineAutocomplete: Story = {
  args: { autocomplete: "both", label: "City", options: cities },
};

/** Matching ignores case and diacritics: "zurich" finds "Zürich", "lodz" finds "Łódź". */
export const AccentInsensitive: Story = {
  args: { label: "City", options: cities },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "zurich");
    await waitFor(() =>
      expect(within(document.body).getByRole("option")).toHaveTextContent("Zürich"),
    );
  },
};

/** Options with a `group` are listed under group headings (`role="group"`). */
export const Groups: Story = {
  args: { options: biddingZones },
  play: openList,
};

/** 5,000 options: only those in view are rendered; each has `aria-setsize` and `aria-posinset`. */
export const LongList: Story = {
  args: { label: "Measuring station", options: stations },
  play: openList,
};

/** `loadOptions` fetches options for the typed text (here a fake server with 600 ms delay). */
export const Async: Story = {
  args: { label: "Bidding zone (server)", loadOptions: fakeLoadZones() },
};

/** While loading, the list says so. */
export const AsyncLoading: Story = {
  args: { label: "Bidding zone (server)", loadOptions: fakeLoadZones(60_000) },
  play: openList,
};

/** When `loadOptions` fails, the list says so (type "error" in the async story). */
export const AsyncError: Story = {
  args: {
    label: "Bidding zone (server)",

    loadOptions: () => Promise.reject(new Error("Server error")),
    loadDelay: 0,
  },
  play: openList,
};

/** `multiple`: selected values become chips; Backspace in the empty input removes the last. */
export const Multiple: Story = {
  args: { multiple: true, label: "Bidding zones", defaultValue: ["DE-LU", "FR"] },
};

/** Help text and an error message, both linked with `aria-describedby`. */
export const WithError: Story = {
  args: {
    description: "The zone whose prices the chart shows.",
    error: "Choose a bidding zone.",
    required: true,
  },
};

/** Disabled. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "FR" },
};

/** In a form: `name` submits the value, `required` blocks submission, reset restores the default. */
export const InForm: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string>("nothing yet");
    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitted(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
    };
    return (
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 320 }}>
        <Combobox label="Bidding zone" options={zones} name="zone" required defaultValue="DE-LU" />
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
