import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Coins, Search, Moon, Sun, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyWallet } from "@/lib/wallet.functions";
import { listMyNotifications } from "@/lib/notifications.functions";
import { LAST_SEEN_KEY } from "@/lib/notifications-seen";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useTheme } from "@/lib/theme";
import { useLang, LANGS } from "@/lib/i18n";

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

  const fetchNotifications = useServerFn(listMyNotifications);
  const { data: notif } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  useEffect(() => {
    setLastSeen(localStorage.getItem(LAST_SEEN_KEY));
  }, [notif]);
  const unread = (notif?.items ?? []).filter(
    (n) => !lastSeen || new Date(n.created_at).getTime() > new Date(lastSeen).getTime(),
  ).length;

  const { theme, toggle } = useTheme();
  const { lang, setLang } = useLang();

  const initials = (user?.email ?? "P").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 glass">
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
        <Link to="/" className="press flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground font-black shadow-glow">
            G
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold tracking-tight">Guru-G</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Learn everything · Win too</div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to="/wallet"
            aria-label="Wallet balance"
            className="press flex items-center gap-1.5 rounded-full bg-gradient-gold px-3 py-1.5 text-sm font-black text-amber-950 shadow-soft"
          >
            <Coins className="h-3.5 w-3.5" />
            ₹{balance.toFixed(0)}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="press flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/70"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            aria-label="Change language"
            className="press flex h-9 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-bold text-foreground hover:bg-muted/70"
          >
            <Globe className="h-3.5 w-3.5" />
            {LANGS.find((l) => l.code === lang)?.code.toUpperCase()}
          </button>
          <Link
            to="/search"
            aria-label="Search"
            className="press flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/70"
          >
            <Search className="h-4 w-4" />
          </Link>
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="press relative flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/70"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            to="/profile"
            aria-label="Profile"
            className="press flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-black text-primary-foreground shadow-soft"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}
