import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Megaphone, Trophy, Wallet, Gift, Target, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { listMyNotifications, type AppNotification } from "@/lib/notifications.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { LAST_SEEN_KEY } from "@/lib/notifications-seen";

export const Route = createFileRoute("/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications — Guru-G" },
      { name: "description", content: "Contest results, wallet updates, rewards and announcements in one place." },
      { property: "og:title", content: "Your Notifications" },
      { property: "og:description", content: "Results, wallet activity, rewards and announcements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<AppNotification["kind"], any> = {
  broadcast: Megaphone,
  result: Trophy,
  wallet: Wallet,
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  reward: Gift,
  mission: Target,
};

function NotificationsPage() {
  const { user } = useAuthSession();
  const fetchNotifications = useServerFn(listMyNotifications);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
    staleTime: 20_000,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  useEffect(() => {
    if (items.length) localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }, [items.length]);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Bell className="h-5 w-5 text-primary" /> Notifications
          </h1>
          <p className="text-xs text-muted-foreground">Results, wallet activity, rewards and announcements.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>Refresh</Button>
      </div>

      {!user && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your notifications.
        </Card>
      )}

      {user && isLoading && <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>}

      {user && !isLoading && !items.length && (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nothing here yet. Play a contest to get started.</Card>
      )}

      <div className="space-y-2">
        {items.map((n) => {
          const Icon = ICONS[n.kind] ?? Bell;
          const inner = (
            <Card className="flex items-start gap-3 p-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            </Card>
          );
          return n.link ? (
            <Link key={n.id} to={n.link} className="block">{inner}</Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </div>
    </AppShell>
  );
}
