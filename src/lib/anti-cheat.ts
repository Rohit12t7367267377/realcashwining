import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fingerprint(): string {
  if (typeof window === "undefined") return "";
  const s = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(new Date().getTimezoneOffset()),
  ].join("|");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `fp_${Math.abs(h).toString(36)}`;
}

/**
 * Anti-cheat hook:
 * - Inserts a contest_attempts row on mount. If the user already attempted
 *   this contest (unique violation), calls onAlreadyAttempted.
 * - Tracks tab-switch / blur / devtools as violations.
 * - After `maxViolations` triggers, calls onForceSubmit.
 *
 * Skips DB calls when contestId isn't a UUID (e.g. demo contests).
 */
export function useAntiCheat(opts: {
  contestId: string;
  enabled: boolean;
  maxViolations?: number;
  onAlreadyAttempted: () => void;
  onForceSubmit: (reason: string) => void;
}) {
  const { contestId, enabled, onAlreadyAttempted, onForceSubmit } = opts;
  const maxViolations = opts.maxViolations ?? 3;
  const [violations, setViolations] = useState(0);
  const attemptIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  // Register attempt
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      if (!UUID_RE.test(contestId)) return; // local demo contest – no DB tracking
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data, error } = await supabase
        .from("contest_attempts")
        .insert({
          user_id: auth.user.id,
          contest_id: contestId,
          device_fingerprint: fingerprint(),
          status: "in_progress",
        })
        .select("id")
        .single();
      if (error) {
        // unique violation = already attempted
        if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
          toast.error("You have already attempted this contest.");
          onAlreadyAttempted();
        }
        return;
      }
      attemptIdRef.current = data.id;
    })();
  }, [contestId, enabled, onAlreadyAttempted]);

  // Tab / focus / context-menu violation tracking
  useEffect(() => {
    if (!enabled) return;
    const bump = (reason: string) => {
      setViolations((v) => {
        const n = v + 1;
        if (n >= maxViolations) {
          onForceSubmit(reason);
        } else {
          toast.warning(`Warning ${n}/${maxViolations}: ${reason}`);
        }
        return n;
      });
    };
    const onVis = () => { if (document.hidden) bump("Tab switch detected"); };
    const onBlur = () => bump("Window lost focus");
    const onCtx = (e: MouseEvent) => { e.preventDefault(); bump("Right-click blocked"); };
    const onCopy = (e: Event) => { e.preventDefault(); bump("Copy blocked"); };
    const onKey = (e: KeyboardEvent) => {
      // Block devtools shortcuts
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key))) {
        e.preventDefault();
        bump("DevTools blocked");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("copy", onCopy);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled, maxViolations, onForceSubmit]);

  async function finalize(score: number) {
    const id = attemptIdRef.current;
    if (!id) return;
    await supabase
      .from("contest_attempts")
      .update({ submitted_at: new Date().toISOString(), score, violations, status: "submitted" })
      .eq("id", id);
  }

  return { violations, finalize };
}
