const GAP = 4;
const MARGIN = 8;

/**
 * Positions a fixed (top-layer) popup next to its anchor: below if it fits,
 * otherwise above, and always inside the viewport horizontally. With
 * `matchWidth`, the popup is at least as wide as the anchor.
 */
export function place(popup: HTMLElement, anchor: HTMLElement, matchWidth = false): void {
  const rect = anchor.getBoundingClientRect();
  if (matchWidth) popup.style.minWidth = `${Math.round(rect.width)}px`;
  const width = popup.offsetWidth;
  const height = popup.offsetHeight;
  const left = Math.min(
    Math.max(MARGIN, rect.left),
    Math.max(MARGIN, window.innerWidth - width - MARGIN),
  );
  const below = rect.bottom + GAP;
  const top =
    below + height <= window.innerHeight - MARGIN || rect.top - GAP - height < MARGIN
      ? below
      : rect.top - GAP - height;
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(top)}px`;
}

/**
 * Keeps a popup placed while the page or any scroll container scrolls or the
 * window resizes. Returns a function that stops following.
 */
export function follow(popup: HTMLElement, anchor: HTMLElement, matchWidth = false): () => void {
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => place(popup, anchor, matchWidth));
  };
  window.addEventListener("scroll", update, { capture: true, passive: true });
  window.addEventListener("resize", update);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", update, { capture: true });
    window.removeEventListener("resize", update);
  };
}
