import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAiDoubt, listMyAiChat, clearMyAiChat } from "@/lib/ai.functions";
import { useUser } from "@/lib/user-store";
import { Sparkles, Send, Trash2, Bot, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ai-tutor")({
  head: () => ({
    meta: [
      { title: "AI Doubt Assistant — Cash Winning League" },
      { name: "description", content: "Ask any quiz or study doubt and get an instant AI-powered answer." },
      { property: "og:title", content: "AI Doubt Assistant" },
      { property: "og:description", content: "Get instant AI answers to your quiz doubts, in English or Hindi." },
    ],
  }),
  component: AiTutorPage,
});

function AiTutorPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const list = useServerFn(listMyAiChat);
  const ask = useServerFn(askAiDoubt);
  const clear = useServerFn(clearMyAiChat);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["ai-chat"],
    queryFn: () => list(),
    enabled: state.loggedIn,
  });

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

  if (!state.loggedIn) return <AppShell><p className="rounded-2xl bg-card p-4 text-center">Please sign in.</p></AppShell>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || send.isPending) return;
    setText("");
    send.mutate(t);
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-black">AI Doubt Assistant</h1>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => confirm("Clear chat history?") && clearMut.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Ask any question — GK, exams, coding, sports. English या हिन्दी दोनों में पूछें.</p>

      <div ref={scrollRef} className="mt-4 h-[60vh] space-y-3 overflow-y-auto rounded-2xl bg-card p-4 shadow-soft">
        {messages.length === 0 && !send.isPending && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div>
              <Bot className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p>Ask me anything to get started.</p>
              <p className="mt-1 text-[11px]">e.g. "Explain photosynthesis" or "बैंकिंग एग्जाम की तैयारी कैसे करूं?"</p>
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
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your doubt…" disabled={send.isPending} />
        <Button type="submit" disabled={send.isPending || !text.trim()} className="bg-gradient-primary">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </AppShell>
  );
}
