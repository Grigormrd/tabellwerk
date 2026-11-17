// Server rendering: components must render without `window` or `document`.
import type { JSX } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveAnnouncer, useAnnouncer, VisuallyHidden } from "./index.ts";

describe("server rendering", () => {
  it("runs in an environment without a DOM", () => {
    expect(typeof document).toBe("undefined");
  });

  it("renders the live regions empty, so they exist before the first message", () => {
    const html = renderToString(
      <LiveAnnouncer>
        <p>content</p>
      </LiveAnnouncer>,
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toMatch(/data-tbw-live="polite"><\/div>/);
  });

  it("renders VisuallyHidden with inline styles and merges custom styles", () => {
    const html = renderToString(<VisuallyHidden style={{ color: "red" }}>Label</VisuallyHidden>);
    expect(html).toContain("position:absolute");
    expect(html).toContain("color:red");
    expect(html).toContain(">Label</span>");
  });

  it("explains a missing provider", () => {
    function Orphan(): JSX.Element {
      useAnnouncer();
      return <p />;
    }
    expect(() => renderToString(<Orphan />)).toThrow(/inside a <LiveAnnouncer>/);
  });
});
