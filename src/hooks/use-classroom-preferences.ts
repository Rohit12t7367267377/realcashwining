import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useUser } from "@/lib/user-store";
import { loadClassroomPreferences, saveClassroomPreferences } from "@/lib/classroom-preferences.functions";
import { DEFAULT_CLASSROOM_PREFERENCES, parseClassroomPreferences, type ClassroomPreferences } from "@/lib/classroom-preferences";

const GUEST_KEY = "guru-guest-classroom-preferences";
export function useClassroomPreferences() {
  const { state } = useUser();
  const load = useServerFn(loadClassroomPreferences);
  const save = useServerFn(saveClassroomPreferences);
  const [preferences, setPreferences] = useState<ClassroomPreferences>(DEFAULT_CLASSROOM_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setPreferences(DEFAULT_CLASSROOM_PREFERENCES);
    setError(null);
    if (state.loggedIn) {
      void load().then((data) => { if (!cancelled) setPreferences(data); })
        .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not restore board settings"); })
        .finally(() => { if (!cancelled) setReady(true); });
    } else {
      try { setPreferences(parseClassroomPreferences(JSON.parse(localStorage.getItem(GUEST_KEY) ?? "{}"))); }
      catch { setPreferences(DEFAULT_CLASSROOM_PREFERENCES); }
      setReady(true);
    }
    return () => { cancelled = true; };
  }, [state.loggedIn, load]);

  async function apply(next: ClassroomPreferences) {
    // Optimistic: the board/teacher change is instant; it reverts (and the caller sees the error) if saving fails.
    const previous = preferences;
    setPreferences(next);
    try {
      if (state.loggedIn) await save({ data: next });
      else localStorage.setItem(GUEST_KEY, JSON.stringify(next));
      setError(null);
    } catch (err) {
      setPreferences(previous);
      throw err;
    }
  }
  return { preferences, apply, error, ready };
}