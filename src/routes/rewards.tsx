import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { listMyRewardBoxes, openRewardBox } from "@/lib/gamification.functions";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import { Gift, Share2, Target, Sparkles, Ticket, Medal, Crown } from "lucide-react";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Reward Boxes — Cash Winning League" },
      { name: "description", content: "Open mystery reward boxes earned from level ups and missions." },
      { property: "og:title", content: "Reward Boxes" },
      { property: "og:description", content: "Open mystery boxes for XP and coin rewards." },
    ],
  }),
  component: RewardsPage,
});

const TIER_STYLES: Record<string, string> = {
  common: "from-slate-400 to-slate-600",
  rare: "from-sky-400 to-blue-600",
  epic: "from-fuchsia-400 to-purple-600",
  legendary: "from-amber-400 to-orange-600",
};

function RewardsPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyRewardBoxes);
  const doOpen = useServerFn(openRewardBox);
  const { data: boxes = [] } = useQuery({ queryKey: ["my-reward-boxes"], queryFn: () => fetchList(), enabled: state.loggedIn });

  const open = useMutation({
    mutationFn: (box_id: string) => doOpen({ data: { box_id } }),
    onSuccess: (res) => {
      toast.success(`Opened ${res.tier}: +${res.xp} XP${res.coins ? ` · +₹${res.coins.toFixed(0)}` : ""}`);
      qc.invalidateQueries({ queryKey: ["my-reward-boxes"] });
      qc.invalidateQueries({ queryKey: ["my-xp"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!state.loggedIn) return <AppShell><p className="rounded-2xl bg-card p-4 text-center">Please sign in.</p></AppShell>;

  const unopened = boxes.filter((b) => !b.opened);
  const opened = boxes.filter((b) => b.opened);
  const unopenedCount = unopened.length;
  const openedCount = opened.length;

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Gift className="h-3.5 w-3.5" /> Reward hub
        </div>
        <h1 className="mt-1 text-2xl font-black">Claim your rewards</h1>
        <p className="mt-1 text-sm opacity-90">Boxes, missions, referrals and seasonal events — all in one place.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
            <div className="text-lg font-black">{unopenedCount}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">To open</div>
          </div>
          <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
            <div className="text-lg font-black">{openedCount}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Opened</div>
          </div>
          <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
            <div className="text-lg font-black">{boxes.length}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Total</div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/refer" className="card-lift rounded-2xl bg-gradient-success p-4 text-success-foreground shadow-soft">
          <Share2 className="h-5 w-5" />
          <div className="mt-2 text-sm font-black">Refer &amp; Earn</div>
          <div className="text-[11px] opacity-90">Invite friends, earn cash</div>
        </Link>
        <Link to="/missions" className="card-lift surface p-4">
          <Target className="h-5 w-5 text-primary" />
          <div className="mt-2 text-sm font-black">Missions</div>
          <div className="text-[11px] text-muted-foreground">Daily · weekly · monthly</div>
        </Link>
        <Link to="/events" className="card-lift surface p-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="mt-2 text-sm font-black">Seasonal Events</div>
          <div className="text-[11px] text-muted-foreground">Limited-time rewards</div>
        </Link>
        <Link to="/coupons" className="card-lift surface p-4">
          <Ticket className="h-5 w-5 text-primary" />
          <div className="mt-2 text-sm font-black">Coupons</div>
          <div className="text-[11px] text-muted-foreground">Redeem bonus codes</div>
        </Link>
        <Link to="/hall-of-fame" className="card-lift surface p-4">
          <Medal className="h-5 w-5 text-primary" />
          <div className="mt-2 text-sm font-black">Achievements</div>
          <div className="text-[11px] text-muted-foreground">Badges &amp; hall of fame</div>
        </Link>
        <Link to="/vip" className="card-lift rounded-2xl bg-gradient-gold p-4 text-amber-950 shadow-soft">
          <Crown className="h-5 w-5" />
          <div className="mt-2 text-sm font-black">VIP Perks</div>
          <div className="text-[11px] opacity-80">Extra rewards for members</div>
        </Link>
      </section>


      <section className="mt-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Unopened ({unopened.length})</h2>
        <div className="grid grid-cols-2 gap-3">
          {unopened.length === 0 && (
            <div className="col-span-2 rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
              No boxes yet. Play more contests to earn some!
            </div>
          )}
          {unopened.map((b) => (
            <div key={b.id} className={`rounded-2xl bg-gradient-to-br ${TIER_STYLES[b.tier] ?? TIER_STYLES.common} p-4 text-white shadow-lift`}>
              <Gift className="h-8 w-8" />
              <div className="mt-2 text-sm font-black uppercase">{b.tier}</div>
              <div className="text-[10px] opacity-90">{b.source}</div>
              <Button size="sm" className="mt-3 w-full bg-white text-slate-900 hover:bg-white/90" disabled={open.isPending} onClick={() => open.mutate(b.id)}>
                Open
              </Button>
            </div>
          ))}
        </div>
      </section>

      {opened.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">History</h2>
          <div className="space-y-2">
            {opened.slice(0, 20).map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
                <div>
                  <div className="text-xs font-bold uppercase">{b.tier} box</div>
                  <div className="text-[10px] text-muted-foreground">{b.opened_at ? new Date(b.opened_at).toLocaleString() : "—"}</div>
                </div>
                <div className="text-right text-xs font-bold">
                  +{b.reward_xp ?? 0} XP{Number(b.reward_coins) > 0 ? ` · +₹${Number(b.reward_coins).toFixed(0)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
