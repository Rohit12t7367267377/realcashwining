import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import { listGuruExams } from "@/lib/guru-exams.functions";
import { GraduationCap, Search, Trophy } from "lucide-react";

export const Route = createFileRoute("/guru/exams")({
  head: () => ({
    meta: [
      { title: "Competitive Exams — JEE, NEET, UPSC, SSC & more | Guru.AI" },
      {
        name: "description",
        content:
          "Prepare for JEE Main, JEE Advanced, GATE, NEET, UPSC, SSC, Banking, Railway, NDA, CDS, CUET, CAT, CLAT and UGC NET with AI syllabus, practice, PYQs, mock tests and study plans.",
      },
      { property: "og:title", content: "Competitive Exams Hub — Guru.AI" },
      {
        property: "og:description",
        content: "Syllabus, AI teacher, practice, PYQs, mock tests, weak-topic analysis and study plans for every major Indian exam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

const CATEGORY_ORDER = ["Engineering", "Medical", "Government", "Other"];

function ExamsPage() {
  const { state } = useUser();
  const load = useServerFn(listGuruExams);
  const [q, setQ] = useState("");

  const { data: exams, isLoading } = useQuery({
    queryKey: ["guru-exams"],
    queryFn: () => load(),
    enabled: state.loggedIn,
  });

  const grouped = useMemo(() => {
    const list = (exams ?? []).filter((e) =>
      q.trim() ? `${e.name} ${e.category} ${e.body}`.toLowerCase().includes(q.trim().toLowerCase()) : true,
    );
    const map = new Map<string, typeof list>();
    for (const e of list) map.set(e.category, [...(map.get(e.category) ?? []), e]);
    return Array.from(map.entries()).sort(
      (a, b) =>
        (CATEGORY_ORDER.indexOf(a[0]) + 1 || 99) - (CATEGORY_ORDER.indexOf(b[0]) + 1 || 99) || a[0].localeCompare(b[0]),
    );
  }, [exams, q]);

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to open Competitive Exams</h1>
          <Link to="/login">
            <Button className="mt-4 bg-gradient-primary">Sign In</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <GraduationCap className="h-3.5 w-3.5" /> Competition Hub • Competitive Exams
        </div>
        <h1 className="mt-1 text-2xl font-black">Every major Indian exam, taught by AI</h1>
        <p className="mt-1 text-sm opacity-90">
          Syllabus, subjects, topics, AI teacher, practice, PYQs, mock tests, performance analysis, weak topics,
          revision and a study plan.
        </p>
        <Link to="/guru/competitions">
          <Button size="sm" variant="secondary" className="mt-3 gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Challenges & rankings
          </Button>
        </Link>
      </section>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exams…" className="pl-9" />
      </div>

      {isLoading && <p className="mt-6 text-center text-sm text-muted-foreground">Loading exams…</p>}

      {grouped.map(([category, list]) => (
        <section key={category} className="mt-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-muted-foreground">{category}</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {list.map((e) => (
              <Link
                key={e.code}
                to="/guru/exams/$code"
                params={{ code: e.code }}
                className="card-lift rounded-2xl bg-card p-3.5 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{e.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-black">{e.name}</div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{e.blurb}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] font-bold">
                      {e.body && <span className="rounded-full bg-secondary px-2 py-0.5">{e.body}</span>}
                      <span className="rounded-full bg-secondary px-2 py-0.5">{e.subjects} subjects</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {!isLoading && grouped.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">No exams match your search.</p>
      )}
    </AppShell>
  );
}
