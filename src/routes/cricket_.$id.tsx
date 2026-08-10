import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Radio, Trophy, Zap, BookOpenCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/cricket_/$id")({
  head: () => ({
    meta: [
      { title: "Live Match Centre — Cash Winning League" },
      { name: "description", content: "Live score, match quizzes and reading challenges for this match." },
      { property: "og:title", content: "Live Match Centre" },
      { property: "og:description", content: "Follow the live score and play the match quiz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Match = {
  id: string;
  name: string;
  series: string | null;
  status: string | null;
  venue: string | null;
  match_type: string | null;
  team_a: string | null;
  team_b: string | null;
  score_a: string | null;
  score_b: string | null;
  is_live: boolean;
  date_time: string | null;
};

function Page() {
  const { id } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [contests, setContests] = useState<any[]>([]);
  const [passages, setPassages] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(60);

  const load = useCallback(async () => {
    const [{ data: m }, { data: c }, { data: p }, { data: s }] = await Promise.all([
      supabase.from("cricket_matches").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("contests")
        .select("id, title, entry_fee, prize_pool, first_prize, num_questions, duration_minutes, starts_at, ends_at, results_status")
        .eq("match_id", id)
        .eq("active", true)
        .order("starts_at", { ascending: true }),
      supabase
        .from("reading_passages")
        .select("id, title, reading_seconds, quiz_seconds, num_questions")
        .eq("match_id", id)
        .eq("active", true),
      supabase.from("app_settings").select("value").eq("key", "cricket_refresh_seconds").maybeSingle(),
    ]);
    setMatch((m as Match) ?? null);
    setContests(c ?? []);
    setPassages(p ?? []);
    if (s?.value) setRefresh(Math.max(30, Number(s.value) || 60));
  }, [id]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), refresh * 1000);
    return () => clearInterval(t);
  }, [load, refresh]);

  return (
    <AppShell>
      <Link to="/cricket" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All live matches
      </Link>

      {!match ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Match not found.</Card>
      ) : (
        <>
          <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
              <Radio className="h-3.5 w-3.5" /> {match.is_live ? "Live now" : match.match_type || "Match"}
            </div>
            <h1 className="mt-1 text-xl font-black">{match.name}</h1>
            {match.series && <p className="text-xs opacity-90">{match.series}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="font-bold">{match.team_a}</div>
                <div className="font-mono">{match.score_a || "—"}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{match.team_b}</div>
                <div className="font-mono">{match.score_b || "—"}</div>
              </div>
            </div>
            <p className="mt-3 text-xs opacity-90">{match.status}</p>
            <p className="mt-1 text-[10px] opacity-75">Auto-refreshes every {refresh}s · {match.venue}</p>
          </section>

          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold"><Zap className="h-4 w-4" /> Match quizzes</h2>
          <div className="mt-2 space-y-2">
            {contests.map((c) => {
              const now = Date.now();
              const notStarted = c.starts_at ? Date.parse(c.starts_at) > now : false;
              const ended = c.ends_at ? Date.parse(c.ends_at) < now : false;
              return (
                <Link key={c.id} to="/contest/$id" params={{ id: c.id }} className="block rounded-2xl bg-card p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{c.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>{c.num_questions} Qs</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.duration_minutes}m</span>
                        {c.starts_at && <span>Starts {new Date(c.starts_at).toLocaleString()}</span>}
                        {c.ends_at && <span>Ends {new Date(c.ends_at).toLocaleString()}</span>}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold">
                        {c.results_status === "declared"
                          ? "Results declared"
                          : notStarted
                            ? "Opens at the scheduled time"
                            : ended
                              ? "Closed — awaiting official result"
                              : "Open now"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px]">
                      {Number(c.first_prize) > 0 && (
                        <div className="rounded-lg bg-gradient-gold px-2 py-1 text-xs font-black text-amber-950">
                          <Trophy className="mr-1 inline h-3 w-3" />₹{c.first_prize}
                        </div>
                      )}
                      <div className="mt-1">Entry ₹{Number(c.entry_fee).toFixed(0)}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {!contests.length && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No quiz has been opened for this match yet.
              </Card>
            )}
          </div>

          {passages.length > 0 && (
            <>
              <h2 className="mt-6 flex items-center gap-2 text-lg font-bold"><BookOpenCheck className="h-4 w-4" /> Match reading challenge</h2>
              <div className="mt-2 space-y-2">
                {passages.map((p) => (
                  <Link key={p.id} to="/reading/$id" params={{ id: p.id }} className="block rounded-2xl bg-card p-4 shadow-soft">
                    <div className="text-sm font-bold">{p.title}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Read {p.reading_seconds}s · Quiz {Math.round(p.quiz_seconds / 60)}m · {p.num_questions} questions
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
