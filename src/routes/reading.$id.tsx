import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth-session";
import { cn } from "@/lib/utils";
import { BookOpenCheck, Clock, Timer, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reading/$id")({
  head: () => ({
    meta: [
      { title: "Reading Comprehension Quiz — Guru-G" },
      { name: "description", content: "Read the passage against the clock, then answer the comprehension questions." },
      { property: "og:title", content: "Reading Comprehension Quiz" },
      { property: "og:description", content: "Timed passage reading followed by multiple choice questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type P = {
  id: string;
  title: string;
  passage: string;
  reading_seconds: number;
  quiz_seconds: number;
  num_questions: number;
  difficulty: string;
  marks_per_question: number;
  negative_marks: number;
  keep_passage_visible: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_explanations: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};
type Q = { id: string; question: string; options: string[]; correct_index: number; explanation: string | null };

type Phase = "intro" | "reading" | "quiz" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Page() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuthSession();
  const [p, setP] = useState<P | null | undefined>(undefined);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [readLeft, setReadLeft] = useState(0);
  const [quizLeft, setQuizLeft] = useState(0);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; correct: number; wrong: number; unanswered: number; accuracy: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("reading_passages").select("*").eq("id", id).maybeSingle();
      if (!data) { setP(null); return; }
      const row = data as P;
      setP(row);
      const now = Date.now();
      if (!row.active) return setBlocked("This reading quiz is not open yet. Please wait for the admin to activate it.");
      if (row.starts_at && new Date(row.starts_at).getTime() > now) return setBlocked(`Starts at ${new Date(row.starts_at).toLocaleString()}.`);
      if (row.ends_at && new Date(row.ends_at).getTime() < now) return setBlocked("This reading quiz has ended.");

      const { data: qs } = await supabase
        .from("reading_questions")
        .select("id, question, options, correct_index, explanation")
        .eq("passage_id", id)
        .order("sort_order")
        .limit(row.num_questions || 50);
      let shaped: Q[] = (qs ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        correct_index: q.correct_index,
        explanation: q.explanation,
      }));
      if (row.shuffle_questions) shaped = shuffle(shaped);
      setQuestions(shaped);
      setAnswers(Array(shaped.length).fill(null));
      setReadLeft(row.reading_seconds);
      setQuizLeft(row.quiz_seconds);
    })();
  }, [id]);

  // Block copy / selection / context menu while reading or answering
  useEffect(() => {
    if (phase !== "reading" && phase !== "quiz") return;
    const stop = (e: Event) => { e.preventDefault(); return false; };
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p", "u"].includes(k)) e.preventDefault();
      if (k === "printscreen") e.preventDefault();
    };
    document.addEventListener("copy", stop);
    document.addEventListener("cut", stop);
    document.addEventListener("contextmenu", stop);
    document.addEventListener("selectstart", stop);
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("copy", stop);
      document.removeEventListener("cut", stop);
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("selectstart", stop);
      document.removeEventListener("keydown", keys);
    };
  }, [phase]);

  // Reading timer -> auto transition to quiz
  useEffect(() => {
    if (phase !== "reading") return;
    if (readLeft <= 0) { setPhase("quiz"); return; }
    const t = setTimeout(() => setReadLeft((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, readLeft]);

  const submit = useCallback(async () => {
    if (!attemptId || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("submit_reading_attempt", {
        _attempt_id: attemptId,
        _answers: answers as unknown as never,
        _quiz_seconds_spent: Math.max(0, (p?.quiz_seconds ?? 0) - quizLeft),
      });
      if (error) throw new Error(error.message);
      const r = Array.isArray(data) ? data[0] : data;
      setResult({
        score: Number(r?.score ?? 0),
        correct: Number(r?.correct_count ?? 0),
        wrong: Number(r?.wrong_count ?? 0),
        unanswered: Number(r?.unanswered_count ?? 0),
        accuracy: Number(r?.accuracy ?? 0),
      });
      setPhase("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }, [answers, attemptId, busy, p?.quiz_seconds, quizLeft]);

  // Quiz timer -> auto submit
  useEffect(() => {
    if (phase !== "quiz") return;
    if (quizLeft <= 0) { void submit(); return; }
    const t = setTimeout(() => setQuizLeft((q) => q - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, quizLeft, submit]);

  async function start() {
    if (!user) return nav({ to: "/auth" });
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("reading_attempts")
        .insert({
          user_id: user.id,
          passage_id: id,
          question_order: questions.map((q) => q.id) as unknown as never,
          answers: [] as unknown as never,
          status: "reading",
          reading_completed: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      setAttemptId(data.id);
      setPhase("reading");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (phase !== "quiz" || !attemptId) return;
    void supabase.from("reading_attempts").update({ reading_completed: true, status: "quiz", reading_seconds_spent: p?.reading_seconds ?? 0 }).eq("id", attemptId);
  }, [phase, attemptId, p?.reading_seconds]);

  const displayOptions = useMemo(() => {
    if (!p?.shuffle_options) return null;
    return questions.map((q) => shuffle(q.options.map((o, i) => ({ o, i }))));
  }, [p?.shuffle_options, questions]);

  if (p === undefined || authLoading) return <AppShell><div className="p-6 text-center text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!p) return <AppShell><div className="p-6 text-center">Reading quiz not found.</div></AppShell>;
  if (blocked) return <AppShell><div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft"><Lock className="mx-auto mb-2 h-5 w-5" />{blocked}</div></AppShell>;

  if (phase === "intro") {
    return (
      <AppShell>
        <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90"><BookOpenCheck className="h-3.5 w-3.5" /> Reading comprehension</div>
          <h1 className="mt-1 text-2xl font-black">{p.title}</h1>
          <p className="mt-2 text-sm opacity-90">
            You get <b>{p.reading_seconds}s</b> to read the passage. Questions stay hidden until reading time ends, then you get <b>{Math.round(p.quiz_seconds / 60)} min</b> to answer {questions.length} questions.
          </p>
          <p className="mt-1 text-xs opacity-80">
            {Number(p.marks_per_question)} mark(s) per correct answer{Number(p.negative_marks) > 0 ? ` · −${Number(p.negative_marks)} per wrong answer` : " · no negative marking"}.
          </p>
        </section>
        {questions.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">Admin hasn't added questions to this passage yet.</div>
        ) : (
          <Button onClick={start} disabled={busy} className="mt-4 h-12 w-full bg-gradient-primary font-black shadow-glow">
            {busy ? "Starting…" : "Start reading"}
          </Button>
        )}
        <Link to="/reading" className="mt-3 block text-center text-xs font-bold text-primary">← All reading quizzes</Link>
      </AppShell>
    );
  }

  if (phase === "reading") {
    const pct = p.reading_seconds ? ((p.reading_seconds - readLeft) / p.reading_seconds) * 100 : 100;
    return (
      <AppShell>
        <div className="sticky top-0 z-20 -mx-4 mb-3 bg-background/90 px-4 py-2 backdrop-blur">
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="inline-flex items-center gap-1 text-primary"><Clock className="h-4 w-4" /> Reading time</span>
            <span className={cn("tabular-nums", readLeft <= 10 && "animate-pulse text-destructive")}>{String(Math.floor(readLeft / 60)).padStart(2, "0")}:{String(readLeft % 60).padStart(2, "0")}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <article className="select-none rounded-3xl bg-card p-5 shadow-soft" style={{ userSelect: "none" }}>
          <h1 className="text-xl font-black">{p.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-[17px] leading-8">{p.passage}</p>
        </article>
        <p className="mt-3 text-center text-xs text-muted-foreground">Questions unlock automatically when the timer ends. The timer can't be skipped.</p>
      </AppShell>
    );
  }

  if (phase === "quiz") {
    const q = questions[idx];
    const opts = displayOptions ? displayOptions[idx] : q.options.map((o, i) => ({ o, i }));
    const pct = questions.length ? ((idx + 1) / questions.length) * 100 : 0;
    return (
      <AppShell>
        <div className="sticky top-0 z-20 -mx-4 mb-3 bg-background/90 px-4 py-2 backdrop-blur">
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="inline-flex items-center gap-1"><Timer className="h-4 w-4 text-primary" /> {String(Math.floor(quizLeft / 60)).padStart(2, "0")}:{String(quizLeft % 60).padStart(2, "0")}</span>
            <span>{idx + 1}/{questions.length}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {p.keep_passage_visible ? (
          <details className="mb-3 select-none rounded-2xl bg-muted/40 p-3 text-sm">
            <summary className="cursor-pointer font-bold">📖 Passage</summary>
            <p className="mt-2 whitespace-pre-wrap leading-7">{p.passage}</p>
          </details>
        ) : (
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> The passage is hidden for this quiz.
          </div>
        )}

        <div className="select-none rounded-3xl bg-gradient-card p-5 shadow-soft">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">Question {idx + 1}</div>
          <h2 className="mt-2 text-lg font-bold leading-snug">{q.question}</h2>
        </div>

        <div className="mt-4 space-y-3">
          {opts.map(({ o, i }, pos) => {
            const selected = answers[idx] === i;
            return (
              <button
                key={pos}
                onClick={() => setAnswers((a) => { const n = [...a]; n[idx] = i; return n; })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 bg-card p-4 text-left text-sm font-medium transition-all",
                  selected ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:border-primary/40",
                )}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold", selected ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {String.fromCharCode(65 + pos)}
                </span>
                <span className="flex-1">{o}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={() => setAnswers((a) => { const n = [...a]; n[idx] = -1; return n; })}>Skip</Button>
          {idx < questions.length - 1 ? (
            <Button className="h-12 flex-[2] bg-gradient-primary font-bold" onClick={() => setIdx(idx + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
          ) : (
            <Button className="h-12 flex-[2] bg-gradient-primary font-bold" disabled={busy} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit"}</Button>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-center text-primary-foreground shadow-lift">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">Result</div>
        <h1 className="mt-1 text-3xl font-black">{Number(result?.score ?? 0).toFixed(2)} pts</h1>
        <p className="mt-1 text-sm opacity-90">Accuracy {Number(result?.accuracy ?? 0).toFixed(0)}% · {result?.correct ?? 0} correct · {result?.wrong ?? 0} wrong · {result?.unanswered ?? 0} skipped</p>
      </section>

      <div className="mt-4 space-y-3">
        {questions.map((q, i) => {
          const given = answers[i];
          const ok = given === q.correct_index;
          return (
            <div key={q.id} className="rounded-2xl bg-card p-4 shadow-soft">
              <div className="text-sm font-bold">{i + 1}. {q.question}</div>
              <div className="mt-2 space-y-1 text-xs">
                {q.options.map((o, oi) => (
                  <div key={oi} className={cn(
                    "rounded-lg px-2 py-1",
                    oi === q.correct_index && "bg-success/15 font-bold text-success",
                    oi === given && oi !== q.correct_index && "bg-destructive/15 font-bold text-destructive",
                  )}>
                    {String.fromCharCode(65 + oi)}. {o}
                    {oi === q.correct_index && " ✓"}
                    {oi === given && oi !== q.correct_index && " ✗ your answer"}
                  </div>
                ))}
              </div>
              {!ok && given === null && <div className="mt-1 text-[11px] text-muted-foreground">Not answered</div>}
              {p.show_explanations && q.explanation && <div className="mt-2 rounded-lg bg-muted/50 p-2 text-[11px]">💡 {q.explanation}</div>}
            </div>
          );
        })}
      </div>

      <Link to="/reading" className="mt-4 block text-center text-xs font-bold text-primary">← More reading quizzes</Link>
    </AppShell>
  );
}
