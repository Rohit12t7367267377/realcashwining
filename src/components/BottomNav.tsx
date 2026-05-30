import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Wallet, Gift, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/refer", label: "Refer", icon: Gift },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const { location } = useRouterState();
  const path = location.pathname;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-all",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                    active && "bg-gradient-primary text-primary-foreground shadow-glow scale-110"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" size={18} />
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
