import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { SUBSCRIBE_SETTING_KEY, SUBSCRIBE_SEEN_KEY } from "@/routes/subscribe";
import { CATEGORIES } from "@/lib/quiz-data";
import { useUser } from "@/lib/user-store";
import { getMyWallet } from "@/lib/wallet.functions";
import { getMyContestStats } from "@/lib/stats.functions";
import { getMyXp } from "@/lib/gamification.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, Timer, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cash Winning League — Play Quiz, Win Real Cash" },
      { name: "description", content: "India's most exciting MCQ quiz competition — SSC, UPSC, Banking, Railway, Police, GK & more. Win cash, climb the leaderboard." },
      { property: "og:title", content: "Cash Winning League" },
      { property: "og:description", content: "Play paid & free quiz contests on SSC, UPSC, Banking & more. Win real cash daily." },
    ],
  }),
  component: Home,
});

type LiveContest = { id: string; title: string; entry_fee: number; first_prize: number; starts_at: string | null; ends_at?: string | null; results_status?: string };
type Banner = { id: string; title: string; subtitle: string | null; image_url: string | null; link_url: string | null; cta_label: string | null };
type Broadcast = { id: string; title: string; body: string };
type CricketMatch = {
  id: string;
  name: string;
  status: string | null;
  team_a: string | null;
  team_b: string | null;
  score_a: string | null;
  score_b: string | null;
  is_live: boolean | null;
  date_time: string | null;
};



