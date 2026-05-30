import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES, CONTESTS } from "@/lib/quiz-data";
import { ArrowLeft, Clock, Users, Zap, Trophy } from "lucide-react";

export const Route = createFileRoute("/category/$id")({
  component: CategoryPage,
});

function CategoryPage() {
  const { id } = Route.useParams();
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) return <AppShell><p>Not found</p></AppShell>;
  const contests = CONTESTS.filter((c) => c.categoryId === id);

  return (
    <AppShell>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${cat.color} p-5 text-white shadow-lift`}>
        <div className="text-5xl">{cat.emoji}</div>
        <h1 className="mt-2 text-2xl font-black">{cat.name}</h1>
        <p className="text-sm opacity-90">{cat.description}</p>
      </section>

      <h2 className="mt-6 text-lg font-bold">All Contests</h2>
      <div className="mt-3 space-y-3">
        {contests.map((c) => {
          const pct = Math.round((c.filled / c.spots) * 100);
          return (
            <Link
              key={c.id}
              to="/contest/$id"
              params={{ id: c.id }}
              className="block rounded-2xl bg-card p-4 shadow-soft transition hover:shadow-glow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold">{c.title}</div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.durationSec / 60}m</span>
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{c.questions.length} Qs</span>
                    {c.entryFee === 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 font-bold text-success">FREE</span>}
                  </div>
                </div>
                <div className="text-right">
                  {c.prize > 0 ? (
                    <div className="rounded-lg bg-gradient-gold px-2 py-1 text-xs font-black text-amber-950">
                      <Trophy className="mr-1 inline h-3 w-3" />₹{c.prize}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted px-2 py-1 text-xs font-bold">Practice</div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">Entry ₹{c.entryFee}</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.filled}/{c.spots} joined</span>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
