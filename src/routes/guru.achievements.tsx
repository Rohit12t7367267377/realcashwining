import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { getMyGuruAchievements } from "@/lib/guru.functions";
import { Medal, Lock } from "lucide-react";

export const Route = createFileRoute("/guru/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Guru.AI Badges & Milestones" },
      { name: "description", content: "Collect Guru.AI badges for streaks, lessons completed and questions solved, and see exactly what each locked badge needs." },
      { property: "og:title", content: "Achievements — Guru.AI" },
      { property: "og:description", content: "Every Guru.AI badge, earned and locked, with its unlock requirement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { state } = useUser();
  const load = useServerFn(getMyGuruAchievements);
  const { data: badges = [] } = useQuery({ queryKey: ["guru-achievements"], queryFn: () => load(), enabled: state.loggedIn });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to see your badges</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const earned = badges.filter((b) => b.earned).length;

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Medal className="h-3.5 w-3.5" /> Achievements
        </div>
        <h1 className="mt-1 text-2xl font-black">{earned} / {badges.length} badges earned</h1>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map((b) => (
          <div key={b.id} className={`rounded-2xl p-4 text-center shadow-soft ${b.earned ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
            <div className="text-3xl">{b.emoji ?? "🏅"}</div>
            <div className="mt-1 text-xs font-black">{b.name}</div>
            <div className={`mt-0.5 text-[10px] leading-tight ${b.earned ? "opacity-90" : "text-muted-foreground"}`}>
              {b.earned ? (b.description ?? "Earned") : (
                <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> {b.requirementText}</span>
              )}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
