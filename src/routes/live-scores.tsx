import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/live-scores")({
  ssr: false,
  head: () => ({ meta: [{ title: "Live Sports Scores — CWL" }] }),
  component: LiveScores,
});

function LiveScores() {
  const [tab, setTab] = useState("Cricket");
  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive animate-pulse" /> Live Scores
          </h1>
          <p className="text-xs text-muted-foreground">Real-time cricket & sports scores · may be slightly delayed</p>
        </div>
        <Link to="/" className="text-xs text-primary hover:underline">← Home</Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="Cricket">🏏 Cricket</TabsTrigger>
          <TabsTrigger value="Soccer">⚽ Football</TabsTrigger>
          <TabsTrigger value="Tennis">🎾 Tennis</TabsTrigger>
          <TabsTrigger value="Basketball">🏀 Basket</TabsTrigger>
        </TabsList>
        {tab === "Cricket" ? (
          <TabsContent value="Cricket" className="mt-4"><CricketFeed active /></TabsContent>
        ) : null}
        {["Soccer", "Tennis", "Basketball"].map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            <SportFeed sport={s} active={tab === s} />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

type Match = {
  id: string;
  league: string;
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
  status: string;
  time: string;
  isLive: boolean;
};

// ---------- Admin-managed scores (from live_scores table) ----------
async function fetchAdminScores(sport: string): Promise<Match[]> {
  const { data } = await supabase
    .from("live_scores")
    .select("*")
    .eq("is_live", true)
    .ilike("sport", sport)
    .order("sort_order")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    league: r.league ?? r.sport ?? sport,
    home: r.home_team,
    away: r.away_team,
    homeScore: r.home_score,
    awayScore: r.away_score,
    status: r.status,
    time: r.match_time ?? "",
    isLive: true,
  }));
}

// ---------- Cricket (via CricAPI-style free public feed) ----------
async function fetchCricket(): Promise<Match[]> {
  // Admin-managed matches first — they're always shown
  const admin = await fetchAdminScores("Cricket");
  // Try disect.in free cricket API (no key required, CORS enabled)
  try {
    const r = await fetch("https://api.disect.in/cricket/live");
    if (r.ok) {
      const j = await r.json();
      const list: any[] = Array.isArray(j) ? j : j?.data ?? j?.matches ?? [];
      if (list.length) {
        return list.slice(0, 15).map((m: any, i: number) => ({
          id: String(m.id ?? m.matchId ?? i),
          league: String(m.series ?? m.tournament ?? m.competition ?? "Cricket"),
          home: String(m.team1 ?? m.teamA ?? m.homeTeam ?? "Team A"),
          away: String(m.team2 ?? m.teamB ?? m.awayTeam ?? "Team B"),
          homeScore: String(m.score1 ?? m.team1Score ?? m.homeScore ?? "-"),
          awayScore: String(m.score2 ?? m.team2Score ?? m.awayScore ?? "-"),
          status: String(m.status ?? m.matchStatus ?? "Live"),
          time: String(m.time ?? m.matchTime ?? ""),
          isLive: true,
        }));
      }
    }
  } catch { /* fall through */ }

  // Fallback: TheSportsDB free public key "3"
  try {
    const r = await fetch("https://www.thesportsdb.com/api/v1/json/3/livescore.php?s=Cricket");
    const j = await r.json();
    const list: any[] = j?.events ?? j?.livescore ?? [];
    return list.map((e) => ({
      id: String(e.idEvent),
      league: String(e.strLeague ?? "Cricket"),
      home: String(e.strHomeTeam),
      away: String(e.strAwayTeam),
      homeScore: String(e.intHomeScore ?? "-"),
      awayScore: String(e.intAwayScore ?? "-"),
      status: String(e.strStatus ?? e.strProgress ?? "Live"),
      time: `${e.dateEvent ?? ""} ${(e.strTime ?? "").slice(0, 5)}`,
      isLive: (e.strStatus ?? "").toLowerCase() !== "ns",
    }));
  } catch {
    return [];
  }
}

function CricketFeed({ active }: { active: boolean }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { setMatches(await fetchCricket()); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!active) return;
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [active]);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {!loading && matches.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No live cricket matches right now. Check back closer to match time.
        </Card>
      )}
      <div className="space-y-2">
        {matches.map((m) => <MatchCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}

// ---------- Non-cricket via TheSportsDB (best-effort, silent fail) ----------
function SportFeed({ sport, active }: { sport: string; active: boolean }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/livescore.php?s=${sport}`);
      const j = await r.json();
      const list: any[] = j?.events ?? j?.livescore ?? [];
      setMatches(list.map((e) => ({
        id: String(e.idEvent),
        league: String(e.strLeague ?? sport),
        home: String(e.strHomeTeam),
        away: String(e.strAwayTeam),
        homeScore: String(e.intHomeScore ?? "-"),
        awayScore: String(e.intAwayScore ?? "-"),
        status: String(e.strStatus ?? e.strProgress ?? "Live"),
        time: `${e.dateEvent ?? ""} ${(e.strTime ?? "").slice(0, 5)}`,
        isLive: (e.strStatus ?? "").toLowerCase() !== "ns",
      })));
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!active) return;
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
     
  }, [active, sport]);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {!loading && matches.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No live {sport.toLowerCase()} matches right now.
        </Card>
      )}
      <div className="space-y-2">{matches.map((m) => <MatchCard key={m.id} m={m} />)}</div>
    </div>
  );
}

function MatchCard({ m }: { m: Match }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.league}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex-1 truncate font-semibold">{m.home}</div>
        <div className="text-lg font-black tabular-nums">{m.homeScore} : {m.awayScore}</div>
        <div className="flex-1 truncate text-right font-semibold">{m.away}</div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {m.isLive && <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}
          {m.status}
        </span>
        <span>{m.time}</span>
      </div>
    </Card>
  );
}
