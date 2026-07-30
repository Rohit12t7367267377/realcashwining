import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { adminSetPostHidden, adminDeletePost, adminSetPostCommentHidden } from "@/lib/admin-crud.functions";
import { saveAppSetting } from "@/lib/admin-settings.functions";

export const Route = createFileRoute("/admin/community")({ component: Page });

function Page() {
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [moderation, setModeration] = useState(false);

  async function load() {
    const { data: p } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(100);
    const { data: c } = await supabase.from("post_comments").select("*").order("created_at", { ascending: false }).limit(100);
    setPosts(p ?? []); setComments(c ?? []);
    const ids = Array.from(new Set([...(p ?? []).map((r: any) => r.user_id), ...(c ?? []).map((r: any) => r.user_id)]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((x: any) => (m[x.id] = x.full_name || "Player"));
      setNames(m);
    }
    const { data: s } = await supabase.from("app_settings").select("value").eq("key", "community_moderation").maybeSingle();
    setModeration(String((s as any)?.value) === "true");
  }
  useEffect(() => { load(); }, []);

  async function toggleModeration(v: boolean) {
    try { await saveAppSetting({ data: { key: "community_moderation", value: v } }); setModeration(v); toast.success(v ? "New posts need approval" : "Posts publish instantly"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function setHidden(id: string, hidden: boolean) {
    try { await adminSetPostHidden({ data: { id, hidden } }); toast.success(hidden ? "Hidden" : "Approved"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) {
    try { await adminDeletePost({ data: { id } }); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function setCommentHidden(id: string, hidden: boolean) {
    try { await adminSetPostCommentHidden({ data: { id, hidden } }); toast.success(hidden ? "Hidden" : "Restored"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-3xl font-bold"><Users className="h-6 w-6" /> Community</h1>
      <p className="mb-6 text-muted-foreground">Moderate posts and comments from the community feed.</p>

      <Card className="mb-6 flex items-center justify-between p-4">
        <div>
          <div className="font-semibold">Pre-approval moderation</div>
          <div className="text-sm text-muted-foreground">When on, new posts stay hidden until you approve them.</div>
        </div>
        <Switch checked={moderation} onCheckedChange={toggleModeration} />
      </Card>

      <h2 className="mb-2 font-semibold">Posts</h2>
      <div className="mb-8 space-y-2">
        {posts.map((p) => (
          <Card key={p.id} className={`p-3 ${p.hidden ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{names[p.user_id] ?? p.user_id.slice(0, 8)}</div>
                <div className="text-sm">{p.body || <span className="text-muted-foreground">(media only)</span>}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()} · ❤ {p.like_count} · 💬 {p.comment_count}
                  {p.media_type ? ` · ${p.media_type}` : ""}{p.hidden ? " · HIDDEN" : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setHidden(p.id, !p.hidden)}>
                  {p.hidden ? <><Eye className="mr-1 h-4 w-4" /> Approve</> : <><EyeOff className="mr-1 h-4 w-4" /> Hide</>}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {!posts.length && <Card className="p-6 text-center text-sm text-muted-foreground">No posts yet.</Card>}
      </div>

      <h2 className="mb-2 font-semibold">Comments</h2>
      <div className="space-y-2">
        {comments.map((c) => (
          <Card key={c.id} className={`flex items-center justify-between gap-4 p-3 ${c.hidden ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1 text-sm">
              <b>{names[c.user_id] ?? c.user_id.slice(0, 8)}</b>: {c.body}
              <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}{c.hidden ? " · HIDDEN" : ""}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCommentHidden(c.id, !c.hidden)}>
              {c.hidden ? "Restore" : "Hide"}
            </Button>
          </Card>
        ))}
        {!comments.length && <Card className="p-6 text-center text-sm text-muted-foreground">No comments yet.</Card>}
      </div>
    </div>
  );
}
