import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { getGuruTopic, guruAsk, generateTopicTest, submitTopicTest } from "@/lib/guru.functions";
import { BookOpen, Sparkles, HelpCircle, Repeat, ListChecks, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/topic/$id")({
  head: () => ({
    meta: [
      { title: "Learn a Topic — Guru.AI AI Teacher" },
      { name: "description", content: "Learn any school topic with your Guru.AI teacher: guided lessons, doubt solving, simple explanations, practice and a mastery test." },
      { property: "og:title", content: "Learn a Topic — Guru.AI" },
      { property: "og:description", content: "Your AI teacher explains, practises and tests you on this topic." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TopicPage,
});

const INTENTS = [
  { key: "learn", label: "Learn", icon: BookOpen, prompt: "Teach me this topic step by step." },
  { key: "doubt", label: "Ask Doubt", icon: HelpCircle, prompt: "" },
  { key: "simple", label: "Explain Simply", icon: Sparkles, prompt: "Explain this topic in the simplest way with an example." },
  { key: "practice", label: "Practice", icon: ListChecks, prompt: "Give me 5 practice questions with answers on this topic." },
  { key: "revise", label: "Revise", icon: Repeat, prompt: "Give me a quick revision summary of this topic." },
] as const;

type Intent = (typeof INTENTS)[number]["key"];

function TopicPage() {
  const { id } = Route.useParams();
  const { state } = useUser();
  const qc = useQueryClient();
  const loadTopic = useServerFn(getGuruTopic);
  const ask = useServerFn(guruAsk);
  const genTest = useServerFn(generateTopicTest);
  const submitTest = useServerFn(submitTopicTest);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [test, setTest] = useState<{ question: string; options: string[]; correct_index: number; explanation?: string }[] | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [scored, setScored] = useState<{ correct: number; total: number; xpEarned: number } | null>(null);

  const { data: topic, isLoading } = useQuery({
    queryKey: ["guru-topic", id],
    queryFn: () => loadTopic({ data: { topic_id: id } }),
    enabled: state.loggedIn,
  });

  const askMut = useMutation({
    mutationFn: (vars: { intent: Intent; question: string }) =>
      ask({ data: { question: vars.question, intent: vars.intent, scope: "school", topic_id: id } }),
    onSuccess: (r) => setAnswer(r.reply),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Guru.AI could not answer"),
  });

  const testMut = useMutation({
    mutationFn: () => genTest({ data: { topic_id: id, count: 5 } }),
    onSuccess: (r) => {
      if (!r.questions.length) {
        toast.error("Test questions are not available right now.");
        return;
      }
      setTest(r.questions);
      setPicked({});
      setScored(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build a test"),
  });

  const finishMut = useMutation({
    mutationFn: (vars: { correct: number; total: number }) =>
      submitTest({ data: { topic_id: id, correct: vars.correct, total: vars.total, seconds: 0 } }),
    onSuccess: (r, vars) => {
      setScored({ correct: vars.correct, total: vars.total, xpEarned: r.xpEarned });
      toast.success(`+${r.xpEarned} XP • ${r.accuracy}% accuracy`);
      qc.invalidateQueries({ queryKey: ["guru-dashboard"] });
      qc.invalidateQueries({ queryKey: ["guru-learning"] });
      qc.invalidateQueries({ queryKey: ["guru-topic", id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save your test"),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to learn this topic</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const crumb = topic
    ? [topic.breadcrumb.board, topic.breadcrumb.className, topic.breadcrumb.subject, topic.breadcrumb.chapter].filter(Boolean).join(" • ")
    : "";

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">{crumb || "Guru.AI School"}</div>
        <h1 className="mt-1 text-2xl font-black">{topic?.title ?? (isLoading ? "Loading…" : "Topic")}</h1>
        {topic && (
          <div className="mt-2 flex items-center gap-2 text-[11px] opacity-90">
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 capitalize">{topic.difficulty ?? "easy"}</span>
            {topic.minutes ? <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5">{topic.minutes} min</span> : null}
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5">Mastery {topic.mastery}%</span>
          </div>
        )}
      </header>

      {(topic?.objectives.length ?? 0) > 0 && (
        <section className="mt-4 rounded-2xl bg-card p-4 shadow-soft">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">You will learn</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {topic!.objectives.map((o) => (
              <li key={o} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{o}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Your AI teacher</h2>
        <div className="flex flex-wrap gap-2">
          {INTENTS.filter((i) => i.key !== "doubt").map(({ key, label, icon: Icon, prompt }) => (
            <Button
              key={key}
              size="sm"
              variant="secondary"
              disabled={askMut.isPending}
              onClick={() => askMut.mutate({ intent: key, question: `${prompt} Topic: ${topic?.title ?? ""}` })}
            >
              <Icon className="mr-1 h-3.5 w-3.5" /> {label}
            </Button>
          ))}
          <Button size="sm" className="bg-gradient-primary" disabled={testMut.isPending} onClick={() => testMut.mutate()}>
            {testMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ListChecks className="mr-1 h-3.5 w-3.5" />} Test Me
          </Button>
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const q = question.trim();
            if (!q) return;
            askMut.mutate({ intent: "doubt", question: q });
            setQuestion("");
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a doubt about this topic…"
            className="min-w-0 flex-1 rounded-2xl bg-card px-4 py-2.5 text-sm shadow-soft outline-none"
          />
          <Button type="submit" disabled={askMut.isPending} className="bg-gradient-primary">Ask</Button>
        </form>

        {askMut.isPending && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Guru.AI is thinking…
          </div>
        )}
        {answer && !askMut.isPending && (
          <article className="mt-3 whitespace-pre-wrap rounded-2xl bg-card p-4 text-sm leading-relaxed shadow-soft">{answer}</article>
        )}
      </section>

      {test && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Mastery test</h2>
          <div className="grid gap-3">
            {test.map((q, qi) => (
              <div key={`${qi}-${q.question}`} className="rounded-2xl bg-card p-4 shadow-soft">
                <div className="text-sm font-bold">{qi + 1}. {q.question}</div>
                <div className="mt-2 grid gap-1.5">
                  {q.options.map((opt, oi) => {
                    const chosen = picked[qi] === oi;
                    const reveal = scored !== null;
                    const isRight = oi === q.correct_index;
                    return (
                      <button
                        key={`${qi}-${oi}-${opt}`}
                        type="button"
                        disabled={scored !== null}
                        onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                        className={`press flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                          reveal && isRight
                            ? "bg-success/15 text-success"
                            : reveal && chosen
                              ? "bg-destructive/15 text-destructive"
                              : chosen
                                ? "bg-primary/15 text-primary"
                                : "bg-muted"
                        }`}
                      >
                        {opt}
                        {reveal && isRight && <Check className="h-4 w-4" />}
                        {reveal && chosen && !isRight && <X className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
                {scored !== null && q.explanation && (
                  <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>
                )}
              </div>
            ))}
          </div>

          {scored === null ? (
            <Button
              className="mt-3 w-full bg-gradient-primary"
              disabled={finishMut.isPending || Object.keys(picked).length !== test.length}
              onClick={() => {
                const correct = test.reduce((acc, q, qi) => acc + (picked[qi] === q.correct_index ? 1 : 0), 0);
                finishMut.mutate({ correct, total: test.length });
              }}
            >
              {finishMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Submit test
            </Button>
          ) : (
            <div className="mt-3 rounded-2xl bg-gradient-primary p-4 text-center text-primary-foreground shadow-lift">
              <div className="text-sm font-bold">Score {scored.correct}/{scored.total}</div>
              <div className="text-xs opacity-90">+{scored.xpEarned} XP earned</div>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
