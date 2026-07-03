import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Cash Winning League" }] }),
  component: LeaderboardPage,
});

type Winner = {
  attempt_id: string;
  user_id: string;
  name: string;
  rank: number;
  prize: number;
  contest_title: string;
};

function LeaderboardPage() {
  const [rows, setRows] = useState<Winner[] | null>(null);

  useEffect(() => {
    (async () => {
      // Only declared contests contribute to the leaderboard.
      const { data: contests } = await supabase
        .from("contests")
        .select("id, title, results_status")
        .eq("results_status", "declared");
      const ids = (contests ?? []).map((c) => c.id);
      if (!ids.length) { setRows([]); return; }
      const titles = Object.fromEntries((contests ?? []).map((c) => [c.id, c.title]));

      const { data: attempts } = await supabase
        .from("contest_attempts")
        .select("id, user_id, contest_id, rank, prize_awarded, is_winner")
        .in("contest_id", ids)
        .eq("is_winner", true)
        .order("prize_awarded", { ascending: false })
        .limit(50);

      const userIds = Array.from(new Set((attempts ?? []).map((a) => a.user_id)));
      let names: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || "Player"]));
      }

      const winners: Winner[] = (attempts ?? []).map((a) => ({
        attempt_id: a.id,
        user_id: a.user_id,
        name: names[a.user_id] || "Player",
        rank: a.rank ?? 0,
        prize: Number(a.prize_awarded) || 0,
        contest_title: titles[a.contest_id] || "",
      }));
      setRows(winners);
    })();
  }, []);

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-center text-primary-foreground shadow-lift">
        <Trophy className="mx-auto h-10 w-10" />
        <h1 className="mt-2 text-2xl font-black">Winners Leaderboard</h1>
        <p className="text-xs opacity-90">Only official winners declared by admin</p>
      </section>

      {rows === null && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {rows && rows.length === 0 && (
        <div className="mt-6 rounded-2xl bg-card p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            No winners yet. The leaderboard will fill up as the admin declares contest results.
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
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
                  <div className="text-[11px] text-muted-foreground truncate">{w.contest_title} · Rank #{w.rank}</div>
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
