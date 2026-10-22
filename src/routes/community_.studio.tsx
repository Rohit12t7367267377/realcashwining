import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/community/shared";
import { useAuthSession } from "@/hooks/use-auth-session";
import { cn } from "@/lib/utils";
import { getCommunityProfile, getCreatorAnalytics } from "@/lib/community.functions";

export const Route = createFileRoute("/community_/studio")({
  head: () => ({ meta: [{ title: "Creator studio — Guru-G" }] }),
  component: Page,
});

import type { AnalyticsDay, AnalyticsPost } from "@/lib/community-types";
type A = Omit<Awaited<ReturnType<typeof getCreatorAnalytics>>, "days" | "posts"> & { days: AnalyticsDay[]; posts: AnalyticsPost[] };
type P = NonNullable<Awaited<ReturnType<typeof getCommunityProfile>>>;
const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="rounded-xl border border-border bg-card p-3"><div className="text-[11px] font-semibold text-muted-foreground">{label}</div><div className="text-xl font-black tabular-nums">{value}</div>{hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}</div>;
}

function Bars({ days, pick, label }: { days: A["days"]; pick: (d: A["days"][number]) => number; label: string }) {
  const max = Math.max(1, ...days.map(pick));
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-bold">{label}</figcaption>
      <div className="flex h-24 items-end gap-0.5" role="img" aria-label={`${label}: ${days.map((d) => `${d.day} ${pick(d)}`).join(", ")}`}>
        {days.map((d) => <div key={d.day} title={`${d.day}: ${pick(d)}`} className="min-w-[3px] flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(2, (pick(d) / max) * 100)}%` }} />)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{days[0]?.day.slice(5)}</span><span>{days[days.length - 1]?.day.slice(5)}</span></div>
    </figure>
  );
}

function Page() {
  const { user, loading } = useAuthSession();
  const [range, setRange] = useState<7 | 30>(30);
  const [a, setA] = useState<A | null>(null), [p, setP] = useState<P | null>(null), [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (user) void getCommunityProfile({ data: { userId: user.id } }).then(setP).catch(() => undefined); }, [user]);
  useEffect(() => {
    if (!user) return;
    setA(null); setErr(null);
    getCreatorAnalytics({ data: { days: range } }).then(setA).catch((e) => setErr(e instanceof Error ? e.message : "Could not load analytics"));
  }, [user, range]);

  if (!loading && !user) return <AppShell><p className="p-6 text-center text-sm">Please <Link to="/auth" className="font-bold text-primary">sign in</Link>.</p></AppShell>;
  const m = p?.milestone;
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <Link to="/community" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Community</Link>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-black">Creator studio</h1>
          <div className="flex gap-1" role="group" aria-label="Date range">{([7, 30] as const).map((d) => <Button key={d} size="sm" variant={range === d ? "default" : "outline"} aria-pressed={range === d} onClick={() => setRange(d)}>Last {d} days</Button>)}</div>
        </div>
        {err && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
        {!a && !err && <div className="mt-8 flex justify-center"><Loader2 className="animate-spin" /></div>}
        {a && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Valid views" value={a.totals.validViews} /><Stat label="Watch time" value={`${a.totals.watchHours} h`} />
              <Stat label="Avg view duration" value={fmtDur(a.totals.avgViewSeconds)} /><Stat label="Avg % viewed" value={`${a.totals.avgPctViewed}%`} />
              <Stat label="Likes" value={a.totals.likes} /><Stat label="Comments" value={a.totals.comments} />
              <Stat label="New followers" value={a.totals.newFollowers} /><Stat label="Quiz attempts" value={a.totals.quizAttempts} hint={`${a.totals.quizCompletions} completed`} />
            </div>
            <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
              <Bars days={a.days} pick={(d) => d.validViews} label="Valid views per day" />
              <Bars days={a.days} pick={(d) => d.newFollowers} label="New followers per day" />
            </div>
            <p className="text-xs text-muted-foreground">{a.note}</p>

            <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="top">
              <h2 id="top" className="font-black">Top posts</h2>
              {a.posts.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No posts in this period yet.</p> : (
                <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="py-1">Post</th><th>Views</th><th>Avg viewed</th><th>Likes</th><th>Comments</th></tr></thead>
                  <tbody>{a.posts.map((x) => <tr key={x.id} className="border-t border-border"><td className="max-w-[16rem] truncate py-1.5"><Link to="/community" search={{ post: x.id }} className="font-semibold hover:underline">{x.title}</Link></td><td className="tabular-nums">{x.validViews}</td><td className="tabular-nums">{x.mediaType === "video" ? `${x.avgPct}%` : "—"}</td><td className="tabular-nums">{x.likes}</td><td className="tabular-nums">{x.comments}</td></tr>)}</tbody></table></div>)}
            </section>

            {p && (
              <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="rep">
                <h2 id="rep" className="font-black">Reputation</h2>
                <p className="text-xs text-muted-foreground">Ratings reflect how useful and clear learners find your teaching. They come only from real accounts that follow you; one rating per account.</p>
                <div className="mt-2 flex items-center gap-3"><Stars value={p.rating.avg} /><span className="text-sm font-bold tabular-nums">{p.rating.count ? p.rating.avg.toFixed(1) : "No ratings yet"}</span><span className="text-xs text-muted-foreground">{p.rating.count} rating{p.rating.count === 1 ? "" : "s"}</span></div>
                <div className="mt-2 space-y-1">{[5, 4, 3, 2, 1].map((n) => { const c = p.rating.dist[n - 1] ?? 0; return <div key={n} className="flex items-center gap-2 text-xs"><span className="w-3 tabular-nums">{n}</span><div className="h-2 flex-1 overflow-hidden rounded bg-muted"><div className="h-full bg-primary/70" style={{ width: `${p.rating.count ? (c / p.rating.count) * 100 : 0}%` }} /></div><span className="w-6 text-right tabular-nums">{c}</span></div>; })}</div>
                {m?.enabled && (
                  <div className={cn("mt-3 rounded-xl p-3 text-sm", m.eligible ? "bg-success/15" : "bg-muted")}>
                    <b>{m.eligible ? "Creator milestone reached" : "Creator milestone"}</b>
                    <ul className="mt-1 space-y-0.5 text-xs"><li>Followers: {m.followers} / {m.needFollowers}</li><li>Average rating: {m.ratings ? m.avg.toFixed(1) : "—"} / {m.needAvg}</li><li>Valid ratings: {m.ratings} / {m.needRatings}</li></ul>
                    <p className="mt-1 text-[11px] text-muted-foreground">A milestone is a recognition badge only. It does not unlock payouts or cash.</p>
                  </div>)}
              </section>)}
          </div>)}
      </div>
    </AppShell>
  );
}
