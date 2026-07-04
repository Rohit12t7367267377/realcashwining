import { Link } from "@tanstack/react-router";
import { Bell, Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyWallet } from "@/lib/wallet.functions";
import { useAuthSession } from "@/hooks/use-auth-session";

export function AppHeader() {
  const { user } = useAuthSession();
  const fetchWallet = useServerFn(getMyWallet);
  const { data } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => fetchWallet(),
    enabled: !!user,
    staleTime: 15_000,
  });
  const balance = user && data ? Number(data.balance || 0) : 0;

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
            ₹{balance.toFixed(0)}
          </Link>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/70">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
