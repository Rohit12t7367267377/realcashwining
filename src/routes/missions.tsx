import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { listMyMissions, claimMission, getMyXp } from "@/lib/gamification.functions";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import { Target, Zap, Gift, Trophy } from "lucide-react";

export const Route = createFileRoute("/missions")({
  head: () => ({
    meta: [
      { title: "Missions & Rewards — Cash Winning League" },
      { name: "description", content: "Complete daily, weekly and monthly missions to earn XP, coins and reward boxes." },
      { property: "og:title", content: "Missions & Rewards" },
      { property: "og:description", content: "Play, win, level up. Claim XP, coins and reward boxes every day." },
    ],
  }),
  component: MissionsPage,
});

function MissionsPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyMissions);
  const fetchXp = useServerFn(getMyXp);
  const doClaim = useServerFn(claimMission);

  const { data: xp } = useQuery({ queryKey: ["my-xp"], queryFn: () => fetchXp(), enabled: state.loggedIn });
  const { data: missions = [] } = useQuery({
    queryKey: ["my-missions"],
    queryFn: () => fetchList(),
    enabled: state.loggedIn,
    refetchOnWindowFocus: true,
  });

  const claim = useMutation({
    mutationFn: (user_mission_id: string) => doClaim({ data: { user_mission_id } }),
    onSuccess: () => {
      toast.success("Reward claimed!");
      qc.invalidateQueries({ queryKey: ["my-missions"] });
      qc.invalidateQueries({ queryKey: ["my-xp"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["my-reward-boxes"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!state.loggedIn) {
    return <AppShell><p className="rounded-2xl bg-card p-4 text-center">Please sign in.</p></AppShell>;
  }

  const groups: Record<"daily" | "weekly" | "monthly", typeof missions> = { daily: [], weekly: [], monthly: [] };
  for (const m of missions) (groups[m.kind as "daily" | "weekly" | "monthly"] ??= []).push(m);

  return (
    <AppShell>
      {/* XP hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Your Rank</p>
            <h1 className="mt-1 text-2xl font-black">{xp?.rankTitle ?? "Bronze"} · Level {xp?.level ?? 1}</h1>
            <p className="mt-1 text-xs opacity-90">{xp?.xp ?? 0} XP · {xp?.boxesEarned ?? 0} boxes earned</p>
          </div>
          <Trophy className="h-10 w-10 opacity-80" />
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full bg-white/80" style={{ width: `${Math.round((xp?.progress ?? 0) * 100)}%` }} />
        </div>
        <p className="mt-1 text-[10px] opacity-80">
          {Math.max(0, (xp?.nextFloor ?? 0) - (xp?.xp ?? 0))} XP to Level {(xp?.level ?? 1) + 1}
        </p>
      </section>

      {(["daily", "weekly", "monthly"] as const).map((k) => (
        <section key={k} className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {k === "daily" ? <Zap className="h-4 w-4" /> : k === "weekly" ? <Target className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
            {k} Missions
          </h2>
          <div className="space-y-2">
            {(groups[k] ?? []).length === 0 && (
              <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
                No {k} missions available.
              </div>
            )}
            {(groups[k] ?? []).map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.goal_value) * 100));
              const done = !!m.completed_at;
              const claimed = !!m.claimed_at;
              return (
                <div key={m.id} className="rounded-2xl bg-card p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{m.title}</div>
                      {m.description && <div className="text-[11px] text-muted-foreground">{m.description}</div>}
                      <div className="mt-1 text-[11px] font-semibold text-primary">
                        +{m.reward_xp} XP{Number(m.reward_coins) > 0 ? ` · +₹${Number(m.reward_coins).toFixed(0)}` : ""}
                        {m.reward_box_tier ? ` · 🎁 ${m.reward_box_tier}` : ""}
                      </div>
                    </div>
                    {claimed ? (
                      <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground">Claimed</span>
                    ) : done ? (
                      <Button size="sm" className="bg-gradient-primary" disabled={claim.isPending} onClick={() => m.user_mission_id && claim.mutate(m.user_mission_id)}>
                        Claim
                      </Button>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary">{m.progress}/{m.goal_value}</span>
                    )}
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </AppShell>
  );
}
