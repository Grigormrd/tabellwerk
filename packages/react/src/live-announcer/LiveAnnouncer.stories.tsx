import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type JSX } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { LiveAnnouncer, useAnnouncer } from "./LiveAnnouncer.tsx";

function SortDemo(): JSX.Element {
  const announce = useAnnouncer();
  const [ascending, setAscending] = useState(true);
  return (
    <button
      type="button"
      className="story-button"
      onClick={() => {
        const next = !ascending;
        setAscending(next);
        announce(`Sorted by price, ${next ? "ascending" : "descending"}`);
      }}
    >
      Sort by price ({ascending ? "ascending" : "descending"})
    </button>
  );
}

const meta = {
  title: "Utilities/LiveAnnouncer",
  component: LiveAnnouncer,
  args: { delay: 100, clearAfter: 7000 },
} satisfies Meta<typeof LiveAnnouncer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Activating the button announces the new sort order. The live regions are
 * visually hidden; the message is shown below for sighted readers of the docs.
 */
export const Announcing: Story = {
  render: (args) => (
    <LiveAnnouncer {...args}>
      <SortDemo />
    </LiveAnnouncer>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvasElement.querySelector('[data-tbw-live="polite"]');
    await expect(region).toHaveAttribute("aria-live", "polite");
    await userEvent.click(canvas.getByRole("button"));
    await waitFor(() => expect(region).toHaveTextContent("Sorted by price, descending"));
  },
};
