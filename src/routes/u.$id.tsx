import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Ban, Flag, Lock, MessageCircle, MoreHorizontal, Share2, ShieldCheck, UserCheck, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PostCard, ReportDialog, type FeedItem } from "@/components/community/PostCard";
import { Stars, UserAvatar, UserLink } from "@/components/community/shared";
import { useAuthSession } from "@/hooks/use-auth-session";
import { blockAction, followAction, getCommunityProfile, listConnections, listFeed, rateCreator } from "@/lib/community.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/u/$id")({
  head: () => ({ meta: [{ title: "Creator profile — Guru-G" }, { name: "description", content: "Educational creator profile on Guru-G." }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

import type { Connection } from "@/lib/community-types";
type Profile = NonNullable<Awaited<ReturnType<typeof getCommunityProfile>>>;
type Tab = "posts" | "videos" | "quizzes" | "about";
const err = (e: unknown, fb: string) => toast.error(e instanceof Error ? e.message : fb);

function ProfilePage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuthSession();
  const nav = useNavigate();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("posts");
  const [items, setItems] = useState<FeedItem[]>([]), [feedBusy, setFeedBusy] = useState(false);
  const [busy, setBusy] = useState(false), [report, setReport] = useState(false), [rate, setRate] = useState(false);
  const [list, setList] = useState<null | { kind: "followers" | "following"; rows: Connection[] }>(null);

  const load = useCallback(async () => { try { setP(await getCommunityProfile({ data: { userId: id } })); } catch (e) { setP(null); err(e, "Could not load this profile"); } }, [id]);
  useEffect(() => { if (!loading && !user) void nav({ to: "/auth" }); else if (user) void load(); }, [loading, user, load, nav]);

  const category = tab === "videos" ? "video" : tab === "quizzes" ? "quiz" : undefined;
  useEffect(() => {
    if (!p?.canView || tab === "about") return;
    setFeedBusy(true);
    void listFeed({ data: { mode: "user", userId: id, category } }).then((r) => setItems(r.items)).catch((e) => err(e, "Could not load posts")).finally(() => setFeedBusy(false));
  }, [p?.canView, id, tab, category]);

  async function act(fn: () => Promise<unknown>, ok?: string) { setBusy(true); try { await fn(); if (ok) toast.success(ok); await load(); } catch (e) { err(e, "Action failed"); } finally { setBusy(false); } }
  async function showList(kind: "followers" | "following") { try { setList({ kind, rows: await listConnections({ data: { userId: id, kind } }) }); } catch (e) { err(e, "Could not load the list"); } }
  async function share() {
    const url = `${window.location.origin}/u/${id}`;
    try { if (navigator.share) await navigator.share({ title: p?.name, url }); else { await navigator.clipboard.writeText(url); toast.success("Profile link copied"); } } catch { /* cancelled */ }
  }

  if (loading || p === undefined) return <AppShell wide><Skeleton className="mx-auto h-64 max-w-3xl rounded-2xl" /></AppShell>;
  if (!p) return <AppShell wide><div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center"><p className="font-bold">This profile isn't available.</p><Link to="/community" className="mt-3 inline-block text-sm font-bold text-primary">Back to Community</Link></div></AppShell>;

  const tabs: { id: Tab; label: string }[] = [{ id: "posts", label: "Posts" }, { id: "videos", label: "Videos" }, { id: "quizzes", label: "Quizzes" }, { id: "about", label: "About" }];
  const maxDist = Math.max(1, ...p.rating.dist);

  return (
    <AppShell wide>
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-28 bg-gradient-hero sm:h-36" style={p.cover ? { backgroundImage: `url(${p.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} role="img" aria-label="Profile banner" />
          <div className="px-4 pb-4">
            <div className="-mt-10 flex items-end justify-between gap-3">
              <UserAvatar author={{ name: p.name, username: p.username, avatar: p.avatar }} size={80} className="ring-4 ring-card" />
              <div className="flex items-center gap-2 pb-1">
                {p.isMe ? <Button asChild size="sm" variant="outline"><Link to="/community/settings">Edit profile</Link></Button> : !p.viewerBlocked && (<>
                  {p.viewerFollows ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => followAction({ data: { targetId: id, action: "unfollow" } }))}><UserCheck className="mr-1 h-4 w-4" />Following</Button>
                    : p.viewerPending ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => followAction({ data: { targetId: id, action: "unfollow" } }), "Request withdrawn")}>Requested</Button>
                    : <Button size="sm" disabled={busy} onClick={() => void act(() => followAction({ data: { targetId: id, action: "follow" } }), p.isPrivate ? "Follow request sent" : undefined)}><UserPlus className="mr-1 h-4 w-4" />{p.followsViewer ? "Follow back" : "Follow"}</Button>}
                  {p.canMessage && <Button asChild size="sm" variant="outline"><Link to="/messages/$id" params={{ id }}><MessageCircle className="mr-1 h-4 w-4" />Message</Link></Button>}
                </>)}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void share()}><Share2 className="mr-2 h-4 w-4" />Share profile</DropdownMenuItem>
                    {!p.isMe && <DropdownMenuItem onClick={() => setReport(true)}><Flag className="mr-2 h-4 w-4" />Report account</DropdownMenuItem>}
                    {!p.isMe && <DropdownMenuItem onClick={() => void act(() => blockAction({ data: { userId: id, block: !p.viewerBlocked } }), p.viewerBlocked ? "Unblocked" : "Blocked")}><Ban className="mr-2 h-4 w-4" />{p.viewerBlocked ? "Unblock" : "Block"}</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <h1 className="mt-2 flex items-center gap-2 text-xl font-black tracking-tight">{p.name}{p.isPrivate && <Lock className="h-4 w-4 text-muted-foreground" aria-label="Private account" />}{p.milestone?.enabled && p.milestone.eligible && <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success"><ShieldCheck className="h-3 w-3" />Trusted creator</span>}</h1>
            {p.username && <p className="text-sm text-muted-foreground">@{p.username}</p>}
            {p.canView && p.bio && <p className="mt-2 whitespace-pre-wrap text-sm">{p.bio}</p>}
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div><dt className="sr-only">Posts</dt><dd><b>{p.posts}</b> <span className="text-muted-foreground">posts</span></dd></div>
              <button type="button" disabled={!p.canView} onClick={() => void showList("followers")} className="text-left disabled:cursor-default"><b>{p.followers}</b> <span className="text-muted-foreground">followers</span></button>
              <button type="button" disabled={!p.canView} onClick={() => void showList("following")} className="text-left disabled:cursor-default"><b>{p.following}</b> <span className="text-muted-foreground">following</span></button>
              <div className="flex items-center gap-1.5">{p.rating.count > 0 ? <><Stars value={p.rating.avg} /><b>{p.rating.avg.toFixed(1)}</b><span className="text-muted-foreground">({p.rating.count})</span></> : <span className="text-muted-foreground">No ratings yet</span>}</div>
            </dl>
            {p.viewerBlocked && <p className="mt-3 rounded-lg bg-muted p-2 text-xs">You have blocked this account. Unblock it from the menu to interact again.</p>}
          </div>
        </div>

        {!p.canView ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-center"><Lock className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden /><p className="mt-2 font-bold">This account is private</p><p className="mt-1 text-xs text-muted-foreground">Follow this account to see their posts, videos and quizzes once they accept.</p></div>
        ) : (<>
          <div role="tablist" aria-label="Profile sections" className="mt-4 flex gap-1 border-b border-border">
            {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-bold transition-colors", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>)}
          </div>

          {tab === "about" ? (
            <div className="mt-4 space-y-4">
              <section className="rounded-2xl border border-border bg-card p-4"><h2 className="text-sm font-bold">Subjects and interests</h2>
                {p.interests.length || p.examInterests.length || p.educationLevel ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">{p.educationLevel && <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{p.educationLevel}</span>}{[...p.interests, ...p.examInterests].map((x) => <span key={x} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{x}</span>)}</div>
                ) : <p className="mt-1 text-xs text-muted-foreground">Nothing shared yet.</p>}
              </section>
              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Creator rating</h2>{!p.isMe && <Button size="sm" variant="outline" onClick={() => setRate(true)}>{p.myRating ? "Update your rating" : "Rate this creator"}</Button>}</div>
                <p className="mt-1 text-xs text-muted-foreground">Ratings reflect how useful and clear this creator's teaching is. Only learners who follow the creator can rate, once each.</p>
                {p.rating.count === 0 ? <p className="mt-3 text-sm text-muted-foreground">No ratings yet.</p> : (
                  <div className="mt-3 flex items-center gap-5">
                    <div className="text-center"><div className="text-3xl font-black">{p.rating.avg.toFixed(1)}</div><Stars value={p.rating.avg} /><div className="text-[11px] text-muted-foreground">{p.rating.count} rating{p.rating.count === 1 ? "" : "s"}</div></div>
                    <ul className="flex-1 space-y-1" aria-label="Rating distribution">{[5, 4, 3, 2, 1].map((n) => <li key={n} className="flex items-center gap-2 text-xs"><span className="w-3">{n}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-warning" style={{ width: `${(p.rating.dist[n - 1]! / maxDist) * 100}%` }} /></span><span className="w-6 text-right text-muted-foreground">{p.rating.dist[n - 1]}</span></li>)}</ul>
                  </div>)}
              </section>
              {p.milestone?.enabled && (
                <section className="rounded-2xl border border-border bg-card p-4"><h2 className="text-sm font-bold">Creator milestone</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Reached when a creator has {p.milestone.needFollowers} followers, at least {p.milestone.needRatings} ratings and an average of {p.milestone.needAvg}★ or higher. It is a quality badge only; it does not pay anything.</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>Followers: <b>{p.milestone.followers}</b> / {p.milestone.needFollowers}</li><li>Ratings: <b>{p.milestone.ratings}</b> / {p.milestone.needRatings}</li><li>Average: <b>{p.milestone.avg.toFixed(1)}</b> / {p.milestone.needAvg}</li>
                  </ul>
                  <p className={cn("mt-2 text-xs font-bold", p.milestone.eligible ? "text-success" : "text-muted-foreground")}>{p.milestone.eligible ? "Milestone reached" : "Milestone not reached yet"}</p>
                </section>)}
            </div>
          ) : (
            <div className="mt-4 space-y-4" aria-busy={feedBusy}>
              {feedBusy && [0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
              {!feedBusy && items.length === 0 && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{p.isMe ? "You haven't published anything here yet." : "Nothing published here yet."}</div>}
              {!feedBusy && items.map((it) => <PostCard key={it.id} post={it} onChanged={(pid, patch) => setItems((c) => c.map((x) => (x.id === pid ? { ...x, ...patch } : x)))} onRemoved={(pid) => setItems((c) => c.filter((x) => x.id !== pid))} />)}
            </div>
          )}
        </>)}
      </div>

      <ReportDialog open={report} onClose={() => setReport(false)} target={{ type: "account", id }} />
      <RateDialog open={rate} onClose={() => setRate(false)} creatorId={id} initial={p.myRating} onDone={() => void load()} />
      <Dialog open={!!list} onOpenChange={(o) => !o && setList(null)}>
        <DialogContent><DialogHeader><DialogTitle className="capitalize">{list?.kind}</DialogTitle><DialogDescription>People connected with {p.name}.</DialogDescription></DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-y-auto">{list?.rows.length === 0 && <li className="text-sm text-muted-foreground">No one yet.</li>}{list?.rows.map((r) => <li key={r.userId} onClick={() => setList(null)}><UserLink id={r.userId} author={r.author} /></li>)}</ul>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function RateDialog({ open, onClose, creatorId, initial, onDone }: { open: boolean; onClose: () => void; creatorId: string; initial: { stars: number; comment: string | null } | null; onDone: () => void }) {
  const [stars, setStars] = useState(initial?.stars ?? 0), [comment, setComment] = useState(initial?.comment ?? ""), [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setStars(initial?.stars ?? 0); setComment(initial?.comment ?? ""); } }, [open, initial]);
  async function send() {
    setBusy(true);
    try { await rateCreator({ data: { creatorId, stars, comment: comment.trim() || undefined } }); toast.success("Thanks for rating"); onClose(); onDone(); }
    catch (e) { err(e, "Could not save your rating"); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent><DialogHeader><DialogTitle>Rate this creator</DialogTitle><DialogDescription>Rate how useful and clear their teaching is. You can change your rating later.</DialogDescription></DialogHeader>
        <div role="radiogroup" aria-label="Stars" className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)} className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <svg viewBox="0 0 20 20" className={cn("h-8 w-8", stars >= n ? "fill-warning text-warning" : "fill-muted text-muted-foreground/40")} aria-hidden><path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9 4.8 17.7l1-5.9L1.5 7.7l5.9-.8L10 1.5z" /></svg>
          </button>))}</div>
        <Textarea aria-label="Comment (optional)" placeholder="What did you find helpful? (optional)" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        <Button disabled={busy || stars < 1} onClick={() => void send()}>Submit rating</Button>
      </DialogContent>
    </Dialog>
  );
}
