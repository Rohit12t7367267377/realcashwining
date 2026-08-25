import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { getGuruCompetitionHub, generateGuruChallenge, submitGuruChallenge } from "@/lib/guru-hub.functions";
import { Crown, Swords, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/competitions")({
  head: () => ({
    meta: [
      { title: "Guru.AI Competition Hub — Challenges & Rankings" },
      { name: "description", content: "Take AI practice challenges, track your Guru.AI XP ranking and see every live contest you can join." },
      { property: "og:title", content: "Guru.AI Competition Hub" },
      { property: "og:description", content: "AI challenges, XP rankings and live contests in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompetitionHubPage,
});

type Q = { question: string; options: string[]; correct_index: number; explanation?: string };

const SUBJECTS = ["Mathematics", "Science", "General Knowledge", "English", "Reading Comprehension", "Sports"];

function CompetitionHubPage() {
  const { state } = useUser();
  const load = useServerFn(getGuruCompetitionHub);
  const gen = useServerFn(generateGuruChallenge);
  const submit = useServerFn(submitGuruChallenge);

  const [subject, setSubject] = useState(SUBJECTS[0]!);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ xpEarned: number; accuracy: number } | null>(null);

  const { data } = useQuery({ queryKey: ["guru-hub"], queryFn: () => load(), enabled: state.loggedIn });

  const genMut = useMutation({
    mutationFn: () => gen({ data: { subject, count: 5 } }),
    onSuccess: (res) => {
      if (!res.questions.length) { toast.error("AI challenge is unavailable right now"); return; }
      setQuestions(res.questions as Q[]);
      setAnswers({});
      setResult(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build the challenge"),
  });

  const submitMut = useMutation({
    mutationFn: () => {
      const correct = questions.reduce((s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0), 0);
      return submit({ data: { correct, total: questions.length, label: `${subject} Challenge` } });
    },
    onSuccess: (res) => { setResult(res); toast.success(`+${res.xpEarned} XP`); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save your score"),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter the Competition Hub</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Swords className="h-3.5 w-3.5" /> Competition Hub
        </div>
        <h1 className="mt-1 text-2xl font-black">Level {data?.me.level ?? 1} • {data?.me.xp ?? 0} XP</h1>
        <p className="mt-1 text-sm opacity-90">{data?.me.solved ?? 0} questions solved with Guru.AI</p>
      </section>

      <Link to="/guru/exams" className="card-lift mt-4 block rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <div className="text-sm font-black">Competitive Exams</div>
            <p className="text-[11px] text-muted-foreground">
              JEE, NEET, GATE, UPSC, SSC, Banking, Railway, NDA, CDS, CUET, CAT, CLAT, UGC NET — syllabus, PYQs, mocks &amp; study plans
            </p>
          </div>
        </div>
      </Link>

      <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
        <h2 className="text-sm font-black">AI Practice Challenge</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={`press rounded-full px-3 py-1 text-[11px] font-bold ${subject === s ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button className="mt-3 w-full bg-gradient-primary" disabled={genMut.isPending} onClick={() => genMut.mutate()}>
          {genMut.isPending ? "Building challenge…" : "Start 5-question challenge"}
        </Button>

        {questions.length > 0 && (
          <div className="mt-4 grid gap-3">
            {questions.map((q, i) => (
              <div key={i} className="rounded-2xl bg-secondary/50 p-3">
                <div className="text-sm font-bold">{i + 1}. {q.question}</div>
                <div className="mt-2 grid gap-1.5">
                  {q.options.map((o, oi) => {
                    const chosen = answers[i] === oi;
                    const reveal = result !== null;
                    const good = reveal && oi === q.correct_index;
                    const bad = reveal && chosen && oi !== q.correct_index;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={result !== null}
                        onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                        className={`press rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                          good ? "bg-primary text-primary-foreground" : bad ? "bg-destructive text-destructive-foreground" : chosen ? "bg-card ring-2 ring-primary" : "bg-card"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
                {result !== null && q.explanation && <div className="mt-1.5 text-[11px] text-muted-foreground">{q.explanation}</div>}
              </div>
            ))}
            {result === null ? (
              <Button className="bg-gradient-primary" disabled={submitMut.isPending || Object.keys(answers).length < questions.length} onClick={() => submitMut.mutate()}>
                {submitMut.isPending ? "Scoring…" : "Submit answers"}
              </Button>
            ) : (
              <div className="rounded-2xl bg-gradient-primary p-3 text-center text-primary-foreground">
                <div className="text-xs font-bold uppercase tracking-wider opacity-90">Result</div>
                <div className="text-xl font-black">{result.accuracy}% • +{result.xpEarned} XP</div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" /> Guru XP Top 10
        </h2>
        <div className="grid gap-1.5">
          {(data?.board ?? []).map((b) => (
            <div key={b.rank} className={`flex items-center justify-between rounded-2xl p-3 shadow-soft ${b.isMe ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
              <div className="flex items-center gap-2 text-sm font-black">
                {b.rank === 1 && <Crown className="h-4 w-4" />}#{b.rank} {b.isMe ? "You" : `Learner L${b.level}`}
              </div>
              <div className="text-xs font-bold">{b.xp} XP</div>
            </div>
          ))}
          {(data?.board?.length ?? 0) === 0 && <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">No rankings yet.</div>}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Live & upcoming contests</h2>
        <div className="grid gap-2">
          {(data?.contests ?? []).map((c) => (
            <Link key={c.id} to="/contest/$id" params={{ id: c.id }} className="card-lift rounded-2xl bg-card p-3 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    {c.startsAt ? new Date(c.startsAt).toLocaleString() : "Anytime"}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${c.live ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {c.live ? "LIVE" : c.resultsDeclared ? "RESULT OUT" : "SOON"}
                </span>
              </div>
            </Link>
          ))}
          {(data?.contests?.length ?? 0) === 0 && <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">No contests scheduled.</div>}
        </div>
      </section>
    </AppShell>
  );
}
