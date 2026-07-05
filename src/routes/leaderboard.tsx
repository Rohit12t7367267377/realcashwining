import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Trophy, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWinnersLeaderboard, getContestLeaderboard } from "@/lib/stats.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Cash Winning League" }] }),
  component: LeaderboardPage,
});

type DeclaredContest = { id: string; title: string };

function LeaderboardPage() {
  const fetchWinners = useServerFn(getWinnersLeaderboard);
  const { data: winners } = useQuery({
    queryKey: ["leaderboard-winners"],
    queryFn: () => fetchWinners(),
    staleTime: 30_000,
  });

  const [declared, setDeclared] = useState<DeclaredContest[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("contests")
        .select("id, title")
        .eq("results_status", "declared")
        .order("created_at", { ascending: false });
      const list = (data ?? []) as DeclaredContest[];
      setDeclared(list);
      if (!selected && list.length) setSelected(list[0].id);
    })();
  }, []);

  const fetchContest = useServerFn(getContestLeaderboard);
  const { data: contestBoard } = useQuery({
    queryKey: ["leaderboard-contest", selected],
    queryFn: () => fetchContest({ data: { contest_id: selected } }),
    enabled: !!selected,
    staleTime: 30_000,
  });

  const rows = winners ?? [];

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-center text-primary-foreground shadow-lift">
        <Trophy className="mx-auto h-10 w-10" />
        <h1 className="mt-2 text-2xl font-black">Winners Leaderboard</h1>
        <p className="text-xs opacity-90">Only official winners declared by admin</p>
      </section>

      {rows.length === 0 && (
        <div className="mt-6 rounded-2xl bg-card p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            No winners yet. The leaderboard will fill up as the admin declares contest results.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <section className="mt-6 grid grid-cols-3 items-end gap-2">
            {rows[1] && <Podium place={2} name={rows[1].name} prize={rows[1].prize} height="h-28" />}
            {rows[0] && <Podium place={1} name={rows[0].name} prize={rows[0].prize} height="h-36" />}
            {rows[2] && <Podium place={3} name={rows[2].name} prize={rows[2].prize} height="h-24" />}
          </section>
          <section className="mt-6 space-y-2">
            {rows.slice(3).map((w, i) => (
              <div key={w.attempt_id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted font-black text-muted-foreground">#{i + 4}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{w.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{w.contest_title} · Rank #{w.rank} · Score {w.score}</div>
                </div>
                <div className="text-right">
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
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Contest Rankings</h2>
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/10 font-black">#{r.rank ?? i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{r.name}</div>
                  <div className="text-[11px] opacity-80 truncate">
                    ✔ {r.correct} · ✖ {r.wrong} · − {r.unanswered} · Score {r.score}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black">{r.prize > 0 ? `₹${r.prize.toFixed(0)}` : "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link to="/" className="mt-6 block text-center text-xs text-primary hover:underline">← Back to home</Link>
    </AppShell>
  );
}

function Podium({ place, name, prize, height }: { place: number; name: string; prize: number; height: string }) {
  const colors = place === 1 ? "bg-gradient-gold text-amber-950" : place === 2 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900" : "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950";
  return (
    <div className="flex flex-col items-center">
      <div className="mt-1 line-clamp-1 max-w-full text-xs font-bold">{name}</div>
      <div className="text-[11px] text-muted-foreground">₹{prize.toFixed(0)}</div>
      <div className={`mt-2 flex w-full flex-col items-center justify-end rounded-t-2xl ${colors} ${height} px-2 py-3 shadow-lift`}>
        {place === 1 && <Crown className="h-5 w-5" />}
        <div className="text-2xl font-black">#{place}</div>
      </div>
    </div>
  );
}
