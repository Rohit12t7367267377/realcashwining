import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/hooks/use-push";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DISMISS_KEY = "cwl_push_prompt_dismissed";

/** Asks for notification permission shortly after launch (signed-in users only). */
export function PushPrompt() {
  const { status, busy, enable } = usePush();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (typeof window === "undefined") return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (!("Notification" in window) || Notification.permission !== "default") return;
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) setShow(true);
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!show || status === "unsupported") return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 md:left-auto md:right-4 md:w-80">
      <div className="rounded-2xl border bg-card/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Turn on notifications</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Get alerts for new contests, live matches, results and rewards.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="h-8"
                disabled={busy}
                onClick={async () => {
                  const ok = await enable();
                  setShow(false);
                  localStorage.setItem(DISMISS_KEY, "1");
                  toast[ok ? "success" : "message"](
                    ok ? "Notifications enabled" : "You can enable notifications later from Settings",
                  );
                }}
              >
                {busy ? "Enabling…" : "Allow"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => {
                  localStorage.setItem(DISMISS_KEY, "1");
                  setShow(false);
                }}
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setShow(false);
            }}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
