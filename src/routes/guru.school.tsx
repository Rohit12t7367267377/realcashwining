import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { browseCurriculum } from "@/lib/guru.functions";
import { ChevronRight, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/guru/school")({
  head: () => ({
    meta: [
      { title: "Guru.AI School — Board, Class, Book & Chapter Learning" },
      { name: "description", content: "Browse your board, class, subject, book and chapter, then learn any topic with your personal AI teacher in English or Hindi." },
      { property: "og:title", content: "Guru.AI School" },
      { property: "og:description", content: "A full school curriculum from board to topic, taught by your AI teacher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchoolPage,
});

type Level = "boards" | "classes" | "subjects" | "books" | "chapters" | "topics";
const ORDER: Level[] = ["boards", "classes", "subjects", "books", "chapters", "topics"];
const LABEL: Record<Level, string> = {
  boards: "Choose your board",
  classes: "Choose your class",
  subjects: "Choose a subject",
  books: "Choose a book",
  chapters: "Choose a chapter",
  topics: "Choose a topic",
};

function SchoolPage() {
  const { state } = useUser();
  const browse = useServerFn(browseCurriculum);
  const [trail, setTrail] = useState<{ level: Level; id: string; title: string }[]>([]);

  const level = ORDER[trail.length] ?? "topics";
  const parentId = trail[trail.length - 1]?.id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["guru-curriculum", level, parentId ?? "root"],
    queryFn: () => browse({ data: { level, ...(parentId ? { parentId } : {}) } }),
    enabled: state.loggedIn,
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to enter Guru.AI School</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <GraduationCap className="h-3.5 w-3.5" /> School
        </div>
        <h1 className="mt-1 text-2xl font-black">{LABEL[level]}</h1>
      </header>

      <nav className="mt-3 flex flex-wrap items-center gap-1 text-[11px]">
        <button type="button" onClick={() => setTrail([])} className="press rounded-full bg-muted px-2.5 py-1 font-bold">
          Boards
        </button>
        {trail.map((t, i) => (
          <span key={t.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setTrail(trail.slice(0, i + 1))}
              className="press rounded-full bg-muted px-2.5 py-1 font-bold"
            >
              {t.title}
            </button>
          </span>
        ))}
      </nav>

      <section className="mt-4 grid gap-2">
        {isLoading && <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">Nothing here yet.</div>
        )}
        {items.map((it) =>
          level === "topics" ? (
            <Link
              key={it.id}
              to="/guru/topic/$id"
              params={{ id: it.id }}
              className="card-lift flex items-center justify-between gap-3 rounded-2xl bg-card p-3.5 shadow-soft"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{it.title}</div>
                {it.subtitle && <div className="truncate text-[11px] text-muted-foreground">{it.subtitle}</div>}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <button
              key={it.id}
              type="button"
              onClick={() => setTrail([...trail, { level, id: it.id, title: it.title }])}
              className="press card-lift flex items-center justify-between gap-3 rounded-2xl bg-card p-3.5 text-left shadow-soft"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{it.title}</div>
                {it.subtitle && <div className="truncate text-[11px] text-muted-foreground">{it.subtitle}</div>}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ),
        )}
      </section>
    </AppShell>
  );
}
