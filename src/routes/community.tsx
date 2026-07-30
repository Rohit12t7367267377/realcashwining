import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth-session";
import { toggleFollow } from "@/lib/social.functions";
import { Heart, MessageCircle, ImagePlus, Trash2, Users, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community Feed — Cash Winning League" },
      { name: "description", content: "Share posts, photos and videos with friends you follow, like and comment on their wins." },
      { property: "og:title", content: "Community Feed" },
      { property: "og:description", content: "Post, like and comment with your quiz friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Post = {
  id: string;
  user_id: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  like_count: number;
  comment_count: number;
  hidden: boolean;
  created_at: string;
};

const MAX_MB = 25;

function Page() {
  const { user, loading } = useAuthSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [mutual, setMutual] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from("community_posts")
      .select("*")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (rows ?? []) as Post[];
    setPosts(list);

    const ids = Array.from(new Set(list.map((p) => p.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p.full_name || "Player"));
      setNames(map);
    }

    const paths = list.filter((p) => p.media_url).map((p) => p.media_url!) as string[];
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("community").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      (urls ?? []).forEach((u: any) => { if (u.path && u.signedUrl) m[u.path] = u.signedUrl; });
      setSigned(m);
    }

    const { data: myLikes } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id);
    const lk: Record<string, boolean> = {};
    (myLikes ?? []).forEach((l: any) => (lk[l.post_id] = true));
    setLiked(lk);

    const { data: iFollow } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    const { data: followsMe } = await supabase.from("follows").select("follower_id").eq("following_id", user.id);
    const a = new Set((iFollow ?? []).map((r: any) => r.following_id));
    const b = new Set((followsMe ?? []).map((r: any) => r.follower_id));
    setFollowing(a as Set<string>);
    setMutual(new Set(Array.from(a).filter((id) => b.has(id))) as Set<string>);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function canInteract(post: Post) {
    return post.user_id === user?.id || mutual.has(post.user_id);
  }

  async function publish() {
    if (!user || (!body.trim() && !file)) return;
    setBusy(true);
    try {
      let media_url: string | null = null;
      let media_type: string | null = null;
      if (file) {
        if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File must be under ${MAX_MB}MB`);
        media_type = file.type.startsWith("video") ? "video" : "image";
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("community").upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        media_url = path;
      }
      const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "community_moderation").maybeSingle();
      const needsApproval = String((setting as any)?.value) === "true";
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id, body: body.trim(), media_url, media_type, hidden: needsApproval,
      });
      if (error) throw new Error(error.message);
      setBody(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(needsApproval ? "Posted — waiting for admin approval" : "Posted!");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to post");
    } finally { setBusy(false); }
  }

  async function like(post: Post) {
    if (!user) return;
    if (!canInteract(post)) return toast.error("You can only like posts from friends you both follow");
    const isLiked = liked[post.id];
    setLiked({ ...liked, [post.id]: !isLiked });
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) } : p)));
    if (isLiked) await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    else {
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      if (error) { toast.error("Could not like this post"); load(); }
    }
  }

  async function loadComments(postId: string) {
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).eq("hidden", false).order("created_at");
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      setNames((n) => { const m = { ...n }; (profs ?? []).forEach((p: any) => (m[p.id] = p.full_name || "Player")); return m; });
    }
    setComments((c) => ({ ...c, [postId]: rows }));
  }

  async function addComment(post: Post) {
    if (!user || !draft.trim()) return;
    if (!canInteract(post)) return toast.error("Only mutual friends can comment");
    const { error } = await supabase.from("post_comments").insert({ post_id: post.id, user_id: user.id, body: draft.trim() });
    if (error) return toast.error("Could not comment");
    setDraft("");
    loadComments(post.id);
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, comment_count: p.comment_count + 1 } : p)));
  }

  async function removePost(post: Post) {
    if (post.user_id !== user?.id) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", post.id);
    if (error) return toast.error("Could not delete");
    toast.success("Deleted");
    load();
  }

  async function findPeople() {
    if (!search.trim()) return setPeople([]);
    const { data } = await supabase.from("profiles").select("id,full_name").ilike("full_name", `%${search.trim()}%`).limit(10);
    setPeople((data ?? []).filter((p: any) => p.id !== user?.id));
  }

  async function follow(id: string) {
    try {
      const res = await toggleFollow({ data: { target_user_id: id } });
      toast.success(res.following ? "Following" : "Unfollowed");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  if (loading) return <AppShell><div className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></AppShell>;

  if (!user) {
    return (
      <AppShell>
        <Card className="mx-auto mt-10 max-w-md p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to post, like and comment with your friends.</p>
          <Link to="/auth"><Button className="mt-4 w-full">Sign in</Button></Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl p-4">
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="mb-4 text-sm text-muted-foreground">Post updates. Only friends you follow each other with can like or comment.</p>

        {/* Find people */}
        <Card className="mb-4 p-3">
          <div className="flex gap-2">
            <Input placeholder="Find players by name…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findPeople()} />
            <Button variant="secondary" onClick={findPeople}>Search</Button>
          </div>
          {people.length > 0 && (
            <div className="mt-3 space-y-2">
              {people.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.full_name || "Player"}</span>
                  <Button size="sm" variant={following.has(p.id) ? "outline" : "default"} onClick={() => follow(p.id)}>
                    {following.has(p.id) ? "Unfollow" : "Follow"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Composer */}
        <Card className="mb-5 p-4">
          <Textarea rows={3} placeholder="Share something with your friends…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
          <div className="mt-3 flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-1 h-4 w-4" /> {file ? "Change media" : "Photo / Video"}
            </Button>
            {file && <span className="truncate text-xs text-muted-foreground">{file.name}</span>}
            <Button className="ml-auto" size="sm" onClick={publish} disabled={busy || (!body.trim() && !file)}>
              {busy ? "Posting…" : "Post"}
            </Button>
          </div>
        </Card>

        {/* Feed */}
        <div className="space-y-4">
          {posts.map((p) => {
            const allowed = canInteract(p);
            const url = p.media_url ? signed[p.media_url] : null;
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                    {(names[p.user_id] ?? "P").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{names[p.user_id] ?? "Player"}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                  {p.user_id === user.id && (
                    <button onClick={() => removePost(p)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  )}
                  {p.user_id !== user.id && !following.has(p.user_id) && (
                    <Button size="sm" variant="outline" onClick={() => follow(p.user_id)}>Follow</Button>
                  )}
                </div>
                {p.body && <p className="whitespace-pre-wrap px-3 pb-3 text-sm">{p.body}</p>}
                {url && p.media_type === "image" && <img src={url} alt="Community post media" loading="lazy" className="max-h-[480px] w-full object-cover" />}
                {url && p.media_type === "video" && <video src={url} controls className="max-h-[480px] w-full bg-black" />}
                <div className="flex items-center gap-4 p-3">
                  <button onClick={() => like(p)} className={`flex items-center gap-1 text-sm ${liked[p.id] ? "text-destructive" : "text-muted-foreground"} ${allowed ? "" : "opacity-50"}`}>
                    <Heart className={`h-4 w-4 ${liked[p.id] ? "fill-current" : ""}`} /> {p.like_count}
                  </button>
                  <button
                    onClick={() => { const next = openComments === p.id ? null : p.id; setOpenComments(next); if (next) loadComments(p.id); }}
                    className="flex items-center gap-1 text-sm text-muted-foreground"
                  >
                    <MessageCircle className="h-4 w-4" /> {p.comment_count}
                  </button>
                  {!allowed && <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" /> Follow each other to interact</span>}
                </div>
                {openComments === p.id && (
                  <div className="border-t bg-muted/30 p-3">
                    <div className="space-y-2">
                      {(comments[p.id] ?? []).map((c) => (
                        <div key={c.id} className="text-sm">
                          <span className="font-semibold">{names[c.user_id] ?? "Player"}</span>{" "}
                          <span className="text-muted-foreground">{c.body}</span>
                        </div>
                      ))}
                      {!(comments[p.id] ?? []).length && <div className="text-xs text-muted-foreground">No comments yet.</div>}
                    </div>
                    {allowed && (
                      <div className="mt-3 flex gap-2">
                        <Input placeholder="Write a comment…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment(p)} maxLength={500} />
                        <Button size="sm" onClick={() => addComment(p)} disabled={!draft.trim()}>Send</Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {!posts.length && <Card className="p-8 text-center text-sm text-muted-foreground">No posts yet. Be the first to share something!</Card>}
        </div>
      </div>
    </AppShell>
  );
}
