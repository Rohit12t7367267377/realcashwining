import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUser } from "@/lib/user-store";
import { useAuthSession } from "@/hooks/use-auth-session";
import { supabase } from "@/integrations/supabase/client";
import { getMyContestStats } from "@/lib/stats.functions";
import { getMyWallet } from "@/lib/wallet.functions";
import { getMyXp } from "@/lib/gamification.functions";
import { toast } from "sonner";
import {
  LogOut, Trophy, Target, Award, History, Camera, Grid3X3, Play,
  Crown, BookOpen, IdCard, MessageSquare, HelpCircle, LifeBuoy, Pencil, ImagePlus, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Cash Winning League" },
      { name: "description", content: "Your quiz profile — photo, bio, followers, posts, stats and contest history." },
      { property: "og:title", content: "My Profile — Cash Winning League" },
      { property: "og:description", content: "Photo, bio, followers, posts, stats and contest history." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type MyPost = { id: string; body: string; media_url: string | null; media_type: string | null; like_count: number; comment_count: number; created_at: string };

const MAX_MB = 25;

function ProfilePage() {
  const { state, logout } = useUser();
  const nav = useNavigate();
  const { user } = useAuthSession();

  const fetchStats = useServerFn(getMyContestStats);
  const fetchWallet = useServerFn(getMyWallet);
  const fetchXp = useServerFn(getMyXp);
  const { data: stats } = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats(), enabled: state.loggedIn, staleTime: 15_000 });
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet(), enabled: state.loggedIn, staleTime: 15_000 });
  const { data: xp } = useQuery({ queryKey: ["my-xp"], queryFn: () => fetchXp(), enabled: state.loggedIn, staleTime: 15_000 });

  const [prof, setProf] = useState<{ full_name: string; username: string; bio: string; avatar_url: string | null }>({ full_name: "", username: "", bio: "", avatar_url: null });
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", username: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const postFileRef = useRef<HTMLInputElement>(null);

  const loadSocial = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: followers }, { data: following }, { data: myPosts }] = await Promise.all([
      supabase.from("profiles").select("full_name, username, bio, avatar_url").eq("id", user.id).maybeSingle(),
      supabase.from("follows").select("follower_id").eq("following_id", user.id),
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase.from("community_posts").select("id, body, media_url, media_type, like_count, comment_count, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(60),
    ]);
    if (p) {
      setProf({ full_name: p.full_name ?? "", username: p.username ?? "", bio: p.bio ?? "", avatar_url: p.avatar_url ?? null });
      if (p.avatar_url) {
        const { data: su } = await supabase.storage.from("community").createSignedUrl(p.avatar_url, 3600);
        setAvatarSrc(su?.signedUrl ?? null);
      } else setAvatarSrc(null);
    }
    setCounts({ followers: (followers ?? []).length, following: (following ?? []).length });
    const list = (myPosts ?? []) as MyPost[];
    setPosts(list);
    const paths = list.map((x) => x.media_url).filter(Boolean) as string[];
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("community").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      (urls ?? []).forEach((u) => { if (u.path && u.signedUrl) m[u.path] = u.signedUrl; });
      setSigned(m);
    }
  }, [user]);

  useEffect(() => { loadSocial(); }, [loadSocial]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Photo must be under 8MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("community").upload(path, file, { contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (error) throw new Error(error.message);
      toast.success("Profile photo updated");
      await loadSocial();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name.trim() || null,
        username: form.username.trim() ? form.username.trim().toLowerCase().replace(/\s+/g, "_") : null,
        bio: form.bio.trim() || null,
      }).eq("id", user.id);
      if (error) throw new Error(error.message);
      toast.success("Profile saved");
      setEditOpen(false);
      await loadSocial();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setSaving(false); }
  }

  async function publishPost() {
    if (!user || (!postBody.trim() && !postFile)) return;
    setPosting(true);
    try {
      let media_url: string | null = null;
      let media_type: string | null = null;
      if (postFile) {
        if (postFile.size > MAX_MB * 1024 * 1024) throw new Error(`File must be under ${MAX_MB}MB`);
        media_type = postFile.type.startsWith("video") ? "video" : "image";
        const ext = postFile.name.split(".").pop() || "bin";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("community").upload(path, postFile, { contentType: postFile.type });
        if (upErr) throw new Error(upErr.message);
        media_url = path;
      }
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id, body: postBody.trim(), media_url, media_type,
      });
      if (error) throw new Error(error.message);
      toast.success("Shared!");
      setPostBody(""); setPostFile(null); setPostOpen(false);
      if (postFileRef.current) postFileRef.current.value = "";
      await loadSocial();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not share");
    } finally { setPosting(false); }
  }

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h2 className="text-xl font-bold">Sign in to view profile</h2>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const played = Number(stats?.played ?? 0);
  const wins = Number(stats?.wins ?? 0);
  const won = Number(stats?.totalWon ?? 0);
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  const displayName = prof.full_name || state.name || wallet?.fullName || "Player";
  const initials = displayName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const history = stats?.history ?? [];
  const highestWin = history.reduce((max, h) => Math.max(max, Number(h.prize ?? 0)), 0);
  const ranked = history.map((h) => Number(h.rank ?? 0)).filter((r) => r > 0);
  const bestRank = ranked.length ? Math.min(...ranked) : 0;

  return (
    <AppShell>
      {/* Feature row (top) */}
      <section className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <TopLink to="/vip" icon={<Crown className="h-4 w-4" />} label="VIP" />
        <TopLink to="/books" icon={<BookOpen className="h-4 w-4" />} label="Library" />
        <TopLink to="/kyc" icon={<IdCard className="h-4 w-4" />} label="KYC" />
        <TopLink to="/feedback" icon={<MessageSquare className="h-4 w-4" />} label="Feedback" />
        <TopLink to="/faq" icon={<HelpCircle className="h-4 w-4" />} label="FAQ" />
        <TopLink to="/support" icon={<LifeBuoy className="h-4 w-4" />} label="Support" />
      </section>

      {/* Instagram-style header */}
      <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center gap-4">
          <button
            onClick={() => avatarRef.current?.click()}
            className="press relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gradient-primary p-[3px]"
            aria-label="Change profile photo"
          >
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-card text-xl font-black">
              {avatarSrc ? <img src={avatarSrc} alt={`${displayName} profile photo`} className="h-full w-full object-cover" /> : initials}
            </span>
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            </span>
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />

          <div className="grid flex-1 grid-cols-3 gap-1 text-center">
            <CountCell value={posts.length} label="Posts" />
            <CountCell value={counts.followers} label="Followers" />
            <CountCell value={counts.following} label="Following" />
          </div>
        </div>

        <div className="mt-3">
          <h1 className="text-lg font-black leading-tight">{displayName}</h1>
          <div className="text-xs text-muted-foreground">@{prof.username || (state.referralCode || "player").toLowerCase()}</div>
          {prof.bio && <p className="mt-1 whitespace-pre-wrap text-sm">{prof.bio}</p>}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 font-bold"
            onClick={() => { setForm({ full_name: prof.full_name, username: prof.username, bio: prof.bio }); setEditOpen(true); }}
          >
            <Pencil className="mr-1 h-4 w-4" /> Edit profile
          </Button>
          <Button className="flex-1 bg-gradient-primary font-bold" onClick={() => setPostOpen(true)}>
            <ImagePlus className="mr-1 h-4 w-4" /> New post
          </Button>
        </div>
      </section>

      {/* Posts grid */}
      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Grid3X3 className="h-4 w-4" /> My posts
          </h2>
          <Link to="/community" className="text-xs font-bold text-primary hover:underline">Friends feed →</Link>
        </div>
        {posts.length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
            No posts yet. Share your first photo or video! 📸
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((p) => {
              const url = p.media_url ? signed[p.media_url] : null;
              return (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {url && p.media_type === "image" && <img src={url} alt={p.body ? p.body.slice(0, 60) : "My post"} loading="lazy" className="h-full w-full object-cover" />}
                  {url && p.media_type === "video" && (
                    <>
                      <video src={url} className="h-full w-full object-cover" muted />
                      <Play className="absolute right-1.5 top-1.5 h-4 w-4 text-primary-foreground drop-shadow" />
                    </>
                  )}
                  {!url && <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] font-medium">{p.body.slice(0, 80)}</div>}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[10px] font-bold text-white">
                    ♥ {p.like_count} · 💬 {p.comment_count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="mt-5 grid grid-cols-3 gap-3">
        <Stat icon={<Trophy />} label="Wins" value={wins} />
        <Stat icon={<Target />} label="Played" value={played} />
        <Stat icon={<Award />} label="Win %" value={`${winRate}%`} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Wallet</div>
          <div className="text-lg font-black">₹{Number(wallet?.balance ?? 0).toFixed(0)}</div>
        </div>
        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total earnings</div>
          <div className="text-lg font-black">₹{won.toFixed(0)}</div>
        </div>
        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Best rank</div>
          <div className="text-lg font-black">{bestRank ? `#${bestRank}` : "—"}</div>
        </div>
        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Highest win</div>
          <div className="text-lg font-black">₹{highestWin.toFixed(0)}</div>
        </div>
      </section>

      {/* XP / Level card */}
      <section className="mt-5 rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-soft">
        <div className="text-[10px] uppercase tracking-widest opacity-80">Rank</div>
        <div className="text-lg font-black">{xp?.rankTitle ?? "Bronze"} · Level {xp?.level ?? 1}</div>
        <div className="text-[11px] opacity-90">{xp?.xp ?? 0} XP · {xp?.boxesEarned ?? 0} boxes</div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full bg-white/80" style={{ width: `${Math.round((xp?.progress ?? 0) * 100)}%` }} />
        </div>
      </section>

      {/* History */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <History className="h-4 w-4" /> Contest History
        </h2>
        <div className="mt-3 space-y-2">
          {history.length === 0 && (
            <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
              No contests played yet. Time to start! 🚀
            </p>
          )}
          {history.map((h) => (
            <Link key={h.id} to="/result/$id" params={{ id: h.contestId }} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft transition hover:shadow-glow">
              <div>
                <div className="text-sm font-bold">{h.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  {h.submittedAt ? new Date(h.submittedAt).toLocaleDateString() : "—"} · Score {h.score}
                  {h.rank ? ` · Rank #${h.rank}` : ""}
                </div>
              </div>
              {h.prize > 0 ? (
                <div className="rounded-lg bg-gradient-gold px-2 py-1 text-xs font-black text-amber-950">+₹{h.prize.toFixed(0)}</div>
              ) : (
                <div className="text-xs font-bold text-muted-foreground">{h.status === "in_progress" ? "In progress" : "—"}</div>
              )}
            </Link>
          ))}
        </div>
      </section>

      <Button
        onClick={() => { logout(); nav({ to: "/" }); }}
        variant="outline"
        className="mt-6 h-12 w-full font-bold text-destructive hover:bg-destructive/10"
      >
        <LogOut className="mr-2 h-4 w-4" /> Logout
      </Button>

      {/* Edit profile dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={80} /></div>
            <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="quiz_king" maxLength={30} /></div>
            <div><Label>Bio</Label><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Quiz lover 🎯 | Winning daily" maxLength={200} /></div>
            <Button className="w-full" onClick={saveProfile} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New post dialog */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Share a photo or video</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea rows={3} placeholder="Write a caption…" value={postBody} onChange={(e) => setPostBody(e.target.value)} maxLength={1000} />
            <input ref={postFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setPostFile(e.target.files?.[0] ?? null)} />
            <Button variant="outline" className="w-full" onClick={() => postFileRef.current?.click()}>
              <ImagePlus className="mr-1 h-4 w-4" /> {postFile ? postFile.name : "Choose photo / video"}
            </Button>
            <Button className="w-full" onClick={publishPost} disabled={posting || (!postBody.trim() && !postFile)}>
              {posting ? "Sharing…" : "Share"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function TopLink({ to, icon, label }: { to: React.ComponentProps<typeof Link>["to"]; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="press flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-bold shadow-soft">
      <span className="text-primary">{icon}</span> {label}
    </Link>
  );
}

function CountCell({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-soft">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
