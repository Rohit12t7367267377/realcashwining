import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { LogOut, Trophy, Target, Award, Phone, Hash, History, LifeBuoy, FileText, BookOpen } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Cash Winning League" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state, logout } = useUser();
  const nav = useNavigate();
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
  const winRate = state.contestsPlayed ? Math.round((state.contestsWon / state.contestsPlayed) * 100) : 0;
  const initials = state.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black backdrop-blur">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black">{state.name}</h1>
            <p className="text-xs opacity-90 flex items-center gap-1"><Phone className="h-3 w-3" /> +91 {state.phone}</p>
            <p className="text-xs opacity-90 flex items-center gap-1"><Hash className="h-3 w-3" /> {state.referralCode}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <Stat icon={<Trophy />} label="Won" value={state.contestsWon} />
        <Stat icon={<Target />} label="Played" value={state.contestsPlayed} />
        <Stat icon={<Award />} label="Win %" value={`${winRate}%`} />
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <History className="h-4 w-4" /> Contest History
        </h2>
        <div className="mt-3 space-y-2">
          {state.history.length === 0 && (
            <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
              No contests played yet. Time to start! 🚀
            </p>
          )}
          {state.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
              <div>
                <div className="text-sm font-bold">{h.title}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(h.at).toLocaleDateString()} · Score {h.score}</div>
              </div>
              {h.reward > 0 ? (
                <div className="rounded-lg bg-gradient-gold px-2 py-1 text-xs font-black text-amber-950">+₹{h.reward}</div>
              ) : (
                <div className="text-xs font-bold text-muted-foreground">—</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Button
        onClick={() => { logout(); nav({ to: "/" }); }}
        variant="outline"
        className="mt-8 h-12 w-full font-bold text-destructive hover:bg-destructive/10"
      >
        <LogOut className="mr-2 h-4 w-4" /> Logout
      </Button>
    </AppShell>
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
