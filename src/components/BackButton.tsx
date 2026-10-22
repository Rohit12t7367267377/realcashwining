import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one Back control for the whole app. Goes to the previous screen in this app; if there is none
 * (deep link, new tab, installed app start) it goes to the home page. Hidden on the home page itself.
 */
export function BackButton({ className, fallback = "/" }: { className?: string; fallback?: string }) {
  const router = useRouter();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/") return null;
  function back() {
    const canGoBack = typeof window !== "undefined" && window.history.length > 1 && (window.history.state?.__TSR_index ?? 1) > 0;
    if (canGoBack) router.history.back();
    else void navigate({ to: fallback });
  }
  return (
    <button
      type="button"
      onClick={back}
      aria-label="Go back"
      title="Back"
      className={cn(
        "press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <ArrowLeft className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
