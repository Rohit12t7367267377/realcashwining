import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { getGuruDashboard, setGuruLanguage } from "@/lib/guru.functions";
import {
  GraduationCap, Trophy, Wrench, Library, Sparkles, Orbit, UserRound,
  LineChart, Medal, Flame, Star, Languages, NotebookPen,
} from "lucide-react";

export const Route = createFileRoute("/guru/")({
  head: () => ({
    meta: [
      { title: "Guru.AI Universe — Learn, Level Up, Win | Cash Winning League" },
      { name: "description", content: "Your gamified AI learning universe: School, Competition Hub, Skills, Library, Universal AI, Galaxy Classroom, AI Character, My Learning and Achievements." },
      { property: "og:title", content: "Guru.AI Universe" },
      { property: "og:description", content: "A gamified AI education universe with your own AI teacher, XP, streaks and badges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruDashboard,
});

const SECTIONS = [
  { to: "/guru/notes", label: "Class Notes 1–12", sub: "Any board, any subject", icon: NotebookPen, ready: true },
  { to: "/guru/school", label: "School", sub: "Board, class & chapters", icon: GraduationCap, ready: true },
  { to: "/guru/competitions", label: "Competition Hub", sub: "Contests & challenges", icon: Trophy, ready: true },
  { to: "/guru/skills", label: "Skills", sub: "Roadmaps & assessments", icon: Wrench, ready: true },
  { to: "/guru/library", label: "Library", sub: "Books & reading", icon: Library, ready: true },
  { to: "/guru/universal", label: "Universal AI", sub: "Text, voice, photo & web", icon: Sparkles, ready: true },
  { to: "/guru/galaxy", label: "Galaxy Classroom", sub: "Subjects as planets", icon: Orbit, ready: true },
  { to: "/guru/characters", label: "My AI Character", sub: "Pick your teacher", icon: UserRound, ready: true },
  { to: "/guru/progress", label: "My Learning", sub: "Strong & weak topics", icon: LineChart, ready: true },
  { to: "/guru/achievements", label: "Achievements", sub: "Badges & milestones", icon: Medal, ready: true },
] as const;

function GuruDashboard() {
  const { state } = useUser();
  const qc = useQueryClient();
  const load = useServerFn(getGuruDashboard);
  const setLang = useServerFn(setGuruLanguage);

  const { data } = useQuery({ queryKey: ["guru-dashboard"], queryFn: () => load(), enabled: state.loggedIn });
  const langMut = useMutation({
    mutationFn: (language: "en" | "hi") => setLang({ data: { language } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guru-dashboard"] }),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter Guru.AI</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const lang = data?.language === "hi" ? "hi" : "en";

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Guru.AI Universe
        </div>
        <h1 className="mt-1 text-2xl font-black">
          {data?.character?.name ? `${data.character.name} is ready to teach` : "Welcome to Guru.AI"}
        </h1>
        <p className="mt-1 text-sm opacity-90">Learn, level up and unlock characters as you go.</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Level" value={String(data?.level ?? 1)} icon={<Star className="h-3.5 w-3.5" />} />
          <Stat label="XP" value={String(data?.xp ?? 0)} icon={<Sparkles className="h-3.5 w-3.5" />} />
          <Stat label="Streak" value={`${data?.streak ?? 0}d`} icon={<Flame className="h-3.5 w-3.5" />} />
        </div>

        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-primary-foreground/25">
            <div className="h-full rounded-full bg-primary-foreground/90 transition-all" style={{ width: `${Math.round((data?.progress ?? 0) * 100)}%` }} />
          </div>
          <div className="mt-1 text-[11px] opacity-90">
            {data?.nextLevelXp ? `${data.nextLevelXp - (data.xp ?? 0)} XP to next level` : "Max level"}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Languages className="h-4 w-4 opacity-90" />
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => langMut.mutate(l)}
              className={`press rounded-full px-3 py-1 text-[11px] font-bold ${lang === l ? "bg-primary-foreground text-primary" : "bg-primary-foreground/20"}`}
            >
              {l === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Explore</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SECTIONS.map(({ to, label, sub, icon: Icon, ready }) => (
            <Link key={label} to={to} className="press card-lift rounded-2xl bg-card p-3 shadow-soft">
              <Icon className={`h-5 w-5 ${ready ? "text-primary" : "text-muted-foreground"}`} />
              <div className="mt-1.5 text-xs font-black leading-tight">{label}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">{sub}</div>
            </Link>
          ))}
        </div>
      </section>

      {(data?.recent?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Continue learning</h2>
          <div className="grid gap-2">
            {data!.recent.map((r) => (
              <Link key={r.topic_id} to="/guru/topic/$id" params={{ id: r.topic_id }} className="card-lift rounded-2xl bg-card p-3 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{r.title}</div>
                    <div className="text-[11px] capitalize text-muted-foreground">{String(r.status).replace("_", " ")}</div>
                  </div>
                  <div className="shrink-0 text-xs font-black text-primary">{r.mastery}%</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-primary-foreground/15 p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-90">{icon}{label}</div>
      <div className="mt-0.5 text-lg font-black leading-none">{value}</div>
    </div>
  );
}
