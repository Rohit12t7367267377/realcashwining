import { Link } from "@tanstack/react-router";
import { Bell, Coins } from "lucide-react";
import { useUser } from "@/lib/user-store";

export function AppHeader() {
  const { state } = useUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground font-black shadow-glow">
            ₹
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">Cash Winning</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">League</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/wallet"
            className="flex items-center gap-1.5 rounded-full bg-gradient-gold px-3 py-1.5 text-sm font-bold text-amber-950 shadow-soft"
          >
            <Coins className="h-3.5 w-3.5" />
            ₹{state.loggedIn ? state.wallet.toFixed(0) : "0"}
          </Link>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/70">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
