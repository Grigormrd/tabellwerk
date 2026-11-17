import { composeStories } from "@storybook/react-vite";
import { useEffect, type JSX } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { LiveAnnouncer, useAnnouncer } from "./LiveAnnouncer.tsx";
import * as stories from "./LiveAnnouncer.stories.tsx";

const { Announcing } = composeStories(stories);

const politeRegion = () => document.querySelector('[data-tbw-live="polite"]');
const assertiveRegion = () => document.querySelector('[data-tbw-live="assertive"]');

describe("LiveAnnouncer", () => {
  it("announces after keyboard activation", async () => {
    const screen = await render(<Announcing />);

    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("button")).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect.poll(() => politeRegion()?.textContent).toBe("Sorted by price, descending");

    await userEvent.keyboard(" ");
    await expect.poll(() => politeRegion()?.textContent).toBe("Sorted by price, ascending");
  });

  it("empties the region before repeating the same message", async () => {
    const seen: string[] = [];
    function Repeat(): JSX.Element {
      const announce = useAnnouncer();
      return (
        <button type="button" onClick={() => announce("Saved")}>
          Save
        </button>
      );
    }
    const screen = await render(
      <LiveAnnouncer delay={50}>
        <Repeat />
      </LiveAnnouncer>,
    );
    const observer = new MutationObserver(() => seen.push(politeRegion()?.textContent ?? ""));
    observer.observe(politeRegion()!, { childList: true, subtree: true, characterData: true });

    await screen.getByRole("button").click();
    await expect.poll(() => politeRegion()?.textContent).toBe("Saved");
    await screen.getByRole("button").click();
    await expect.poll(() => seen.filter((text) => text === "Saved").length).toBe(2);
    observer.disconnect();

    expect(seen).toContain("");
  });

  it("routes assertive messages to the assertive region", async () => {
    function Alert(): JSX.Element {
      const announce = useAnnouncer();
      useEffect(() => announce("Connection lost", { politeness: "assertive" }), [announce]);
      return <p>content</p>;
    }
    await render(
      <LiveAnnouncer delay={0}>
        <Alert />
      </LiveAnnouncer>,
    );
    await expect.poll(() => assertiveRegion()?.textContent).toBe("Connection lost");
    expect(politeRegion()?.textContent).toBe("");
  });

  it("clears a message after clearAfter", async () => {
    function Once(): JSX.Element {
      const announce = useAnnouncer();
      useEffect(() => announce("3 rows match"), [announce]);
      return <p>content</p>;
    }
    await render(
      <LiveAnnouncer delay={0} clearAfter={100}>
        <Once />
      </LiveAnnouncer>,
    );
    await expect.poll(() => politeRegion()?.textContent).toBe("3 rows match");
    await expect.poll(() => politeRegion()?.textContent).toBe("");
  });
});
