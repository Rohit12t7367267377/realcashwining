import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import {
  getGuruExam,
  getExamQuestions,
  getExamStudyPlan,
  getExamSyllabus,
  getExamTopics,
  saveExamAttempt,
} from "@/lib/guru-exams.functions";
import type { ExamQuestion } from "@/lib/guru-exams.server";
import { ArrowLeft, Bot, CalendarDays, ClipboardList, LineChart, ListChecks, Repeat, Target, Timer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/exams_/$code")({
  head: ({ params }) => {
    const name = params.code.replace(/-/g, " ").toUpperCase();
    return {
      meta: [
        { title: `${name} Preparation — Syllabus, PYQs & Mock Tests | Guru.AI` },
        {
          name: "description",
          content: `${name} preparation with AI teacher, full syllabus, subject-wise topics, practice questions, previous-year style PYQs, mock tests, weak-topic analysis and a personalised study plan.`,
        },
        { property: "og:title", content: `${name} Preparation — Guru.AI` },
        {
          property: "og:description",
          content: `Syllabus, practice, PYQs, mock tests and study plan for ${name}.`,
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ExamDetailPage,
});

type Tab =
  | "syllabus"
  | "subjects"
  | "practice"
  | "pyq"
  | "mock"
  | "quiz"
  | "performance"
  | "revision"
  | "plan";

const TABS: { id: Tab; label: string; icon: typeof Target }[] = [
  { id: "syllabus", label: "Syllabus", icon: ClipboardList },
  { id: "subjects", label: "Subjects & Topics", icon: ListChecks },
  { id: "practice", label: "Practice", icon: Target },
  { id: "pyq", label: "PYQs", icon: Repeat },
  { id: "mock", label: "Mock Test", icon: Timer },
  { id: "quiz", label: "Quiz", icon: Bot },
  { id: "performance", label: "Performance", icon: LineChart },
  { id: "revision", label: "Revision", icon: Repeat },
  { id: "plan", label: "Study Plan", icon: CalendarDays },
];

function ExamDetailPage() {
  const { code } = Route.useParams();
  const { state } = useUser();
  const loadExam = useServerFn(getGuruExam);
  const loadSyllabus = useServerFn(getExamSyllabus);
  const loadTopics = useServerFn(getExamTopics);
  const loadQuestions = useServerFn(getExamQuestions);
  const saveAttempt = useServerFn(saveExamAttempt);
  const loadPlan = useServerFn(getExamStudyPlan);

  const [tab, setTab] = useState<Tab>("syllabus");
  const [subject, setSubject] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [aiTopics, setAiTopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [qMode, setQMode] = useState<"practice" | "quiz" | "mock" | "pyq">("practice");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["guru-exam", code],
    queryFn: () => loadExam({ data: { code } }),
    enabled: state.loggedIn,
  });

  const examName = data?.exam.name ?? code;
  const language = (typeof document !== "undefined" && document.documentElement.lang === "hi" ? "hi" : "en") as
    | "en"
    | "hi";

  const syllabus = useQuery({
    queryKey: ["exam-syllabus", examName, language],
    queryFn: () => loadSyllabus({ data: { exam: examName, language } }),
    enabled: state.loggedIn && !!data && tab === "syllabus",
    staleTime: 30 * 60 * 1000,
  });

  const activeSubject = subject || data?.subjects[0]?.name || "";
  const dbTopics = data?.subjects.find((s) => s.name === activeSubject)?.topics ?? [];
  const topics = dbTopics.length ? dbTopics : aiTopics;

  const topicsMut = useMutation({
    mutationFn: () => loadTopics({ data: { exam: examName, subject: activeSubject } }),
    onSuccess: (res) => {
      setAiTopics(res);
      if (!res.length) toast.error("Could not load topics right now");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load topics"),
  });

  const qMut = useMutation({
    mutationFn: (mode: "practice" | "quiz" | "mock" | "pyq") =>
      loadQuestions({
        data: {
          exam: examName,
          subject: activeSubject,
          topic: topic || undefined,
          mode,
          count: mode === "mock" ? 15 : 5,
          difficulty: mode === "mock" ? "hard" : "medium",
          language,
        },
      }),
    onSuccess: (res, mode) => {
      if (!res.length) {
        toast.error("Questions are unavailable right now — try again");
        return;
      }
      setQuestions(res);
      setQMode(mode);
      setAnswers({});
      setSubmitted(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build questions"),
  });

  const submitMut = useMutation({
    mutationFn: () => {
      const correct = questions.reduce((s, q, i) => s + (answers[i] === q.answerIndex ? 1 : 0), 0);
      return saveAttempt({
        data: {
          exam_code: code,
          subject: activeSubject,
          topic: topic || "",
          mode: qMode,
          correct,
          total: questions.length,
        },
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Attempt saved to your performance analysis");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save your attempt"),
  });

  const perf = useMemo(() => {
    const rows = data?.attempts ?? [];
    const total = rows.reduce((s, r) => s + r.total, 0);
    const correct = rows.reduce((s, r) => s + r.correct, 0);
    const bySubject = new Map<string, { correct: number; total: number }>();
    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const r of rows) {
      const sKey = r.subject || "General";
      const s = bySubject.get(sKey) ?? { correct: 0, total: 0 };
      bySubject.set(sKey, { correct: s.correct + r.correct, total: s.total + r.total });
      if (r.topic) {
        const t = byTopic.get(r.topic) ?? { correct: 0, total: 0 };
        byTopic.set(r.topic, { correct: t.correct + r.correct, total: t.total + r.total });
      }
    }
    const weak = Array.from(byTopic.entries())
      .map(([name, v]) => ({ name, accuracy: Math.round((v.correct / Math.max(1, v.total)) * 100), total: v.total }))
      .filter((x) => x.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);
    return {
      attempts: rows.length,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      answered: total,
      bySubject: Array.from(bySubject.entries()).map(([name, v]) => ({
        name,
        accuracy: Math.round((v.correct / Math.max(1, v.total)) * 100),
        total: v.total,
      })),
      weak,
    };
  }, [data?.attempts]);

  const planMut = useMutation({
    mutationFn: () =>
      loadPlan({
        data: { exam: examName, weeks: 8, hoursPerDay: 4, weakTopics: perf.weak.map((w) => w.name), language },
      }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build the plan"),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to prepare for this exam</h1>
          <Link to="/login">
            <Button className="mt-4 bg-gradient-primary">Sign In</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link to="/guru/exams" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All exams
      </Link>

      <section className="mt-2 rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="text-3xl">{data?.exam.emoji ?? "🎯"}</div>
        <h1 className="mt-1 text-2xl font-black">{isLoading ? "Loading…" : examName}</h1>
        <p className="mt-1 text-sm opacity-90">{data?.exam.blurb}</p>
        {data?.exam.conducting_body && (
          <span className="mt-2 inline-block rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-[10px] font-bold">
            Conducted by {data.exam.conducting_body}
          </span>
        )}
      </section>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
              tab === t.id ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Subject picker shared by the study tabs */}
      {tab !== "syllabus" && tab !== "performance" && tab !== "plan" && (
        <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
          <h2 className="text-sm font-black">Subject</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(data?.subjects ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSubject(s.name);
                  setTopic("");
                  setAiTopics([]);
                  setQuestions([]);
                }}
                className={`press rounded-full px-3 py-1 text-[11px] font-bold ${
                  activeSubject === s.name ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
          {topic && (
            <p className="mt-2 text-[11px] font-bold text-muted-foreground">
              Focused topic: {topic}{" "}
              <button type="button" className="underline" onClick={() => setTopic("")}>
                clear
              </button>
            </p>
          )}
        </section>
      )}

      {tab === "syllabus" && (
        <section className="mt-4 grid gap-3">
          {syllabus.isLoading && <p className="text-center text-sm text-muted-foreground">Loading syllabus…</p>}
          {syllabus.data && (
            <>
              <div className="rounded-3xl bg-card p-4 shadow-soft">
                <h2 className="text-sm font-black">Overview</h2>
                <p className="mt-1 text-sm leading-relaxed">{syllabus.data.overview}</p>
              </div>
              {syllabus.data.pattern.length > 0 && (
                <div className="rounded-3xl bg-card p-4 shadow-soft">
                  <h2 className="text-sm font-black">Paper pattern</h2>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {syllabus.data.pattern.map((p) => (
                      <div key={p.label} className="rounded-2xl bg-secondary/50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{p.label}</div>
                        <div className="text-xs font-semibold">{p.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syllabus.data.units.map((u) => (
                <div key={u.subject} className="rounded-3xl bg-card p-4 shadow-soft">
                  <h3 className="text-sm font-black">{u.subject}</h3>
                  <ul className="mt-1.5 grid gap-1 text-xs sm:grid-cols-2">
                    {u.items.map((i) => (
                      <li key={i} className="rounded-xl bg-secondary/40 px-2.5 py-1.5">
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {syllabus.data.tips.length > 0 && (
                <div className="rounded-3xl bg-card p-4 shadow-soft">
                  <h3 className="text-sm font-black">Strategy tips</h3>
                  <ul className="mt-1.5 grid gap-1 text-xs">
                    {syllabus.data.tips.map((t) => (
                      <li key={t}>• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "subjects" && (
        <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black">Topics in {activeSubject || "this exam"}</h2>
            {!dbTopics.length && (
              <Button size="sm" variant="secondary" disabled={topicsMut.isPending} onClick={() => topicsMut.mutate()}>
                {topicsMut.isPending ? "Loading…" : "Load topics"}
              </Button>
            )}
          </div>
          <div className="mt-2 grid gap-1.5">
            {topics.map((t) => (
              <div key={t} className="flex items-center justify-between gap-2 rounded-2xl bg-secondary/50 px-3 py-2">
                <span className="text-xs font-semibold">{t}</span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="press rounded-full bg-card px-2.5 py-1 text-[10px] font-bold"
                    onClick={() => {
                      setTopic(t);
                      setTab("practice");
                    }}
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    className="press rounded-full bg-card px-2.5 py-1 text-[10px] font-bold"
                    onClick={() => {
                      setTopic(t);
                      window.dispatchEvent(
                        new CustomEvent("guru:teach", {
                          detail: { topic: `${examName} • ${activeSubject} • ${t}` },
                        }),
                      );
                    }}
                  >
                    AI Teacher
                  </button>
                </div>
              </div>
            ))}
            {!topics.length && (
              <p className="text-xs text-muted-foreground">
                No topics yet — tap “Load topics” and Guru.AI will build the syllabus topic list.
              </p>
            )}
          </div>
        </section>
      )}

      {(tab === "practice" || tab === "pyq" || tab === "mock" || tab === "quiz") && (
        <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
          <h2 className="text-sm font-black">
            {tab === "practice" && "Practice questions"}
            {tab === "pyq" && "Previous-year style questions"}
            {tab === "mock" && "Mock test (15 questions)"}
            {tab === "quiz" && "Quick quiz"}
          </h2>
          {tab === "pyq" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Modelled on publicly released past papers and rewritten by Guru.AI — no copyrighted paper text is
              reproduced.
            </p>
          )}
          <Button
            className="mt-2 w-full bg-gradient-primary"
            disabled={qMut.isPending || !activeSubject}
            onClick={() => qMut.mutate(tab === "quiz" ? "quiz" : tab === "pyq" ? "pyq" : tab === "mock" ? "mock" : "practice")}
          >
            {qMut.isPending ? "Building…" : `Start ${tab === "mock" ? "mock test" : tab}`}
          </Button>

          {questions.length > 0 && (
            <div className="mt-4 grid gap-3">
              {questions.map((q, i) => (
                <div key={i} className="rounded-2xl bg-secondary/50 p-3">
                  <div className="text-sm font-bold">
                    {i + 1}. {q.question}
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {q.options.map((o, oi) => {
                      const chosen = answers[i] === oi;
                      const good = submitted && oi === q.answerIndex;
                      const bad = submitted && chosen && oi !== q.answerIndex;
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={submitted}
                          onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                          className={`press rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                            good
                              ? "bg-primary text-primary-foreground"
                              : bad
                                ? "bg-destructive text-destructive-foreground"
                                : chosen
                                  ? "bg-card ring-2 ring-primary"
                                  : "bg-card"
                          }`}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && q.explanation && (
                    <p className="mt-2 rounded-xl bg-card p-2 text-[11px] leading-relaxed">{q.explanation}</p>
                  )}
                </div>
              ))}
              {!submitted ? (
                <Button
                  className="bg-gradient-primary"
                  disabled={submitMut.isPending || Object.keys(answers).length === 0}
                  onClick={() => submitMut.mutate()}
                >
                  {submitMut.isPending ? "Saving…" : "Submit & see solutions"}
                </Button>
              ) : (
                <p className="text-center text-xs font-bold">
                  Score: {questions.reduce((s, q, i) => s + (answers[i] === q.answerIndex ? 1 : 0), 0)}/
                  {questions.length}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "performance" && (
        <section className="mt-3 grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Attempts", value: perf.attempts },
              { label: "Questions", value: perf.answered },
              { label: "Accuracy", value: `${perf.accuracy}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-card p-3 text-center shadow-soft">
                <div className="text-lg font-black">{s.value}</div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-card p-4 shadow-soft">
            <h2 className="text-sm font-black">Subject-wise accuracy</h2>
            {perf.bySubject.length ? (
              <div className="mt-2 grid gap-2">
                {perf.bySubject.map((s) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>{s.name}</span>
                      <span>
                        {s.accuracy}% • {s.total} Qs
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-gradient-primary" style={{ width: `${s.accuracy}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Attempt a practice set to unlock your analysis.</p>
            )}
          </div>
          <div className="rounded-3xl bg-card p-4 shadow-soft">
            <h2 className="text-sm font-black">Weak topics</h2>
            {perf.weak.length ? (
              <div className="mt-2 grid gap-1.5">
                {perf.weak.map((w) => (
                  <div key={w.name} className="flex items-center justify-between gap-2 rounded-2xl bg-secondary/50 px-3 py-2">
                    <span className="text-xs font-semibold">{w.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] font-bold text-destructive">{w.accuracy}%</span>
                      <button
                        type="button"
                        className="press rounded-full bg-card px-2.5 py-1 text-[10px] font-bold"
                        onClick={() => {
                          setTopic(w.name);
                          setTab("practice");
                        }}
                      >
                        Fix it
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No weak topics detected yet. Keep practising!</p>
            )}
          </div>
        </section>
      )}

      {tab === "revision" && (
        <section className="mt-3 grid gap-3">
          <div className="rounded-3xl bg-card p-4 shadow-soft">
            <h2 className="text-sm font-black">Smart revision</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Revise the topics you scored lowest on, then take a 5-question quiz to lock them in.
            </p>
            <div className="mt-2 grid gap-1.5">
              {(perf.weak.length ? perf.weak.map((w) => w.name) : topics.slice(0, 6)).map((t) => (
                <div key={t} className="flex items-center justify-between gap-2 rounded-2xl bg-secondary/50 px-3 py-2">
                  <span className="text-xs font-semibold">{t}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="press rounded-full bg-card px-2.5 py-1 text-[10px] font-bold"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("guru:teach", { detail: { topic: `${examName} revision • ${t}` } }),
                        )
                      }
                    >
                      Teach me
                    </button>
                    <button
                      type="button"
                      className="press rounded-full bg-card px-2.5 py-1 text-[10px] font-bold"
                      onClick={() => {
                        setTopic(t);
                        setTab("quiz");
                      }}
                    >
                      Quiz
                    </button>
                  </div>
                </div>
              ))}
              {!perf.weak.length && !topics.length && (
                <p className="text-xs text-muted-foreground">Load topics from the Subjects tab to start revising.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "plan" && (
        <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
          <h2 className="text-sm font-black">Personalised study plan</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            8 weeks, 4 hours a day, prioritising {perf.weak.length ? "your weak topics" : "the full syllabus"}.
          </p>
          <Button className="mt-2 w-full bg-gradient-primary" disabled={planMut.isPending} onClick={() => planMut.mutate()}>
            {planMut.isPending ? "Building plan…" : "Build my plan"}
          </Button>
          {planMut.data && (
            <div className="mt-3 grid gap-2">
              <p className="text-sm leading-relaxed">{planMut.data.summary}</p>
              {planMut.data.weeks.map((w) => (
                <div key={w.week} className="rounded-2xl bg-secondary/50 p-3">
                  <div className="text-xs font-black">
                    {w.week} — {w.focus}
                  </div>
                  <ul className="mt-1 grid gap-0.5 text-[11px]">
                    {w.tasks.map((t) => (
                      <li key={t}>• {t}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {planMut.data.daily.length > 0 && (
                <div className="rounded-2xl bg-card p-3 shadow-soft">
                  <div className="text-xs font-black">Daily routine</div>
                  <ul className="mt-1 grid gap-0.5 text-[11px]">
                    {planMut.data.daily.map((d) => (
                      <li key={d}>• {d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
