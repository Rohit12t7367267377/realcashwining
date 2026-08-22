import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { speakAnswer } from "@/lib/voice.functions";
import { guruSpeak } from "@/lib/guru-extras.functions";
import { Loader2, Mic, Volume2, X, BookOpen, Square } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

/** Split long page text into TTS-sized chunks on sentence boundaries. */
function chunkText(text: string, size = 1200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  let buf = "";
  for (const part of clean.split(/(?<=[.!?।])\s+/)) {
    if ((buf + " " + part).trim().length > size) {
      if (buf) out.push(buf.trim());
      buf = part;
    } else {
      buf = `${buf} ${part}`;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.slice(0, 8);
}

/**
 * Guru.AI voice assistant dock — available on every Guru.AI section.
 * Ask aloud (Gemini answers, spoken back) or have the page's paragraphs read out.
 */
export function GuruVoiceDock() {
  const ask = useServerFn(speakAnswer);
  const speak = useServerFn(guruSpeak);
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [listening, setListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef(false);

  function stopAudio() {
    stopRef.current = true;
    setReading(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.src = "";
    }
  }

  async function play(base64: string, mimeType?: string) {
    const el = audioRef.current ?? new Audio();
    audioRef.current = el;
    el.src = `data:${mimeType || "audio/mpeg"};base64,${base64}`;
    await el.play().catch(() => undefined);
    await new Promise<void>((resolve) => {
      el.onended = () => resolve();
      el.onerror = () => resolve();
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer(null);
    stopRef.current = false;
    try {
      const res = await ask({ data: { question: q, lang } });
      setAnswer(res.answer);
      if (res.audioBase64 && !stopRef.current) await play(res.audioBase64, res.mimeType);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice assistant unavailable");
    } finally {
      setBusy(false);
    }
  }

  async function readPage() {
    if (reading) return stopAudio();
    const main = document.querySelector("main");
    const chunks = chunkText(main?.innerText ?? "");
    if (chunks.length === 0) return toast.info("Nothing to read on this page yet.");
    stopRef.current = false;
    setReading(true);
    try {
      for (const part of chunks) {
        if (stopRef.current) break;
        const res = await speak({ data: { text: part } });
        if (stopRef.current) break;
        await play(res.audioBase64, res.mimeType);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read this page aloud");
    } finally {
      setReading(false);
    }
  }

  function listen() {
    const w = window as unknown as {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return toast.info("Voice input isn't supported on this browser — type instead.");
    const rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.onresult = (ev: any) => setQuestion(String(ev.results[0][0].transcript ?? ""));
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Guru.AI voice assistant"
        className="press fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-lift"
      >
        <Mic className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-card p-4 shadow-lift ring-1 ring-border">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Volume2 className="h-4 w-4 text-primary" /> Guru.AI Voice
        </h2>
        <button type="button" onClick={() => { stopAudio(); setOpen(false); }} aria-label="Close voice assistant">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ask aloud or let Guru.AI read this section's paragraphs to you.
      </p>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={lang === "hi" ? "अपना सवाल बोलें…" : "Ask aloud or type…"}
          disabled={busy}
        />
        <Button type="button" variant="outline" onClick={listen} aria-label="Speak your question" disabled={busy}>
          <Mic className={`h-4 w-4 ${listening ? "animate-pulse text-destructive" : ""}`} />
        </Button>
        <Button type="submit" className="press bg-gradient-primary" disabled={busy || !question.trim()} aria-label="Ask Guru.AI">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </form>

      <Button
        type="button"
        variant={reading ? "destructive" : "secondary"}
        className="mt-2 w-full"
        onClick={readPage}
      >
        {reading ? <Square className="mr-2 h-4 w-4" /> : <BookOpen className="mr-2 h-4 w-4" />}
        {reading ? "Stop reading" : lang === "hi" ? "यह पेज पढ़कर सुनाएँ" : "Read this page aloud"}
      </Button>

      {answer && (
        <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-muted p-3 text-sm">{answer}</p>
      )}
    </div>
  );
}
