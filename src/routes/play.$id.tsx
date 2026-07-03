import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight, X, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAntiCheat } from "@/lib/anti-cheat";
import { toast } from "sonner";

export const Route = createFileRoute("/play/$id")({
  component: PlayPage,
});

type Contest = {
  id: string;
  title: string;
  category_id: string | null;
  duration_minutes: number;
  num_questions: number;
  active: boolean;
  results_status: string;
};
type Q = { id: string; question: string; options: string[] };

function PlayPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [c, setC] = useState<Contest | null | undefined>(undefined);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: contest } = await supabase.from("contests").select("id, title, category_id, duration_minutes, num_questions, active, results_status").eq("id", id).maybeSingle();
      if (!contest) { setC(null); return; }
      setC(contest as Contest);
      if (!contest.active) {
        setBlocked("This contest is not currently open. Please wait for the admin to activate it.");
        return;
      }
      if (contest.results_status === "declared") {
        setBlocked("Results have already been declared for this contest.");
        return;
      }
      setRemaining((contest.duration_minutes || 5) * 60);
      if (!contest.category_id) { setQuestions([]); setAnswers([]); return; }
      const { data: qs } = await supabase
        .from("questions")
        .select("id, question, options")
        .eq("category_id", contest.category_id)
        .limit(contest.num_questions || 10);
      const shaped = (qs ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
      }));
      setQuestions(shaped);
      setAnswers(Array(shaped.length).fill(null));
    })();
  }, [id]);

  useEffect(() => {
    if (submitted || !c) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [submitted, c]);

  const submit = useCallback(() => {
    if (submitted || !c) return;
    setSubmitted(true);
    void anti.finalize(0, answers);
    nav({ to: "/result/$id", params: { id: c.id } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, c, nav, submitted]);

  const anti = useAntiCheat({
    contestId: c?.id ?? "",
    enabled: !submitted && !!c,
    maxViolations: 3,
    onAlreadyAttempted: () => {
      toast.error("You have already attempted this contest.");
      if (c) nav({ to: "/result/$id", params: { id: c.id } });
    },
    onForceSubmit: (reason) => {
      toast.error(`Auto-submitted: ${reason}`);
      submit();
    },
  });

  useEffect(() => {
    if (c && remaining === 0 && !submitted) submit();
  }, [c, remaining, submit, submitted]);

  if (c === undefined) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!c) return <div className="p-6">Contest not found</div>;
  if (questions.length === 0) return <div className="p-6 text-sm text-muted-foreground">Admin hasn't added questions for this contest yet.</div>;

  const q = questions[idx];
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = ((idx + 1) / questions.length) * 100;
  const danger = remaining < 30;

  const pick = (i: number) => {
    setAnswers((a) => {
      const next = [...a];
      next[idx] = i;
      return next;
    });
  };

  const next = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else submit();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button onClick={() => confirm("Quit quiz? Your entry won't be refunded.") && nav({ to: "/" })} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4" />
          </button>
          <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums", danger ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-gradient-primary text-primary-foreground")}>
            <Clock className="h-3.5 w-3.5" />
            {mm}:{ss}
          </div>
          <div className="flex items-center gap-2">
            {anti.violations > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">
                <ShieldAlert className="h-3 w-3" />{anti.violations}/3
              </div>
            )}
            <div className="text-sm font-bold">{idx + 1}/{questions.length}</div>
          </div>
        </div>
        <div className="h-1 bg-muted">
          <div className="h-full bg-gradient-primary transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-32">
        <div className="rounded-3xl bg-gradient-card p-5 shadow-soft">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">Question {idx + 1}</div>
          <h2 className="mt-2 text-lg font-bold leading-snug">{q.question}</h2>
        </div>

        <div className="mt-5 space-y-3">
          {q.options.map((opt, i) => {
            const selected = answers[idx] === i;
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 bg-card p-4 text-left text-sm font-medium transition-all",
                  selected ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:border-primary/40"
                )}
              >
                <span className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold transition-all",
                  selected ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="outline" onClick={() => pick(-1)} className="h-12 flex-1">Skip</Button>
          <Button onClick={next} disabled={answers[idx] === null} className="h-12 flex-[2] bg-gradient-primary font-bold shadow-glow">
            {idx === questions.length - 1 ? "Submit" : "Next"} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
