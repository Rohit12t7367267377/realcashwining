import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Search, Sparkles, Target, Medal, Zap, Gift, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWinnersLeaderboard, getContestLeaderboard, getMyContestStats } from "@/lib/stats.functions";
import { getMyXp, getHallOfFame, listMyMissions, claimMission } from "@/lib/gamification.functions";
import { useUser } from "@/lib/user-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Ranks — Leaderboards, Missions & Hall of Fame | Guru-G" },
      { name: "description", content: "The complete competition centre: winners leaderboard, weekly/monthly/all-time ranking, top 3 podium, seasonal events, missions, XP progress and Hall of Fame." },
      { property: "og:title", content: "Ranks — Guru-G" },
      { property: "og:description", content: "Winners leaderboard, weekly & monthly rankings, podium, missions, XP and Hall of Fame." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RanksPage,
});

type DeclaredContest = { id: string; title: string };
type SeasonalEvent = { id: string; name: string; description: string | null; starts_at: string; ends_at: string; reward_pool: number; bonus_xp_multiplier: number };
type Period = "weekly" | "monthly" | "all";
type Tab = "board" | "missions" | "fame" | "me";

const TABS: { key: Tab; label: string }[] = [
  { key: "board", label: "Leaderboard" },
  { key: "missions", label: "Missions" },
  { key: "fame", label: "Hall of Fame" },
  { key: "me", label: "My Rank" },
];

function RanksPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("board");
  const [period, setPeriod] = useState<Period>("all");
  const [q, setQ] = useState("");

  const fetchWinners = useServerFn(getWinnersLeaderboard);
  const { data: winners } = useQuery({ queryKey: ["leaderboard-winners"], queryFn: () => fetchWinners(), staleTime: 30_000 });

  const [declared, setDeclared] = useState<DeclaredContest[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [events, setEvents] = useState<SeasonalEvent[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: evs }] = await Promise.all([
        supabase.from("contests").select("id, title").eq("results_status", "declared").order("created_at", { ascending: false }),
        supabase.from("seasonal_events").select("id, name, description, starts_at, ends_at, reward_pool, bonus_xp_multiplier")
          .eq("active", true).order("starts_at", { ascending: false }).limit(5),
      ]);
      const list = (data ?? []) as DeclaredContest[];
      setDeclared(list);
      setEvents((evs ?? []) as SeasonalEvent[]);
      if (list.length) setSelected((s) => s || list[0].id);
    })();
  }, []);

  const fetchContest = useServerFn(getContestLeaderboard);
  const { data: contestBoard } = useQuery({
    queryKey: ["leaderboard-contest", selected],
    queryFn: () => fetchContest({ data: { contest_id: selected } }),
    enabled: !!selected,
    staleTime: 30_000,
  });

  const fetchXp = useServerFn(getMyXp);
  const fetchStats = useServerFn(getMyContestStats);
  const fetchHof = useServerFn(getHallOfFame);
  const fetchMissions = useServerFn(listMyMissions);
  const doClaim = useServerFn(claimMission);

  const { data: xp } = useQuery({ queryKey: ["my-xp"], queryFn: () => fetchXp(), enabled: state.loggedIn, staleTime: 30_000 });
  const { data: stats } = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats(), enabled: state.loggedIn, staleTime: 30_000 });
  const { data: hof = [] } = useQuery({ queryKey: ["hall-of-fame"], queryFn: () => fetchHof(), enabled: state.loggedIn && tab === "fame" });
  const { data: missions = [] } = useQuery({ queryKey: ["my-missions"], queryFn: () => fetchMissions(), enabled: state.loggedIn && tab === "missions" });

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

  const allRows = winners ?? [];
  const periodRows = useMemo(() => {
    if (period === "all") return allRows;
    const days = period === "weekly" ? 7 : 30;
    const cutoff = Date.now() - days * 86400_000;
    return allRows.filter((w) => w.won_at && new Date(w.won_at).getTime() >= cutoff);
  }, [allRows, period]);

  const rows = q.trim()
    ? periodRows.filter((w) => w.name.toLowerCase().includes(q.trim().toLowerCase()))
    : periodRows;

  const totalPrize = periodRows.reduce((s, w) => s + Number(w.prize ?? 0), 0);
  const topPrize = periodRows.reduce((m, w) => Math.max(m, Number(w.prize ?? 0)), 0);
  const history = stats?.history ?? [];
  const rankedHistory = history.filter((h) => h.rank);
  const bestRank = rankedHistory.length ? Math.min(...rankedHistory.map((h) => Number(h.rank))) : 0;

  return (
    <AppShell>
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-hero p-5 text-center text-primary-foreground shadow-lift animate-rise-in">
        <Trophy className="mx-auto h-10 w-10" />
        <h1 className="mt-2 text-2xl font-black">Competition Centre</h1>
        <p className="text-xs opacity-90">Official winners declared by admin · missions · Hall of Fame</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <HeroStat value={String(periodRows.length)} label="Winners" />
          <HeroStat value={`₹${totalPrize.toFixed(0)}`} label="Paid out" />
          <HeroStat value={`₹${topPrize.toFixed(0)}`} label="Top prize" />
        </div>
      </section>

      {/* Tabs */}
      <nav className="mt-4 flex gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`press flex-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${tab === t.key ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "board" && (
        <>
          {/* Period filter */}
          <div className="mt-4 flex gap-2">
            {(["weekly", "monthly", "all"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`press flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${period === p ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground shadow-soft"}`}
              >
                {p === "all" ? "All time" : p === "weekly" ? "This week" : "This month"}
              </button>
            ))}
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search player…"
              aria-label="Search player"
              className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-sm shadow-soft outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </div>

          {rows.length === 0 && (
            <div className="mt-6 rounded-2xl bg-card p-8 text-center shadow-soft">
              <p className="text-sm text-muted-foreground">
                No winners in this period yet. Rankings fill up as the admin declares contest results.
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Top 3 Podium</h2>
              <section className="mt-3 grid grid-cols-3 items-end gap-2">
                {rows[1] && <Podium rank={rows[1].rank} name={rows[1].name} prize={rows[1].prize} correct={rows[1].correct} wrong={rows[1].wrong} height="h-28" tone="silver" />}
                {rows[0] && <Podium rank={rows[0].rank} name={rows[0].name} prize={rows[0].prize} correct={rows[0].correct} wrong={rows[0].wrong} height="h-36" tone="gold" />}
                {rows[2] && <Podium rank={rows[2].rank} name={rows[2].name} prize={rows[2].prize} correct={rows[2].correct} wrong={rows[2].wrong} height="h-24" tone="bronze" />}
              </section>

              <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Latest winners</h2>
              <section className="mt-3 space-y-2">
                {rows.slice(3).map((w) => (
                  <div key={w.attempt_id} className="card-lift flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted font-black text-muted-foreground">#{w.rank}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{w.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {w.contest_title} · ✔ {w.correct} · ✖ {w.wrong} · − {w.unanswered} · Score {w.score}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-black">₹{w.prize.toFixed(0)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">won</div>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {declared.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Contest rankings</h2>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Choose contest" /></SelectTrigger>
                <SelectContent>
                  {declared.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-3 space-y-2">
                {(contestBoard?.rows ?? []).length === 0 && (
                  <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No entries.</p>
                )}
                {(contestBoard?.rows ?? []).map((r, i) => (
                  <div key={r.attempt_id} className={`flex items-center gap-3 rounded-2xl p-3 shadow-soft ${r.isWinner ? "bg-gradient-gold text-amber-950" : "bg-card"}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/10 font-black">#{r.rank ?? i + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{r.name}</div>
                      <div className="truncate text-[11px] opacity-80">
                        ✔ {r.correct} · ✖ {r.wrong} · − {r.unanswered} · Score {r.score}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-black">{r.prize > 0 ? `₹${r.prize.toFixed(0)}` : "—"}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Seasonal events */}
          <section className="mt-8">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Seasonal rankings
            </h2>
            {events.length === 0 ? (
              <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No active events right now.</p>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <Link key={e.id} to="/events" className="card-lift block rounded-2xl border border-primary/30 bg-gradient-card p-4 shadow-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">{e.name}</div>
                        {e.description && <div className="truncate text-[11px] text-muted-foreground">{e.description}</div>}
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(e.starts_at).toLocaleDateString()} – {new Date(e.ends_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-black text-success">₹{Number(e.reward_pool).toFixed(0)}</div>
                        <div className="text-[10px] font-bold text-primary">{Number(e.bonus_xp_multiplier).toFixed(1)}× XP</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "missions" && (
        <section className="mt-4 space-y-5">
          {!state.loggedIn && <p className="rounded-2xl bg-card p-4 text-center text-sm shadow-soft">Sign in to see your missions.</p>}
          {state.loggedIn && (["daily", "weekly", "monthly"] as const).map((k) => {
            const group = missions.filter((m) => m.kind === k);
            return (
              <div key={k}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {k === "daily" ? <Zap className="h-4 w-4" /> : k === "weekly" ? <Target className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
                  {k} missions
                </h2>
                <div className="space-y-2">
                  {group.length === 0 && (
                    <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No {k} missions available.</div>
                  )}
                  {group.map((m) => {
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
                            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground">Claimed</span>
                          ) : done ? (
                            <Button size="sm" className="press shrink-0 bg-gradient-primary" disabled={claim.isPending} onClick={() => m.user_mission_id && claim.mutate(m.user_mission_id)}>
                              Claim
                            </Button>
                          ) : (
                            <span className="shrink-0 text-[11px] font-bold text-muted-foreground">{m.progress}/{m.goal_value}</span>
                          )}
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {tab === "fame" && (
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Medal className="h-4 w-4" /> All-time top XP earners
          </h2>
          {!state.loggedIn && <p className="rounded-2xl bg-card p-4 text-center text-sm shadow-soft">Sign in to see the Hall of Fame.</p>}
          <div className="space-y-2">
            {state.loggedIn && hof.length === 0 && (
              <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No entries yet.</div>
            )}
            {hof.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${r.rank === 1 ? "bg-gradient-gold text-amber-950" : r.rank <= 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    #{r.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{r.name}</div>
                    <div className="text-[10px] text-muted-foreground">Level {r.level}</div>
                  </div>
                </div>
                <div className="shrink-0 text-sm font-black text-primary">{r.xp} XP</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "me" && (
        <section className="mt-4 space-y-4">
          {!state.loggedIn && <p className="rounded-2xl bg-card p-4 text-center text-sm shadow-soft">Sign in to see your rank.</p>}
          {state.loggedIn && (
            <>
              <div className="rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-lift">
                <div className="text-[10px] uppercase tracking-widest opacity-80">Your rank</div>
                <div className="text-xl font-black">{xp?.rankTitle ?? "Bronze"} · Level {xp?.level ?? 1}</div>
                <div className="text-[11px] opacity-90">{xp?.xp ?? 0} XP · {xp?.boxesEarned ?? 0} reward boxes</div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${Math.round((xp?.progress ?? 0) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[10px] opacity-80">
                  {Math.max(0, (xp?.nextFloor ?? 0) - (xp?.xp ?? 0))} XP to Level {(xp?.level ?? 1) + 1}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Played" value={String(stats?.played ?? 0)} />
                <MiniStat label="Wins" value={String(stats?.wins ?? 0)} />
                <MiniStat label="Best rank" value={bestRank ? `#${bestRank}` : "—"} />
              </div>

              <div>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <History className="h-4 w-4" /> Rank history
                </h2>
                <div className="space-y-2">
                  {history.length === 0 && (
                    <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No contests played yet.</p>
                  )}
                  {history.map((h) => (
                    <Link key={h.id} to="/result/$id" params={{ id: h.contestId }} className="card-lift flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{h.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {h.submittedAt ? new Date(h.submittedAt).toLocaleDateString() : "—"} · Score {h.score}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-black">{h.rank ? `#${h.rank}` : "—"}</div>
                        {h.prize > 0 && <div className="text-[10px] font-bold text-success">+₹{h.prize.toFixed(0)}</div>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </AppShell>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
      <div className="text-base font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-3 text-center">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Podium({ rank, name, prize, correct, wrong, height, tone }: { rank: number; name: string; prize: number; correct: number; wrong: number; height: string; tone: "gold" | "silver" | "bronze" }) {
  const colors = tone === "gold" ? "bg-gradient-gold text-amber-950" : tone === "silver" ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900" : "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950";
  return (
    <div className="flex flex-col items-center">
      <div className="mt-1 line-clamp-1 max-w-full text-xs font-bold">{name}</div>
      <div className="text-[11px] text-muted-foreground">₹{prize.toFixed(0)}</div>
      <div className="text-[10px] text-muted-foreground">✔{correct} ✖{wrong}</div>
      <div className={`mt-2 flex w-full flex-col items-center justify-end rounded-t-2xl ${colors} ${height} px-2 py-3 shadow-lift`}>
        {tone === "gold" && <Crown className="h-5 w-5" />}
        <div className="text-2xl font-black">#{rank}</div>
      </div>
    </div>
  );
}
