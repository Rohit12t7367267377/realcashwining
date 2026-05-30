import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LEADERBOARD } from "@/lib/quiz-data";
import { useUser } from "@/lib/user-store";
import { Trophy, Crown } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Cash Winning League" }] }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { state } = useUser();
  const youScore = state.totalScore;
  const all = [...LEADERBOARD];
  if (state.loggedIn) all.push({ name: state.name + " (You)", score: youScore, wins: state.contestsWon, avatar: "🎯" });
  all.sort((a, b) => b.score - a.score);
  const top3 = all.slice(0, 3);
  const rest = all.slice(3);

  const yourRank = state.loggedIn ? all.findIndex((p) => p.name.includes("(You)")) + 1 : null;

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-center text-primary-foreground shadow-lift">
        <Trophy className="mx-auto h-10 w-10" />
        <h1 className="mt-2 text-2xl font-black">Global Leaderboard</h1>
        <p className="text-xs opacity-90">Top scorers across all contests</p>
        {yourRank && (
          <div className="mt-3 inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold backdrop-blur">
            Your Rank: #{yourRank}
          </div>
        )}
      </section>

      {/* Top 3 podium */}
      <section className="mt-6 grid grid-cols-3 items-end gap-2">
        {top3[1] && <Podium place={2} {...top3[1]} height="h-28" />}
        {top3[0] && <Podium place={1} {...top3[0]} height="h-36" />}
        {top3[2] && <Podium place={3} {...top3[2]} height="h-24" />}
      </section>

      <section className="mt-6 space-y-2">
        {rest.map((p, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 shadow-soft ${p.name.includes("(You)") ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-black ${p.name.includes("(You)") ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>
              #{i + 4}
            </div>
            <div className="text-2xl">{p.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-bold">{p.name}</div>
              <div className={`text-[11px] ${p.name.includes("(You)") ? "opacity-80" : "text-muted-foreground"}`}>{p.wins} wins</div>
            </div>
            <div className="text-right">
              <div className="font-black">{p.score.toLocaleString()}</div>
              <div className={`text-[10px] uppercase tracking-wider ${p.name.includes("(You)") ? "opacity-80" : "text-muted-foreground"}`}>pts</div>
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}

function Podium({ place, name, score, avatar, height }: { place: number; name: string; score: number; avatar: string; height: string }) {
  const colors = place === 1 ? "bg-gradient-gold text-amber-950" : place === 2 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900" : "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950";
  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl">{avatar}</div>
      <div className="mt-1 line-clamp-1 max-w-full text-xs font-bold">{name.replace(" (You)", "")}</div>
      <div className="text-[11px] text-muted-foreground">{score.toLocaleString()} pts</div>
      <div className={`mt-2 flex w-full flex-col items-center justify-end rounded-t-2xl ${colors} ${height} px-2 py-3 shadow-lift`}>
        {place === 1 && <Crown className="h-5 w-5" />}
        <div className="text-2xl font-black">#{place}</div>
      </div>
    </div>
  );
}
