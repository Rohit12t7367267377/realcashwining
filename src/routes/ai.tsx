import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAiDoubt, listMyAiChat, clearMyAiChat, aiRecommendContests } from "@/lib/ai.functions";
import { getMyContestStats } from "@/lib/stats.functions";
import { useUser } from "@/lib/user-store";
import {
  Sparkles, Send, Trash2, Bot, User as UserIcon, GraduationCap, HelpCircle,
  ListChecks, BookOpen, Code2, Briefcase, CalendarClock, LineChart,
} from "lucide-react";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { LibrarySection } from "@/components/LibrarySection";
import { toast } from "sonner";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Guru.AI — Tutor, Doubt Solver, Library & Voice | Cash Winning League" },
      { name: "description", content: "Guru.AI: one place for every AI tool — tutor, doubt solver, quiz generator, reading assistant, coding mentor, interview practice, study planner and performance analysis." },
      { property: "og:title", content: "Guru.AI — Cash Winning League" },
      { property: "og:description", content: "Your personal AI tutor, doubt solver, planner and performance analyst — in English or Hindi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiHubPage,
});

type Tool = { key: string; label: string; sub: string; icon: React.ReactNode; prompt: string };

const TOOLS: Tool[] = [
  { key: "tutor", label: "AI Tutor", sub: "Learn any topic step by step", icon: <GraduationCap className="h-5 w-5" />, prompt: "Act as my AI tutor. Teach me " },
  { key: "doubt", label: "Doubt Solver", sub: "Instant answers with reasoning", icon: <HelpCircle className="h-5 w-5" />, prompt: "Solve this doubt and explain the reasoning: " },
  { key: "quiz", label: "Quiz Generator", sub: "Practice MCQs on demand", icon: <ListChecks className="h-5 w-5" />, prompt: "Generate 10 MCQs with answers and explanations on the topic: " },
  { key: "reading", label: "Reading Assistant", sub: "Summarise & explain passages", icon: <BookOpen className="h-5 w-5" />, prompt: "Summarise this passage and give me 5 comprehension questions:\n\n" },
  { key: "coding", label: "Coding Mentor", sub: "Debug, explain, optimise", icon: <Code2 className="h-5 w-5" />, prompt: "Act as my coding mentor. Explain and improve this code:\n\n" },
  { key: "interview", label: "Interview Practice", sub: "Mock questions & feedback", icon: <Briefcase className="h-5 w-5" />, prompt: "Give me a mock interview with feedback for the role of " },
  { key: "planner", label: "Study Planner", sub: "Day-wise exam schedule", icon: <CalendarClock className="h-5 w-5" />, prompt: "Create a day-wise study plan for the exam: " },
];

function AiHubPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const list = useServerFn(listMyAiChat);
  const ask = useServerFn(askAiDoubt);
  const clear = useServerFn(clearMyAiChat);
  const fetchRecs = useServerFn(aiRecommendContests);
  const fetchStats = useServerFn(getMyContestStats);

  const [text, setText] = useState("");
  const [active, setActive] = useState("tutor");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: messages = [] } = useQuery({ queryKey: ["ai-chat"], queryFn: () => list(), enabled: state.loggedIn });
  const { data: recs } = useQuery({ queryKey: ["ai-recs"], queryFn: () => fetchRecs(), enabled: state.loggedIn, staleTime: 5 * 60_000, retry: false });
  const { data: stats } = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats(), enabled: state.loggedIn, staleTime: 30_000 });

  const send = useMutation({
    mutationFn: (message: string) => ask({ data: { message } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-chat"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const clearMut = useMutation({
    mutationFn: () => clear(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-chat"] }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to use Guru.AI</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  function pick(t: Tool) {
    setActive(t.key);
    setText(t.prompt);
    inputRef.current?.focus();
  }

  function analyse() {
    setActive("analysis");
    const played = Number(stats?.played ?? 0);
    const wins = Number(stats?.wins ?? 0);
    const acc = played ? Math.round((wins / played) * 100) : 0;
    const recent = (stats?.history ?? []).slice(0, 5).map((h) => `${h.title}: score ${h.score}${h.rank ? `, rank #${h.rank}` : ""}`).join("; ");
    setText(
      `Analyse my quiz performance and give me a 5-point improvement plan. Contests played: ${played}, wins: ${wins}, win rate: ${acc}%. Recent results: ${recent || "none yet"}.`,
    );
    inputRef.current?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || send.isPending) return;
    setText("");
    send.mutate(t);
  }

  return (
    <AppShell>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Guru.AI
        </div>
        <h1 className="mt-1 text-2xl font-black">Guru.AI — your personal coach</h1>
        <p className="mt-1 text-sm opacity-90">Tutor, doubt solver, library, voice and analyst — English या हिन्दी.</p>
      </section>

      {/* Tools */}
      <section className="mt-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Guru.AI tools</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pick(t)}
              className={`press card-lift rounded-2xl p-3 text-left shadow-soft transition ${active === t.key ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}
            >
              <span className={active === t.key ? "" : "text-primary"}>{t.icon}</span>
              <div className="mt-1.5 text-xs font-black leading-tight">{t.label}</div>
              <div className={`text-[10px] leading-tight ${active === t.key ? "opacity-90" : "text-muted-foreground"}`}>{t.sub}</div>
            </button>
          ))}
          <button
            type="button"
            onClick={analyse}
            className={`press card-lift rounded-2xl p-3 text-left shadow-soft transition ${active === "analysis" ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}
          >
            <span className={active === "analysis" ? "" : "text-primary"}><LineChart className="h-5 w-5" /></span>
            <div className="mt-1.5 text-xs font-black leading-tight">Performance Analysis</div>
            <div className={`text-[10px] leading-tight ${active === "analysis" ? "opacity-90" : "text-muted-foreground"}`}>Based on your real results</div>
          </button>
        </div>
      </section>

      {/* Chat */}
      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Chat history</h2>
          {messages.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => confirm("Clear chat history?") && clearMut.mutate()} aria-label="Clear chat history">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="mt-2 h-[52vh] space-y-3 overflow-y-auto rounded-2xl bg-card p-4 shadow-soft">
          {messages.length === 0 && !send.isPending && (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Bot className="mx-auto mb-2 h-8 w-8 text-primary" />
                <p>Pick a tool above or just ask anything.</p>
                <p className="mt-1 text-[11px]">e.g. "Explain photosynthesis" या "बैंकिंग एग्जाम की तैयारी कैसे करूं?"</p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role !== "user" && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-4 w-4" /></div>}
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-soft ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.content}
              </div>
              {m.role === "user" && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4" /></div>}
            </div>
          ))}
          {send.isPending && (
            <div className="flex gap-2">
              <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-4 w-4" /></div>
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm shadow-soft">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="mt-3 flex gap-2">
          <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" disabled={send.isPending} />
          <Button type="submit" disabled={send.isPending || !text.trim()} className="press bg-gradient-primary" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>

      {/* Recommended learning */}
      {recs?.enabled && recs.items && recs.items.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Recommended for you</h2>
          <div className="grid gap-2">
            {recs.items.map((r) => (
              <Link key={r.contest_id} to="/contest/$id" params={{ id: r.contest_id }} className="card-lift rounded-2xl border border-primary/30 bg-card p-3 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{r.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.reason}</div>
                  </div>
                  <div className="shrink-0 text-right text-[11px]">
                    {r.entry_fee > 0 ? <span>Entry ₹{r.entry_fee}</span> : <span className="font-bold text-success">FREE</span>}
                    {r.first_prize > 0 && <div className="font-bold text-success">Win ₹{r.first_prize}</div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <VoiceAssistant />
      <LibrarySection />
    </AppShell>
  );
}
