import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, Clock3, Sparkles } from "lucide-react";

export const Route = createFileRoute("/result/$id")({
  component: ResultPage,
});

type Contest = { id: string; title: string; results_status: string; first_prize: number };
type Attempt = { id: string; rank: number | null; prize_awarded: number; is_winner: boolean; status: string; score: number | null; submitted_at: string | null };

function ResultPage() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Contest | null | undefined>(undefined);
  const [a, setA] = useState<Attempt | null>(null);

  useEffect(() => {
    (async () => {
      const { data: contest } = await supabase
        .from("contests")
        .select("id, title, results_status, first_prize")
        .eq("id", id)
        .maybeSingle();
      setC((contest ?? null) as Contest | null);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: att } = await supabase
        .from("contest_attempts")
        .select("id, rank, prize_awarded, is_winner, status, score, submitted_at")
        .eq("contest_id", id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      setA((att ?? null) as Attempt | null);
    })();
  }, [id]);

  if (c === undefined) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (!c) return <AppShell><p>Contest not found</p></AppShell>;

  const declared = c.results_status === "declared";
  const won = declared && a?.is_winner && Number(a.prize_awarded) > 0;

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-6 text-center text-primary-foreground shadow-lift">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur">
          {won ? <Trophy className="h-10 w-10" /> : declared ? <Sparkles className="h-10 w-10" /> : <Clock3 className="h-10 w-10" />}
        </div>
        <h1 className="mt-4 text-2xl font-black">
          {!a ? "No attempt found" : declared ? (won ? "Congratulations! 🎉" : "Results Declared") : "Submission Received"}
        </h1>
        <p className="mt-1 text-sm opacity-90">{c.title}</p>

        {won && a && (
          <div className="mx-auto mt-5 inline-block rounded-2xl bg-gradient-gold px-5 py-3 text-amber-950 shadow-lift">
            <div className="text-xs font-bold uppercase tracking-widest">Prize credited</div>
            <div className="text-3xl font-black">₹{Number(a.prize_awarded).toFixed(0)}</div>
            {a.rank && <div className="text-xs font-semibold">Rank #{a.rank}</div>}
          </div>
        )}
      </section>

      {!declared && a && (
        <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Awaiting admin review</h2>
          <p className="mt-2 text-sm">
            Your answers have been submitted successfully. The admin will verify correct answers,
            finalise the leaderboard, and declare winners. Your result and any prize will appear
            here once results are published.
          </p>
          {a.submitted_at && (
            <p className="mt-3 text-xs text-muted-foreground">Submitted at {new Date(a.submitted_at).toLocaleString()}</p>
          )}
        </section>
      )}

      {declared && a && !won && (
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Your result</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-muted-foreground text-xs">Rank</div><div className="font-black text-lg">{a.rank ? `#${a.rank}` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Prize</div><div className="font-black text-lg">₹{Number(a.prize_awarded).toFixed(0)}</div></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Better luck next time! Keep playing to climb the leaderboard.</p>
        </section>
      )}

      {!a && (
        <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft">
          <p className="text-sm">You haven't attempted this contest.</p>
        </section>
      )}

      <div className="mt-6 flex gap-3">
        <Link to="/" className="flex-1">
          <Button variant="outline" className="w-full h-12">Home</Button>
        </Link>
        <Link to="/leaderboard" className="flex-1">
          <Button className="w-full h-12 bg-gradient-primary font-bold">Leaderboard</Button>
        </Link>
      </div>
    </AppShell>
  );
}
