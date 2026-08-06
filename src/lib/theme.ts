import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "cwl_theme";

function apply(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
}

/** Light/dark theme with localStorage persistence (hydration-safe). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as Theme | null;
    const initial: Theme =
      stored ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    apply(initial);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
