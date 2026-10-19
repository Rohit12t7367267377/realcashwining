import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuruBoardCanvas } from "@/components/GuruBoardCanvas";
import { TeacherCharacter, type TeacherCharacterState } from "@/components/TeacherCharacter";
import type { BoardBlock } from "@/lib/guru-board-blocks";
import { guruClassroomTurn, guruEvaluateAnswer, guruClassroomProgress, guruLessonOutline, guruLessonSection } from "@/lib/guru-classroom.functions";
import { useLessonNarration } from "@/hooks/use-lesson-narration";
import { useClassroomPreferences } from "@/hooks/use-classroom-preferences";
import { ClassroomSettings } from "@/components/ClassroomSettings";
import { LessonPlayback } from "@/components/LessonPlayback";
import { lessonSegments } from "@/lib/lesson-segments";
import { GuruBookView, type BookSection } from "@/components/GuruBookView";
import { ClassroomPractice } from "@/components/ClassroomPractice";
import { contextOf, summariseBlocks, type SectionPlanItem } from "@/lib/lesson-sections";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import {
  GraduationCap, Loader2, Mic, MicOff, Send, RefreshCw, Baby, Rocket,
  Lightbulb, HelpCircle, ListChecks, ClipboardCheck, ArrowRight,
  Eye, EyeOff, Maximize2, Minimize2, BookOpen, Presentation, FileText, Square,
} from "lucide-react";

