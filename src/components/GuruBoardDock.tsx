import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuruLessonDepth, type LessonContext } from "@/components/GuruLessonDepth";
import { guruEngineSpeak } from "@/lib/guru-engine.functions";
import { useTeacherAudio } from "@/hooks/use-teacher-audio";
import { GraduationCap, Loader2, X, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

/**
 * Floating AI 2D teacher dock — available on every Guru.AI section.
 * Ask any topic and the animated character teaches it on the board, aloud.
 */
export function GuruBoardDock() {
  const speak = useServerFn(guruEngineSpeak);
  const teacherAudio = useTeacherAudio();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState<LessonContext>({ topic: "" });
  const [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState<{ title: string; lines: string[]; speech: string; teacher: string } | null>(null);
  const [revealed, setRevealed] = useState(0);
  const stopRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function stopAll() {
    stopRef.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    teacherAudio.stop();
  }

  function revealLines(count: number) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRevealed(1);
    for (let i = 2; i <= count; i++) {
      timers.current.push(setTimeout(() => setRevealed(i), (i - 1) * 1400));
    }
  }

  async function teachTopic(raw: string) {
    const t = raw.trim();
    if (!t || busy) return;
    stopAll();
    setContext((previous) => ({ ...previous, topic: t }));
  }

  function run(e: React.FormEvent) {
    e.preventDefault();
    void teachTopic(topic);
  }

  /** Any Guru.AI screen can start a board lesson: window.dispatchEvent(new CustomEvent("guru:teach", { detail: { topic } })) */
  useEffect(() => {
    function onTeach(ev: Event) {
      const detail = (ev as CustomEvent<LessonContext>).detail;
      const t = detail?.topic;
      if (!t) return;
      setOpen(true);
      setTopic(t);
      setContext(detail);
    }
    window.addEventListener("guru:teach", onTeach);
    return () => window.removeEventListener("guru:teach", onTeach);
  });



  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the AI teacher board"
        className="press fixed bottom-44 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-lift"
      >
        <GraduationCap className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-40 max-h-[calc(100dvh-8rem)] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-card p-4 shadow-lift ring-1 ring-border">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-primary" /> AI Teacher Board
        </h2>
        <button type="button" onClick={() => { stopAll(); setOpen(false); }} aria-label="Close AI teacher board">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="mt-3">
        <GuruLessonDepth {...context} />
      </div>

      <form onSubmit={run} className="mt-3 flex gap-2">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={lang === "hi" ? "कोई भी टॉपिक लिखें…" : "Any topic to teach on the board…"}
          disabled={busy}
        />
        <Button type="submit" className="press bg-gradient-primary" disabled={busy || !topic.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
        </Button>
      </form>

      <Link
        to="/guru/classroom"
        search={{ topic: topic.trim() || undefined }}
        onClick={() => { stopAll(); setOpen(false); }}
        className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-secondary py-2 text-[12px] font-bold"
      >
        <GraduationCap className="h-4 w-4 text-primary" />
        {lang === "hi" ? "पूरी इंटरैक्टिव क्लास खोलें" : "Open full interactive classroom"}
      </Link>

      {(teacherAudio.speaking || busy) && (
        <Button type="button" variant="destructive" className="mt-2 w-full" onClick={stopAll}>
          <Square className="mr-2 h-4 w-4" /> Stop
        </Button>
      )}
    </div>
  );
}
