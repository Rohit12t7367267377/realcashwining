import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuruTeacherBoard } from "@/components/GuruTeacherBoard";
import { useUser } from "@/lib/user-store";
import { guruImageDoubt, guruSpeak } from "@/lib/guru-extras.functions";
import { guruBoardLesson } from "@/lib/guru-board.functions";
import { ImagePlus, Loader2, Send, Sparkles, Volume2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/ask")({
  head: () => ({
    meta: [
      { title: "Photo Doubt & Ask AI — Guru.AI Vision Tutor" },
      {
        name: "description",
        content:
          "Upload a photo of any question, book page, diagram or code and get a step-by-step explanation from your Guru.AI teacher, plus board lessons on any topic.",
      },
      { property: "og:title", content: "Photo Doubt & Ask AI — Guru.AI" },
      { property: "og:description", content: "Snap a question, ask a doubt, and learn it on the AI teacher's board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskPage,
});

type Msg = { role: "user" | "assistant"; content: string; image?: string };

function AskPage() {
  const { state } = useUser();
  const askImage = useServerFn(guruImageDoubt);
  const teach = useServerFn(guruBoardLesson);
  const speak = useServerFn(guruSpeak);

  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [board, setBoard] = useState<{ title: string; lines: string[]; teacher: string } | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 6_000_000) return toast.error("Image is too large (max 6 MB)");
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function play(text: string) {
    try {
      const res = await speak({ data: { text: text.slice(0, 2500) } });
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.src = `data:${res.mimeType || "audio/mpeg"};base64,${res.audioBase64}`;
      setSpeaking(true);
      el.onended = () => setSpeaking(false);
      el.onerror = () => setSpeaking(false);
      await el.play().catch(() => setSpeaking(false));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice unavailable");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const q = prompt.trim();
    if (!image && !q) return;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: q || "Explain this image", image: image ?? undefined }]);
    setPrompt("");
    try {
      if (image) {
        const res = await askImage({ data: { image, prompt: q || undefined, session_id: sessionRef.current ?? undefined } });
        sessionRef.current = res.session_id ?? sessionRef.current;
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
        setImage(null);
        const lesson = await teach({ data: { topic: q || "the uploaded question", context: res.reply.slice(0, 1200) } });
        setBoard({ title: lesson.title, lines: lesson.lines, teacher: lesson.teacher });
        setRevealed(lesson.lines.length);
      } else {
        const lesson = await teach({ data: { topic: q } });
        setBoard({ title: lesson.title, lines: lesson.lines, teacher: lesson.teacher });
        setRevealed(lesson.lines.length);
        setMessages((m) => [...m, { role: "assistant", content: lesson.speech || lesson.lines.join("\n") }]);
        if (lesson.speech) void play(lesson.speech);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not answer that");
    } finally {
      setBusy(false);
    }
  }

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to ask Guru.AI</h1>
          <Link to="/login">
            <Button className="mt-4 bg-gradient-primary">Sign In</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Photo Doubt & Ask AI
        </div>
        <h1 className="mt-1 text-2xl font-black">Snap it. Ask it. Learn it.</h1>
        <p className="mt-1 text-sm opacity-90">
          Upload a question, book page, diagram or code — your AI teacher explains it on the board.
        </p>
      </header>

      <section className="mt-4">
        <GuruTeacherBoard
          title={board?.title ?? "Board class"}
          lines={board?.lines ?? []}
          revealed={board ? revealed : 0}
          speaking={speaking}
          teacher={board?.teacher ?? "Guru"}
        />
      </section>

      <section className="mt-4 grid gap-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl p-3 text-sm shadow-soft ${
              m.role === "user" ? "bg-primary/10" : "bg-card"
            }`}
          >
            {m.image && <img src={m.image} alt="Uploaded doubt" className="mb-2 max-h-56 rounded-xl object-contain" />}
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.role === "assistant" && (
              <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => void play(m.content)}>
                <Volume2 className="mr-1 h-3.5 w-3.5" /> Listen
              </Button>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 rounded-2xl bg-card p-3 text-sm text-muted-foreground shadow-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Guru is reading and preparing the board…
          </div>
        )}
      </section>

      {image && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
          <img src={image} alt="Selected doubt" className="h-16 w-16 rounded-xl object-cover" />
          <span className="flex-1 text-xs text-muted-foreground">Image ready — add a question or send it.</span>
          <button type="button" onClick={() => setImage(null)} aria-label="Remove image">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="sticky bottom-20 mt-3 flex gap-2 rounded-2xl bg-card p-2 shadow-lift">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} aria-label="Upload a photo">
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask any doubt, or upload a photo…"
          disabled={busy}
        />
        <Button type="submit" className="press bg-gradient-primary" disabled={busy || (!image && !prompt.trim())}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </AppShell>
  );
}
