import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getDmConversation, sendDm } from "@/lib/dm.functions";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({
    meta: [
      { title: "Chat — Guru-G" },
      { name: "description", content: "Direct message a player you both follow." },
      { property: "og:title", content: "Chat — Guru-G" },
      { property: "og:description", content: "Direct message a player you both follow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { id: peerId } = useParams({ from: "/messages/$id" });
  const qc = useQueryClient();
  const fetchConvo = useServerFn(getDmConversation);
  const send = useServerFn(sendDm);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["dm", peerId],
    queryFn: () => fetchConvo({ data: { peer_id: peerId } }),
    refetchInterval: 8_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`dm-${peerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["dm", peerId] });
        void qc.invalidateQueries({ queryKey: ["dm-threads"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [peerId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await send({ data: { peer_id: peerId, body } });
      setDraft("");
      await qc.invalidateQueries({ queryKey: ["dm", peerId] });
      void qc.invalidateQueries({ queryKey: ["dm-threads"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  const peerName = data?.peer?.full_name ?? data?.peer?.username ?? "Player";

  return (
    <AppShell>
      <div className="mx-auto flex max-w-lg flex-col p-4">
        <div className="mb-3 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/messages"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          {data?.peer?.avatar_url ? (
            <img src={data.peer.avatar_url} alt={peerName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
              {peerName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="truncate font-semibold">{peerName}</div>
        </div>

        <div className="min-h-[50vh] space-y-2">
          {(data?.messages ?? []).map((m) => {
            const mine = m.sender_id === data?.me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`mt-1 text-[10px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          {data && !data.messages.length && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Say hi to {peerName} — this chat is private.
            </Card>
          )}
          <div ref={endRef} />
        </div>

        {data && !data.canSend ? (
          <Card className="mt-4 p-4 text-center text-sm text-muted-foreground">
            You can only chat once you both follow each other.
          </Card>
        ) : (
          <form onSubmit={submit} className="sticky bottom-20 mt-4 flex gap-2 bg-background/80 py-2 backdrop-blur">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" maxLength={2000} />
            <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
