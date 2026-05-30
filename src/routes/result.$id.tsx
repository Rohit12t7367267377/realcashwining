import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { getContest } from "@/lib/quiz-data";
import { useUser } from "@/lib/user-store";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Trophy, CheckCircle2, XCircle, MinusCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/result/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ a: (s.a as string) ?? "" }),
  component: ResultPage,
});

function ResultPage() {
  const { id } = Route.useParams();
  const { a } = Route.useSearch();
  const c = getContest(id);
  const { recordResult } = useUser();
  const recorded = useRef(false);

  const answers: (number | null)[] = useMemo(() => {
    try { return a ? JSON.parse(decodeURIComponent(a)) : []; } catch { return []; }
  }, [a]);

  if (!c) return <AppShell><p>Not found</p></AppShell>;

  let correct = 0, wrong = 0, skipped = 0;
  c.questions.forEach((q, i) => {
    const ans = answers[i];
    if (ans === null || ans === undefined || ans === -1) skipped++;
    else if (ans === q.answer) correct++;
    else wrong++;
  });
  const score = correct * 10 - wrong * 2;
  const accuracy = c.questions.length ? Math.round((correct / c.questions.length) * 100) : 0;

  // Reward logic (mock): prize based on accuracy
  const reward = c.prize === 0 ? 0
    : accuracy >= 80 ? Math.round(c.prize * 0.6)
    : accuracy >= 60 ? Math.round(c.prize * 0.25)
    : accuracy >= 40 ? Math.round(c.prize * 0.05)
    : 0;

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    recordResult(c.id, c.title, score, c.questions.length, reward);
  }, [c.id, c.title, c.questions.length, score, reward, recordResult]);

  const rank = reward > 0 ? (accuracy >= 80 ? 1 : accuracy >= 60 ? 2 : 3) : Math.floor(Math.random() * 40) + 10;

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-6 text-center text-primary-foreground shadow-lift">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur animate-pulse-ring">
          {reward > 0 ? <Trophy className="h-10 w-10" /> : <Sparkles className="h-10 w-10" />}
        </div>
        <h1 className="mt-4 text-3xl font-black">
          {reward > 0 ? "Congratulations! 🎉" : "Quiz Complete!"}
        </h1>
        <p className="mt-1 text-sm opacity-90">{c.title}</p>
        {reward > 0 && (
          <div className="mx-auto mt-5 inline-block rounded-2xl bg-gradient-gold px-5 py-3 text-amber-950 shadow-lift">
            <div className="text-xs font-bold uppercase tracking-widest">You won</div>
            <div className="text-3xl font-black">₹{reward}</div>
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Score" value={score.toString()} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Rank" value={`#${rank}`} />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <Pill icon={<CheckCircle2 className="h-5 w-5 text-success" />} label="Correct" value={correct} />
        <Pill icon={<XCircle className="h-5 w-5 text-destructive" />} label="Wrong" value={wrong} />
        <Pill icon={<MinusCircle className="h-5 w-5 text-muted-foreground" />} label="Skipped" value={skipped} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Review Answers</h2>
        <div className="mt-3 space-y-3">
          {c.questions.map((q, i) => {
            const ans = answers[i];
            const isCorrect = ans === q.answer;
            const isSkipped = ans === null || ans === undefined || ans === -1;
            return (
              <div key={i} className="rounded-2xl bg-card p-4 shadow-soft">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-xs font-bold text-muted-foreground">Q{i + 1}.</span>
                  <p className="flex-1 text-sm font-semibold">{q.q}</p>
                  {isSkipped ? <MinusCircle className="h-4 w-4 text-muted-foreground" /> : isCorrect ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                </div>
                <div className="mt-2 space-y-1.5 text-xs">
                  {q.options.map((opt, oi) => {
                    const isAns = oi === q.answer;
                    const isUser = oi === ans;
                    return (
                      <div key={oi} className={`rounded-lg px-3 py-1.5 ${isAns ? "bg-success/15 text-success-foreground" : isUser ? "bg-destructive/15 text-destructive-foreground" : "bg-muted"}`}>
                        <span className="mr-2 font-bold">{String.fromCharCode(65 + oi)}.</span>
                        {opt}
                        {isAns && <span className="ml-2 font-bold text-success">✓ Correct</span>}
                        {isUser && !isAns && <span className="ml-2 font-bold text-destructive">Your answer</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/leaderboard"><Button variant="outline" className="h-12 w-full font-bold">Leaderboard</Button></Link>
        <Link to="/"><Button className="h-12 w-full bg-gradient-primary font-bold shadow-glow">Play Again</Button></Link>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function Pill({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-card p-3 shadow-soft">
      {icon}
      <div className="mt-1 text-xl font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
