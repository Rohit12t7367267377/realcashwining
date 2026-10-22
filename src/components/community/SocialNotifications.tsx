import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AtSign, Heart, MessageCircle, ShieldAlert, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listSocialNotifications, markSocialRead } from "@/lib/community.functions";

type Item = { id: string; kind: string; postId: string | null; actorId: string | null; actor: { name: string } | null; read: boolean; createdAt: string };
const TEXT: Record<string, [typeof Heart, (n: string) => string]> = {
  follow: [UserPlus, (n) => `${n} started following you`], follow_request: [UserPlus, (n) => `${n} requested to follow you`],
  follow_accept: [UserPlus, (n) => `${n} accepted your follow request`], like: [Heart, (n) => `${n} liked your post`],
  comment: [MessageCircle, (n) => `${n} commented on your post`], reply: [AtSign, (n) => `${n} replied to your comment`],
  message: [MessageCircle, (n) => `New message from ${n}`], milestone: [Trophy, () => "You reached a creator milestone"],
  moderation: [ShieldAlert, () => "A moderator reviewed your content"],
};

/** Community activity (follows, likes, comments, messages, milestones, moderation) inside the existing notifications page. */
export function SocialNotifications() {
  const [rows, setRows] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(0);
  const load = useCallback(() => listSocialNotifications().then((r) => { setRows(r.items as Item[]); setUnread(r.unread); }).catch(() => setRows([])), []);
  useEffect(() => { void load(); }, [load]);
  async function readAll() { try { await markSocialRead({ data: {} }); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not mark as read"); } }
  if (!rows || rows.length === 0) return null;
  return (
    <section className="mb-5" aria-label="Community activity">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-black">Community{unread > 0 && <span className="ml-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">{unread} new</span>}</h2>
        {unread > 0 && <Button size="sm" variant="ghost" onClick={() => void readAll()}>Mark all read</Button>}
      </div>
      <div className="space-y-2">
        {rows.slice(0, 15).map((n) => {
          const [Icon, text] = TEXT[n.kind] ?? [MessageCircle, () => "New activity"];
          const body = (
            <Card className={`flex items-center gap-3 p-3 ${n.read ? "opacity-70" : ""}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="h-4 w-4" aria-hidden /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{text(n.actor?.name ?? "Someone")}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div></div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
            </Card>
          );
          if (n.kind === "message" && n.actorId) return <Link key={n.id} to="/messages/$id" params={{ id: n.actorId }} className="block">{body}</Link>;
          if (n.postId) return <Link key={n.id} to="/community" search={{ post: n.postId }} className="block">{body}</Link>;
          if (n.actorId) return <Link key={n.id} to="/u/$id" params={{ id: n.actorId }} className="block">{body}</Link>;
          return <div key={n.id}>{body}</div>;
        })}
      </div>
    </section>
  );
}
