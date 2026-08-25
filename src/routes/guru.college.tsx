import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import {
  getCodingQuestions,
  getCollegeCatalog,
  getOutputPredictions,
  getLearnProgress,
  listCollegeDegrees,
  runCodeReview,
  saveLearnProgress,
} from "@/lib/guru-college.functions";
import { getClassNotes, getTopicQuiz, askNotesDoubt } from "@/lib/guru-notes.functions";
import type { CollegeItem } from "@/lib/guru-college.functions";
import type { NotesPayload, QuizItem } from "@/lib/guru-notes";
import { ArrowLeft, Bot, Code2, GraduationCap, Lightbulb, MessageCircleQuestion, Terminal } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/college")({
  head: () => ({
    meta: [
      { title: "College — B.Tech, BCA, B.Sc, MBA & more semester notes | Guru.AI" },
      {
        name: "description",
        content:
          "Degree-wise college learning: pick your degree, university regulation, semester, subject, unit and topic for AI notes, examples, practice, quizzes, doubt solving and a coding lab.",
      },
      { property: "og:title", content: "College Learning Hub — Guru.AI" },
      {
        property: "og:description",
        content: "AI notes, examples, quizzes, doubt solving and a coding lab for every college subject and semester.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollegePage,
});

type Step = "degree" | "regulation" | "term" | "subject" | "unit" | "topic" | "study";
type Tab = "notes" | "teacher" | "examples" | "practice" | "quiz" | "doubt" | "exam" | "code";

const PROG_HINT = /(program|coding|c\+\+|\bc\b|java|python|javascript|data structure|dsa|algorithm|software|web|oop|dbms|sql|compiler|operating system|machine learning|\bai\b)/i;
const LANGS = ["Python", "Java", "C", "C++", "JavaScript", "SQL"];

function CollegePage() {
  const { state } = useUser();
  const loadDegrees = useServerFn(listCollegeDegrees);
  const loadCatalog = useServerFn(getCollegeCatalog);
  const loadNotes = useServerFn(getClassNotes);
  const loadQuiz = useServerFn(getTopicQuiz);
  const askDoubt = useServerFn(askNotesDoubt);
  const loadCoding = useServerFn(getCodingQuestions);
  const loadOutputs = useServerFn(getOutputPredictions);
  const review = useServerFn(runCodeReview);
  const saveProgress = useServerFn(saveLearnProgress);
  const loadProgress = useServerFn(getLearnProgress);

  const [step, setStep] = useState<Step>("degree");
  const [degree, setDegree] = useState<{ id: string; name: string } | null>(null);
  const [regulation, setRegulation] = useState<CollegeItem | null>(null);
  const [term, setTerm] = useState<CollegeItem | null>(null);
  const [subject, setSubject] = useState<CollegeItem | null>(null);
  const [unit, setUnit] = useState<CollegeItem | null>(null);
  const [topic, setTopic] = useState<CollegeItem | null>(null);
  const [tab, setTab] = useState<Tab>("notes");

  const [notes, setNotes] = useState<NotesPayload | null>(null);
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizDone, setQuizDone] = useState(false);
  const [doubt, setDoubt] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const [lang, setLang] = useState("Python");
  const [code, setCode] = useState("");
  const [codeAnswer, setCodeAnswer] = useState("");

  const degrees = useQuery({ queryKey: ["college-degrees"], queryFn: () => loadDegrees(), enabled: state.loggedIn });
  const progress = useQuery({
    queryKey: ["college-progress"],
    queryFn: () => loadProgress({ data: { track: "college" as const } }),
    enabled: state.loggedIn,
  });

  const isProgramming = !!subject && (subject.programming || PROG_HINT.test(subject.name));
  const scope = {
    board: (regulation?.name ?? "University").slice(0, 60),
    className: (term?.name ?? "Sem").replace(/semester\s*/i, "S").slice(0, 10),
    subject: `${subject?.name ?? ""}`.slice(0, 80),
    language: "en" as const,
  };
  const nodeKey = [degree?.name, regulation?.name, term?.name, subject?.name, unit?.name, topic?.name]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 300);

  const listMut = useMutation({
    mutationFn: (input: { level: "regulations" | "terms" | "subjects" | "units" | "topics"; parentId?: string }) =>
      loadCatalog({
        data: {
          level: input.level,
          parentId: input.parentId,
          degree: degree?.name ?? "",
          regulation: regulation?.name,
          term: term?.name,
          subject: subject?.name,
          unit: unit?.name,
        },
      }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load the list"),
  });

  const notesMut = useMutation({
    mutationFn: () => loadNotes({ data: { ...scope, topic: topic?.name ?? "" } }),
    onSuccess: (res) => {
      setNotes(res);
      void saveProgress({ data: { track: "college" as const, node_key: nodeKey, status: "opened" as const, score: null } });
      void progress.refetch();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build the notes"),
  });

  const quizMut = useMutation({
    mutationFn: () => loadQuiz({ data: { ...scope, topic: topic?.name ?? "" } }),
    onSuccess: (res) => {
      setQuiz(res);
      setQuizAnswers({});
      setQuizDone(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build the quiz"),
  });

  const doubtMut = useMutation({
    mutationFn: (question: string) =>
      askNotesDoubtSafe(question),
    onSuccess: (res, question) => setChat((c) => [...c, { role: "user", content: question }, { role: "assistant", content: res.answer }]),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not answer right now"),
  });

  async function askNotesDoubtSafe(question: string) {
    return askDoubt({
      data: { ...scope, topic: topic?.name ?? "", question, history: chat.slice(-8) },
    });
  }

  const codingMut = useMutation({
    mutationFn: () =>
      loadCoding({ data: { subject: subject?.name ?? "", topic: topic?.name ?? "", language: lang, count: 3 } }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build coding questions"),
  });

  const outputMut = useMutation({
    mutationFn: () =>
      loadOutputs({ data: { subject: subject?.name ?? "", topic: topic?.name ?? "", language: lang, count: 3 } }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build output questions"),
  });

  const reviewMut = useMutation({
    mutationFn: (mode: "explain" | "debug" | "review") =>
      review({ data: { mode, language: lang, code, problem: topic?.name } }),
    onSuccess: (res) => setCodeAnswer(res.answer),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not review the code"),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to open College</h1>
          <Link to="/login">
            <Button className="mt-4 bg-gradient-primary">Sign In</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const crumbs = [degree?.name, regulation?.name, term?.name, subject?.name, unit?.name, topic?.name].filter(Boolean);

  function goBack() {
    if (step === "study") setStep("topic");
    else if (step === "topic") setStep("unit");
    else if (step === "unit") setStep("subject");
    else if (step === "subject") setStep("term");
    else if (step === "term") setStep("regulation");
    else setStep("degree");
  }

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <GraduationCap className="h-3.5 w-3.5" /> College
        </div>
        <h1 className="mt-1 text-2xl font-black">Degree → Semester → Subject → Topic</h1>
        <p className="mt-1 text-sm opacity-90">
          Notes, AI teacher, examples, practice, quizzes, doubt solving, exam prep and a full coding lab.
        </p>
      </section>

      {crumbs.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={goBack} className="press inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <p className="truncate text-[11px] font-bold text-muted-foreground">{crumbs.join(" • ")}</p>
        </div>
      )}

      {step === "degree" && (
        <section className="mt-4">
          <h2 className="text-sm font-black">Choose your degree</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(degrees.data ?? []).map((d) => (
              <button
                key={d.id}
                type="button"
                className="card-lift rounded-2xl bg-card p-3.5 text-left shadow-soft"
                onClick={() => {
                  setDegree({ id: d.id, name: d.name });
                  setRegulation(null);
                  setStep("regulation");
                  listMut.mutate({ level: "regulations", parentId: d.id });
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{d.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-black">
                      {d.name} <span className="text-[10px] font-bold text-muted-foreground">{d.level}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{d.blurb}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {(progress.data ?? []).length > 0 && (
            <div className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
              <h3 className="text-sm font-black">Continue learning</h3>
              <ul className="mt-1.5 grid gap-1 text-[11px]">
                {(progress.data ?? []).slice(0, 5).map((p) => (
                  <li key={p.node_key} className="truncate rounded-xl bg-secondary/50 px-2.5 py-1.5">
                    {p.node_key} — <span className="font-bold">{p.status}</span>
                    {p.score !== null && p.score !== undefined ? ` • ${p.score}%` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {(step === "regulation" || step === "term" || step === "subject" || step === "unit" || step === "topic") && (
        <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
          <h2 className="text-sm font-black">
            {step === "regulation" && "University / Regulation"}
            {step === "term" && "Semester / Year"}
            {step === "subject" && "Subject"}
            {step === "unit" && "Unit"}
            {step === "topic" && "Topic"}
          </h2>
          {listMut.isPending && <p className="mt-2 text-xs text-muted-foreground">Loading…</p>}
          <div className="mt-2 grid gap-1.5">
            {(listMut.data ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                className="press flex items-center gap-2 rounded-2xl bg-secondary/50 px-3 py-2 text-left"
                onClick={() => {
                  if (step === "regulation") {
                    setRegulation(item);
                    setTerm(null);
                    setStep("term");
                    listMut.mutate({ level: "terms", parentId: item.fromDb ? item.id : undefined });
                  } else if (step === "term") {
                    setTerm(item);
                    setSubject(null);
                    setStep("subject");
                    listMut.mutate({
                      level: "subjects",
                      parentId: regulation?.fromDb ? regulation.id : undefined,
                    });
                  } else if (step === "subject") {
                    setSubject(item);
                    setUnit(null);
                    setStep("unit");
                    listMut.mutate({ level: "units", parentId: item.fromDb ? item.id : undefined });
                  } else if (step === "unit") {
                    setUnit(item);
                    setTopic(null);
                    setStep("topic");
                    listMut.mutate({ level: "topics", parentId: item.fromDb ? item.id : undefined });
                  } else {
                    setTopic(item);
                    setNotes(null);
                    setQuiz([]);
                    setChat([]);
                    setCodeAnswer("");
                    setTab("notes");
                    setStep("study");
                  }
                }}
              >
                <span className="text-lg">{item.emoji}</span>
                <span className="text-xs font-semibold">{item.name}</span>
                {!item.fromDb && <span className="ml-auto text-[9px] font-bold text-muted-foreground">AI</span>}
              </button>
            ))}
            {!listMut.isPending && !(listMut.data ?? []).length && (
              <p className="text-xs text-muted-foreground">Nothing here yet — go back and pick another option.</p>
            )}
          </div>
        </section>
      )}

      {step === "study" && topic && (
        <>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {([
              { id: "notes", label: "Notes", icon: Lightbulb },
              { id: "teacher", label: "AI Teacher", icon: Bot },
              { id: "examples", label: "Examples", icon: Lightbulb },
              { id: "practice", label: "Practice", icon: Lightbulb },
              { id: "quiz", label: "Quiz", icon: Bot },
              { id: "doubt", label: "Ask Doubt", icon: MessageCircleQuestion },
              { id: "exam", label: "Exam Prep", icon: Lightbulb },
              ...(isProgramming ? [{ id: "code" as Tab, label: "Coding Lab", icon: Code2 }] : []),
            ] as { id: Tab; label: string; icon: typeof Bot }[]).map((t) => (
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

          {tab !== "code" && tab !== "doubt" && tab !== "teacher" && !notes && (
            <Button className="mt-3 w-full bg-gradient-primary" disabled={notesMut.isPending} onClick={() => notesMut.mutate()}>
              {notesMut.isPending ? "Preparing your notes…" : `Study “${topic.name}”`}
            </Button>
          )}

          {tab === "teacher" && (
            <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
              <h2 className="text-sm font-black">AI Teacher</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Let the 2D AI teacher explain “{topic.name}” step by step on the interactive board.
              </p>
              <Button
                className="mt-2 w-full bg-gradient-primary"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("guru:teach", {
                      detail: { topic: `${subject?.name} • ${topic.name}`, subject: subject?.name },
                    }),
                  )
                }
              >
                Teach me on the board
              </Button>
            </section>
          )}

          {notes && (tab === "notes" || tab === "examples" || tab === "practice" || tab === "exam") && (
            <section className="mt-3 grid gap-3">
              {tab === "notes" && (
                <>
                  <div className="rounded-3xl bg-card p-4 shadow-soft">
                    <h2 className="text-base font-black">{notes.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed">{notes.intro}</p>
                  </div>
                  {notes.simple && (
                    <div className="rounded-3xl bg-secondary/50 p-4">
                      <h3 className="text-sm font-black">Explain simply</h3>
                      <p className="mt-1 text-sm leading-relaxed">{notes.simple}</p>
                    </div>
                  )}
                  {notes.sections.map((s) => (
                    <div key={s.heading} className="rounded-3xl bg-card p-4 shadow-soft">
                      <h3 className="text-sm font-black">{s.heading}</h3>
                      <p className="mt-1 text-sm leading-relaxed">{s.body}</p>
                    </div>
                  ))}
                  {notes.formulas.length > 0 && (
                    <div className="rounded-3xl bg-card p-4 shadow-soft">
                      <h3 className="text-sm font-black">Formulas</h3>
                      <ul className="mt-1 grid gap-1 text-xs font-mono">
                        {notes.formulas.map((f) => (
                          <li key={f} className="rounded-xl bg-secondary/50 px-2.5 py-1.5">
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {tab === "examples" &&
                notes.examples.map((e) => (
                  <div key={e.question} className="rounded-3xl bg-card p-4 shadow-soft">
                    <div className="text-sm font-black">{e.question}</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{e.solution}</p>
                  </div>
                ))}

              {tab === "practice" &&
                notes.practice.map((p, i) => (
                  <details key={p.question} className="rounded-3xl bg-card p-4 shadow-soft">
                    <summary className="cursor-pointer text-sm font-bold">
                      {i + 1}. {p.question}
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.answer}</p>
                  </details>
                ))}

              {tab === "exam" && (
                <>
                  <div className="rounded-3xl bg-card p-4 shadow-soft">
                    <h3 className="text-sm font-black">Important points</h3>
                    <ul className="mt-1 grid gap-1 text-xs">
                      {notes.importantPoints.map((p) => (
                        <li key={p}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl bg-card p-4 shadow-soft">
                    <h3 className="text-sm font-black">Exam tips</h3>
                    <ul className="mt-1 grid gap-1 text-xs">
                      {notes.examTips.map((p) => (
                        <li key={p}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl bg-card p-4 shadow-soft">
                    <h3 className="text-sm font-black">Quick revision</h3>
                    <ul className="mt-1 grid gap-1 text-xs">
                      {notes.revision.map((p) => (
                        <li key={p}>• {p}</li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => {
                        void saveProgress({
                          data: { track: "college" as const, node_key: nodeKey, status: "revised" as const, score: null },
                        });
                        toast.success("Marked as revised");
                        void progress.refetch();
                      }}
                    >
                      Mark as revised
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "quiz" && (
            <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
              <h2 className="text-sm font-black">Topic quiz</h2>
              <Button className="mt-2 w-full bg-gradient-primary" disabled={quizMut.isPending} onClick={() => quizMut.mutate()}>
                {quizMut.isPending ? "Building quiz…" : "Start 5-question quiz"}
              </Button>
              {quiz.length > 0 && (
                <div className="mt-3 grid gap-3">
                  {quiz.map((q, i) => (
                    <div key={i} className="rounded-2xl bg-secondary/50 p-3">
                      <div className="text-sm font-bold">
                        {i + 1}. {q.question}
                      </div>
                      <div className="mt-2 grid gap-1.5">
                        {q.options.map((o, oi) => {
                          const chosen = quizAnswers[i] === oi;
                          const good = quizDone && oi === q.answerIndex;
                          const bad = quizDone && chosen && oi !== q.answerIndex;
                          return (
                            <button
                              key={oi}
                              type="button"
                              disabled={quizDone}
                              onClick={() => setQuizAnswers((a) => ({ ...a, [i]: oi }))}
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
                      {quizDone && q.explanation && (
                        <p className="mt-2 rounded-xl bg-card p-2 text-[11px] leading-relaxed">{q.explanation}</p>
                      )}
                    </div>
                  ))}
                  {!quizDone ? (
                    <Button
                      className="bg-gradient-primary"
                      onClick={() => {
                        const correct = quiz.reduce((s, q, i) => s + (quizAnswers[i] === q.answerIndex ? 1 : 0), 0);
                        setQuizDone(true);
                        void saveProgress({
                          data: {
                            track: "college" as const,
                            node_key: nodeKey,
                            status: "quizzed" as const,
                            score: Math.round((correct / quiz.length) * 100),
                          },
                        });
                        void progress.refetch();
                      }}
                    >
                      Submit quiz
                    </Button>
                  ) : (
                    <p className="text-center text-xs font-bold">
                      Score: {quiz.reduce((s, q, i) => s + (quizAnswers[i] === q.answerIndex ? 1 : 0), 0)}/{quiz.length}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === "doubt" && (
            <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
              <h2 className="text-sm font-black">Ask a doubt about {topic.name}</h2>
              <div className="mt-2 grid gap-2">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-gradient-primary text-primary-foreground" : "bg-secondary/60"}`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={doubt}
                  onChange={(e) => setDoubt(e.target.value)}
                  placeholder="Type your doubt…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && doubt.trim()) {
                      doubtMut.mutate(doubt.trim());
                      setDoubt("");
                    }
                  }}
                />
                <Button
                  className="bg-gradient-primary"
                  disabled={doubtMut.isPending || !doubt.trim()}
                  onClick={() => {
                    doubtMut.mutate(doubt.trim());
                    setDoubt("");
                  }}
                >
                  Ask
                </Button>
              </div>
              {doubtMut.isPending && <p className="mt-2 text-xs text-muted-foreground">Guru.AI is thinking…</p>}
            </section>
          )}

          {tab === "code" && (
            <section className="mt-3 grid gap-3">
              <div className="rounded-3xl bg-card p-4 shadow-soft">
                <h2 className="flex items-center gap-1.5 text-sm font-black">
                  <Terminal className="h-4 w-4" /> Code editor
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {LANGS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      className={`press rounded-full px-3 py-1 text-[11px] font-bold ${lang === l ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder={`Write your ${lang} code here…`}
                  className="mt-2 font-mono text-xs"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" className="bg-gradient-primary" disabled={!code.trim() || reviewMut.isPending} onClick={() => reviewMut.mutate("explain")}>
                    Explain code
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!code.trim() || reviewMut.isPending} onClick={() => reviewMut.mutate("debug")}>
                    Debug
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!code.trim() || reviewMut.isPending} onClick={() => reviewMut.mutate("review")}>
                    Review solution
                  </Button>
                </div>
                {reviewMut.isPending && <p className="mt-2 text-xs text-muted-foreground">Analysing your code…</p>}
                {codeAnswer && (
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-secondary/50 p-3 text-[11px] leading-relaxed">
                    {codeAnswer}
                  </pre>
                )}
              </div>

              <div className="rounded-3xl bg-card p-4 shadow-soft">
                <h2 className="text-sm font-black">Coding questions</h2>
                <Button size="sm" className="mt-2 bg-gradient-primary" disabled={codingMut.isPending} onClick={() => codingMut.mutate()}>
                  {codingMut.isPending ? "Building…" : "Get practice problems"}
                </Button>
                <div className="mt-2 grid gap-2">
                  {(codingMut.data ?? []).map((q) => (
                    <details key={q.title} className="rounded-2xl bg-secondary/50 p-3">
                      <summary className="cursor-pointer text-xs font-black">{q.title}</summary>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">{q.prompt}</p>
                      {q.starter && (
                        <div className="mt-2">
                          <button
                            type="button"
                            className="press rounded-full bg-card px-2.5 py-1 text-[10px] font-bold"
                            onClick={() => {
                              setCode(q.starter);
                              setLang(q.language);
                            }}
                          >
                            Load starter into editor
                          </button>
                        </div>
                      )}
                      {q.hints.length > 0 && (
                        <ul className="mt-2 grid gap-0.5 text-[11px]">
                          {q.hints.map((h) => (
                            <li key={h}>💡 {h}</li>
                          ))}
                        </ul>
                      )}
                      {q.solution && (
                        <pre className="mt-2 overflow-auto rounded-xl bg-card p-2 text-[10px]">{q.solution}</pre>
                      )}
                    </details>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-card p-4 shadow-soft">
                <h2 className="text-sm font-black">Predict the output</h2>
                <Button size="sm" variant="secondary" className="mt-2" disabled={outputMut.isPending} onClick={() => outputMut.mutate()}>
                  {outputMut.isPending ? "Building…" : "Get output questions"}
                </Button>
                <div className="mt-2 grid gap-2">
                  {(outputMut.data ?? []).map((q, i) => (
                    <details key={i} className="rounded-2xl bg-secondary/50 p-3">
                      <summary className="cursor-pointer text-xs font-black">Snippet {i + 1}</summary>
                      <pre className="mt-1 overflow-auto rounded-xl bg-card p-2 text-[10px]">{q.code}</pre>
                      <ul className="mt-2 grid gap-0.5 text-[11px]">
                        {q.options.map((o, oi) => (
                          <li key={oi} className={oi === q.answerIndex ? "font-bold text-primary" : ""}>
                            {String.fromCharCode(65 + oi)}. {o}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[11px] leading-relaxed">{q.explanation}</p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
