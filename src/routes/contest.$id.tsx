import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES, getContest } from "@/lib/quiz-data";
import { useUser } from "@/lib/user-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Trophy, Users, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contest/$id")({
  component: ContestPage,
});

function ContestPage() {
  const { id } = Route.useParams();
  const c = getContest(id);
  const { state, debit } = useUser();
  const nav = useNavigate();
  if (!c) return <AppShell><p>Not found</p></AppShell>;
  const cat = CATEGORIES.find((x) => x.id === c.categoryId)!;

  const join = () => {
    if (!state.loggedIn) return nav({ to: "/login" });
    if (c.entryFee > 0) {
      const ok = debit(c.entryFee, `Entry: ${c.title}`);
      if (!ok) return toast.error("Insufficient wallet balance. Add money first.");
    }
    nav({ to: "/play/$id", params: { id: c.id } });
  };

  return (
    <AppShell>
      <Link to="/category/$id" params={{ id: cat.id }} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {cat.name}
      </Link>

      <section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${cat.color} p-5 text-white shadow-lift`}>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">{cat.emoji}</div>
          <div>
            <h1 className="text-xl font-black">{c.title}</h1>
            <p className="text-xs opacity-90">{cat.name} · {cat.short}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Pill icon={<Trophy className="h-4 w-4" />} label="Prize Pool" value={c.prize > 0 ? `₹${c.prize}` : "Practice"} />
          <Pill icon={<Zap className="h-4 w-4" />} label="Entry Fee" value={c.entryFee > 0 ? `₹${c.entryFee}` : "FREE"} />
          <Pill icon={<Clock className="h-4 w-4" />} label="Duration" value={`${c.durationSec / 60} min`} />
          <Pill icon={<Users className="h-4 w-4" />} label="Joined" value={`${c.filled}/${c.spots}`} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Format</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            `${c.questions.length} MCQ questions`,
            `${c.durationSec / 60} minute timer — auto submit`,
            "+10 for correct, 0 for skipped, −2 for wrong",
            "Top scorer takes the prize. Speed breaks ties.",
            "Automatic scoring & leaderboard update",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {c.prize > 0 && (
        <section className="mt-4 rounded-2xl bg-gradient-card p-4 shadow-soft">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Prize Breakdown</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Row rank="🥇 Rank 1" amt={`₹${Math.round(c.prize * 0.6)}`} />
            <Row rank="🥈 Rank 2" amt={`₹${Math.round(c.prize * 0.25)}`} />
            <Row rank="🥉 Rank 3" amt={`₹${Math.round(c.prize * 0.15)}`} />
          </div>
        </section>
      )}

      <div className="sticky bottom-24 mt-6">
        <Button onClick={join} size="lg" className="h-14 w-full bg-gradient-primary text-base font-bold shadow-glow">
          {c.entryFee > 0 ? `Pay ₹${c.entryFee} & Join Contest` : "Start Free Quiz"}
        </Button>
        {c.entryFee > 0 && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Wallet: ₹{state.wallet.toFixed(0)} · Demo entry — no real money charged
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Pill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-90">{icon}{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function Row({ rank, amt }: { rank: string; amt: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
      <span className="font-semibold">{rank}</span>
      <span className="font-black text-primary">{amt}</span>
    </div>
  );
}
