import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { VisuallyHidden } from "./VisuallyHidden.tsx";

const meta = {
  title: "Utilities/VisuallyHidden",
  component: VisuallyHidden,
  args: { children: "Close dialog" },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An icon-only button gets its accessible name from hidden text. */
export const IconButton: Story = {
  render: (args) => (
    <button type="button" className="story-icon-button">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
      </svg>
      <VisuallyHidden {...args} />
    </button>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Close dialog" });
    await expect(button).toBeInTheDocument();
    const hidden = within(button).getByText("Close dialog");
    await expect(hidden.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  },
};
