import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getHallOfFame } from "@/lib/gamification.functions";
import { useUser } from "@/lib/user-store";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — Cash Winning League" },
      { name: "description", content: "The top XP earners across all seasons." },
      { property: "og:title", content: "Hall of Fame" },
      { property: "og:description", content: "The top XP earners across all seasons." },
    ],
  }),
  component: HallOfFamePage,
});

function HallOfFamePage() {
  const { state } = useUser();
  const fetchHof = useServerFn(getHallOfFame);
  const { data = [] } = useQuery({ queryKey: ["hall-of-fame"], queryFn: () => fetchHof(), enabled: state.loggedIn });

  if (!state.loggedIn) return <AppShell><p className="rounded-2xl bg-card p-4 text-center">Please sign in.</p></AppShell>;

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-black">Hall of Fame</h1>
            <p className="text-xs opacity-90">All-time top XP earners</p>
          </div>
        </div>
      </section>

      <div className="mt-5 space-y-2">
        {data.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No entries yet.</div>
        )}
        {data.map((r) => (
          <div key={r.user_id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${r.rank === 1 ? "bg-gradient-gold text-amber-950" : r.rank <= 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                #{r.rank}
              </div>
              <div>
                <div className="text-sm font-bold">{r.name}</div>
                <div className="text-[10px] text-muted-foreground">Level {r.level}</div>
              </div>
            </div>
            <div className="text-sm font-black text-primary">{r.xp} XP</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
