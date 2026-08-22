import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import { guruAsk, listGuruMessages } from "@/lib/guru.functions";
import { guruImageDoubt, guruSpeak, guruWebAnswer } from "@/lib/guru-extras.functions";
import { Bot, Camera, Globe, Mic, Send, Sparkles, User as UserIcon, Volume2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/universal")({
  head: () => ({
    meta: [
      { title: "Universal AI — Ask Guru.AI Anything" },
      { name: "description", content: "Ask Guru.AI any question across school, skills, exams and general knowledge — by text, voice, photo or live web search — in your chosen character's teaching style." },
      { property: "og:title", content: "Universal AI — Guru.AI" },
      { property: "og:description", content: "One AI companion for every question: text, voice, photo doubts and web-backed answers, in English or Hindi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UniversalAiPage,
});

type Mode = "ask" | "web" | "photo";

function UniversalAiPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const ask = useServerFn(guruAsk);
  const listMsgs = useServerFn(listGuruMessages);
  const webAnswer = useServerFn(guruWebAnswer);
  const imageDoubt = useServerFn(guruImageDoubt);
  const speak = useServerFn(guruSpeak);

  const [mode, setMode] = useState<Mode>("ask");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [web, setWeb] = useState<{ answer: string; verified: boolean; note: string | null; results: Array<{ title: string; url: string }> } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["guru-messages", sessionId],
    queryFn: () => listMsgs({ data: { session_id: sessionId! } }),
    enabled: Boolean(sessionId),
  });

  const send = useMutation({
    mutationFn: (question: string) =>
      ask({ data: { question, intent: "chat" as const, scope: "universal" as const, ...(sessionId ? { session_id: sessionId } : {}) } }),
    onSuccess: (res) => {
      setSessionId(res.session_id);
      qc.invalidateQueries({ queryKey: ["guru-messages"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Guru.AI could not answer"),
  });

  const searchWeb = useMutation({
    mutationFn: (query: string) => webAnswer({ data: { query } }),
    onSuccess: (res) => setWeb({ answer: res.answer, verified: res.verified, note: res.note, results: res.results }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Search failed"),
  });

  const photo = useMutation({
    mutationFn: (payload: { image: string; prompt?: string }) =>
      imageDoubt({ data: { ...payload, ...(sessionId ? { session_id: sessionId } : {}) } }),
    onSuccess: (res) => {
      if (res.session_id) setSessionId(res.session_id);
      setMode("ask");
      qc.invalidateQueries({ queryKey: ["guru-messages"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not read that image"),
  });

  const speaking = useMutation({
    mutationFn: (t: string) => speak({ data: { text: t.slice(0, 3000) } }),
    onSuccess: (res) => {
      const src = `data:${res.mimeType};base64,${res.audioBase64}`;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = src;
      void audioRef.current.play();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Voice is unavailable right now"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to use Universal AI</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const busy = send.isPending || searchWeb.isPending || photo.isPending;

  function startVoice() {
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input is not supported on this browser");
      return;
    }
    const rec = new Ctor() as {
      lang: string; interimResults: boolean; start: () => void;
      onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
      onerror: () => void; onend: () => void;
    };
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => setText(e.results[0][0].transcript);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    if (mode === "web") searchWeb.mutate(q);
    else send.mutate(q);
  }

  function onPickImage(file: File) {
    if (file.size > 5_000_000) {
      toast.error("Please choose an image under 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = String(reader.result || "");
      if (!image.startsWith("data:image/")) return toast.error("That file is not an image");
      photo.mutate({ image, ...(text.trim() ? { prompt: text.trim() } : {}) });
      setText("");
    };
    reader.readAsDataURL(file);
  }

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Universal AI
        </div>
        <h1 className="mt-1 text-2xl font-black">Ask Guru.AI anything</h1>
        <p className="mt-1 text-xs opacity-90">Type it, speak it, snap a photo of it, or search the web.</p>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {([
          { id: "ask" as Mode, label: "Ask AI", icon: Bot },
          { id: "web" as Mode, label: "Web search", icon: Globe },
          { id: "photo" as Mode, label: "Photo doubt", icon: Camera },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`press flex items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-xs font-bold shadow-soft ${mode === id ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === "web" ? (
        <div className="mt-3 min-h-[40vh] rounded-2xl bg-card p-4 shadow-soft">
          {searchWeb.isPending && <p className="text-sm text-muted-foreground">Searching the web…</p>}
          {!searchWeb.isPending && !web && (
            <p className="text-sm text-muted-foreground">Ask about current affairs, news or general knowledge — Guru.AI will use live web results when available.</p>
          )}
          {web && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${web.verified ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {web.verified ? "Web-verified" : "Unverified — AI knowledge"}
                </span>
                <Button size="sm" variant="outline" onClick={() => speaking.mutate(web.answer)} disabled={speaking.isPending}>
                  <Volume2 className="mr-1 h-3.5 w-3.5" /> Listen
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{web.answer}</p>
              {web.note && <p className="text-xs text-muted-foreground">{web.note}</p>}
              {web.results.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {web.results.map((r, i) => (
                    <li key={r.url + i}>
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-primary underline">[{i + 1}] {r.title}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : mode === "photo" ? (
        <div className="mt-3 min-h-[40vh] rounded-2xl bg-card p-4 text-center shadow-soft">
          <Camera className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Snap or upload a photo of a question, book page, diagram or code — Guru.AI will read it and teach the solution step by step.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImage(f);
              e.target.value = "";
            }}
          />
          <Button className="press mt-4 bg-gradient-primary" onClick={() => fileRef.current?.click()} disabled={photo.isPending}>
            {photo.isPending ? "Reading your photo…" : "Choose / take photo"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Optional: type a hint below before choosing the photo.</p>
        </div>
      ) : (
        <div ref={scrollRef} className="mt-3 h-[52vh] space-y-3 overflow-y-auto rounded-2xl bg-card p-4 shadow-soft">
          {messages.length === 0 && !busy && (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Bot className="mx-auto mb-2 h-8 w-8 text-primary" />
                <p>Start a conversation with your Guru.</p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role !== "user" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-4 w-4" /></div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-soft ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.role !== "user" && (
                  <button
                    type="button"
                    onClick={() => speaking.mutate(m.content)}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                  >
                    <Volume2 className="h-3 w-3" /> Listen
                  </button>
                )}
              </div>
              {m.role === "user" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4" /></div>
              )}
            </div>
          ))}
          {busy && <div className="rounded-2xl bg-muted px-3 py-2 text-sm shadow-soft">Guru is thinking…</div>}
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === "web" ? "Search anything…" : mode === "photo" ? "Optional hint for the photo…" : "Ask anything…"}
          disabled={busy}
        />
        <Button type="button" variant="outline" onClick={startVoice} aria-label="Speak" className={listening ? "text-primary" : ""}>
          <Mic className="h-4 w-4" />
        </Button>
        {mode !== "photo" && (
          <Button type="submit" disabled={busy || !text.trim()} className="press bg-gradient-primary" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </AppShell>
  );
}
