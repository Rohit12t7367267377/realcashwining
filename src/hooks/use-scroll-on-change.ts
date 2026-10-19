import { useEffect, useRef } from "react";

/**
 * When `key` changes (a new step/selection), smoothly bring the right spot into view so the student
 * never has to scroll down to find what they just opened. `pick` returns the element to show; without it
 * the page scrolls to the top. The first render is skipped.
 */
export function useScrollOnChange(key: unknown, pick?: () => Element | null) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = requestAnimationFrame(() => {
      const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
      const el = pick?.();
      if (el) el.scrollIntoView({ behavior, block: "start" });
      else window.scrollTo({ top: 0, behavior });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
