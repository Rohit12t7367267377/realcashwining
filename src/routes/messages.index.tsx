import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Users } from "lucide-react";
import { listDmThreads, listDmContacts } from "@/lib/dm.functions";

export const Route = createFileRoute("/messages/")({
  head: () => ({
    meta: [
      { title: "Messages — Guru-G" },
      { name: "description", content: "Private chats with the players who follow you back." },
      { property: "og:title", content: "Messages — Guru-G" },
      { property: "og:description", content: "Private chats with the players who follow you back." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function initials(name?: string | null) {
  return (name ?? "P").trim().charAt(0).toUpperCase();
}

function InboxPage() {
  const fetchThreads = useServerFn(listDmThreads);
  const fetchContacts = useServerFn(listDmContacts);
  const { data: threads = [] } = useQuery({ queryKey: ["dm-threads"], queryFn: () => fetchThreads(), refetchInterval: 15_000 });
  const { data: contacts = [] } = useQuery({ queryKey: ["dm-contacts"], queryFn: () => fetchContacts(), staleTime: 30_000 });

  const chatted = new Set(threads.map((t) => t.peer_id));
  const suggestions = contacts.filter((c) => !chatted.has(c.id));

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MessageCircle className="h-6 w-6" /> Messages
        </h1>

        <div className="space-y-2">
          {threads.map((t) => (
            <Link key={t.peer_id} to="/messages/$id" params={{ id: t.peer_id }}>
              <Card className="flex items-center gap-3 p-3">
                <Avatar url={t.peer?.avatar_url ?? null} name={t.peer?.full_name ?? null} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{t.peer?.full_name ?? t.peer?.username ?? "Player"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.outgoing ? "You: " : ""}{t.last_body}
                  </div>
                </div>
                {t.unread > 0 && <Badge>{t.unread}</Badge>}
              </Card>
            </Link>
          ))}
          {!threads.length && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No chats yet. Follow someone who follows you back to start a conversation.
            </Card>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Users className="h-4 w-4" /> Start a new chat
            </h2>
            {suggestions.map((c) => (
              <Link key={c.id} to="/messages/$id" params={{ id: c.id }}>
                <Card className="flex items-center gap-3 p-3">
                  <Avatar url={c.avatar_url} name={c.full_name} />
                  <div className="truncate text-sm font-medium">{c.full_name ?? c.username ?? "Player"}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) return <img src={url} alt={name ?? "Player"} className="h-11 w-11 rounded-full object-cover" />;
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
      {initials(name)}
    </div>
  );
}
