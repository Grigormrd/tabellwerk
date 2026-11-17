import type { ComponentPropsWithRef, CSSProperties, JSX } from "react";

/**
 * Styles that hide content visually while keeping it in the accessibility tree.
 * Exported for components that need the same effect on their own elements.
 */
export const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

/** Props of {@link VisuallyHidden}: everything a `<span>` accepts, including `ref`. */
export type VisuallyHiddenProps = ComponentPropsWithRef<"span">;

/**
 * Renders content for assistive technology only, for example a label that is
 * obvious from the visual layout but would otherwise be missing for screen
 * reader users.
 *
 * @example
 * ```tsx
 * <button>
 *   <SortIcon aria-hidden />
 *   <VisuallyHidden>Sort by price</VisuallyHidden>
 * </button>
 * ```
 */
export function VisuallyHidden({ style, ...props }: VisuallyHiddenProps): JSX.Element {
  return <span {...props} style={{ ...visuallyHiddenStyle, ...style }} />;
}
