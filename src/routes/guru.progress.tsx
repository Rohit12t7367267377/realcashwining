import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { getMyGuruLearning } from "@/lib/guru.functions";
import { LineChart, TrendingUp, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/guru/progress")({
  head: () => ({
    meta: [
      { title: "My Learning — Guru.AI Progress & Analytics" },
      { name: "description", content: "See your Guru.AI level, XP, streak, study minutes, strong topics, weak topics and everything you can continue learning." },
      { property: "og:title", content: "My Learning — Guru.AI" },
      { property: "og:description", content: "Track mastery per topic with strong and weak topic analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { state } = useUser();
  const load = useServerFn(getMyGuruLearning);
  const { data } = useQuery({ queryKey: ["guru-learning"], queryFn: () => load(), enabled: state.loggedIn });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to see your progress</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const t = data?.totals;

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <LineChart className="h-3.5 w-3.5" /> My Learning
        </div>
        <h1 className="mt-1 text-2xl font-black">Level {t?.level ?? 1} • {t?.xp ?? 0} XP</h1>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Streak", `${t?.streak ?? 0}d`],
          ["Lessons", String(t?.lessons ?? 0)],
          ["Questions", String(t?.questions ?? 0)],
          ["Minutes", String(t?.minutes ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-card p-3 shadow-soft">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-lg font-black">{value}</div>
          </div>
        ))}
      </section>

      <Group title="Continue learning" items={data?.continueLearning ?? []} />
      <Group title="Strong topics" items={data?.strong ?? []} icon={<TrendingUp className="h-3.5 w-3.5 text-success" />} />
      <Group title="Needs revision" items={data?.weak ?? []} icon={<TriangleAlert className="h-3.5 w-3.5 text-destructive" />} />
    </AppShell>
  );
}

function Group({
  title,
  items,
  icon,
}: {
  title: string;
  items: { topic_id: string; title: string; mastery: number; difficulty?: string }[];
  icon?: React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </h2>
      <div className="grid gap-2">
        {items.map((r) => (
          <Link key={`${title}-${r.topic_id}`} to="/guru/topic/$id" params={{ id: r.topic_id }} className="card-lift rounded-2xl bg-card p-3 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{r.title}</div>
                {r.difficulty && <div className="text-[11px] capitalize text-muted-foreground">{r.difficulty}</div>}
              </div>
              <div className="shrink-0 text-xs font-black text-primary">{r.mastery}%</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
