import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { listGuruCharacters, selectGuruCharacter, setGuruTeachingStyle } from "@/lib/guru.functions";
import { GuruCharacterAvatar } from "@/components/GuruCharacterAvatar";
import { TEACHING_STYLES, type TeachingStyleId } from "@/lib/guru-teaching";
import { Lock, Check, GraduationCap, Languages, Mic, Gauge, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/guru/characters")({
  head: () => ({
    meta: [
      { title: "My AI Character — Pick Your Guru.AI Teacher" },
      { name: "description", content: "Choose from Maths, Physics, Chemistry, Biology, Coding, AI/ML, English, exam and career AI teachers — each with its own avatar, voice, specialisation and teaching style." },
      { property: "og:title", content: "My AI Character — Guru.AI" },
      { property: "og:description", content: "Pick your personal AI teacher and choose how they teach you: friendly, strict, simple, exam-focused, concept-focused, fast or detailed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CharactersPage,
});

type CharacterRow = {
  id: string;
  name: string;
  emoji?: string | null;
  tagline?: string | null;
  personality?: string | null;
  teaching_style?: string | null;
  tone?: string | null;
  accent_color?: string | null;
  subject_specialization?: string | null;
  languages?: string | null;
  voice_label?: string | null;
  difficulty_style?: string | null;
  avatar_style?: string | null;
  unlocked: boolean;
  requirementText: string;
};

function CharactersPage() {
  const { state } = useUser();
  const qc = useQueryClient();
  const list = useServerFn(listGuruCharacters);
  const select = useServerFn(selectGuruCharacter);
  const saveStyle = useServerFn(setGuruTeachingStyle);
  const [filter, setFilter] = useState<string>("all");

  const { data } = useQuery({ queryKey: ["guru-characters"], queryFn: () => list(), enabled: state.loggedIn });

  const pick = useMutation({
    mutationFn: (character_id: string) => select({ data: { character_id } }),
    onSuccess: () => {
      toast.success("Teacher selected");
      qc.invalidateQueries({ queryKey: ["guru-characters"] });
      qc.invalidateQueries({ queryKey: ["guru-dashboard"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not select"),
  });

  const style = useMutation({
    mutationFn: (s: TeachingStyleId) => saveStyle({ data: { style: s } }),
    onSuccess: () => {
      toast.success("Teaching style saved");
      qc.invalidateQueries({ queryKey: ["guru-characters"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save style"),
  });

  const characters = (data?.characters ?? []) as unknown as CharacterRow[];
  const activeStyle = (data as { teachingStyle?: string } | undefined)?.teachingStyle ?? "friendly";

  const groups = useMemo(() => {
    const map: Record<string, string> = {
      all: "All",
      classic: "General",
      maths: "Maths",
      science: "Science",
      tech: "Coding",
      ai: "AI/ML",
      language: "Languages",
      exam: "Exams",
      college: "College",
      career: "Career",
    };
    const present = new Set(characters.map((c) => c.avatar_style ?? "classic"));
    return Object.entries(map).filter(([k]) => k === "all" || present.has(k));
  }, [characters]);

  const shown = filter === "all" ? characters : characters.filter((c) => (c.avatar_style ?? "classic") === filter);

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to choose your character</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> My AI Character
        </div>
        <h1 className="mt-1 text-2xl font-black">Your personal AI teachers</h1>
        <p className="mt-1 text-sm opacity-90">Every teacher has its own subject, voice, personality and difficulty. Pick one, then choose how it should teach you.</p>
      </header>

      {/* Teaching style */}
      <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
        <h2 className="text-sm font-black">How should your teacher teach?</h2>
        <p className="text-[11px] text-muted-foreground">This style is used everywhere in Guru.AI — School, Classroom, Universal AI and Skill Academy.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TEACHING_STYLES.map((s) => {
            const on = activeStyle === s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={style.isPending}
                onClick={() => style.mutate(s.id)}
                className={`press rounded-full px-3 py-1.5 text-[11px] font-bold disabled:opacity-60 ${on ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}
                title={s.blurb}
              >
                {s.emoji} {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {TEACHING_STYLES.find((s) => s.id === activeStyle)?.blurb}
        </p>
      </section>

      {/* Filters */}
      <div className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {groups.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`press shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${filter === key ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="mt-3 grid gap-2 sm:grid-cols-2">
        {shown.map((c) => {
          const selected = data?.selectedId === c.id;
          return (
            <div
              key={c.id}
              className={`rounded-3xl p-4 shadow-soft ${selected ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}
            >
              <div className="flex items-start gap-3">
                <GuruCharacterAvatar accent={c.accent_color} style={c.avatar_style} emoji={c.emoji} size={58} className="shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-black">{c.name}</div>
                  <div className={`text-[11px] ${selected ? "opacity-90" : "text-muted-foreground"}`}>
                    {[c.personality, c.tone].filter(Boolean).join(" • ")}
                  </div>
                  {c.tagline && <p className={`mt-1 text-xs ${selected ? "opacity-90" : "text-muted-foreground"}`}>{c.tagline}</p>}
                </div>
              </div>

              <dl className={`mt-3 grid gap-1 text-[11px] ${selected ? "opacity-95" : "text-muted-foreground"}`}>
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.subject_specialization || "General"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.teaching_style || "Friendly"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Languages className="h-3.5 w-3.5" />{c.languages || "English"}</span>
                  <span className="inline-flex items-center gap-1"><Mic className="h-3.5 w-3.5" />{c.voice_label || "Warm"}</span>
                  <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{c.difficulty_style || "Adaptive"}</span>
                </div>
              </dl>

              <div className="mt-3 flex items-center gap-2">
                {selected ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs font-bold"><Check className="h-3.5 w-3.5" /> Selected</span>
                    <Link to="/guru/classroom" className="ml-auto">
                      <Button size="sm" variant="secondary">Teach me</Button>
                    </Link>
                  </>
                ) : c.unlocked ? (
                  <Button size="sm" className="bg-gradient-primary" disabled={pick.isPending} onClick={() => pick.mutate(c.id)}>
                    Choose
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> {c.requirementText}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {(data?.costumes?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Costumes</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data!.costumes.map((c) => (
              <div key={c.id} className="rounded-2xl bg-card p-3 text-center shadow-soft">
                <div className="text-2xl">{c.emoji ?? "🎽"}</div>
                <div className="mt-1 text-xs font-bold">{c.name}</div>
                <div className="text-[10px] text-muted-foreground">{c.unlocked ? "Unlocked" : c.requirementText}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
