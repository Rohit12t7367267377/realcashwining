import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { listActiveEvents } from "@/lib/gamification.functions";
import { useUser } from "@/lib/user-store";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Seasonal Events — Cash Winning League" },
      { name: "description", content: "Limited-time events with boosted XP and prize pools." },
      { property: "og:title", content: "Seasonal Events" },
      { property: "og:description", content: "Limited-time events with boosted XP and prize pools." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { state } = useUser();
  const fetchEvents = useServerFn(listActiveEvents);
  const { data = [] } = useQuery({ queryKey: ["active-events"], queryFn: () => fetchEvents(), enabled: state.loggedIn });

  if (!state.loggedIn) return <AppShell><p className="rounded-2xl bg-card p-4 text-center">Please sign in.</p></AppShell>;

  return (
    <AppShell>
      <h1 className="text-xl font-black flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Seasonal Events</h1>
      <p className="text-xs text-muted-foreground">Boosted XP and special prize pools — limited time only.</p>

      <div className="mt-4 space-y-3">
        {data.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
            No active events right now. Check back soon!
          </div>
        )}
        {data.map((e) => (
          <article key={e.id} className="overflow-hidden rounded-2xl bg-card shadow-soft">
            {e.banner_url && <img src={e.banner_url} alt={e.name} className="h-32 w-full object-cover" />}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">{e.name}</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">×{e.bonus_xp_multiplier} XP</span>
              </div>
              {e.description && <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>}
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Ends {new Date(e.ends_at).toLocaleString()}</span>
                {Number(e.reward_pool) > 0 && <span className="font-bold text-success">₹{Number(e.reward_pool).toFixed(0)} pool</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
