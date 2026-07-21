import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { listMyRewardBoxes, openRewardBox } from "@/lib/gamification.functions";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import { Gift } from "lucide-react";

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

  return (
    <AppShell>
      <h1 className="text-xl font-black">🎁 Reward Boxes</h1>
      <p className="text-xs text-muted-foreground">Earn boxes by leveling up and completing missions.</p>

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
