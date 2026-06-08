import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Radio } from "lucide-react";

export const Route = createFileRoute("/live-scores")({
  ssr: false,
  head: () => ({ meta: [{ title: "Live Sports Scores — CWL" }] }),
  component: LiveScores,
});

type Event = {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
  strProgress: string | null;
  strTime: string | null;
  dateEvent: string | null;
  strSport: string;
};

// TheSportsDB free public key "3" — no signup required
const API = "https://www.thesportsdb.com/api/v1/json/3";

function LiveScores() {
  const [tab, setTab] = useState("Cricket");
  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive animate-pulse" /> Live Scores
          </h1>
          <p className="text-xs text-muted-foreground">Real-time scores via TheSportsDB · may be delayed</p>
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
        {["Cricket", "Soccer", "Tennis", "Basketball"].map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            <SportFeed sport={s} active={tab === s} />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

function SportFeed({ sport, active }: { sport: string; active: boolean }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setErr(null);
    try {
      // Live events first
      const liveRes = await fetch(`${API}/livescore.php?s=${sport}`);
      const live = await liveRes.json();
      let evs: Event[] = (live?.events ?? live?.livescore ?? []) as Event[];
      if (!evs || !evs.length) {
        // Fall back to most recent finished/upcoming events
        const recRes = await fetch(`${API}/eventspastleague.php?id=4328`); // placeholder; use search
        const fb = await fetch(`${API}/searchevents.php?e=${encodeURIComponent(sport)}`);
        const j = await fb.json();
        evs = (j?.event ?? []).slice(0, 10) as Event[];
        void recRes;
      }
      setEvents(evs ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!active) return;
    fetchData();
    const t = setInterval(fetchData, 60_000);
    return () => clearInterval(t);
     
  }, [active, sport]);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="ghost" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {err && <Card className="p-4 text-sm text-destructive">{err}</Card>}
      {!loading && !events.length && !err && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No live {sport.toLowerCase()} matches right now. Check back soon.
        </Card>
      )}
      <div className="space-y-2">
        {events.map((e) => (
          <Card key={e.idEvent} className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.strLeague}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex-1 truncate font-semibold">{e.strHomeTeam}</div>
              <div className="text-lg font-black tabular-nums">
                {e.intHomeScore ?? "-"} : {e.intAwayScore ?? "-"}
              </div>
              <div className="flex-1 truncate text-right font-semibold">{e.strAwayTeam}</div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {e.strStatus && e.strStatus !== "NS" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                )}
                {e.strStatus || e.strProgress || "Scheduled"}
              </span>
              <span>{e.dateEvent} {e.strTime?.slice(0, 5)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
