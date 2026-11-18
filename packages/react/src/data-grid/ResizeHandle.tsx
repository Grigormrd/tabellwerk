import { useRef, type JSX, type KeyboardEvent, type PointerEvent } from "react";

export interface ResizeHandleProps {
  label: string;
  valueText: string;
  width: number;
  min: number;
  max: number;
  /** Called with the requested width; the caller clamps it. */
  onResize: (width: number) => void;
  /** Fit the column to its content (double click, Enter). */
  onFit: () => void;
}

const STEP = 8;
const LARGE_STEP = 32;

/**
 * The resize handle at the right edge of a header cell: a focusable
 * separator with a value (WAI-ARIA "window splitter" semantics). Pointer
 * drags work with mouse, pen and touch; the keyboard changes the width in
 * steps, Home/End jump to the limits, Enter fits the content.
 */
export function ResizeHandle({
  label,
  valueText,
  width,
  min,
  max,
  onResize,
  onFit,
}: ResizeHandleProps): JSX.Element {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // No text selection or scrolling while dragging; focus the handle so the
    // keyboard continues where the pointer left off.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    onResize(Math.round(current.startWidth + event.clientX - current.startX));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? LARGE_STEP : STEP;
    const next =
      event.key === "ArrowLeft"
        ? width - step
        : event.key === "ArrowRight"
          ? width + step
          : event.key === "Home"
            ? min
            : event.key === "End"
              ? max
              : null;
    if (next !== null) {
      event.preventDefault();
      onResize(next);
      // Keep the focused handle in view when the column grows past the edge.
      const handle = event.currentTarget;
      requestAnimationFrame(() => handle.scrollIntoView({ block: "nearest", inline: "nearest" }));
    } else if (event.key === "Enter") {
      event.preventDefault();
      onFit();
    }
  };

  return (
    // A focusable separator with a value is an interactive widget in ARIA
    // (the window splitter pattern); jsx-a11y treats every separator as static.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueText}
      tabIndex={-1}
      className="tbw-grid__resize"
      data-tbw-inner=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onFit}
      onKeyDown={onKeyDown}
    />
  );
}
