import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { speakAnswer } from "@/lib/voice.functions";
import { Loader2, Mic, Volume2 } from "lucide-react";
import { toast } from "sonner";

/** Guru.AI voice assistant — ask aloud, hear the answer spoken back. */
export function VoiceAssistant() {
  const ask = useServerFn(speakAnswer);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await ask({ data: { question: q } });
      setAnswer(res.answer);
      if (res.audioBase64) {
        const el = audioRef.current ?? new Audio();
        el.src = `data:${res.mimeType || "audio/mpeg"};base64,${res.audioBase64}`;
        audioRef.current = el;
        await el.play().catch(() => undefined);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice assistant unavailable");
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SR) return toast.info("Voice input isn't supported on this browser — type instead.");
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (ev: any) => setQuestion(String(ev.results[0][0].transcript ?? ""));
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <section className="mt-5 rounded-3xl bg-card p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <Volume2 className="h-4 w-4" /> Voice assistant
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Ask a study question and Guru.AI answers out loud.</p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask aloud or type…"
          disabled={busy}
        />
        <Button type="button" variant="outline" onClick={listen} aria-label="Speak your question" disabled={busy}>
          <Mic className={`h-4 w-4 ${listening ? "text-destructive animate-pulse" : ""}`} />
        </Button>
        <Button type="submit" className="press bg-gradient-primary" disabled={busy || !question.trim()} aria-label="Ask">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </form>
      {answer && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted p-3 text-sm">{answer}</p>}
    </section>
  );
}
