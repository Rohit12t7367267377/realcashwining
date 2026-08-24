import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuruTeacherBoard } from "@/components/GuruTeacherBoard";
import { guruBoardLesson } from "@/lib/guru-board.functions";
import { guruSpeak } from "@/lib/guru-extras.functions";
import { GraduationCap, Loader2, X, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

/**
 * Floating AI 2D teacher dock — available on every Guru.AI section.
 * Ask any topic and the animated character teaches it on the board, aloud.
 */
export function GuruBoardDock() {
  const teach = useServerFn(guruBoardLesson);
  const speak = useServerFn(guruSpeak);
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState<{ title: string; lines: string[]; speech: string; teacher: string } | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function stopAll() {
    stopRef.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSpeaking(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.src = "";
    }
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
    stopRef.current = false;
    setBusy(true);
    setLesson(null);
    setRevealed(0);
    try {
      const res = await teach({ data: { topic: t, context: document.querySelector("main")?.innerText?.slice(0, 1200) } });
      setLesson({ title: res.title, lines: res.lines, speech: res.speech, teacher: res.teacher });
      revealLines(res.lines.length);
      if (res.speech && !stopRef.current) {
        const audio = await speak({ data: { text: res.speech } });
        if (stopRef.current) return;
        const el = audioRef.current ?? new Audio();
        audioRef.current = el;
        el.src = `data:${audio.mimeType || "audio/mpeg"};base64,${audio.audioBase64}`;
        setSpeaking(true);
        el.onended = () => setSpeaking(false);
        el.onerror = () => setSpeaking(false);
        await el.play().catch(() => setSpeaking(false));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The AI teacher is unavailable right now");
    } finally {
      setBusy(false);
    }
  }

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
    <div className="fixed bottom-24 right-4 z-40 w-[min(26rem,calc(100vw-2rem))] rounded-3xl bg-card p-4 shadow-lift ring-1 ring-border">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-primary" /> AI Teacher Board
        </h2>
        <button type="button" onClick={() => { stopAll(); setOpen(false); }} aria-label="Close AI teacher board">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="mt-3">
        <GuruTeacherBoard
          title={lesson?.title ?? (lang === "hi" ? "बोर्ड कक्षा" : "Board class")}
          lines={lesson?.lines ?? []}
          revealed={revealed}
          speaking={speaking}
          teacher={lesson?.teacher ?? "Guru"}
        />
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

      {(speaking || busy) && (
        <Button type="button" variant="destructive" className="mt-2 w-full" onClick={stopAll}>
          <Square className="mr-2 h-4 w-4" /> Stop
        </Button>
      )}
    </div>
  );
}