function Home() {
  const { state } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Admin-managed subscription page: shown once to the targeted audience.
  const nav = useNavigate();
  useEffect(() => {
    if (!mounted || !state.loggedIn) return;
    if (localStorage.getItem(SUBSCRIBE_SEEN_KEY) === "1") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", SUBSCRIBE_SETTING_KEY).maybeSingle();
      const cfg = data?.value as { enabled?: boolean; audience?: "all" | "new" } | undefined;
      if (cancelled || !cfg?.enabled) return;
      if (cfg.audience === "new") {
        const { data: auth } = await supabase.auth.getUser();
        const created = auth.user?.created_at ? new Date(auth.user.created_at).getTime() : 0;
        const isNew = created > 0 && Date.now() - created < 7 * 24 * 60 * 60 * 1000;
        if (!isNew) return;
      }
      if (!cancelled) nav({ to: "/subscribe" });
    })();
    return () => { cancelled = true; };
  }, [mounted, state.loggedIn, nav]);

  const fetchWallet = useServerFn(getMyWallet);
  const fetchStats = useServerFn(getMyContestStats);
  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => fetchWallet(),
    enabled: mounted && state.loggedIn,
    staleTime: 15_000,
  });
  const { data: stats } = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => fetchStats(),
    enabled: mounted && state.loggedIn,
    staleTime: 15_000,
  });
  const fetchXp = useServerFn(getMyXp);
  const { data: xp } = useQuery({
    queryKey: ["my-xp"],
    queryFn: () => fetchXp(),
    enabled: mounted && state.loggedIn,
    staleTime: 30_000,
  });

  const [live, setLive] = useState<LiveContest[]>([]);
  const [upcoming, setUpcoming] = useState<LiveContest[]>([]);
  const [completed, setCompleted] = useState<LiveContest[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [matches, setMatches] = useState<CricketMatch[]>([]);

  
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const nowIso = () => new Date().toISOString();
    async function load() {
      const now = nowIso();
      const [liveRes, upRes, doneRes, banRes, bcRes, matchRes] = await Promise.all([
        supabase.from("contests").select("id, title, entry_fee, first_prize, starts_at, ends_at, results_status")
          .eq("active", true).eq("results_status", "pending")
          .or(`starts_at.is.null,starts_at.lte.${now}`)
          .order("created_at", { ascending: false }).limit(10),
        supabase.from("contests").select("id, title, entry_fee, first_prize, starts_at, ends_at, results_status")
          .eq("active", true).gt("starts_at", now)
          .order("starts_at", { ascending: true }).limit(6),
        supabase.from("contests").select("id, title, entry_fee, first_prize, starts_at, ends_at, results_status")
          .eq("results_status", "declared")
          .order("created_at", { ascending: false }).limit(4),
        supabase.from("banners").select("id, title, subtitle, image_url, link_url, cta_label, starts_at, ends_at")
          .eq("active", true).order("sort_order", { ascending: true }).limit(10),
        supabase.from("broadcasts").select("id, title, body").eq("active", true)
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("cricket_matches")
          .select("id, name, status, team_a, team_b, score_a, score_b, is_live, date_time")
          .order("is_live", { ascending: false })
          .order("date_time", { ascending: false })
          .limit(6),
      ]);
      if (cancelled) return;
      setLive((liveRes.data ?? []) as LiveContest[]);
      setUpcoming((upRes.data ?? []) as LiveContest[]);
      setCompleted((doneRes.data ?? []) as LiveContest[]);
      setMatches((matchRes.data ?? []) as CricketMatch[]);
      // Filter banners by date window
      const bans = ((banRes.data ?? []) as any[]).filter((b) => {
        if (b.starts_at && new Date(b.starts_at) > new Date()) return false;
        if (b.ends_at && new Date(b.ends_at) < new Date()) return false;
        return true;
      });
      setBanners(bans as Banner[]);
      setBroadcasts((bcRes.data ?? []) as Broadcast[]);

    }
    load();
    const t = setInterval(load, 45_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [mounted]);

  // Banner auto-rotate
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!mounted || !state.loggedIn) {
    return <div className="min-h-screen bg-background"><Landing /></div>;
  }

  const balance = Number(wallet?.balance ?? 0);
  const won = Number(stats?.totalWon ?? 0);
  const played = Number(stats?.played ?? 0);
  const history = stats?.history ?? [];
  const inProgress = history.filter((h) => h.status === "in_progress");
  const featured = live[0];

  return (
    <AppShell>
      {/* Live contest marquee */}
      {live.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 py-2">
          <div className="flex animate-[marquee_28s_linear_infinite] whitespace-nowrap gap-8 pl-4">
            {[...live, ...live].map((c, i) => (
              <Link key={i} to="/contest/$id" params={{ id: c.id }} className="inline-flex items-center gap-2 text-sm font-bold">
                <span className="inline-flex h-2 w-2 rounded-full bg-destructive"><span className="h-full w-full animate-ping rounded-full bg-destructive" /></span>
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-primary">LIVE</span>
                <span>{c.title}</span>
                {Number(c.first_prize) > 0 && <span className="text-success">· Win ₹{c.first_prize}</span>}
                {Number(c.entry_fee) > 0 ? <span className="text-muted-foreground">· Entry ₹{c.entry_fee}</span> : <span className="text-success">· FREE</span>}
                <span className="text-muted-foreground">→</span>
              </Link>
            ))}
          </div>
          <style>{`@keyframes marquee { from { transform: translateX(0);} to { transform: translateX(-50%);} }`}</style>
        </div>
      )}

      {/* Admin-managed banners (auto rotate) */}
      {banners.length > 0 && (() => {
        const b = banners[bannerIdx % banners.length];
        const inner = (
          <div className="relative overflow-hidden rounded-2xl shadow-soft" style={{ minHeight: 120 }}>
            {b.image_url ? (
              <img src={b.image_url} alt={b.title} className="h-32 w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-32 w-full bg-gradient-to-r from-primary via-secondary to-accent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent p-3 flex flex-col justify-end text-white">
              <div className="text-sm font-black leading-tight">{b.title}</div>
              {b.subtitle && <div className="text-[11px] opacity-90 line-clamp-2">{b.subtitle}</div>}
              {b.cta_label && <span className="mt-1 inline-block text-[11px] font-bold text-primary-foreground bg-primary/80 rounded px-2 py-0.5 w-fit">{b.cta_label}</span>}
            </div>
            {banners.length > 1 && (
              <div className="absolute bottom-1 right-2 flex gap-1">
                {banners.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === bannerIdx ? "bg-white" : "bg-white/50"}`} />)}
              </div>
            )}
          </div>
        );
        return <div className="mb-3">{b.link_url ? <a href={b.link_url} target="_blank" rel="noopener noreferrer">{inner}</a> : inner}</div>;
      })()}

      {/* Admin broadcasts / announcements */}
      {broadcasts.length > 0 && (
        <div className="mb-3 space-y-2">
          {broadcasts.map((b) => (
            <div key={b.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-soft">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">📣 {b.title}</div>
              <div className="mt-0.5 text-sm">{b.body}</div>
            </div>
          ))}
        </div>
      )}



      {/* 1 · Welcome card */}
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest opacity-80">Welcome back</p>
            <h1 className="mt-1 truncate text-2xl font-black">Hey {state.name.split(" ")[0]} 👋</h1>
            <p className="mt-1 text-sm opacity-90">Ready to win some cash today?</p>
          </div>
          <Link to="/wallet" className="press shrink-0 rounded-xl bg-white/15 px-3 py-2 text-[11px] font-bold backdrop-blur">
            Wallet →
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2 text-center">
          <Stat label="Wallet" value={`₹${balance.toFixed(0)}`} />
          <Stat label="Won" value={`₹${won.toFixed(0)}`} />
          <Stat label="Played" value={String(played)} />
          <Stat label={xp?.rankTitle ?? "Bronze"} value={`Lv ${xp?.level ?? 1}`} />
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white/80 transition-all duration-500" style={{ width: `${Math.round((xp?.progress ?? 0) * 100)}%` }} />
        </div>
      </section>

      {/* 2 · Contest banner (featured) */}
      {featured && (
        <section className="mt-3 overflow-hidden rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-lift animate-rise-in">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
            <Sparkles className="h-3.5 w-3.5" /> Featured contest
          </div>
          <h2 className="mt-1 text-xl font-black leading-tight">{featured.title}</h2>
          <div className="mt-1 text-sm opacity-90">
            {Number(featured.entry_fee) > 0 ? `Entry ₹${featured.entry_fee}` : "FREE entry"}
            {Number(featured.first_prize) > 0 && ` · 1st prize ₹${featured.first_prize}`}
          </div>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold backdrop-blur">
              <Timer className="h-3.5 w-3.5 shrink-0" />
              <Countdown target={featured.ends_at ?? featured.starts_at ?? null} />
            </div>
            <Link to="/contest/$id" params={{ id: featured.id }} className="shrink-0">
              <Button size="lg" className="press h-11 bg-white font-black text-primary hover:bg-white/90">Join Now</Button>
            </Link>
          </div>
        </section>
      )}

      {/* Continue playing */}
      {inProgress.length > 0 && (
        <section className="mt-4">
          <SectionHeader title="▶️ Continue Playing" subtitle="Pick up where you left off" />
          <div className="mt-3 grid gap-2">
            {inProgress.slice(0, 3).map((h) => (
              <Link key={h.id} to="/contest/$id" params={{ id: h.contestId }} className="card-lift flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{h.title}</div>
                  <div className="text-[11px] text-muted-foreground">In progress · Score {h.score}</div>
                </div>
                <PlayCircle className="h-6 w-6 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3 · Live contests */}
      <section className="mt-6">
        <SectionHeader title="🔥 Live Contests" subtitle="Open now — join and play" />
        <div className="mt-3 grid gap-2">
          {live.length === 0 && (
            <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
              No contests are live right now. Please check back later.
            </div>
          )}
          {live.slice(0, 5).map((c) => (
            <Link key={c.id} to="/contest/$id" params={{ id: c.id }} className="card-lift flex items-center justify-between rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-soft">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{c.title}</div>
                <div className="text-[11px] opacity-90">
                  {Number(c.entry_fee) > 0 ? `Entry ₹${c.entry_fee}` : "FREE"}
                  {Number(c.first_prize) > 0 && ` · 1st ₹${c.first_prize}`}
                  {c.ends_at && ` · Ends ${new Date(c.ends_at).toLocaleString()}`}
                </div>
              </div>
              <Trophy className="h-5 w-5 shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming contests */}
      {upcoming.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="⏰ Upcoming Contests" subtitle="Starting soon — be ready" />
          <div className="mt-3 grid gap-2">
            {upcoming.map((c) => (
              <Link key={c.id} to="/contest/$id" params={{ id: c.id }} className="card-lift flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.starts_at && `Starts ${new Date(c.starts_at).toLocaleString()}`}
                    {Number(c.entry_fee) > 0 ? ` · Entry ₹${c.entry_fee}` : " · FREE"}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">Upcoming</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4 · Quiz categories */}
      <section className="mt-6">
        <SectionHeader title="Quiz Categories" subtitle="Sports · GK · Coding" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to="/category/$id"
              params={{ id: c.id }}
              className="card-lift group flex flex-col items-center rounded-2xl bg-card p-4 text-center shadow-soft"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-3xl shadow-md`}>
                {c.emoji}
              </div>
              <div className="mt-2 text-sm font-bold leading-tight">{c.name}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{c.short}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5 · Live scores */}
      <Link to="/live-scores" className="press mt-6 block rounded-2xl border border-destructive/30 bg-gradient-card px-4 py-3 shadow-soft transition hover:shadow-glow">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-destructive"><span className="h-full w-full animate-ping rounded-full bg-destructive" /></span>
            <span className="text-xs font-bold uppercase tracking-wider text-destructive">Live Scores</span>
            <span className="truncate text-sm font-medium">Cricket · Football · Tennis</span>
          </div>
          <span className="shrink-0 text-xs text-primary">View →</span>
        </div>
      </Link>

      {/* 5b · Live cricket matches from the sports feed */}
      {matches.length > 0 && (
        <section className="mt-3">
          <div className="flex snap-x gap-3 overflow-x-auto pb-1">
            {matches.map((m) => (
              <Link
                key={m.id}
                to="/cricket_/$id"
                params={{ id: m.id }}
                className="card-lift min-w-[240px] snap-start rounded-2xl bg-card p-3 shadow-soft"
              >
                <div className="flex items-center gap-2">
                  {m.is_live ? (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">● LIVE</span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {m.date_time ? new Date(m.date_time).toLocaleDateString() : "Match"}
                    </span>
                  )}
                  <span className="truncate text-[11px] text-muted-foreground">🏏 Cricket</span>
                </div>
                <div className="mt-2 space-y-1 text-sm font-bold">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{m.team_a || "Team A"}</span>
                    <span className="shrink-0 font-mono text-xs">{m.score_a || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{m.team_b || "Team B"}</span>
                    <span className="shrink-0 font-mono text-xs">{m.score_b || "—"}</span>
                  </div>
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{m.status || m.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}


      {/* 6 · Recently completed */}
      {completed.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="🏁 Recently Completed" subtitle="Results declared — see who won" />
          <div className="mt-3 grid gap-2">
            {completed.map((c) => (
              <Link key={c.id} to="/contest/$id" params={{ id: c.id }} className="card-lift flex items-center justify-between rounded-2xl bg-muted/40 p-3 shadow-soft">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {Number(c.first_prize) > 0 && `1st Prize ₹${c.first_prize} · `}Results out
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-1 text-[10px] font-bold text-success">Declared</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 7 · Explore shortcuts */}
      <section className="mt-6">
        <SectionHeader title="Explore" subtitle="Jump straight in" />
        <div className="mt-3 grid grid-cols-4 gap-2">
          <ExploreTile to="/reading" emoji="📖" label="Reading" />
          <ExploreTile to="/cricket" emoji="🏏" label="Cricket" />
          <Link to="/category/$id" params={{ id: "gk" }} className="press card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
            <span className="text-2xl">🌍</span>GK
          </Link>
          <Link to="/category/$id" params={{ id: "coding" }} className="press card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
            <span className="text-2xl">💻</span>Coding
          </Link>
        </div>
      </section>




    </AppShell>
  );
}

function Countdown({ target }: { target: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return <span className="truncate">Live now</span>;
  const diff = new Date(target).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return <span className="truncate">Live now</span>;
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (
    <span className="truncate tabular-nums">
      {d > 0 ? `${d}d ` : ""}
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(sec).padStart(2, "0")} left
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function ExploreTile({ to, emoji, label }: { to: React.ComponentProps<typeof Link>["to"]; emoji: string; label: string }) {
  return (
    <Link to={to} className="press card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
      <span className="text-2xl">{emoji}</span>{label}
    </Link>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-secondary/30 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-accent/30 blur-3xl animate-blob" style={{ animationDelay: "8s" }} />
      </div>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 pt-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/60 px-4 py-1.5 text-xs font-semibold backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          Play. Win. Repeat.
        </div>
        <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          Play Quiz.<br />Win <span className="text-gradient-primary">Real Cash.</span>
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          Live Sports quizzes (cricket, football, tennis & more), General Knowledge for every competitive exam, and Coding challenges across every language.
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Link to="/auth">
            <Button size="lg" className="h-12 w-full bg-gradient-primary text-base font-bold shadow-glow hover:opacity-95">
              Get Started
            </Button>
          </Link>
          <Link to="/live-scores">
            <Button size="lg" variant="outline" className="h-12 w-full text-base font-semibold">
              ⚡ View Live Scores
            </Button>
          </Link>
        </div>

        <div className="mt-12 w-full">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Quiz Categories</h3>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map((c) => (
              <Link key={c.id} to="/category/$id" params={{ id: c.id }} className="flex flex-col items-center rounded-2xl bg-card/80 p-4 shadow-soft backdrop-blur hover:-translate-y-1 transition">
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-3xl`}>{c.emoji}</div>
                <div className="mt-2 text-sm font-bold">{c.name}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 flex gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-primary hover:underline">Terms &amp; Conditions</Link>
          <Link to="/support" className="hover:text-primary hover:underline">Help &amp; Support</Link>
          <Link to="/books" className="hover:text-primary hover:underline">Study Books</Link>
        </div>
      </div>
    </div>
  );
}
