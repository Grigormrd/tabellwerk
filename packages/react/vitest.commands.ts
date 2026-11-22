// Browser commands for pointer gestures that a test inside the page cannot
// produce itself: synthetic PointerEvents have no active pointer, so
// setPointerCapture() would throw. These run on the Playwright side and send
// real mouse and touch input through the browser.

import type { BrowserCommand } from "vitest/node";

export interface DragOptions {
  /** Start point, relative to the test frame's viewport (getBoundingClientRect). */
  x: number;
  y: number;
  /** Horizontal distance to move. */
  dx: number;
  pointer: "mouse" | "touch";
  steps?: number;
}

async function frameOffset(context: Parameters<BrowserCommand>[0]) {
  const frame = await context.frame();
  const box = await (await frame.frameElement()).boundingBox();
  if (!box) throw new Error("The test frame has no layout box.");
  return box;
}

export const pointerDrag: BrowserCommand<[DragOptions]> = async (context, options) => {
  const { x, y, dx, pointer, steps = 8 } = options;
  const box = await frameOffset(context);
  const px = box.x + x;
  const py = box.y + y;
  const { page } = context;

  if (pointer === "mouse") {
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + dx, py, { steps });
    await page.mouse.up();
    return;
  }

  // Touch through the DevTools protocol: produces pointerType "touch".
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", tx: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: tx, y: py, id: 1 }],
    });
  await touch("touchStart", px);
  for (let i = 1; i <= steps; i++) await touch("touchMove", px + (dx * i) / steps);
  await touch("touchEnd", px + dx);
  await cdp.detach();
};

export const pointerDoubleClick: BrowserCommand<[{ x: number; y: number }]> = async (
  context,
  { x, y },
) => {
  const box = await frameOffset(context);
  await context.page.mouse.dblclick(box.x + x, box.y + y);
};

/**
 * IME input in Chromium through the DevTools protocol, like typing Japanese
 * with an input method: each step updates the uncommitted composition text
 * (compositionstart/update, input events with isComposing), then the final
 * text is committed (compositionend).
 */
export const imeCompose: BrowserCommand<[{ steps: string[]; commit: string }]> = async (
  context,
  { steps, commit },
) => {
  const cdp = await context.page.context().newCDPSession(context.page);
  for (const text of steps) {
    await cdp.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  }
  await cdp.send("Input.insertText", { text: commit });
  await cdp.detach();
};

/** Starts a composition and leaves it open (for checks during composition). */
export const imeStart: BrowserCommand<[{ text: string }]> = async (context, { text }) => {
  const cdp = await context.page.context().newCDPSession(context.page);
  await cdp.send("Input.imeSetComposition", {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await cdp.detach();
};

declare module "vitest/browser" {
  interface BrowserCommands {
    pointerDrag: (options: DragOptions) => Promise<void>;
    pointerDoubleClick: (options: { x: number; y: number }) => Promise<void>;
    imeCompose: (options: { steps: string[]; commit: string }) => Promise<void>;
    imeStart: (options: { text: string }) => Promise<void>;
  }
}
