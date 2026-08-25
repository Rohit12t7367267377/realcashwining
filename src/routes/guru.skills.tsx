import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import {
  GURU_SKILL_TRACKS,
  SKILL_CATEGORIES,
  SKILL_STAGES,
  type SkillStage,
  type SkillTrack,
} from "@/lib/guru-hub";
import { generateGuruChallenge, submitGuruChallenge } from "@/lib/guru-hub.functions";
import { guruAsk } from "@/lib/guru.functions";
import { ArrowLeft, Check, GraduationCap, Rocket, Sparkles, Wrench, X } from "lucide-react";

export const Route = createFileRoute("/guru/skills")({
  head: () => ({
    meta: [
      { title: "Skill Academy — Learn Coding, AI, Cloud & Career Skills | Guru.AI" },
      { name: "description", content: "Skill Academy takes you from Beginner to Intermediate, Advanced, Projects, Practice and Assessment in Java, Python, C, C++, JavaScript, DSA, AI, ML, Data Science, Web, App, Cyber, Cloud, English, Aptitude and Interview prep — with an AI mentor for every skill." },
      { property: "og:title", content: "Skill Academy — Guru.AI" },
      { property: "og:description", content: "18+ skill tracks with staged roadmaps, projects, practice, assessments and a dedicated AI mentor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruSkillsPage,
});

type Q = { question: string; options: string[]; correct_index: number; explanation: string };
type Intent = "learn" | "simple" | "revise" | "practice";

const STAGE_HINT: Record<SkillStage, string> = {
  Beginner: "Start from zero with easy words and examples.",
  Intermediate: "Build on the basics with real usage.",
  Advanced: "Go deep — edge cases, internals and best practices.",
  Projects: "Guide me to build this, step by step, with a starter plan.",
  Practice: "Give me graded practice problems with hints, then answers.",
  Assessment: "Test me and tell me what to revise.",
};

function GuruSkillsPage() {
  const { state } = useUser();
  const ask = useServerFn(guruAsk);
  const gen = useServerFn(generateGuruChallenge);
  const submit = useServerFn(submitGuruChallenge);

  const [category, setCategory] = useState<string>("All");
  const [track, setTrack] = useState<SkillTrack | null>(null);
  const [stage, setStage] = useState<SkillStage>("Beginner");
  const [lesson, setLesson] = useState<string>("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ xpEarned: number; accuracy: number } | null>(null);

  const teach = useMutation({
    mutationFn: (args: { track: SkillTrack; stage: SkillStage; intent: Intent }) =>
      ask({
        data: {
          question:
            `I am learning the skill "${args.track.title}" (${args.track.blurb}). ` +
            `Stage: ${args.stage} — ${args.track.stages[args.stage]}. ${STAGE_HINT[args.stage]}`,
          intent: args.intent,
          scope: "skills" as const,
          learner_context: `Skill Academy track: ${args.track.title} (${args.track.category}). Stage: ${args.stage}. Mentor: ${args.track.mentor.name}, ${args.track.mentor.role}.`,
        },
      }),
    onSuccess: (r) => setLesson(r.reply),
  });

  const challenge = useMutation({
    mutationFn: (args: { track: SkillTrack; stage: SkillStage }) =>
      gen({ data: { subject: args.track.title, focus: `${args.stage}: ${args.track.stages[args.stage]}`, count: 5 } }),
    onSuccess: (r) => {
      setQuestions(r.questions as Q[]);
      setAnswers({});
      setResult(null);
    },
  });

  const finish = useMutation({
    mutationFn: (correct: number) =>
      submit({ data: { correct, total: questions.length, label: `${track?.title ?? "Skill"} — ${stage}` } }),
    onSuccess: (r) => setResult({ xpEarned: r.xpEarned, accuracy: r.accuracy }),
  });

  function openStage(t: SkillTrack, s: SkillStage) {
    setTrack(t);
    setStage(s);
    setLesson("");
    setQuestions([]);
    setAnswers({});
    setResult(null);
    if (s === "Assessment") challenge.mutate({ track: t, stage: s });
    teach.mutate({ track: t, stage: s, intent: s === "Practice" ? "practice" : "learn" });
  }

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter Skill Academy</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  if (track) {
    const correct = questions.reduce((s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0), 0);
    const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;
    return (
      <AppShell>
        <button type="button" onClick={() => setTrack(null)} className="press mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All skills
        </button>
        <h1 className="text-xl font-black">{track.emoji} {track.title}</h1>
        <div className="text-[11px] text-muted-foreground">{track.category} • {stage}: {track.stages[stage]}</div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card p-3 shadow-soft">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-lg">{track.mentor.emoji}</span>
          <div className="min-w-0">
            <div className="text-xs font-black">{track.mentor.name}</div>
            <div className="text-[11px] text-muted-foreground">Your AI {track.mentor.role.toLowerCase()}</div>
          </div>
          <Link to="/guru/classroom" search={{ topic: `${track.title} — ${track.stages[stage]}` }} className="ml-auto">
            <Button size="sm" variant="secondary">Teach on board</Button>
          </Link>
        </div>

        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SKILL_STAGES.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => openStage(track, s)}
              className={`press shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${stage === s ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}
            >
              <span className="mr-1 opacity-70">{i + 1}</span>{s}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {([["learn", "Learn"], ["simple", "Explain simply"], ["revise", "Revise"], ["practice", "Practice"]] as const).map(([intent, label]) => (
            <button
              key={intent}
              type="button"
              disabled={teach.isPending}
              onClick={() => teach.mutate({ track, stage, intent })}
              className="press rounded-full bg-secondary px-3 py-1 text-[11px] font-bold disabled:opacity-50"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={challenge.isPending}
            onClick={() => challenge.mutate({ track, stage })}
            className="press rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {challenge.isPending ? "Building…" : "Assess me"}
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-card p-4 text-sm shadow-soft">
          {teach.isPending && <div className="text-muted-foreground">{track.mentor.name} is preparing this lesson…</div>}
          {!teach.isPending && teach.isError && (
            <div className="text-muted-foreground">
              Lesson could not load right now.
              <button type="button" onClick={() => teach.mutate({ track, stage, intent: "learn" })} className="ml-1 font-bold text-primary">Retry</button>
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

  const shown = category === "All" ? GURU_SKILL_TRACKS : GURU_SKILL_TRACKS.filter((t) => t.category === category);

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Wrench className="h-3.5 w-3.5" /> Guru.AI Skill Academy
        </div>
        <h1 className="mt-1 text-2xl font-black">Learn a real career skill</h1>
        <p className="mt-1 text-sm opacity-90">Every track runs Beginner → Intermediate → Advanced → Projects → Practice → Assessment, with its own AI mentor.</p>
      </section>

      <div className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {["All", ...SKILL_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`press shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${category === c ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {shown.map((t) => (
          <div key={t.slug} className="rounded-3xl bg-card p-3 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl">{t.emoji}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{t.title}</div>
                <div className="text-[11px] text-muted-foreground">{t.blurb}</div>
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">
              <GraduationCap className="h-3 w-3" /> Mentor: {t.mentor.name}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SKILL_STAGES.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => openStage(t, s)}
                  className="press rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold"
                  title={t.stages[s]}
                >
                  <span className="mr-1 text-primary">{i + 1}</span>{s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-card p-3 text-[11px] text-muted-foreground shadow-soft">
        <Rocket className="h-4 w-4 text-primary" /> New skill tracks and mentors are added to Skill Academy over time.
      </div>
    </AppShell>
  );
}
