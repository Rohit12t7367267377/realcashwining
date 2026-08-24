import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import { getClassNotes, listNotesChapters, listNotesTopics, askNotesDoubt, getTopicQuiz } from "@/lib/guru-notes.functions";
import { getSchoolCatalog } from "@/lib/guru-school.functions";
import {
  gradientFor, readProgress, saveProgress, getProgress,
  type NotesPayload, type QuizItem, type TopicProgress,
} from "@/lib/guru-notes";
import {
  School, ArrowLeft, Sparkles, Lightbulb, Sigma, ListChecks, Target, GraduationCap,
  MessageCircleQuestion, Send, Languages, Loader2, BookMarked, Baby, PencilRuler,
  RotateCcw, CheckCircle2, XCircle, TrendingUp, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/guru/notes")({
  head: () => ({
    meta: [
      { title: "School — Board, Class, Subject, Chapter & Topic | Guru.AI" },
      { name: "description", content: "Guru.AI School: pick your board and class 1–12, open any subject, chapter and topic, then learn with notes, AI teacher, examples, formulas, practice, quiz, revision and doubt solving." },
      { property: "og:title", content: "Guru.AI School" },
      { property: "og:description", content: "Every board, class 1–12: notes, AI teacher, practice, quiz, revision and instant doubt solving in English or Hindi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruSchoolPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Pick = { id: string; name: string; emoji: string } | null;
type Tab =
  | "notes" | "simple" | "examples" | "points" | "formulas"
  | "practice" | "quiz" | "revision" | "tips" | "doubt";

const TABS: { key: Tab; label: string; icon: typeof ListChecks }[] = [
  { key: "notes", label: "Notes", icon: BookMarked },
  { key: "simple", label: "Explain Simply", icon: Baby },
  { key: "points", label: "Important Points", icon: ListChecks },
  { key: "examples", label: "Examples", icon: Lightbulb },
  { key: "formulas", label: "Formulas", icon: Sigma },
  { key: "practice", label: "Practice", icon: PencilRuler },
  { key: "quiz", label: "Quiz", icon: Target },
  { key: "revision", label: "Revision", icon: RotateCcw },
  { key: "tips", label: "Exam Tips", icon: Target },
  { key: "doubt", label: "Ask Doubt", icon: MessageCircleQuestion },
];

function GuruSchoolPage() {
  const { state } = useUser();
  const catalog = useServerFn(getSchoolCatalog);
  const loadChapters = useServerFn(listNotesChapters);
  const loadTopics = useServerFn(listNotesTopics);
  const loadNotes = useServerFn(getClassNotes);
  const loadQuiz = useServerFn(getTopicQuiz);
  const ask = useServerFn(askNotesDoubt);

  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [board, setBoard] = useState<Pick>(null);
  const [klass, setKlass] = useState<Pick>(null);
  const [subject, setSubject] = useState<Pick>(null);
  const [chapter, setChapter] = useState<Pick>(null);
  const [topicInput, setTopicInput] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState<NotesPayload | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [doubt, setDoubt] = useState("");
  const [chat, setChat] = useState<Msg[]>([]);
  const [progress, setProgress] = useState<Record<string, TopicProgress>>({});

  useEffect(() => setProgress(readProgress()), []);

  const scope = {
    board: board?.name ?? "",
    className: klass?.name ?? "",
    subject: subject?.name ?? "",
    language,
  };

  const boardsQ = useQuery({
    queryKey: ["school-boards"],
    queryFn: () => catalog({ data: { level: "boards" } }),
    enabled: state.loggedIn,
  });
  const classesQ = useQuery({
    queryKey: ["school-classes", board?.id],
    queryFn: () => catalog({ data: { level: "classes", parentId: board!.id } }),
    enabled: state.loggedIn && !!board,
  });
  const subjectsQ = useQuery({
    queryKey: ["school-subjects", klass?.id, klass?.name],
    queryFn: () => catalog({ data: { level: "subjects", parentId: klass!.id, className: klass!.name } }),
    enabled: state.loggedIn && !!klass,
  });
  const chaptersQ = useQuery({
    queryKey: ["school-chapters", subject?.id, scope.board, scope.className, language],
    queryFn: async () => {
      const db = await catalog({ data: { level: "chapters", parentId: subject!.id } });
      if (db.length) return db;
      const ai = await loadChapters({ data: { ...scope, subject: subject!.name } });
      return ai.map((name) => ({ id: name, name, emoji: "🔖", fromDb: false }));
    },
    enabled: state.loggedIn && !!subject,
  });
  const topicsQ = useQuery({
    queryKey: ["school-topics", chapter?.id, scope.board, scope.className, scope.subject, language],
    queryFn: async () => {
      const db = await catalog({ data: { level: "topics", parentId: chapter!.id } });
      if (db.length) return db;
      const ai = await loadTopics({ data: { ...scope, chapter: chapter!.name } });
      return ai.map((name) => ({ id: name, name, emoji: "✨", fromDb: false }));
    },
    enabled: state.loggedIn && !!chapter,
  });

  const notesMut = useMutation({
    mutationFn: (t: string) => loadNotes({ data: { ...scope, topic: t } }),
    onSuccess: (n, t) => {
      setNotes(n);
      setChat([]);
      setQuiz(null);
      setSubmitted(false);
      setTab("notes");
      saveProgress({ ...scope, topic: t }, { opened: true });
      setProgress(readProgress());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quizMut = useMutation({
    mutationFn: () => loadQuiz({ data: { ...scope, topic: notes?.title ?? topic } }),
    onSuccess: (q) => {
      setQuiz(q);
      setAnswers(q.map(() => null));
      setSubmitted(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doubtMut = useMutation({
    mutationFn: (q: string) =>
      ask({ data: { ...scope, topic: notes?.title ?? topic, question: q, history: chat.slice(-8) } }),
    onSuccess: (r) => setChat((c) => [...c, { role: "assistant", content: r.answer }]),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to open Guru.AI School</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  function openTopic(t: string) {
    setTopic(t);
    notesMut.mutate(t);
  }

  function sendDoubt(e: React.FormEvent) {
    e.preventDefault();
    const q = doubt.trim();
    if (!q) return;
    setChat((c) => [...c, { role: "user", content: q }]);
    setDoubt("");
    doubtMut.mutate(q);
  }

  function teachOnBoard() {
    window.dispatchEvent(
      new CustomEvent("guru:teach", {
        detail: { topic: `${notes?.title ?? topic} (Class ${scope.className} ${scope.subject}, ${scope.board})` },
      }),
    );
  }

  function submitQuiz() {
    if (!quiz) return;
    const correct = quiz.reduce((n, q, i) => (answers[i] === q.answerIndex ? n + 1 : n), 0);
    setSubmitted(true);
    saveProgress({ ...scope, topic: notes?.title ?? topic }, { quizScore: Math.round((correct / quiz.length) * 100) });
    setProgress(readProgress());
    toast.success(`You scored ${correct}/${quiz.length}`);
  }

  /* ---------------- Topic learning view ---------------- */
  if (notes) {
    const p = getProgress(progress, { ...scope, topic: notes.title });
    const done = [p?.opened ? 1 : 0, p?.quizScore != null ? 1 : 0, p?.revised ? 1 : 0].reduce((a, b) => a + b, 0);

    return (
      <AppShell>
        <button type="button" onClick={() => setNotes(null)} className="press mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to topics
        </button>

        <section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${gradientFor(notes.title)} p-5 text-primary-foreground shadow-lift animate-rise-in`}>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
            <School className="h-3.5 w-3.5" /> {scope.board} • Class {scope.className} • {scope.subject}
          </div>
          <h1 className="mt-1 text-2xl font-black leading-tight">{notes.title}</h1>
          {notes.intro && <p className="mt-2 text-sm opacity-95">{notes.intro}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={teachOnBoard} className="press inline-flex items-center gap-1.5 rounded-full bg-primary-foreground px-3 py-1.5 text-[11px] font-black text-primary">
              <GraduationCap className="h-3.5 w-3.5" /> AI Teacher
            </button>
            {(["en", "hi"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => { setLanguage(l); openTopic(notes.title); }}
                className={`press rounded-full px-3 py-1.5 text-[11px] font-bold ${language === l ? "bg-primary-foreground/90 text-primary" : "bg-primary-foreground/20"}`}
              >
                {l === "en" ? "English" : "हिन्दी"}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-2xl bg-primary-foreground/15 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
              <TrendingUp className="h-3.5 w-3.5" /> Progress {Math.round((done / 3) * 100)}%
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
              <div className="h-full rounded-full bg-primary-foreground/90 transition-all" style={{ width: `${(done / 3) * 100}%` }} />
            </div>
            <div className="mt-1 text-[10px] opacity-90">
              Read {p?.opened ? "✓" : "•"} · Quiz {p?.quizScore != null ? `${p.quizScore}%` : "•"} · Revised {p?.revised ? "✓" : "•"}
            </div>
          </div>
        </section>

        <nav className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); if (key === "quiz" && !quiz && !quizMut.isPending) quizMut.mutate(); }}
              className={`press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                tab === key ? "bg-gradient-primary text-primary-foreground" : "bg-card shadow-soft"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </nav>

        {tab === "notes" && (
          <>
            {notes.keyPoints.length > 0 && (
              <Card title="Key points" icon={<ListChecks className="h-4 w-4" />} tone="bg-primary/10 text-primary">
                <ul className="space-y-1.5">
                  {notes.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">{i + 1}</span>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {notes.sections.map((s, i) => (
              <Card key={i} title={s.heading} icon={<BookMarked className="h-4 w-4" />} tone="bg-secondary text-foreground">
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </Card>
            ))}
          </>
        )}

        {tab === "simple" && (
          <Card title="Explain simply" icon={<Baby className="h-4 w-4" />} tone="bg-accent/15 text-accent-foreground">
            <p className="whitespace-pre-line text-sm leading-relaxed">{notes.simple || notes.intro}</p>
          </Card>
        )}

        {tab === "points" && (
          <Card title="Important points" icon={<ListChecks className="h-4 w-4" />} tone="bg-primary/10 text-primary">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {(notes.importantPoints.length ? notes.importantPoints : notes.keyPoints).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Card>
        )}

        {tab === "examples" && (
          notes.examples.length ? notes.examples.map((ex, i) => (
            <Card key={i} title={`Solved example ${i + 1}`} icon={<Lightbulb className="h-4 w-4" />} tone="bg-primary/10 text-primary">
              <p className="text-sm font-bold">{ex.question}</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{ex.solution}</p>
            </Card>
          )) : <Empty text="No solved examples for this topic." />
        )}

        {tab === "formulas" && (
          notes.formulas.length ? (
            <Card title="Formulas & facts" icon={<Sigma className="h-4 w-4" />} tone="bg-accent/15 text-accent-foreground">
              <div className="flex flex-wrap gap-1.5">
                {notes.formulas.map((f, i) => (
                  <span key={i} className="rounded-xl bg-muted px-2.5 py-1 font-mono text-[12px] font-bold">{f}</span>
                ))}
              </div>
            </Card>
          ) : <Empty text="This topic has no formulas to memorise." />
        )}

        {tab === "practice" && (
          notes.practice.length ? notes.practice.map((q, i) => (
            <Card key={i} title={`Practice ${i + 1}`} icon={<PencilRuler className="h-4 w-4" />} tone="bg-secondary text-foreground">
              <p className="text-sm font-bold">{q.question}</p>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-primary">Show answer</summary>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{q.answer}</p>
              </details>
            </Card>
          )) : <Empty text="No practice questions yet." />
        )}

        {tab === "quiz" && (
          <Card title="Topic quiz" icon={<Target className="h-4 w-4" />} tone="bg-primary/10 text-primary">
            {quizMut.isPending && (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Setting your quiz…
              </div>
            )}
            {quiz?.map((q, qi) => (
              <div key={qi} className="mb-3 rounded-2xl bg-muted/60 p-3">
                <p className="text-sm font-bold">{qi + 1}. {q.question}</p>
                <div className="mt-2 grid gap-1.5">
                  {q.options.map((o, oi) => {
                    const chosen = answers[qi] === oi;
                    const right = submitted && oi === q.answerIndex;
                    const wrong = submitted && chosen && oi !== q.answerIndex;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                        className={`press flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                          right ? "bg-primary/15 font-bold text-primary"
                          : wrong ? "bg-destructive/15 font-bold text-destructive"
                          : chosen ? "bg-gradient-primary text-primary-foreground" : "bg-card shadow-soft"
                        }`}
                      >
                        <span>{o}</span>
                        {right && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                        {wrong && <XCircle className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {submitted && q.explanation && (
                  <p className="mt-1.5 text-[12px] text-muted-foreground">{q.explanation}</p>
                )}
              </div>
            ))}
            {quiz && !submitted && (
              <Button onClick={submitQuiz} className="bg-gradient-primary">Submit quiz</Button>
            )}
            {quiz && submitted && (
              <Button variant="outline" onClick={() => quizMut.mutate()}>New quiz</Button>
            )}
          </Card>
        )}

        {tab === "revision" && (
          <Card title="Quick revision" icon={<RotateCcw className="h-4 w-4" />} tone="bg-secondary text-foreground">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {(notes.revision.length ? notes.revision : notes.keyPoints).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
            <Button
              className="mt-3 bg-gradient-primary"
              onClick={() => {
                saveProgress({ ...scope, topic: notes.title }, { revised: true });
                setProgress(readProgress());
                toast.success("Revision marked complete");
              }}
            >
              Mark revised
            </Button>
          </Card>
        )}

        {tab === "tips" && (
          <Card title="Exam tips" icon={<Target className="h-4 w-4" />} tone="bg-accent/15 text-accent-foreground">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {notes.examTips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Card>
        )}

        {tab === "doubt" && (
          <Card title="Ask your doubt" icon={<MessageCircleQuestion className="h-4 w-4" />} tone="bg-primary/10 text-primary">
            <div className="space-y-2">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[92%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "ml-auto bg-gradient-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {doubtMut.isPending && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Teacher is writing…
                </div>
              )}
              {chat.length === 0 && !doubtMut.isPending && (
                <p className="text-xs text-muted-foreground">Ask anything from this topic — “explain again with an example”, “why does this formula work?”</p>
              )}
            </div>
            <form onSubmit={sendDoubt} className="mt-3 flex gap-2">
              <Input value={doubt} onChange={(e) => setDoubt(e.target.value)} placeholder="Type your doubt…" />
              <Button type="submit" className="bg-gradient-primary" disabled={doubtMut.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        )}

        {notes.nextTopics.length > 0 && (
          <Card title="Learn next" icon={<Sparkles className="h-4 w-4" />} tone="bg-secondary text-foreground">
            <div className="flex flex-wrap gap-1.5">
              {notes.nextTopics.map((t) => (
                <button key={t} type="button" onClick={() => openTopic(t)} className="press rounded-full bg-muted px-3 py-1 text-[11px] font-bold">
                  {t}
                </button>
              ))}
            </div>
          </Card>
        )}
      </AppShell>
    );
  }

  /* ---------------- Board → Class → Subject → Chapter → Topic picker ---------------- */
  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <School className="h-3.5 w-3.5" /> School
        </div>
        <h1 className="mt-1 text-2xl font-black leading-tight">Every board, Class 1 to 12</h1>
        <p className="mt-1 text-sm opacity-90">Board → Class → Subject → Chapter → Topic. Then learn with notes, AI teacher, practice, quiz, revision and doubt solving.</p>
        <div className="mt-4 flex items-center gap-2">
          <Languages className="h-4 w-4 opacity-90" />
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={`press rounded-full px-3 py-1 text-[11px] font-bold ${language === l ? "bg-primary-foreground text-primary" : "bg-primary-foreground/20"}`}
            >
              {l === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </section>

      {(board || klass || subject || chapter) && (
        <nav className="mt-3 flex flex-wrap items-center gap-1 text-[11px]">
          <Crumb label="School" onClick={() => { setBoard(null); setKlass(null); setSubject(null); setChapter(null); }} />
          {board && <Crumb label={board.name} onClick={() => { setKlass(null); setSubject(null); setChapter(null); }} />}
          {klass && <Crumb label={`Class ${klass.name}`} onClick={() => { setSubject(null); setChapter(null); }} />}
          {subject && <Crumb label={subject.name} onClick={() => setChapter(null)} />}
          {chapter && <Crumb label={chapter.name} onClick={() => undefined} />}
        </nav>
      )}

      <Step n={1} label="Choose your board" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {boardsQ.isLoading && <Empty text="Loading boards…" />}
        {(boardsQ.data ?? []).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => { setBoard(b); setKlass(null); setSubject(null); setChapter(null); }}
            className={`press card-lift rounded-2xl p-3 text-left shadow-soft ${
              board?.id === b.id ? `bg-gradient-to-br ${gradientFor(b.id)} text-primary-foreground` : "bg-card"
            }`}
          >
            <div className="text-xl">{b.emoji}</div>
            <div className="mt-1 text-xs font-black leading-tight">{b.name}</div>
          </button>
        ))}
      </div>

      {board && (
        <>
          <Step n={2} label="Choose your class" />
          <div className="flex flex-wrap gap-2">
            {(classesQ.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setKlass(c); setSubject(null); setChapter(null); }}
                className={`press grid h-12 min-w-12 place-items-center rounded-2xl px-2 text-sm font-black shadow-soft ${
                  klass?.id === c.id ? `bg-gradient-to-br ${gradientFor("c" + c.name)} text-primary-foreground` : "bg-card"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}

      {klass && (
        <>
          <Step n={3} label="Choose a subject" />
          <div className="grid gap-2 sm:grid-cols-2">
            {(subjectsQ.data ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setSubject(s); setChapter(null); }}
                className={`press card-lift rounded-2xl p-3 text-left shadow-soft ${
                  subject?.id === s.id ? `bg-gradient-to-br ${gradientFor(s.name)} text-primary-foreground` : "bg-card"
                }`}
              >
                <div className="text-sm font-black">{s.emoji} {s.name}</div>
                <div className={`text-[11px] ${subject?.id === s.id ? "opacity-90" : "text-muted-foreground"}`}>
                  Class {klass.name} • {board?.name}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {subject && (
        <>
          <Step n={4} label="Choose a chapter" />
          {chaptersQ.isLoading && <Empty text="Loading chapters…" />}
          <div className="grid gap-2">
            {(chaptersQ.data ?? []).map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChapter(c)}
                className={`press card-lift flex items-center gap-3 rounded-2xl p-3 text-left shadow-soft ${
                  chapter?.id === c.id ? "bg-primary/10 ring-1 ring-primary/40" : "bg-card"
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradientFor(c.name)} text-sm font-black text-primary-foreground`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold">{c.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </>
      )}

      {chapter && (
        <>
          <Step n={5} label="Choose a topic" />
          {topicsQ.isLoading && <Empty text="Loading topics…" />}
          <div className="grid gap-2">
            {(topicsQ.data ?? []).map((t) => {
              const p = getProgress(progress, { ...scope, topic: t.name });
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTopic(t.name)}
                  className="press card-lift flex items-center justify-between gap-3 rounded-2xl bg-card p-3.5 text-left shadow-soft"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{t.emoji} {t.name}</div>
                    {p && (
                      <div className="text-[11px] text-muted-foreground">
                        {p.opened ? "Read" : ""}{p.quizScore != null ? ` · Quiz ${p.quizScore}%` : ""}{p.revised ? " · Revised" : ""}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (topicInput.trim().length > 1) openTopic(topicInput.trim()); }}
          >
            <Input value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="Or type any topic of this chapter…" />
            <Button type="submit" className="bg-gradient-primary" disabled={notesMut.isPending}>
              {notesMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </form>
        </>
      )}

      {notesMut.isPending && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Your teacher is preparing this topic…
        </div>
      )}
    </AppShell>
  );
}

function Crumb({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <button type="button" onClick={onClick} className="press rounded-full bg-muted px-2.5 py-1 font-bold">{label}</button>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
    </span>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <h2 className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">{n}</span>
      {label}
    </h2>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="mt-3 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">{text}</div>;
}

function Card({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
      <h2 className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${tone}`}>
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}
