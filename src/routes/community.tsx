import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Bookmark, BarChart3, Loader2, MessageCircle, PenSquare, Search, Settings, SlidersHorizontal, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCard, type FeedItem } from "@/components/community/PostCard";
import { Composer } from "@/components/community/Composer";
import { UserAvatar } from "@/components/community/shared";
import { useAuthSession } from "@/hooks/use-auth-session";
import { followAction, listFeed, listFollowRequests, listSocialNotifications, searchPeople } from "@/lib/community.functions";
import { cn } from "@/lib/utils";
import type { FollowRequest, PersonHit } from "@/lib/community-types";

export const Route = createFileRoute("/community")({
  validateSearch: (s: Record<string, unknown>): { post?: string } => (typeof s.post === "string" && /^[0-9a-f-]{36}$/i.test(s.post) ? { post: s.post } : {}),
  head: () => ({ meta: [
    { title: "Community — Guru-G" },
    { name: "description", content: "Learn together: educational posts, videos, quizzes, notes and verified education news from students and teachers." },
    { property: "og:title", content: "Guru-G Community" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const TABS = [
  { id: "for_you", label: "For you", mode: "for_you" }, { id: "following", label: "Following", mode: "following" }, { id: "explore", label: "Explore", mode: "explore" },
  { id: "trending", label: "Trending", mode: "trending" }, { id: "videos", label: "Videos", mode: "explore", category: "video" }, { id: "quizzes", label: "Quizzes", mode: "explore", category: "quiz" },
  { id: "news", label: "News", mode: "explore", category: "news" }, { id: "saved", label: "Saved", mode: "saved" },
] as const;
type People = PersonHit[];

function Page() {
  const { user, loading } = useAuthSession();
  const nav = useNavigate();
  const { post: deepLink } = Route.useSearch();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("for_you");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [more, setMore] = useState<{ has: boolean; cursor: string | null; page: number }>({ has: false, cursor: null, page: 0 });
  const [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(""), [applied, setApplied] = useState(""), [showFilters, setShowFilters] = useState(false);
  const [flt, setFlt] = useState({ subject: "", exam: "", level: "" });
  const [people, setPeople] = useState<People>([]), [compose, setCompose] = useState(false);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [unread, setUnread] = useState(0);
  const seq = useRef(0);

  const load = useCallback(async (reset: boolean) => {
    if (!user) return;
    const my = ++seq.current;
    if (reset) { setBusy(true); setError(null); }
    const t = TABS.find((x) => x.id === tab)!;
    try {
      const r = await listFeed({ data: {
        mode: t.mode, category: "category" in t ? t.category : undefined, q: applied || undefined, subject: flt.subject || undefined, exam: flt.exam || undefined, level: flt.level || undefined,
        id: deepLink, cursor: reset ? undefined : more.cursor ?? undefined, page: reset ? 0 : more.page,
      } });
      if (my !== seq.current) return;
      setItems((cur) => (reset ? r.items : [...cur, ...r.items.filter((n) => !cur.some((c) => c.id === n.id))]));
      setMore({ has: r.hasMore, cursor: r.nextCursor, page: r.nextPage });
    } catch (e) { if (my === seq.current) setError(e instanceof Error ? e.message : "Could not load the feed"); }
    finally { if (my === seq.current) setBusy(false); }
  }, [user, tab, applied, flt, deepLink, more.cursor, more.page]);

  useEffect(() => { if (!loading && !user) void nav({ to: "/auth" }); }, [loading, user, nav]);
  useEffect(() => { void load(true); }, [user, tab, applied, flt.subject, flt.exam, flt.level, deepLink]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;
    void listFollowRequests().then(setRequests).catch(() => undefined);
    void listSocialNotifications().then((r) => setUnread(r.unread)).catch(() => undefined);
  }, [user]);
  useEffect(() => {
    if (applied.length < 2) { setPeople([]); return; }
    void searchPeople({ data: { q: applied } }).then(setPeople).catch(() => setPeople([]));
  }, [applied]);

  const patch = (id: string, p: Partial<FeedItem>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));
  async function respond(userId: string, action: "accept" | "reject") {
    try { await followAction({ data: { targetId: userId, action } }); setRequests((r) => r.filter((x) => x.userId !== userId)); toast.success(action === "accept" ? "Request accepted" : "Request declined"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  if (loading || !user) return <AppShell wide><Skeleton className="h-40 rounded-2xl" /></AppShell>;

  const quick = [
    { to: "/messages", icon: MessageCircle, label: "Messages" }, { to: "/notifications", icon: Bell, label: "Alerts", badge: unread },
    { to: "/community/studio", icon: BarChart3, label: "Studio" }, { to: "/community/settings", icon: Settings, label: "Settings" },
  ] as const;

  return (
    <AppShell wide>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Community feed" className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight">Community</h1>
            <form className="relative ml-auto min-w-0 flex-1 sm:max-w-xs" role="search" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-9 pr-8" aria-label="Search posts and people" placeholder="Search posts, subjects, people" value={q} onChange={(e) => setQ(e.target.value)} />
              {applied && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => { setQ(""); setApplied(""); }}><X className="h-4 w-4" /></button>}
            </form>
            <Button size="icon" variant="outline" aria-label="Filters" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal className="h-4 w-4" /></Button>
          </div>

          {showFilters && (
            <div className="mt-2 grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-3">
              <Input aria-label="Subject filter" placeholder="Subject" value={flt.subject} onChange={(e) => setFlt({ ...flt, subject: e.target.value })} />
              <Input aria-label="Exam filter" placeholder="Exam (e.g. NEET)" value={flt.exam} onChange={(e) => setFlt({ ...flt, exam: e.target.value })} />
              <Input aria-label="Level filter" placeholder="Class / level" value={flt.level} onChange={(e) => setFlt({ ...flt, level: e.target.value })} />
            </div>
          )}

          <nav aria-label="Feed" className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors", tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{t.id === "saved" && <Bookmark className="mr-1 inline h-3 w-3" />}{t.label}</button>)}
          </nav>

          <div className="mt-2 flex gap-1.5 overflow-x-auto lg:hidden" aria-label="Community shortcuts">
            {quick.map((l) => <Link key={l.to} to={l.to} className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"><l.icon className="h-3.5 w-3.5" />{l.label}{"badge" in l && l.badge ? <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">{l.badge}</span> : null}</Link>)}
            <Link to="/profile" className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"><UserRound className="h-3.5 w-3.5" />My profile</Link>
          </div>

          {applied && people.length > 0 && (
            <div className="mt-3 rounded-2xl border border-border bg-card p-3">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">People</h2>
              <ul className="space-y-2">{people.map((p) => (
                <li key={p.userId}><Link to="/u/$id" params={{ id: p.userId }} className="flex items-center gap-3 rounded-lg p-1 hover:bg-muted">
                  <UserAvatar author={{ name: p.name, username: p.username, avatar: p.avatar }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{p.name}</span><span className="block truncate text-[11px] text-muted-foreground">{p.username ? `@${p.username} · ` : ""}{p.followers} followers{p.isPrivate ? " · Private" : ""}</span></span></Link></li>
              ))}</ul>
            </div>
          )}

          <button onClick={() => setCompose(true)} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card/70 p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
            <PenSquare className="h-5 w-5 text-primary" />Share an explanation, video, quiz, notes or news…
          </button>

          <div className="mt-4 space-y-4" aria-live="polite" aria-busy={busy}>
            {busy && [0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
            {!busy && error && <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error} <button className="ml-2 font-bold underline" onClick={() => void load(true)}>Retry</button></div>}
            {!busy && !error && items.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-bold">{tab === "following" ? "Nothing from people you follow yet" : tab === "saved" ? "No saved posts yet" : applied ? "No posts match your search" : "No posts here yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tab === "following" ? "Follow creators from Explore to see their posts here." : "Be the first to share something useful."}</p>
                <div className="mt-3 flex justify-center gap-2">{tab === "following" && <Button size="sm" variant="outline" onClick={() => setTab("explore")}>Explore</Button>}<Button size="sm" onClick={() => setCompose(true)}>Create a post</Button></div>
              </div>
            )}
            {!busy && items.map((p) => <PostCard key={p.id} post={p} onChanged={patch} onRemoved={(id) => setItems((c) => c.filter((x) => x.id !== id))} />)}
            {!busy && more.has && <div className="text-center"><Button variant="outline" onClick={() => void load(false)}>Load more</Button></div>}
          </div>
        </section>

        <aside className="hidden space-y-4 lg:block" aria-label="Community sidebar">
          <div className="sticky top-20 space-y-4">
            <nav className="rounded-2xl border border-border bg-card p-2" aria-label="Community">
              {quick.map((l) => <Link key={l.to} to={l.to} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted"><l.icon className="h-4 w-4" />{l.label}{"badge" in l && l.badge ? <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">{l.badge}</span> : null}</Link>)}
              <Link to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted"><UserRound className="h-4 w-4" />My profile</Link>
            </nav>
            {requests.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-3"><h2 className="mb-2 text-sm font-bold">Follow requests</h2>
                <ul className="space-y-2">{requests.slice(0, 5).map((r) => (
                  <li key={r.userId} className="flex items-center gap-2"><Link to="/u/$id" params={{ id: r.userId }} className="flex min-w-0 flex-1 items-center gap-2"><UserAvatar author={r.author} size={32} /><span className="truncate text-sm font-semibold">{r.author.name}</span></Link>
                    <Button size="sm" onClick={() => void respond(r.userId, "accept")}>Accept</Button><Button size="sm" variant="ghost" onClick={() => void respond(r.userId, "reject")}>Decline</Button></li>
                ))}</ul></div>
            )}
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Community is for learning. Posts follow our education-only policy; you can report anything that doesn't. Only people who follow each other can message.</p>
          </div>
        </aside>
      </div>

      <Button size="icon" className="fixed bottom-24 right-4 z-30 h-12 w-12 rounded-full bg-gradient-primary shadow-lift lg:hidden" aria-label="Create a post" onClick={() => setCompose(true)}><PenSquare className="h-5 w-5" /></Button>
      <Composer open={compose} onClose={() => setCompose(false)} userId={user.id} onPosted={() => void load(true)} />
    </AppShell>
  );
}
