import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { saveAppSetting } from "@/lib/admin-settings.functions";
import { refreshCricketMatches } from "@/lib/cricket.functions";
import { RefreshCw, Radio } from "lucide-react";

export const Route = createFileRoute("/admin/cricket")({ component: Page });

function Page() {
  const [enabled, setEnabled] = useState(true);
  const [key, setKey] = useState("");
  const [refresh, setRefresh] = useState(60);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: s } = await supabase.from("app_settings").select("*")
      .in("key", ["cricket_enabled", "cricket_api_key", "cricket_refresh_seconds"]);
    (s ?? []).forEach((r: any) => {
      if (r.key === "cricket_enabled") setEnabled(!!r.value);
      if (r.key === "cricket_api_key") setKey(String(r.value ?? "").replace(/^"|"$/g, ""));
      if (r.key === "cricket_refresh_seconds") setRefresh(Number(r.value) || 60);
    });
    const { data: m } = await supabase.from("cricket_matches").select("*").order("date_time", { ascending: false }).limit(30);
    setRows(m ?? []);
  }
  useEffect(() => { load(); }, []);

  async function saveAll() {
    try {
      await saveAppSetting({ data: { key: "cricket_enabled", value: enabled } });
      await saveAppSetting({ data: { key: "cricket_api_key", value: key } });
      await saveAppSetting({ data: { key: "cricket_refresh_seconds", value: refresh } });
      toast.success("Saved");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function doRefresh() {
    setBusy(true);
    try {
      const r = await refreshCricketMatches();
      toast.success(`Fetched ${r.total} matches (${r.upserted} saved)`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><Radio className="w-6 h-6" /> Cricket API</h1>
      <p className="text-muted-foreground mb-6">Configure live cricket score provider. Get a free API key at cricapi.com.</p>

      <div className="max-w-2xl space-y-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between"><Label>Enabled</Label><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
          <div><Label>CricAPI key</Label><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="paste-your-cricapi-key" className="font-mono" /></div>
          <div><Label>Refresh interval (seconds)</Label><Input type="number" min={30} value={refresh} onChange={(e) => setRefresh(Number(e.target.value))} /></div>
          <div className="flex gap-2">
            <Button onClick={saveAll}>Save</Button>
            <Button variant="outline" onClick={doRefresh} disabled={busy}><RefreshCw className={`w-4 h-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Refresh matches now</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Recent matches</h2>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm border-b pb-2">
                <div>
                  <div className="font-medium">{r.name} {r.is_live && <span className="ml-2 text-xs text-destructive font-bold">● LIVE</span>}</div>
                  <div className="text-xs text-muted-foreground">{r.status} · {r.venue}</div>
                </div>
                <div className="text-xs font-mono">{r.score_a} vs {r.score_b}</div>
              </div>
            ))}
            {!rows.length && <div className="text-sm text-muted-foreground">No matches cached yet. Click Refresh.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
