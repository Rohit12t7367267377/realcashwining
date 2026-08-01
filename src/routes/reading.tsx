import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { BookOpenCheck, Timer, Clock } from "lucide-react";

export const Route = createFileRoute("/reading")({
  head: () => ({
    meta: [
      { title: "Reading Comprehension Quizzes — Cash Winning League" },
      { name: "description", content: "Timed reading comprehension quizzes: read the passage, then answer MCQs before the clock runs out." },
      { property: "og:title", content: "Reading Comprehension Quizzes" },
      { property: "og:description", content: "Read a passage against the clock, then answer the questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type P = {
  id: string;
  title: string;
  reading_seconds: number;
  quiz_seconds: number;
  num_questions: number;
  difficulty: string;
  entry_fee: number;
  prize_pool: number;
  starts_at: string | null;
  ends_at: string | null;
};

function Page() {
  const [rows, setRows] = useState<P[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("reading_passages")
        .select("id, title, reading_seconds, quiz_seconds, num_questions, difficulty, entry_fee, prize_pool, starts_at, ends_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      setRows((data ?? []) as P[]);
    })();
  }, []);

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <BookOpenCheck className="h-3.5 w-3.5" /> New quiz type
        </div>
        <h1 className="mt-1 text-2xl font-black">Reading Comprehension</h1>
        <p className="mt-1 text-sm opacity-90">Read the passage while the timer runs. Questions unlock automatically after reading time ends.</p>
      </section>

      <div className="mt-4 space-y-2">
        {rows === null && <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">Loading…</div>}
        {rows?.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
            No reading quizzes are live right now. Please check back later.
          </div>
        )}
        {(rows ?? []).map((p) => (
          <Link key={p.id} to="/reading/$id" params={{ id: p.id }} className="card-lift block rounded-2xl bg-gradient-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{p.title}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Read {p.reading_seconds}s</span>
                  <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> Quiz {Math.round(p.quiz_seconds / 60)}m</span>
                  <span>{p.num_questions} questions</span>
                  <span className="capitalize">{p.difficulty}</span>
                </div>
              </div>
              <div className="shrink-0 text-right text-[11px]">
                {Number(p.entry_fee) > 0 ? <div>Entry ₹{Number(p.entry_fee).toFixed(0)}</div> : <div className="font-bold text-success">FREE</div>}
                {Number(p.prize_pool) > 0 && <div className="font-bold text-success">Pool ₹{Number(p.prize_pool).toFixed(0)}</div>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