export const Route = createFileRoute("/guru/classroom")({
  validateSearch: (s: Record<string, unknown>) => ({ topic: typeof s.topic === "string" ? s.topic : undefined }),
  head: () => ({
    meta: [
      { title: "AI Teacher Classroom — Learn Any Topic Live | Guru.AI" },
      { name: "description", content: "An interactive 2D AI teacher explains any topic step by step on a live board with formulas, diagrams, examples, questions and a mini-test." },
      { property: "og:title", content: "AI Teacher Classroom — Guru.AI" },
      { property: "og:description", content: "Your 2D AI teacher teaches live on an interactive board, asks questions and adapts to you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Classroom,
});

type Mode = "start" | "again" | "easier" | "harder" | "deeper" | "example" | "ask_me" | "practice" | "test" | "doubt" | "next";
type Turn = { role: "teacher" | "student"; content: string };
type Question = { prompt: string; hint: string | null; expected: string | null };
type SectionState = Omit<BookSection, "start"> & { kind: string };
type ViewMode = "teacher" | "book";

const MODE_TITLES: Partial<Record<Mode, string>> = {
  again: "Explained again", easier: "Simpler explanation", harder: "Harder treatment", deeper: "Deeper explanation",
  example: "Another example", ask_me: "Check your understanding", practice: "Quick practice", test: "Mini-test", doubt: "Your doubt", next: "Next step",
};
const TEACHER_WIDTH = {
  small: "w-[56px] sm:w-[88px] lg:w-[110px]",
  medium: "w-[76px] sm:w-[130px] lg:w-[160px]",
  large: "w-[110px] sm:w-[180px] lg:w-[230px]",
} as const;
const TEACHER_COLUMN = {
  small: "sm:grid-cols-[minmax(0,1fr)_100px] lg:grid-cols-[minmax(0,1fr)_120px]",
  medium: "sm:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-[minmax(0,1fr)_180px]",
  large: "sm:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_250px]",
} as const;

function Classroom() {
  const { state } = useUser();
  const { topic: topicParam } = Route.useSearch();
  const turnFn = useServerFn(guruClassroomTurn);
  const evalFn = useServerFn(guruEvaluateAnswer);
  const saveFn = useServerFn(guruClassroomProgress);
  const outlineFn = useServerFn(guruLessonOutline);
  const sectionFn = useServerFn(guruLessonSection);
  const teacherAudio = useLessonNarration();
  const boardPreferences = useClassroomPreferences();
  const prefs = boardPreferences.preferences;

  const [topic, setTopic] = useState(topicParam ?? "");
  const [active, setActive] = useState<string | null>(null);
  const [level, setLevel] = useState(3);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Interactive AI Classroom");
  // ONE lesson state: both the teacher-led board and the book read from it, so they can never disagree.
  const [secs, setSecs] = useState<SectionState[]>([]);
  const secsRef = useRef<SectionState[]>([]);
  const [plan, setPlan] = useState<SectionPlanItem[]>([]);
  const [roadmap, setRoadmap] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("teacher");
  const [boardFull, setBoardFull] = useState(false);
  const [teacher, setTeacher] = useState("Guru");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ verdict: string; text: string; miss: string | null } | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [asked, setAsked] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [doubt, setDoubt] = useState("");
  const [listening, setListening] = useState(false);
  const cancelRest = useRef(false);
  const exitRef = useRef<HTMLButtonElement>(null);

  const commit = useCallback((next: SectionState[]) => { secsRef.current = next; setSecs(next); }, []);
  const bookSections: BookSection[] = useMemo(() => {
    let start = 0;
    return secs.map((x) => { const r = { ...x, start }; start += x.blocks.length; return r; });
  }, [secs]);
  const blocks: BoardBlock[] = useMemo(() => secs.flatMap((x) => x.blocks), [secs]);
  const segments = useMemo(() => lessonSegments(active ?? "lesson", blocks), [active, blocks]);
  const narrating = teacherAudio.speaking || teacherAudio.paused || teacherAudio.loading;
  const currentSection = Math.max(0, bookSections.findIndex((x, i) => position >= x.start && (i === bookSections.length - 1 || position < (bookSections[i + 1]?.start ?? Infinity))));
  const stepLabel = plan.length ? `Section ${Math.min(currentSection + 1, bookSections.length)} of ${bookSections.length}` : null;
  const pendingIndex = secs.findIndex((x) => x.status === "pending" || x.status === "partial" || x.status === "error");

  const teacherState: TeacherCharacterState = listening
    ? "listening"
    : busy
      ? "thinking"
      : teacherAudio.speaking
        ? "speaking"
        : feedback?.verdict === "correct"
          ? "correct"
          : feedback?.verdict === "partial"
            ? "encouraging"
            : feedback
              ? "wrong"
              : "idle";

  const recRef = useRef<any>(null);
  const voiceTarget = useRef<"doubt" | "answer">("doubt");

  useEffect(() => () => {
    teacherAudio.stop();
    recRef.current?.stop?.();
  }, [teacherAudio.stop]);

  // While the teacher speaks, the shared reading position follows the narrated segment.
  useEffect(() => { if (narrating) setPosition(teacherAudio.activeSegment); }, [narrating, teacherAudio.activeSegment]);

  // Full-screen board: Esc returns, page scroll is locked, focus moves to the exit button. Nothing remounts.
  useEffect(() => {
    if (!boardFull) return;
    document.body.classList.add("classroom-lock");
    exitRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setBoardFull(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("classroom-lock"); window.removeEventListener("keydown", onKey); };
  }, [boardFull]);

  function stopVoice() {
    teacherAudio.stop();
  }

  async function toggleTeacher() {
    try { await boardPreferences.apply({ ...prefs, teacherVisible: !prefs.teacherVisible }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not save this setting"); }
  }

  /** Appends extra teaching (re-explanations, doubts, corrections) to the same lesson and moves there. */
  function appendSection(next: SectionState, speak = true) {
    const all = [...secsRef.current, next];
    commit(all);
    const start = all.slice(0, -1).reduce((n, x) => n + x.blocks.length, 0);
    setPosition(start);
    if (speak && next.blocks.length) void teacherAudio.start(lessonSegments(active ?? "lesson", all.flatMap((x) => x.blocks)), start);
  }

  /** Generates (or continues) ONE textbook section. Earlier complete sections are sent as context. */
  async function generateSection(i: number, topicText: string, planNow: SectionPlanItem[], speak: boolean): Promise<boolean> {
    const sec = secsRef.current[i];
    const item = planNow[i];
    if (!sec || !item) return false;
    const mark = (patch: Partial<SectionState>) => commit(secsRef.current.map((x, n) => (n === i ? { ...x, ...patch } : x)));
    const resumed = sec.status === "partial" || sec.status === "error";
    mark({ status: "loading" });
    try {
      const previous = contextOf(secsRef.current.slice(0, i).filter((x) => x.status === "complete").map((x) => ({ title: x.title, kind: x.kind, text: summariseBlocks(x.blocks) })));
      const res = await sectionFn({
        data: { topic: topicText, level, plan: planNow, index: i, previous, existing: resumed && sec.blocks.length ? (sec.blocks as unknown as Record<string, unknown>[]) : undefined },
      });
      mark({ status: res.status, blocks: res.board as BoardBlock[], problems: res.problems });
      if (res.question) { setQuestion(res.question); setAsked((n) => n + 1); }
      setHistory((h) => [...h, { role: "teacher" as const, content: `Taught "${item.title}": ${summariseBlocks(res.board as BoardBlock[], 200)}` }].slice(-12));
      if (speak && res.board.length) {
        const all = secsRef.current;
        const start = all.slice(0, i).reduce((n, x) => n + x.blocks.length, 0);
        setPosition(start);
        void teacherAudio.start(lessonSegments(topicText, all.flatMap((x) => x.blocks)), start);
      }
      return res.status === "complete";
    } catch (err) {
      mark({ status: "error", problems: [err instanceof Error ? err.message : "Generation failed"] });
      toast.error(err instanceof Error ? err.message : "The classroom is busy, try again");
      return false;
    }
  }

  async function startLesson(topicText: string) {
    const t = topicText.trim();
    if (!t) { toast.error("Type a topic first"); return; }
    if (busy) return;
    stopVoice();
    cancelRest.current = true;
    setBusy(true);
    setFeedback(null); setQuestion(null); setAnswer("");
    setHistory([]); setAsked(0); setCorrect(0); setPosition(0);
    commit([]); setPlan([]); setRoadmap(null);
    try {
      const outline = await outlineFn({ data: { topic: t } });
      setActive(t); setTitle(t); setTeacher(outline.teacher); setRoadmap(outline.roadmap);
      if (outline.fallback) toast.info("Could not tailor the outline, so the standard textbook structure is used.");
      setPlan(outline.sections);
      commit(outline.sections.map((p) => ({ id: p.kind, kind: p.kind, title: p.title, status: "pending" as const, blocks: [] })));
      await generateSection(0, t, outline.sections, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The classroom is busy, try again");
    } finally {
      setBusy(false);
    }
  }

  async function nextSection(speak = true) {
    if (busy || !active || pendingIndex < 0) return;
    stopVoice();
    setBusy(true);
    setFeedback(null); setQuestion(null); setAnswer("");
    try { await generateSection(pendingIndex, active, plan, speak); } finally { setBusy(false); }
  }

  async function writeRestOfChapter() {
    if (busy || !active) return;
    cancelRest.current = false;
    setBusy(true);
    try {
      for (let i = secsRef.current.findIndex((x) => x.status === "pending" || x.status === "partial" || x.status === "error"); i >= 0 && i < plan.length; i += 1) {
        if (cancelRest.current) break;
        if (secsRef.current[i]?.status === "complete") continue;
        const ok = await generateSection(i, active, plan, false);
        if (!ok) break; // stop on the first incomplete section so nothing is silently skipped
      }
    } finally { setBusy(false); }
  }

  async function retrySection(i: number) {
    if (busy || !active) return;
    setBusy(true);
    try { await generateSection(i, active, plan, false); } finally { setBusy(false); }
  }

  async function runTurn(mode: Mode, opts: { studentText?: string; nextLevel?: number } = {}) {
    const t = (active ?? topic).trim();
    if (!t) {
      toast.error("Type a topic first");
      return;
    }
    if (mode === "next" && pendingIndex >= 0) { await nextSection(); return; }
    if (busy) return;
    stopVoice();
    setBusy(true);
    setFeedback(null);
    setQuestion(null);
    setAnswer("");
    try {
      const lessonSoFar = contextOf(secsRef.current.filter((x) => x.status === "complete").map((x) => ({ title: x.title, kind: x.kind, text: summariseBlocks(x.blocks, 160) })), 1400);
      const res = await turnFn({
        data: { topic: t, mode, level: opts.nextLevel ?? level, studentText: opts.studentText, context: lessonSoFar || undefined, history: history.slice(-8) },
      });
      setTeacher(res.teacher);
      appendSection({ id: `turn-${secsRef.current.length}`, kind: "turn", title: MODE_TITLES[mode] ?? "Extra explanation", status: "complete", blocks: res.board as BoardBlock[] });
      setQuestion(res.question);
      if (res.question) setAsked((n) => n + 1);
      setHistory((h) => [
        ...h,
        ...(opts.studentText ? ([{ role: "student", content: opts.studentText }] as Turn[]) : []),
        { role: "teacher", content: `${res.speech}${res.question ? ` Question: ${res.question.prompt}` : ""}` },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The classroom is busy, try again");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    const a = answer.trim();
    if (!a || !question || !active || busy) return;
    setBusy(true);
    stopVoice();
    try {
      const res = await evalFn({
        data: { topic: active, question: question.prompt, expected: question.expected ?? undefined, answer: a, level },
      });
      setFeedback({ verdict: res.verdict, text: res.feedback, miss: res.misunderstanding });
      setLevel(res.nextLevel);
      if (res.board.length) appendSection({ id: `fix-${secsRef.current.length}`, kind: "turn", title: "Correction", status: "complete", blocks: res.board as BoardBlock[] });
      const isCorrect = res.verdict === "correct";
      if (isCorrect) setCorrect((n) => n + 1);
      setHistory((h) => [
        ...h,
        { role: "student", content: a },
        { role: "teacher", content: `${res.feedback}${res.misunderstanding ? ` (gap: ${res.misunderstanding})` : ""}` },
      ]);
      setQuestion(null);
      setAnswer("");
      void saveFn({ data: { questions: 1, correct: isCorrect ? 1 : 0, lessonCompleted: false } }).catch(() => {});
      // Correction remains visible and audible; the student chooses Explain again.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check that answer");
    } finally {
      setBusy(false);
    }
  }

  function toggleMic(target: "doubt" | "answer") {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input is not supported on this browser");
      return;
    }
    if (listening) {
      recRef.current?.stop?.();
      setListening(false);
      return;
    }
    voiceTarget.current = target;
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = String(e.results?.[0]?.[0]?.transcript ?? "").trim();
      if (!text) return;
      if (voiceTarget.current === "answer") setAnswer(text);
      else setDoubt(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function finishLesson() {
    if (!active) return;
    // A lesson is only "complete" when every required textbook section was actually generated in full.
    const missing = secsRef.current.filter((x, i) => plan[i]?.required && x.status !== "complete").map((x) => x.title);
    if (missing.length) {
      toast.error(`Not finished yet — still missing: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}. Use "Write the rest" first.`);
      return;
    }
    try {
      await saveFn({ data: { questions: 0, correct: 0, lessonCompleted: true } });
      toast.success("Lesson saved — XP added to your profile");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save your lesson"); }
  }

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter the AI classroom</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const teacherShown = prefs.teacherVisible;
  const stageWide = viewMode === "book" || !teacherShown;

  return (
    <AppShell wide>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <GraduationCap className="h-3.5 w-3.5" /> AI Teacher Classroom
        </div>
        <h1 className="mt-1 text-2xl font-black">Teach Me anything</h1>
        <p className="mt-1 text-sm opacity-90">
          Your 2D teacher explains step by step on a live board, asks you questions and adapts to your level.
        </p>
        <div className="mt-4 flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void startLesson(topic); }}
            placeholder="e.g. Photosynthesis, Quadratic equations, For loops in Python"
            className="bg-white/95 text-foreground"
          />
          <Button
            onClick={() => void startLesson(topic)}
            disabled={busy}
            className="shrink-0 bg-white text-primary hover:bg-white/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Teach Me"}
          </Button>
        </div>
      </section>

      <section className={`mt-5 ${boardFull ? "classroom-fullscreen" : ""}`} aria-label="Interactive classroom">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="How to learn" className="inline-flex rounded-full bg-secondary p-1 text-xs font-bold">
            <button type="button" aria-pressed={viewMode === "teacher"} onClick={() => setViewMode("teacher")} className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${viewMode === "teacher" ? "bg-primary text-primary-foreground" : ""}`}><Presentation className="h-3.5 w-3.5" /> Teacher-led</button>
            <button type="button" aria-pressed={viewMode === "book"} onClick={() => setViewMode("book")} className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${viewMode === "book" ? "bg-primary text-primary-foreground" : ""}`}><BookOpen className="h-3.5 w-3.5" /> Book</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void toggleTeacher()} aria-pressed={!teacherShown} disabled={!boardPreferences.ready}>
              {teacherShown ? <EyeOff /> : <Eye />} {teacherShown ? "Hide teacher" : "Show teacher"}
            </Button>
            <Button ref={exitRef} variant="outline" size="sm" onClick={() => setBoardFull((v) => !v)} aria-pressed={boardFull}>
              {boardFull ? <Minimize2 /> : <Maximize2 />} {boardFull ? "Exit full screen" : "Full screen"}
            </Button>
            <ClassroomSettings preferences={prefs} apply={boardPreferences.apply} disabled={!boardPreferences.ready} />
          </div>
        </div>
        {boardPreferences.error && <p role="alert" className="mb-2 text-sm text-destructive">{boardPreferences.error}</p>}
        {roadmap && !boardFull && <p className="mb-2 rounded-xl bg-secondary/60 p-3 text-sm"><b>Roadmap:</b> {roadmap}</p>}
        <div className={`classroom-stage grid min-w-0 grid-cols-1 gap-4 ${stageWide ? "" : TEACHER_COLUMN[prefs.teacherSize]}`}>
          {viewMode === "teacher" ? (
            <GuruBoardCanvas title={title} blocks={blocks} revealed={blocks.length} stepLabel={stepLabel} preferences={prefs} activeSegment={narrating ? teacherAudio.activeSegment : position} scrollToSegment={position} loading={busy} />
          ) : (
            <GuruBookView title={title} sections={bookSections} position={position} onPosition={setPosition} preferences={prefs} onRetry={(i) => void retrySection(i)} busy={busy} />
          )}
          {teacherShown && viewMode === "teacher" && (
            <div className="flex items-center justify-end sm:items-start sm:justify-center">
              <TeacherCharacter
                teacherName={teacher}
                state={teacherState}
                className={TEACHER_WIDTH[prefs.teacherSize]}
                showStatus={false}
                lipSyncLevel={teacherAudio.lipSyncLevel}
              />
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">Level {level}/5</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">Answered {correct}/{asked}</span>
          {plan.length > 0 && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">{secs.filter((x, i) => plan[i] && x.status === "complete").length}/{plan.length} sections written</span>}
          {pendingIndex >= 0 && active && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void nextSection()}><ArrowRight /> Next section</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void writeRestOfChapter()}><FileText /> Write the rest</Button>
            </>
          )}
          {busy && secs.length > 1 && <Button size="sm" variant="outline" onClick={() => { cancelRest.current = true; }}><Square /> Stop after this section</Button>}
        </div>
        <LessonPlayback narration={teacherAudio} segments={segments} position={position} />
        {boardFull && <p className="mt-2 text-xs text-muted-foreground">Press Esc or “Exit full screen” to return to the classroom.{question ? " Your teacher asked a question — exit full screen to answer it." : ""}</p>}

        {!boardFull && segments.length > 0 ? (
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted-foreground">Lesson transcript</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed">{segments.map((x) => x.narration).join("\n\n")}</p></details>
        ) : null}
      </section>

      {question ? (
        <section className="mt-4 rounded-3xl border-2 border-primary/40 bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
            <HelpCircle className="h-3.5 w-3.5" /> {teacher} asks you
          </div>
          <p className="mt-1 text-sm font-bold">{question.prompt}</p>
          {question.hint ? <p className="mt-1 text-xs text-muted-foreground">Hint: {question.hint}</p> : null}
          <div className="mt-3 flex gap-2">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submitAnswer(); }}
              placeholder="Type your answer, or use the mic"
            />
            <Button variant="outline" size="icon" onClick={() => toggleMic("answer")} aria-label="Answer by voice">
              {listening ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button onClick={() => void submitAnswer()} disabled={busy || !answer.trim()} className="bg-gradient-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </section>
      ) : null}

      {feedback ? (
        <section
          className={`mt-4 rounded-3xl p-4 shadow-soft ${
            feedback.verdict === "correct"
              ? "bg-emerald-500/10 ring-1 ring-emerald-500/40"
              : feedback.verdict === "partial"
                ? "bg-amber-500/10 ring-1 ring-amber-500/40"
                : "bg-destructive/10 ring-1 ring-destructive/40"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest">
            {feedback.verdict === "correct" ? "Correct" : feedback.verdict === "partial" ? "Almost there" : "Let's fix this"}
          </div>
          <p className="mt-1 text-sm">{feedback.text}</p>
          {feedback.miss ? <p className="mt-1 text-xs text-muted-foreground">Gap detected: {feedback.miss}</p> : null}
        </section>
      ) : null}

      {active ? <ClassroomPractice key={active} topic={active} level={level} preferences={prefs} /> : null}

      <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tell your teacher what you need</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Act icon={RefreshCw} label="Explain again" onClick={() => void runTurn("again")} disabled={busy || !active} />
          <Act icon={Baby} label="Explain Easy" onClick={() => void runTurn("easier", { nextLevel: Math.max(1, level - 1) })} disabled={busy || !active} />
          <Act icon={Rocket} label="Explain Deeply" onClick={() => void runTurn("deeper")} disabled={busy || !active} />
          <Act icon={Lightbulb} label="Give an example" onClick={() => void runTurn("example")} disabled={busy || !active} />
          <Act icon={HelpCircle} label="Ask me a question" onClick={() => void runTurn("ask_me")} disabled={busy || !active} />
          <Act icon={ListChecks} label="Give practice" onClick={() => void runTurn("practice")} disabled={busy || !active} />
          <Act icon={ClipboardCheck} label="Mini-test" onClick={() => void runTurn("test")} disabled={busy || !active} />
          <Act icon={ArrowRight} label={pendingIndex >= 0 ? "Next section" : "Next step"} onClick={() => void runTurn("next")} disabled={busy || !active} />
          <Act icon={GraduationCap} label="Finish & save" onClick={() => void finishLesson()} disabled={busy || !active} />
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={doubt}
            onChange={(e) => setDoubt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && doubt.trim()) {
                const d = doubt.trim();
                setDoubt("");
                void runTurn("doubt", { studentText: d });
              }
            }}
            placeholder="Ask a follow-up doubt…"
          />
          <Button variant="outline" size="icon" onClick={() => toggleMic("doubt")} aria-label="Ask by voice">
            {listening ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            onClick={() => {
              const d = doubt.trim();
              if (!d) return;
              setDoubt("");
              void runTurn("doubt", { studentText: d });
            }}
            disabled={busy || !active || !doubt.trim()}
            className="bg-gradient-primary"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </AppShell>
  );
}

function Act({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof GraduationCap;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled} className="h-auto justify-start gap-2 py-2 text-left text-[12px] font-bold">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="truncate">{label}</span>
    </Button>
  );
}
