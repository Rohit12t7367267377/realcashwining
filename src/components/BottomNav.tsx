import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Sparkles, Gem, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home, center: false },
  { to: "/leaderboard", label: "Ranks", icon: Trophy, center: false },
  { to: "/guru", label: "Guru.AI", icon: Sparkles, center: true },
  { to: "/hub", label: "Elite Hub", icon: Gem, center: false },
  { to: "/profile", label: "Profile", icon: User, center: false },
] as const;


export function BottomNav() {
  const { location } = useRouterState();
  const path = location.pathname;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 glass">
      <ul className="mx-auto flex max-w-2xl items-end justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ to, label, icon: Icon, center }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          if (center) {
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  aria-label={label}
                  className="press flex flex-col items-center justify-center gap-1 -mt-6"
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow ring-4 ring-background",
                      active && "animate-pulse-ring",
                    )}
                  >
                    <Icon size={22} />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          }
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-label={label}
                className={cn(
                  "press flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                    active && "bg-primary/12 text-primary scale-105",
                  )}
                >
                  <Icon size={18} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
