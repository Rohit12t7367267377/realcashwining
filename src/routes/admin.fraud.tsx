import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { adminResolveFraud } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/fraud")({ component: Page });

function Page() {
  const [flags, setFlags] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    const { data: f } = await supabase.from("fraud_flags").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(50);
    setFlags(f ?? []);
    const { data: e } = await supabase.from("anticheat_events").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(50);
    setEvents(e ?? []);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id: string) {
    try { await adminResolveFraud({ data: { id, resolved: true, admin_note: notes[id] } }); toast.success("Resolved"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-destructive" /> Fraud & Anti-Cheat</h1>
      <p className="text-muted-foreground mb-6">Review flagged users and cheat events.</p>

      <h2 className="font-semibold mb-2">Fraud flags</h2>
      <div className="space-y-2 mb-6">
        {flags.map((r) => (
          <Card key={r.id} className={`p-3 ${r.resolved ? "opacity-60" : ""}`}>
            <div className="flex justify-between gap-4">
              <div className="flex-1"><div className="text-sm"><b>{r.profiles?.full_name ?? r.user_id.slice(0, 8)}</b> · <span className="uppercase text-xs">{r.severity}</span></div><div className="text-sm">{r.reason}</div><div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div></div>
              {!r.resolved && <div className="w-56 space-y-1"><Textarea rows={1} placeholder="Note" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} /><Button size="sm" onClick={() => resolve(r.id)}><Check className="w-4 h-4 mr-1" /> Resolve</Button></div>}
            </div>
          </Card>
        ))}
        {!flags.length && <Card className="p-6 text-center text-muted-foreground text-sm">No flags.</Card>}
      </div>

      <h2 className="font-semibold mb-2">Anti-cheat events (recent)</h2>
      <Card className="p-3">
        <table className="w-full text-xs">
          <thead><tr className="border-b"><th className="text-left p-1">User</th><th className="text-left">Event</th><th className="text-left">Severity</th><th className="text-left">When</th></tr></thead>
          <tbody>
            {events.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-1">{r.profiles?.full_name ?? r.user_id?.slice(0, 8) ?? "—"}</td>
                <td>{r.event_type}</td>
                <td className="uppercase">{r.severity}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!events.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No events.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
