import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { getMyContestStats } from "@/lib/stats.functions";
import { getMyWallet } from "@/lib/wallet.functions";
import { getMyXp } from "@/lib/gamification.functions";
import { LogOut, Trophy, Target, Award, Phone, Hash, History, LifeBuoy, FileText, BookOpen, Zap, Gift } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Cash Winning League" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state, logout } = useUser();
  const nav = useNavigate();
  const fetchStats = useServerFn(getMyContestStats);
  const fetchWallet = useServerFn(getMyWallet);
  const fetchXp = useServerFn(getMyXp);
  const { data: stats } = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => fetchStats(),
    enabled: state.loggedIn,
    staleTime: 15_000,
  });
  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => fetchWallet(),
    enabled: state.loggedIn,
    staleTime: 15_000,
  });
  const { data: xp } = useQuery({
    queryKey: ["my-xp"],
    queryFn: () => fetchXp(),
    enabled: state.loggedIn,
    staleTime: 15_000,
  });

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
  const initials = state.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const history = stats?.history ?? [];
  const highestWin = history.reduce((max, h) => Math.max(max, Number(h.prize ?? 0)), 0);
  const ranked = history.map((h) => Number(h.rank ?? 0)).filter((r) => r > 0);
  const bestRank = ranked.length ? Math.min(...ranked) : 0;

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black backdrop-blur">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black">{state.name || wallet?.fullName || "Player"}</h1>
            <p className="text-xs opacity-90 flex items-center gap-1"><Phone className="h-3 w-3" /> {wallet?.phone || state.phone || "—"}</p>
            <p className="text-xs opacity-90 flex items-center gap-1"><Hash className="h-3 w-3" /> {state.referralCode}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Wallet" value={`₹${Number(wallet?.balance ?? 0).toFixed(0)}`} />
          <MiniStat label="Won" value={`₹${won.toFixed(0)}`} />
          <MiniStat label="Played" value={String(played)} />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <Stat icon={<Trophy />} label="Wins" value={wins} />
        <Stat icon={<Target />} label="Played" value={played} />
        <Stat icon={<Award />} label="Win %" value={`${winRate}%`} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
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
        <div className="surface p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Losses</div>
          <div className="text-lg font-black">{Math.max(played - wins, 0)}</div>
        </div>
      </section>

      {/* XP / Level card */}
      <section className="mt-5 rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Rank</div>
            <div className="text-lg font-black">{xp?.rankTitle ?? "Bronze"} · Level {xp?.level ?? 1}</div>
            <div className="text-[11px] opacity-90">{xp?.xp ?? 0} XP · {xp?.boxesEarned ?? 0} boxes</div>
          </div>
          <div className="flex gap-2">
            <Link to="/missions" className="rounded-xl bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30"><Zap className="mr-1 inline h-3 w-3" />Missions</Link>
            <Link to="/rewards" className="rounded-xl bg-white/20 px-3 py-2 text-xs font-bold hover:bg-white/30"><Gift className="mr-1 inline h-3 w-3" />Rewards</Link>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full bg-white/80" style={{ width: `${Math.round((xp?.progress ?? 0) * 100)}%` }} />
        </div>
      </section>

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
            <Link key={h.id} to="/result/$id" params={{ id: h.contestId }} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft hover:shadow-glow transition">
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

      {/* Social hub */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Social</h2>
        <Link to="/community" className="card-lift flex items-center justify-between rounded-2xl bg-gradient-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-bold">Community</div>
              <div className="text-[11px] text-muted-foreground">Posts, friends, follows & discussions</div>
            </div>
          </div>
          <span className="text-xs font-bold text-primary">Open →</span>
        </Link>
      </section>

      {/* Everything else */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">More</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickLink to="/refer" emoji="🎁" label="Refer" />
          <QuickLink to="/missions" emoji="🎯" label="Missions" />
          <QuickLink to="/rewards" emoji="🎉" label="Rewards" />
          <QuickLink to="/wallet" emoji="💰" label="Wallet" />
          <QuickLink to="/hall-of-fame" emoji="👑" label="Hall of Fame" />
          <QuickLink to="/events" emoji="✨" label="Events" />
          <QuickLink to="/vip" emoji="⭐" label="VIP" />
          <QuickLink to="/coupons" emoji="🎟️" label="Coupons" />
          <QuickLink to="/kyc" emoji="🪪" label="KYC" />
          <QuickLink to="/ai-tutor" emoji="🤖" label="AI Tutor" />
          <QuickLink to="/cricket" emoji="🏏" label="Cricket" />
          <QuickLink to="/live-scores" emoji="⚡" label="Scores" />
        </div>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Help & Settings</h2>
        <div className="grid grid-cols-4 gap-2">
          <Link to="/books" className="card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
            <BookOpen className="h-5 w-5 text-primary" /> Books
          </Link>
          <Link to="/support" className="card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
            <LifeBuoy className="h-5 w-5 text-primary" /> Support
          </Link>
          <Link to="/faq" className="card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
            <HelpCircle className="h-5 w-5 text-primary" /> FAQ
          </Link>
          <Link to="/terms" className="card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
            <FileText className="h-5 w-5 text-primary" /> Terms
          </Link>
          <Link to="/feedback" className="card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-xs font-bold shadow-soft">
            <MessageSquare className="h-5 w-5 text-primary" /> Feedback
          </Link>
        </div>
      </section>


      <Button
        onClick={() => { logout(); nav({ to: "/" }); }}
        variant="outline"
        className="mt-6 h-12 w-full font-bold text-destructive hover:bg-destructive/10"
      >
        <LogOut className="mr-2 h-4 w-4" /> Logout
      </Button>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
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
