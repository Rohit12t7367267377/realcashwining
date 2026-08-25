import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuruBoardCanvas } from "@/components/GuruBoardCanvas";
import { GuruTeacherAvatar } from "@/components/GuruTeacherAvatar";
import type { BoardBlock } from "@/lib/guru-board-blocks";
import { guruClassroomTurn, guruEvaluateAnswer, guruClassroomProgress } from "@/lib/guru-classroom.functions";
import { guruSpeak } from "@/lib/guru-extras.functions";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import {
  GraduationCap, Loader2, Mic, MicOff, Send, RefreshCw, Baby, Rocket,
  Lightbulb, HelpCircle, ListChecks, ClipboardCheck, Square, Volume2, ArrowRight,
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

type Mode = "start" | "again" | "easier" | "harder" | "example" | "ask_me" | "practice" | "test" | "doubt" | "next";
type Turn = { role: "teacher" | "student"; content: string };

function Classroom() {
  const { state } = useUser();
  const { topic: topicParam } = Route.useSearch();
  const turnFn = useServerFn(guruClassroomTurn);
  const evalFn = useServerFn(guruEvaluateAnswer);
  const saveFn = useServerFn(guruClassroomProgress);
  const speakFn = useServerFn(guruSpeak);

  const [topic, setTopic] = useState(topicParam ?? "");
  const [active, setActive] = useState<string | null>(null);
  const [level, setLevel] = useState(3);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Interactive AI Classroom");
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BoardBlock[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [speech, setSpeech] = useState("");
  const [teacher, setTeacher] = useState("Guru");
  const [speaking, setSpeaking] = useState(false);
  const [question, setQuestion] = useState<{ prompt: string; hint: string | null; expected: string | null } | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ verdict: string; text: string; miss: string | null } | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [asked, setAsked] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [doubt, setDoubt] = useState("");
  const [listening, setListening] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recRef = useRef<any>(null);
  const voiceTarget = useRef<"doubt" | "answer">("doubt");

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    audioRef.current?.pause();
    recRef.current?.stop?.();
  }, []);

  function stopVoice() {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.src = "";
    }
    setSpeaking(false);
  }

  function reveal(count: number) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRevealed(count > 0 ? 1 : 0);
    for (let i = 2; i <= count; i++) {
      timers.current.push(setTimeout(() => setRevealed(i), (i - 1) * 1200));
    }
  }

  async function say(text: string) {
    if (!text) return;
    try {
      const audio = await speakFn({ data: { text } });
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.src = `data:${audio.mimeType || "audio/mpeg"};base64,${audio.audioBase64}`;
      setSpeaking(true);
      el.onended = () => setSpeaking(false);
      el.onerror = () => setSpeaking(false);
      await el.play().catch(() => setSpeaking(false));
    } catch {
      setSpeaking(false);
    }
  }

  async function runTurn(mode: Mode, opts: { studentText?: string; nextLevel?: number; topicOverride?: string } = {}) {
    const t = (opts.topicOverride ?? active ?? topic).trim();
    if (!t) {
      toast.error("Type a topic first");
      return;
    }
    if (busy) return;
    stopVoice();
    setBusy(true);
    setFeedback(null);
    setQuestion(null);
    setAnswer("");
    try {
      const res = await turnFn({
        data: {
          topic: t,
          mode,
          level: opts.nextLevel ?? level,
          studentText: opts.studentText,
          history: history.slice(-8),
        },
      });
      setActive(t);
      setTeacher(res.teacher);
      setTitle(res.title);
      setStepLabel(res.stepLabel);
      setBlocks(res.board as BoardBlock[]);
      reveal(res.board.length);
      setSpeech(res.speech);
      setQuestion(res.question);
      if (res.question) setAsked((n) => n + 1);
      setHistory((h) => [
        ...h,
        ...(opts.studentText ? ([{ role: "student", content: opts.studentText }] as Turn[]) : []),
        { role: "teacher", content: `${res.speech}${res.question ? ` Question: ${res.question.prompt}` : ""}` },
      ]);
      void say(res.speech);
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
      if (res.board.length) {
        setBlocks((b) => [...b, ...(res.board as BoardBlock[])]);
        setRevealed((r) => r + res.board.length);
      }
      const isCorrect = res.verdict === "correct";
      if (isCorrect) setCorrect((n) => n + 1);
      setHistory((h) => [
        ...h,
        { role: "student", content: a },
        { role: "teacher", content: `${res.feedback}${res.misunderstanding ? ` (gap: ${res.misunderstanding})` : ""}` },
      ]);
      setQuestion(null);
      setAnswer("");
      void say(res.speech);
      void saveFn({ data: { questions: 1, correct: isCorrect ? 1 : 0, lessonCompleted: false } }).catch(() => {});
      if (res.reteach) {
        setTimeout(() => void runTurn("again", { nextLevel: res.nextLevel }), 1200);
      }
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
    await saveFn({ data: { questions: 0, correct: 0, lessonCompleted: true } }).catch(() => {});
    toast.success("Lesson saved — XP added to your profile");
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

  return (
    <AppShell>
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
            onKeyDown={(e) => { if (e.key === "Enter") void runTurn("start", { topicOverride: topic }); }}
            placeholder="e.g. Photosynthesis, Quadratic equations, For loops in Python"
            className="bg-white/95 text-foreground"
          />
          <Button
            onClick={() => { setHistory([]); setAsked(0); setCorrect(0); void runTurn("start", { topicOverride: topic }); }}
            disabled={busy}
            className="shrink-0 bg-white text-primary hover:bg-white/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Teach Me"}
          </Button>
        </div>
      </section>

      <section className="mt-4 rounded-3xl bg-card p-3 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <GuruBoardCanvas title={title} blocks={blocks} revealed={revealed} stepLabel={stepLabel} />
          <div className="flex items-center justify-center sm:block">
            <GuruTeacherAvatar teacher={teacher} speaking={speaking} writing={busy ? false : revealed < blocks.length} thinking={busy} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">Level {level}/5</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">Answered {correct}/{asked}</span>
          {speech ? (
            <Button size="sm" variant="outline" onClick={() => (speaking ? stopVoice() : void say(speech))}>
              {speaking ? <><Square className="mr-1 h-3.5 w-3.5" /> Stop</> : <><Volume2 className="mr-1 h-3.5 w-3.5" /> Listen</>}
            </Button>
          ) : null}
        </div>

        {speech ? (
          <p className="mt-2 rounded-2xl bg-secondary/60 p-3 text-[13px] leading-relaxed">{speech}</p>
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

      <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tell your teacher what you need</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Act icon={RefreshCw} label="Explain again" onClick={() => void runTurn("again")} disabled={busy || !active} />
          <Act icon={Baby} label="Make it easier" onClick={() => void runTurn("easier", { nextLevel: Math.max(1, level - 1) })} disabled={busy || !active} />
          <Act icon={Rocket} label="Go deeper" onClick={() => void runTurn("harder", { nextLevel: Math.min(5, level + 1) })} disabled={busy || !active} />
          <Act icon={Lightbulb} label="Give an example" onClick={() => void runTurn("example")} disabled={busy || !active} />
          <Act icon={HelpCircle} label="Ask me a question" onClick={() => void runTurn("ask_me")} disabled={busy || !active} />
          <Act icon={ListChecks} label="Give practice" onClick={() => void runTurn("practice")} disabled={busy || !active} />
          <Act icon={ClipboardCheck} label="Mini-test" onClick={() => void runTurn("test")} disabled={busy || !active} />
          <Act icon={ArrowRight} label="Next step" onClick={() => void runTurn("next")} disabled={busy || !active} />
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
