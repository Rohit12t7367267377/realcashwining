import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES } from "@/lib/quiz-data";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, Users, Zap, Trophy, Inbox, Radio, BookOpenCheck } from "lucide-react";

export const Route = createFileRoute("/category/$id")({
  component: CategoryPage,
});

// Home groups → matching DB category slugs
const GROUP_SLUGS: Record<string, string[] | "all"> = {
  sports: ["cricket", "football", "tennis", "basketball", "badminton", "hockey", "kabaddi", "sports-other"],
  gk: ["upsc", "ssc", "banking", "railway", "police", "current-affairs", "gk"],
  coding: ["coding", "python", "javascript", "java", "cpp", "dsa"],
};

type Row = {
  id: string;
  title: string;
  entry_fee: number;
  prize_pool: number;
  first_prize: number;
  duration_minutes: number;
  num_questions: number;
  max_participants: number;
  active: boolean;
  results_status: string;
};

function CategoryPage() {
  const { id } = Route.useParams();
  const cat = CATEGORIES.find((c) => c.id === id);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [passages, setPassages] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const wanted = GROUP_SLUGS[id];
      if (!wanted) { setRows([]); return; }
      const { data: cats } = await supabase.from("categories").select("id, slug").in("slug", wanted as string[]);
      const catIds = (cats ?? []).map((c) => c.id);
      if (!catIds.length) { setRows([]); return; }
      const { data } = await supabase
        .from("contests")
        .select("id, title, entry_fee, prize_pool, first_prize, duration_minutes, num_questions, max_participants, active, results_status")
        .in("category_id", catIds)
        .eq("active", true)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as Row[]);

      // Reading-comprehension challenges published into this category group
      const { data: rp } = await supabase
        .from("reading_passages")
        .select("id, title, reading_seconds, quiz_seconds, num_questions, entry_fee")
        .in("category_id", catIds)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      setPassages(rp ?? []);

      // Live match centre is only surfaced inside the Sports group
      if (id === "sports") {
        const { data: lm } = await supabase
          .from("cricket_matches")
          .select("id, name, status, team_a, team_b, score_a, score_b, is_live")
          .order("is_live", { ascending: false })
          .order("date_time", { ascending: false })
          .limit(6);
        setMatches(lm ?? []);
      } else {
        setMatches([]);
      }
    })();
  }, [id]);

  if (!cat) return <AppShell><p>Not found</p></AppShell>;

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

      {matches.length > 0 && (
        <>
          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold"><Radio className="h-4 w-4 text-destructive" /> Live match centre</h2>
          <div className="mt-2 space-y-2">
            {matches.map((m) => (
              <Link key={m.id} to="/cricket/$id" params={{ id: m.id }} className="block rounded-2xl bg-card p-4 shadow-soft transition hover:shadow-glow">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.status}</div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px]">
                    {m.is_live && <div className="font-bold text-destructive">● LIVE</div>}
                    {m.score_a || "—"} vs {m.score_b || "—"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-6 text-lg font-bold">Available Contests</h2>

      {rows === null && (
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      )}

      {rows && rows.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed bg-card p-8 text-center shadow-soft">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No contests yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The admin hasn't published any {cat.name.toLowerCase()} contests yet. Please check back soon.
          </p>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {(rows ?? []).map((c) => {
          const declared = c.results_status === "declared";
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
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.duration_minutes}m</span>
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{c.num_questions} Qs</span>
                    {Number(c.entry_fee) === 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 font-bold text-success">FREE</span>}
                    {declared && <span className="rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">Results out</span>}
                  </div>
                </div>
                <div className="text-right">
                  {Number(c.first_prize) > 0 ? (
                    <div className="rounded-lg bg-gradient-gold px-2 py-1 text-xs font-black text-amber-950">
                      <Trophy className="mr-1 inline h-3 w-3" />₹{c.first_prize}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted px-2 py-1 text-xs font-bold">Practice</div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">Entry ₹{c.entry_fee}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />Max {c.max_participants}</span>
                <span>Prize pool ₹{c.prize_pool}</span>
              </div>
            </Link>
          );
        })}
      </div>
      {passages.length > 0 && (
        <>
          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold"><BookOpenCheck className="h-4 w-4" /> Reading comprehension</h2>
          <div className="mt-2 space-y-2">
            {passages.map((p) => (
              <Link key={p.id} to="/reading/$id" params={{ id: p.id }} className="block rounded-2xl bg-card p-4 shadow-soft transition hover:shadow-glow">
                <div className="text-sm font-bold">{p.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Read {p.reading_seconds}s · Quiz {Math.round(p.quiz_seconds / 60)}m · {p.num_questions} questions
                  {Number(p.entry_fee) > 0 ? ` · Entry ₹${Number(p.entry_fee).toFixed(0)}` : " · FREE"}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

    </AppShell>
  );
}
