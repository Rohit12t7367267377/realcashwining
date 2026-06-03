import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES, CONTESTS } from "@/lib/quiz-data";
import { useUser } from "@/lib/user-store";
import { Button } from "@/components/ui/button";
import { Flame, Gift, Trophy, Users, Clock, Zap } from "lucide-react";
import { toast } from "sonner";

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

function Home() {
  const { state, claimDaily } = useUser();
  const navigate = useNavigate();

  if (!state.loggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Landing />
      </div>
    );
  }

  const claimToday = () => {
    const r = claimDaily();
    if (r === 0) toast.info("You've already claimed today's reward 🎁");
    else toast.success(`+₹${r} added to your wallet!`);
  };

  const featured = CONTESTS.filter((c) => c.entryFee > 0).slice(0, 4);

  return (
    <AppShell>
      {/* Hero greeting */}
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Welcome back</p>
            <h1 className="mt-1 text-2xl font-black">Hey {state.name.split(" ")[0]} 👋</h1>
            <p className="mt-1 text-sm opacity-90">Ready to win some cash today?</p>
          </div>
          <button onClick={claimToday} className="flex flex-col items-center rounded-2xl bg-white/15 px-3 py-2 backdrop-blur transition hover:bg-white/25">
            <Gift className="h-5 w-5" />
            <span className="mt-0.5 text-[10px] font-bold uppercase">Daily</span>
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Wallet" value={`₹${state.wallet.toFixed(0)}`} />
          <Stat label="Won" value={`₹${state.winnings.toFixed(0)}`} />
          <Stat label="Played" value={state.contestsPlayed.toString()} />
        </div>
      </section>

      {/* Live banner */}
      <section className="mt-5 flex items-center justify-between rounded-2xl border border-primary/20 bg-gradient-card px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-destructive">
            <span className="h-full w-full animate-ping rounded-full bg-destructive" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-destructive">Live now</span>
          <span className="text-sm font-medium">2,340 players online</span>
        </div>
        <Trophy className="h-4 w-4 text-primary" />
      </section>

      {/* Categories */}
      <section className="mt-6">
        <SectionHeader title="Exam Categories" subtitle="Pick your battlefield" />
        <div className="mt-3 grid grid-cols-4 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to="/category/$id"
              params={{ id: c.id }}
              className="group flex flex-col items-center rounded-2xl bg-card p-3 text-center shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-2xl shadow-md`}>
                {c.emoji}
              </div>
              <div className="mt-2 text-xs font-bold leading-tight">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured contests */}
      <section className="mt-6">
        <SectionHeader title="🔥 Hot Contests" subtitle="Limited spots — join now" />
        <div className="mt-3 space-y-3">
          {featured.map((c) => {
            const cat = CATEGORIES.find((x) => x.id === c.categoryId)!;
            const pct = Math.round((c.filled / c.spots) * 100);
            return (
              <button
                key={c.id}
                onClick={() => navigate({ to: "/contest/$id", params: { id: c.id } })}
                className="block w-full rounded-2xl bg-card p-4 text-left shadow-soft transition hover:shadow-glow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${cat.color} text-xl`}>
                      {cat.emoji}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{c.title}</div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.durationSec / 60}m</span>
                        <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{c.questions.length} Qs</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-lg bg-gradient-gold px-2 py-1 text-xs font-black text-amber-950">
                      Win ₹{c.prize}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">Entry ₹{c.entryFee}</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.filled}/{c.spots}</span>
                  <span>{c.spots - c.filled} spots left</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Promo */}
      <section className="mt-6 rounded-2xl bg-gradient-success p-4 text-success-foreground shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2"><Flame className="h-4 w-4" /><span className="text-xs font-bold uppercase">Refer & Earn</span></div>
            <p className="mt-1 text-sm font-semibold">Invite friends, get ₹50 each!</p>
          </div>
          <Link to="/refer"><Button size="sm" variant="secondary" className="bg-white text-emerald-700 hover:bg-white/90">Invite</Button></Link>
        </div>
      </section>
    </AppShell>
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
          12,000+ players winning daily
        </div>
        <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          Play Quiz.<br />Win <span className="text-gradient-primary">Real Cash.</span>
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          India's most thrilling MCQ league for SSC, UPSC, Banking, Railway, Police, GK & more. Score fast, win bigger.
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Link to="/auth">
            <Button size="lg" className="h-12 w-full bg-gradient-primary text-base font-bold shadow-glow hover:opacity-95">
              Get Started
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="h-12 w-full text-base font-semibold">
              I already have an account
            </Button>
          </Link>
        </div>

        <div className="mt-12 w-full">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">All Exam Categories</h3>
          <div className="grid grid-cols-4 gap-3">
            {CATEGORIES.map((c) => (
              <Link key={c.id} to="/category/$id" params={{ id: c.id }} className="flex flex-col items-center rounded-2xl bg-card/80 p-3 shadow-soft backdrop-blur hover:-translate-y-1 transition">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-xl`}>{c.emoji}</div>
                <div className="mt-1 text-[11px] font-bold">{c.name}</div>
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

function LandStat({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-2xl bg-card/80 p-3 text-center shadow-soft backdrop-blur">
      <div className="text-xl font-black text-gradient-primary">{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
    </div>
  );
}
