import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { GURU_SKILL_TRACKS, type SkillTrack } from "@/lib/guru-hub";
import { generateGuruChallenge, submitGuruChallenge } from "@/lib/guru-hub.functions";
import { guruAsk } from "@/lib/guru.functions";
import { ArrowLeft, Check, Rocket, Sparkles, Wrench, X } from "lucide-react";

export const Route = createFileRoute("/guru/skills")({
  head: () => ({
    meta: [
      { title: "Guru.AI Skills — Learn Coding, English, Finance & More" },
      { name: "description", content: "Follow Guru.AI skill roadmaps: spoken English, coding, maths tricks, GK, reading and money skills — taught by your AI character with practice assessments." },
      { property: "og:title", content: "Guru.AI Skills World" },
      { property: "og:description", content: "Skill roadmaps with AI lessons, practice and XP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruSkillsPage,
});

type Q = { question: string; options: string[]; correct_index: number; explanation: string };

function GuruSkillsPage() {
  const { state } = useUser();
  const ask = useServerFn(guruAsk);
  const gen = useServerFn(generateGuruChallenge);
  const submit = useServerFn(submitGuruChallenge);

  const [track, setTrack] = useState<SkillTrack | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [lesson, setLesson] = useState<string>("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ xpEarned: number; accuracy: number } | null>(null);

  const teach = useMutation({
    mutationFn: (args: { track: SkillTrack; level: string; intent: "learn" | "simple" | "revise" }) =>
      ask({
        data: {
          question: `Teach me "${args.level}" in the skill "${args.track.title}". ${args.track.blurb}`,
          intent: args.intent,
          scope: "skills",
        },
      }),
    onSuccess: (r) => setLesson(r.reply),
  });

  const challenge = useMutation({
    mutationFn: (args: { track: SkillTrack; level: string }) =>
      gen({ data: { subject: args.track.title, focus: args.level, count: 5 } }),
    onSuccess: (r) => {
      setQuestions(r.questions as Q[]);
      setAnswers({});
      setResult(null);
    },
  });

  const finish = useMutation({
    mutationFn: (correct: number) =>
      submit({ data: { correct, total: questions.length, label: `${track?.title ?? "Skill"} — ${level ?? ""}` } }),
    onSuccess: (r) => setResult({ xpEarned: r.xpEarned, accuracy: r.accuracy }),
  });

  function openLevel(t: SkillTrack, l: string) {
    setTrack(t);
    setLevel(l);
    setLesson("");
    setQuestions([]);
    setAnswers({});
    setResult(null);
    teach.mutate({ track: t, level: l, intent: "learn" });
  }

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter Skills World</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  if (track && level) {
    const correct = questions.reduce((s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0), 0);
    const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;
    return (
      <AppShell>
        <button type="button" onClick={() => { setTrack(null); setLevel(null); }} className="press mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All skills
        </button>
        <h1 className="text-xl font-black">{track.emoji} {level}</h1>
        <div className="text-[11px] text-muted-foreground">{track.title} roadmap</div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {([["learn", "Learn"], ["simple", "Explain simply"], ["revise", "Revise"]] as const).map(([intent, label]) => (
            <button
              key={intent}
              type="button"
              disabled={teach.isPending}
              onClick={() => teach.mutate({ track, level, intent })}
              className="press rounded-full bg-secondary px-3 py-1 text-[11px] font-bold disabled:opacity-50"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={challenge.isPending}
            onClick={() => challenge.mutate({ track, level })}
            className="press rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {challenge.isPending ? "Building…" : "Assess me"}
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-card p-4 text-sm shadow-soft">
          {teach.isPending && <div className="text-muted-foreground">Your AI teacher is preparing this lesson…</div>}
          {!teach.isPending && teach.isError && (
            <div className="text-muted-foreground">
              Lesson could not load right now.
              <button type="button" onClick={() => teach.mutate({ track, level, intent: "learn" })} className="ml-1 font-bold text-primary">Retry</button>
            </div>
          )}
          {!teach.isPending && lesson && <div className="whitespace-pre-wrap leading-relaxed">{lesson}</div>}
          {!teach.isPending && !lesson && !teach.isError && <div className="text-muted-foreground">Tap Learn to begin.</div>}
        </div>

        {questions.length > 0 && (
          <div className="mt-4 grid gap-2">
            {questions.map((q, i) => (
              <div key={i} className="rounded-2xl bg-card p-3 shadow-soft">
                <div className="text-sm font-bold">{i + 1}. {q.question}</div>
                <div className="mt-2 grid gap-1.5">
                  {q.options.map((o, oi) => {
                    const picked = answers[i] === oi;
                    const show = result !== null;
                    const good = show && oi === q.correct_index;
                    const bad = show && picked && oi !== q.correct_index;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={result !== null}
                        onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                        className={`press flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                          good ? "bg-primary/15 text-primary" : bad ? "bg-destructive/15 text-destructive" : picked ? "bg-secondary" : "bg-muted"
                        }`}
                      >
                        <span>{o}</span>
                        {good && <Check className="h-3.5 w-3.5" />}
                        {bad && <X className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
                {result !== null && q.explanation && (
                  <div className="mt-2 text-[11px] text-muted-foreground">{q.explanation}</div>
                )}
              </div>
            ))}

            {result === null ? (
              <Button className="bg-gradient-primary" disabled={!allAnswered || finish.isPending} onClick={() => finish.mutate(correct)}>
                {finish.isPending ? "Scoring…" : "Submit assessment"}
              </Button>
            ) : (
              <div className="rounded-2xl bg-card p-4 text-center shadow-soft">
                <div className="text-lg font-black">{result.accuracy}% accuracy</div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> +{result.xpEarned} XP
                </div>
              </div>
            )}
          </div>
        )}

        {challenge.isSuccess && questions.length === 0 && (
          <div className="mt-4 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">
            The assessment engine is not connected yet — keep learning and try again later.
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Wrench className="h-3.5 w-3.5" /> Guru.AI Skills
        </div>
        <h1 className="mt-1 text-2xl font-black">Learn a real-world skill</h1>
        <p className="mt-1 text-sm opacity-90">Pick a roadmap, learn each level with your AI teacher, then prove it in an assessment.</p>
      </section>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {GURU_SKILL_TRACKS.map((t) => (
          <div key={t.slug} className="rounded-2xl bg-card p-3 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="text-xl">{t.emoji}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{t.title}</div>
                <div className="text-[11px] text-muted-foreground">{t.blurb}</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {t.levels.map((l, i) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => openLevel(t, l)}
                  className="press rounded-full bg-secondary px-3 py-1 text-[11px] font-bold"
                >
                  <span className="mr-1 text-primary">L{i + 1}</span>{l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-card p-3 text-[11px] text-muted-foreground shadow-soft">
        <Rocket className="h-4 w-4 text-primary" /> More skill tracks are added by the Guru.AI team over time.
      </div>
    </AppShell>
  );
}
