import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { listMyRewardBoxes, openRewardBox, getMyXp } from "@/lib/gamification.functions";
import { getMyWallet } from "@/lib/wallet.functions";
import { useUser } from "@/lib/user-store";
import { StoreSection } from "@/components/StoreSection";
import { toast } from "sonner";

import {
  Gift, Share2, Ticket, Crown, Gem, Zap, Coins, CreditCard, Shield,
  Frame, Palette, Disc3, ShoppingBag, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/hub")({
  head: () => ({
    meta: [
      { title: "Elite Hub — Redeem, Unlock & Claim | Guru-G" },
      { name: "description", content: "The Elite Hub: open reward boxes, redeem coupons, unlock premium membership, XP boosts, power-ups, badges, frames and themes." },
      { property: "og:title", content: "Elite Hub — Guru-G" },
      { property: "og:description", content: "Claim, redeem and unlock everything: boxes, coupons, membership, boosts, badges and frames." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HubPage,
});

const TIER_STYLES: Record<string, string> = {
  common: "from-slate-400 to-slate-600",
  rare: "from-sky-400 to-blue-600",
  epic: "from-fuchsia-400 to-purple-600",
  legendary: "from-amber-400 to-orange-600",
};

function HubPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyRewardBoxes);
  const fetchXp = useServerFn(getMyXp);
  const fetchWallet = useServerFn(getMyWallet);
  const doOpen = useServerFn(openRewardBox);

  const { data: boxes = [] } = useQuery({ queryKey: ["my-reward-boxes"], queryFn: () => fetchList(), enabled: state.loggedIn });
  const { data: xp } = useQuery({ queryKey: ["my-xp"], queryFn: () => fetchXp(), enabled: state.loggedIn, staleTime: 30_000 });
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet(), enabled: state.loggedIn, staleTime: 15_000 });

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

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter the Elite Hub</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const unopened = boxes.filter((b) => !b.opened);
  const opened = boxes.filter((b) => b.opened);

  return (
    <AppShell>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Gem className="h-3.5 w-3.5" /> Elite Hub
        </div>
        <h1 className="mt-1 text-2xl font-black">Redeem · Unlock · Claim</h1>
        <p className="mt-1 text-sm opacity-90">Everything you can buy, boost or unlock lives here.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <HeroStat value={`₹${Number(wallet?.balance ?? 0).toFixed(0)}`} label="Balance" />
          <HeroStat value={String(unopened.length)} label="Boxes" />
          <HeroStat value={`Lv ${xp?.level ?? 1}`} label={xp?.rankTitle ?? "Bronze"} />
        </div>
      </section>

      {/* Reward boxes */}
      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Gift className="h-4 w-4" /> Reward boxes ({unopened.length})
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {unopened.length === 0 && (
            <div className="col-span-2 rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
              No boxes yet. Play contests and complete missions to earn some!
            </div>
          )}
          {unopened.map((b) => (
            <div key={b.id} className={`rounded-2xl bg-gradient-to-br ${TIER_STYLES[b.tier] ?? TIER_STYLES.common} p-4 text-white shadow-lift`}>
              <Gift className="h-8 w-8" />
              <div className="mt-2 text-sm font-black uppercase">{b.tier}</div>
              <div className="text-[10px] opacity-90">{b.source}</div>
              <Button size="sm" className="press mt-3 w-full bg-white text-slate-900 hover:bg-white/90" disabled={open.isPending} onClick={() => open.mutate(b.id)}>
                Open
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Store / unlocks */}
      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-4 w-4" /> Store &amp; unlocks
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <TileLink to="/vip" icon={<Crown className="h-5 w-5" />} title="Premium Membership" sub="VIP plans & perks" tone="gold" />
          <TileLink to="/coupons" icon={<Ticket className="h-5 w-5" />} title="Coupons" sub="Redeem bonus codes" />
          <TileLink to="/refer" icon={<Share2 className="h-5 w-5" />} title="Referral Rewards" sub="Invite & earn cash" tone="success" />
          <TileLink to="/wallet" icon={<Coins className="h-5 w-5" />} title="Coins & Balance" sub="Add money or withdraw" />
          <Soon icon={<Zap className="h-5 w-5" />} title="XP Boost" sub="2× XP for 24 hours" />
          <Soon icon={<Gem className="h-5 w-5" />} title="Power Ups" sub="50-50, freeze timer, skip" />
          <Soon icon={<Shield className="h-5 w-5" />} title="Special Badges" sub="Show off your rank" />
          <Soon icon={<Frame className="h-5 w-5" />} title="Avatar Frames" sub="Premium profile rings" />
          <Soon icon={<Palette className="h-5 w-5" />} title="Themes" sub="Custom app skins" />
          <Soon icon={<CreditCard className="h-5 w-5" />} title="Gift Cards" sub="Amazon, Flipkart & more" />
          <Soon icon={<Disc3 className="h-5 w-5" />} title="Spin Wheel" sub="Daily lucky spin" />
          <Soon icon={<ShoppingBag className="h-5 w-5" />} title="Merchandise" sub="Official Guru-G store" />
        </div>
      </section>

      <StoreSection />


      {/* Claim history */}
      {opened.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Claim history</h2>
          <div className="space-y-2">
            {opened.slice(0, 20).map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase">{b.tier} box</div>
                  <div className="text-[10px] text-muted-foreground">{b.opened_at ? new Date(b.opened_at).toLocaleString() : "—"}</div>
                </div>
                <div className="shrink-0 text-right text-xs font-bold">
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

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
      <div className="text-base font-black">{value}</div>
      <div className="truncate text-[10px] uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function TileLink({
  to, icon, title, sub, tone,
}: {
  to: React.ComponentProps<typeof Link>["to"];
  icon: React.ReactNode; title: string; sub: string; tone?: "gold" | "success";
}) {
  const cls =
    tone === "gold" ? "bg-gradient-gold text-amber-950"
    : tone === "success" ? "bg-gradient-success text-success-foreground"
    : "surface";
  return (
    <Link to={to} className={`press card-lift rounded-2xl p-4 shadow-soft ${cls}`}>
      <span className={tone ? "" : "text-primary"}>{icon}</span>
      <div className="mt-2 text-sm font-black leading-tight">{title}</div>
      <div className={`text-[11px] ${tone ? "opacity-80" : "text-muted-foreground"}`}>{sub}</div>
    </Link>
  );
}

function Soon({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={() => toast.info(`${title} unlocks soon — stay tuned!`)}
      className="press card-lift rounded-2xl border border-dashed border-border bg-card/60 p-4 text-left shadow-soft"
    >
      <span className="text-muted-foreground">{icon}</span>
      <div className="mt-2 flex items-center gap-1.5 text-sm font-black leading-tight">
        {title}
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">Soon</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </button>
  );
}
