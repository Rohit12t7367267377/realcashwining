import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Radio, WifiOff, Clock, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isStaleMatch } from "@/lib/sports-provider";
import { rowToFacts, rowToRef, type MatchRow } from "@/lib/pred/facts";
import type { InningsFacts, MatchRef } from "@/lib/pred/types";

// Reads the verified central cache (cricket_matches), which the server fills from the
// configured provider. Nothing here is fetched from a third-party site or invented.
const REFRESH_SECONDS = 60;
const POLL_MS = 30_000;

type Row = MatchRow & { series?: string | null; venue?: string | null };
type Ball = { innings: number; over: number; seq: number; legal: boolean; runs_bat: number; extras: number; wicket: boolean };

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Time TBA";

function ago(iso: string | null, now: number) {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "unknown";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function inningsLine(i: InningsFacts) {
  return `${i.runs}/${i.wickets} (${i.overs} ov)`;
}

function ballLabel(b: Ball) {
  if (b.wicket) return "W";
  if (!b.legal && b.extras > 0) return `${b.extras + b.runs_bat}${b.runs_bat ? "" : "x"}`;
  return b.runs_bat === 0 ? "•" : String(b.runs_bat);
}

export function CricketScoreboard({ active }: { active: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [manual, setManual] = useState<any[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
      const { data, error: e } = await supabase
        .from("cricket_matches")
        .select("id, name, status, date_time, team_a, team_b, match_type, is_live, raw, fetched_at, series, venue")
        .or(`is_live.eq.true,date_time.gte.${since}`)
        .order("date_time", { ascending: false })
        .limit(60);
      if (e) throw e;
      setRows(data as unknown as Row[]);
      setError(false);
      const { data: m } = await supabase.from("live_scores").select("*").eq("is_live", true).ilike("sport", "Cricket").order("sort_order");
      setManual(m ?? []);
    } catch {
      setError(true); // keep showing the last verified data
    } finally {
      setNow(Date.now());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [active, load]);

  const groups = useMemo(() => {
    const g = { live: [] as Row[], upcoming: [] as Row[], done: [] as Row[] };
    for (const r of rows ?? []) {
      const st = rowToRef(r).state;
      if (st === "live") g.live.push(r);
      else if (st === "upcoming") g.upcoming.push(r);
      else g.done.push(r);
    }
    g.upcoming.sort((a, b) => Date.parse(a.date_time ?? "") - Date.parse(b.date_time ?? ""));
    return g;
  }, [rows]);

  const newest = useMemo(() => (rows ?? []).reduce<string | null>((n, r) => (r.fetched_at && (!n || r.fetched_at > n) ? r.fetched_at : n), null), [rows]);
  const feedStale = isStaleMatch(newest, REFRESH_SECONDS * 5, now);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[11px] text-muted-foreground">
          {rows === null ? "Loading…" : newest ? (
            <span className={cn("inline-flex items-center gap-1", feedStale && "text-amber-600")}>
              <Clock className="h-3 w-3" /> Last verified {ago(newest, now)}{feedStale ? " · delayed data" : ""}
            </span>
          ) : "No verified data yet"}
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-1 h-3 w-3", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error && (
        <Card className="mb-3 flex items-center gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <WifiOff className="h-4 w-4 shrink-0" /> Reconnecting… showing the last verified scores.
        </Card>
      )}

      {rows !== null && rows.length === 0 && manual.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No cricket matches available yet. Scores appear here once the sports provider is connected and matches are synced.
        </Card>
      )}

      {manual.length > 0 && (
        <Section title="Updated by Guru-G team">
          {manual.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.league ?? "Cricket"} · manual update</div>
              <div className="mt-1 flex items-center justify-between gap-2 font-semibold">
                <span className="flex-1 truncate">{m.home_team}</span>
                <span className="font-black tabular-nums">{m.home_score} : {m.away_score}</span>
                <span className="flex-1 truncate text-right">{m.away_team}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{m.status}</div>
            </Card>
          ))}
        </Section>
      )}

      {groups.live.length > 0 && (
        <Section title="Live" live>
          {groups.live.map((r) => <MatchCard key={r.id} row={r} now={now} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />)}
        </Section>
      )}
      {groups.upcoming.length > 0 && (
        <Section title="Upcoming">
          {groups.upcoming.map((r) => <MatchCard key={r.id} row={r} now={now} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />)}
        </Section>
      )}
      {groups.done.length > 0 && (
        <Section title="Completed">
          {groups.done.map((r) => <MatchCard key={r.id} row={r} now={now} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, live, children }: { title: string; live?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {live && <Radio className="h-3.5 w-3.5 animate-pulse text-destructive" />} {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MatchCard({ row, now, open, onToggle }: { row: Row; now: number; open: boolean; onToggle: () => void }) {
  const ref: MatchRef = rowToRef(row);
  // Huge refresh window: here we only want the parsed innings; staleness is shown explicitly below.
  const facts = rowToFacts(row, { nowMs: now, refreshSeconds: 1e9 });
  const stale = ref.state === "live" && isStaleMatch(row.fetched_at, REFRESH_SECONDS, now);
  const inningsOf = (team: string) => (facts?.innings ?? []).filter((i) => i.team.toLowerCase() === team.toLowerCase());
  const a = inningsOf(ref.teamA);
  const b = inningsOf(ref.teamB);
  const current = facts?.innings.length ? facts.innings[facts.innings.length - 1] : null;

  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left" aria-expanded={open}>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="truncate">{row.series || row.match_type || "Cricket"}</span>
          <span className="shrink-0">{fmtTime(row.date_time)}</span>
        </div>
        <div className="mt-2 space-y-1">
          <TeamLine name={ref.teamA} scores={a.map(inningsLine)} bold={facts?.winner === "A"} />
          <TeamLine name={ref.teamB} scores={b.map(inningsLine)} bold={facts?.winner === "B"} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span className={cn("inline-flex min-w-0 items-center gap-1 truncate", ref.state === "live" ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {ref.state === "live" && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-destructive" />}
            <span className="truncate">{ref.statusText || (ref.state === "upcoming" ? "Match not started" : ref.state)}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
        {stale && <div className="mt-1 text-[11px] text-amber-600">Delayed · last verified {ago(row.fetched_at, now)}</div>}
      </button>
      {open && <Details row={row} ref_={ref} innings={facts?.innings ?? []} current={current} now={now} />}
    </Card>
  );
}

function TeamLine({ name, scores, bold }: { name: string; scores: string[]; bold: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("truncate", bold ? "font-black" : "font-semibold")}>{name}</span>
      <span className="shrink-0 text-right text-sm font-bold tabular-nums">{scores.length ? scores.join(" & ") : <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function Details({ row, ref_, innings, current, now }: { row: Row; ref_: MatchRef; innings: InningsFacts[]; current: InningsFacts | null; now: number }) {
  const [balls, setBalls] = useState<Ball[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("pred_events").select("innings, over, seq, legal, runs_bat, extras, wicket").eq("match_id", row.id)
        .order("innings", { ascending: false }).order("over", { ascending: false }).order("seq", { ascending: false }).limit(12);
      if (alive) setBalls((data ?? []).reverse());
    })().catch(() => alive && setBalls([]));
    return () => { alive = false; };
  }, [row.id]);

  const target = innings.length >= 2 && ref_.state === "live" && current ? innings[0].runs + 1 : null;
  return (
    <div className="space-y-3 border-t bg-muted/30 p-4 text-sm">
      {row.venue ? <div className="text-xs text-muted-foreground">📍 {row.venue}</div> : null}
      {innings.length > 0 ? (
        <div className="space-y-1">
          {innings.map((i) => (
            <div key={i.no} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Innings {i.no} · {i.team || "—"}{i.complete ? "" : " (batting)"}</span>
              <span className="font-bold tabular-nums">{inningsLine(i)}</span>
            </div>
          ))}
          {target !== null && current && (
            <div className="pt-1 text-xs font-semibold text-primary">
              Target {target} · need {Math.max(0, target - current.runs)} more
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Innings details are not available from the provider for this match.</div>
      )}
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent deliveries</div>
        {balls && balls.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {balls.map((b, i) => (
              <span key={i} className={cn("inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-xs font-bold",
                b.wicket ? "border-destructive bg-destructive text-destructive-foreground" : b.runs_bat >= 4 ? "border-primary bg-primary/15 text-primary" : "bg-background")}>
                {ballLabel(b)}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Ball-by-ball data isn't available for this match.</div>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground">Provider data · last verified {ago(row.fetched_at, now)}</div>
    </div>
  );
}
