import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ensureQuizAutogen } from "@/lib/quiz-autogen.functions";
import { applyFilters, countdown, NO_FILTERS, statusOf, trackOf, type ExplorerContest, type Filters } from "@/lib/contest-explorer";

const STATUS = [["all", "All"], ["live", "Live"], ["upcoming", "Upcoming"], ["ended", "Ended"]] as const;
const TRACK = [["all", "All"], ["school", "School"], ["college", "College"], ["exam", "Exams"], ["coding", "Coding"]] as const;
const DIFF = [["all", "Any level"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] as const;

/** Student contest cards with filters and live countdowns. Free contests only are shown as joinable. */
export function ContestExplorer() {
  const [rows, setRows] = useState<ExplorerContest[]>([]);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // Nudge the (idempotent) generator at most every 10 minutes per browser; reload the list if it made one.
    let nudge: Promise<unknown> = Promise.resolve();
    try {
      const last = Number(sessionStorage.getItem("quizAutogenPing") ?? 0);
      if (Date.now() - last > 10 * 60_000) {
        sessionStorage.setItem("quizAutogenPing", String(Date.now()));
        nudge = ensureQuizAutogen().then((r) => (r.status === "created" ? load() : undefined)).catch(() => undefined);
      }
    } catch { /* storage blocked: skip */ }
    void nudge;
    load();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
    function load() {
    void supabase.from("contests")
      .select("id, title, contest_type, entry_fee, num_questions, duration_minutes, starts_at, ends_at, results_status, active, marks_correct, marks_wrong, auto_scope")
      .eq("active", true).order("starts_at", { ascending: false, nullsFirst: false }).limit(60)
      .then(({ data }) => { setRows(((data ?? []) as unknown) as ExplorerContest[]); setLoaded(true); });
    }
  }, []);
  const shown = useMemo(() => applyFilters(rows, f, now), [rows, f, now]);
  const chip = <K extends keyof Filters>(key: K, items: readonly (readonly [string, string])[]) => (
    <div className="flex gap-1 overflow-x-auto" role="group" aria-label={String(key)}>
      {items.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={f[key] === v} onClick={() => setF({ ...f, [key]: v } as Filters)}
          className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-bold", f[key] === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{label}</button>
      ))}
    </div>
  );
  if (loaded && rows.length === 0) return null;
  return (
    <section className="mt-6" aria-label="Contest explorer">
      <h2 className="text-base font-black">All contests</h2>
      <p className="text-[11px] text-muted-foreground">Free to play · virtual points only</p>
      <div className="mt-2 space-y-2">
        {chip("status", STATUS)}{chip("track", TRACK)}{chip("difficulty", DIFF)}
        <Input aria-label="Search subject, class or exam" placeholder="Search subject, class or exam" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      </div>
      <div className="mt-3 grid gap-2">
        {shown.length === 0 && <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No contests match these filters.</div>}
        {shown.slice(0, 30).map((c) => {
          const st = statusOf(c, now), tr = trackOf(c);
          const paid = Number(c.entry_fee) > 0;
          const body = (
            <>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{c.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {tr === "coding" ? "Coding" : c.num_questions + " questions"} · {c.duration_minutes} min
                  {c.marks_correct != null && ` · +${c.marks_correct}/${c.marks_wrong ?? 0}`}
                  {c.auto_scope?.difficulty && ` · ${c.auto_scope.difficulty}`}
                </div>
                <div className="text-[11px] font-bold text-primary">{countdown(c, now)}</div>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-bold", st === "live" ? "bg-success/15 text-success" : st === "upcoming" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{paid ? "Unavailable" : st}</span>
            </>
          );
          const cls = "card-lift flex items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-soft";
          return tr === "coding"
            ? <Link key={c.id} to="/coding/$id" params={{ id: c.id }} className={cls}>{body}</Link>
            : <Link key={c.id} to="/contest/$id" params={{ id: c.id }} className={cls}>{body}</Link>;
        })}
      </div>
    </section>
  );
}
