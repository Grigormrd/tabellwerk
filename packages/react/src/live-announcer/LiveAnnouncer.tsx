import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { visuallyHiddenStyle } from "../visually-hidden/VisuallyHidden.tsx";

/** How urgently a screen reader should speak a message. */
export type Politeness = "polite" | "assertive";

/** Options for a single announcement. */
export interface AnnounceOptions {
  /**
   * `polite` (default) waits until the screen reader is idle; `assertive`
   * interrupts. Use `assertive` only for errors the user must hear at once.
   */
  politeness?: Politeness;
}

/** Sends `message` to screen readers. Returned by {@link useAnnouncer}. */
export type Announce = (message: string, options?: AnnounceOptions) => void;

/** Props of {@link LiveAnnouncer}. */
export interface LiveAnnouncerProps {
  /** The part of the application that may call {@link useAnnouncer}. */
  children?: ReactNode;
  /**
   * Delay before a message is written into the live region, in milliseconds.
   * The region is emptied first, so that repeating the same message (for
   * example "Sorted ascending" twice) is announced again.
   */
  delay?: number;
  /** Time after which an announced message is removed again, in milliseconds. */
  clearAfter?: number;
}

const AnnouncerContext = createContext<Announce | null>(null);

const EMPTY = { polite: "", assertive: "" } satisfies Record<Politeness, string>;

/**
 * Provides `useAnnouncer()` to its children and renders two visually hidden
 * live regions (polite and assertive). The regions exist from the first
 * render on, because screen readers ignore live regions that are inserted
 * together with their content.
 */
export function LiveAnnouncer({
  children,
  delay = 100,
  clearAfter = 7000,
}: LiveAnnouncerProps): JSX.Element {
  const [messages, setMessages] = useState<Record<Politeness, string>>(EMPTY);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  }, []);

  const announce = useCallback<Announce>(
    (message, { politeness = "polite" } = {}) => {
      setMessages((current) => ({ ...current, [politeness]: "" }));
      schedule(() => {
        setMessages((current) => ({ ...current, [politeness]: message }));
        schedule(
          () =>
            setMessages((current) =>
              current[politeness] === message ? { ...current, [politeness]: "" } : current,
            ),
          clearAfter,
        );
      }, delay);
    },
    [schedule, delay, clearAfter],
  );

  return (
    <AnnouncerContext value={announce}>
      {children}
      <div style={visuallyHiddenStyle}>
        <div aria-live="polite" aria-atomic="true" data-tbw-live="polite">
          {messages.polite}
        </div>
        <div aria-live="assertive" aria-atomic="true" data-tbw-live="assertive">
          {messages.assertive}
        </div>
      </div>
    </AnnouncerContext>
  );
}

/**
 * Returns a function that sends a message to screen readers through the
 * nearest `<LiveAnnouncer>`.
 *
 * @example
 * ```tsx
 * const announce = useAnnouncer();
 * announce(`${rows.length} rows match the filter`);
 * ```
 */
export function useAnnouncer(): Announce {
  const announce = useContext(AnnouncerContext);
  if (!announce) {
    throw new Error("useAnnouncer() must be called inside a <LiveAnnouncer>.");
  }
  return announce;
}
