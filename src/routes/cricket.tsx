import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Radio } from "lucide-react";

export const Route = createFileRoute("/cricket")({
  head: () => ({ meta: [
    { title: "Live Cricket Scores — Cash Winning League" },
    { name: "description", content: "Live scores for cricket matches happening right now." },
    { property: "og:title", content: "Live Cricket Scores" },
    { property: "og:description", content: "Follow every live match in one place." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Page,
});

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(60);

  async function load() {
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from("cricket_matches").select("*").order("is_live", { ascending: false }).order("date_time", { ascending: false }).limit(20),
      supabase.from("app_settings").select("value").eq("key", "cricket_refresh_seconds").maybeSingle(),
    ]);
    setRows(m ?? []);
    if (s?.value) setRefresh(Number(s.value) || 60);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, Math.max(30, refresh) * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><Radio className="w-7 h-7 text-destructive" /> Live Cricket</h1>
        <p className="text-muted-foreground mb-6">Real-time scores. Auto-refreshes every {refresh}s.</p>
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.id} to="/cricket/$id" params={{ id: r.id }} className="block">
            <Card className="p-4 transition hover:shadow-glow">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-muted-foreground">{r.match_type} · {r.venue}</div>
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.status}</div>
                </div>
                {r.is_live && <span className="text-xs font-bold text-destructive whitespace-nowrap">● LIVE</span>}
              </div>
              <div className="mt-2 grid grid-cols-2 text-sm">
                <div><b>{r.team_a}</b><div className="font-mono">{r.score_a || "—"}</div></div>
                <div className="text-right"><b>{r.team_b}</b><div className="font-mono">{r.score_b || "—"}</div></div>
              </div>
            </Card>
            </Link>
          ))}
          {!rows.length && <Card className="p-8 text-center text-muted-foreground">No matches available. Admin can refresh from Cricket API settings.</Card>}
        </div>
      </div>
    </AppShell>
  );
}
