import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import { guruAsk, listGuruMessages } from "@/lib/guru.functions";
import { Bot, Send, Sparkles, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/universal")({
  head: () => ({
    meta: [
      { title: "Universal AI — Ask Guru.AI Anything" },
      { name: "description", content: "Ask Guru.AI any question across school, skills, exams and general knowledge, and get answers in your chosen character's teaching style." },
      { property: "og:title", content: "Universal AI — Guru.AI" },
      { property: "og:description", content: "One AI companion for every question, in English or Hindi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UniversalAiPage,
});

function UniversalAiPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const ask = useServerFn(guruAsk);
  const listMsgs = useServerFn(listGuruMessages);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || send.isPending) return;
    setText("");
    send.mutate(q);
  }

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Universal AI
        </div>
        <h1 className="mt-1 text-2xl font-black">Ask Guru.AI anything</h1>
      </header>

      <div ref={scrollRef} className="mt-4 h-[56vh] space-y-3 overflow-y-auto rounded-2xl bg-card p-4 shadow-soft">
        {messages.length === 0 && !send.isPending && (
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
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-soft ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4" /></div>
            )}
          </div>
        ))}
        {send.isPending && <div className="rounded-2xl bg-muted px-3 py-2 text-sm shadow-soft">Guru is thinking…</div>}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything…" disabled={send.isPending} />
        <Button type="submit" disabled={send.isPending || !text.trim()} className="press bg-gradient-primary" aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </AppShell>
  );
}
