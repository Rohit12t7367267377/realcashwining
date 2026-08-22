import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { getGuruGalaxy } from "@/lib/guru-hub.functions";
import { Orbit, Sparkles, Telescope } from "lucide-react";

export const Route = createFileRoute("/guru/galaxy")({
  head: () => ({
    meta: [
      { title: "Galaxy Classroom — Explore Subjects as Planets | Guru.AI" },
      { name: "description", content: "Every subject you study becomes a planet in your Galaxy Classroom. Explore topics, raise mastery and light up your galaxy with your AI teacher." },
      { property: "og:title", content: "Guru.AI Galaxy Classroom" },
      { property: "og:description", content: "Subjects as planets, mastery as light." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruGalaxyPage,
});

function GuruGalaxyPage() {
  const { state } = useUser();
  const load = useServerFn(getGuruGalaxy);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["guru-galaxy"],
    queryFn: () => load(),
    enabled: state.loggedIn,
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter the Galaxy Classroom</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Orbit className="h-3.5 w-3.5" /> Galaxy Classroom
        </div>
        <h1 className="mt-1 text-2xl font-black">Your learning galaxy</h1>
        <p className="mt-1 text-sm opacity-90">Each subject is a planet. The more you master, the brighter it glows.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-primary-foreground/15 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Topics explored</div>
            <div className="text-lg font-black leading-none">{data?.explored ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/15 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Mastered</div>
            <div className="text-lg font-black leading-none">{data?.mastered ?? 0}</div>
          </div>
        </div>
      </section>

      {isLoading && <div className="mt-4 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">Scanning your galaxy…</div>}

      {isError && (
        <div className="mt-4 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">
          Could not load your galaxy.
          <button type="button" onClick={() => refetch()} className="ml-1 font-bold text-primary">Retry</button>
        </div>
      )}

      {!isLoading && !isError && (data?.planets.length ?? 0) === 0 && (
        <div className="mt-4 rounded-2xl bg-card p-5 text-center shadow-soft">
          <Telescope className="mx-auto h-6 w-6 text-primary" />
          <div className="mt-2 text-sm font-bold">Your galaxy is still dark</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Study your first topic in School and a planet will appear here.</p>
          <Link to="/guru/school"><Button className="mt-3 bg-gradient-primary">Open School</Button></Link>
        </div>
      )}

      {(data?.planets.length ?? 0) > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data!.planets.map((p) => (
            <div key={p.subject} className="rounded-2xl bg-card p-3 text-center shadow-soft">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl"
                style={{ background: `radial-gradient(circle at 30% 30%, hsl(var(--primary) / ${0.15 + (p.mastery / 100) * 0.6}), hsl(var(--muted)))` }}
              >
                {p.emoji}
              </div>
              <div className="mt-2 truncate text-xs font-black">{p.subject}</div>
              <div className="text-[10px] text-muted-foreground">{p.mastered}/{p.topics} mastered</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${p.mastery}%` }} />
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                <Sparkles className="h-3 w-3" /> {p.mastery}% light
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
