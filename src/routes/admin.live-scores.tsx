import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Radio } from "lucide-react";
import { toast } from "sonner";
import { upsertLiveScore, deleteLiveScore } from "@/lib/admin-live-scores.functions";

export const Route = createFileRoute("/admin/live-scores")({ component: Page });

type Score = {
  id: string;
  sport: string;
  league: string | null;
  home_team: string;
  away_team: string;
  home_score: string;
  away_score: string;
  status: string;
  match_time: string | null;
  is_live: boolean;
  sort_order: number;
};

const empty = {
  sport: "Cricket", league: "", home_team: "", away_team: "",
  home_score: "-", away_score: "-", status: "Live", match_time: "",
  is_live: true, sort_order: 0,
};

function Page() {
  const [rows, setRows] = useState<Score[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Score | null>(null);
  const [form, setForm] = useState(empty);

  async function load() {
    const { data } = await supabase.from("live_scores").select("*").order("sort_order").order("created_at", { ascending: false });
    setRows((data ?? []) as Score[]);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(r: Score) {
    setEditing(r);
    setForm({
      sport: r.sport, league: r.league ?? "", home_team: r.home_team, away_team: r.away_team,
      home_score: r.home_score, away_score: r.away_score, status: r.status,
      match_time: r.match_time ?? "", is_live: r.is_live, sort_order: r.sort_order,
    });
    setOpen(true);
  }
  async function save() {
    try {
      await upsertLiveScore({ data: { id: editing?.id, values: { ...form, league: form.league || null, match_time: form.match_time || null } } });
      toast.success("Saved");
      setOpen(false); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) {
    if (!confirm("Delete this live score?")) return;
    try { await deleteLiveScore({ data: { id } }); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Radio className="w-6 h-6 text-destructive" /> Live Scores</h1>
          <p className="text-muted-foreground">Post real-time match scores users see on the Live Scores page.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add Score</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-muted-foreground">{r.sport}{r.league ? ` · ${r.league}` : ""}</div>
                <div className="mt-1 flex items-center gap-2 font-semibold">
                  <span className="truncate">{r.home_team}</span>
                  <span className="text-lg font-black tabular-nums">{r.home_score} : {r.away_score}</span>
                  <span className="truncate">{r.away_team}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{r.status}{r.match_time ? ` · ${r.match_time}` : ""}{!r.is_live && " · Hidden"}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {!rows.length && <Card className="p-8 text-center text-muted-foreground md:col-span-2">No live scores yet.</Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} live score</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sport</Label><Input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} placeholder="Cricket" /></div>
              <div><Label>League / Series</Label><Input value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} placeholder="IPL 2026" /></div>
              <div><Label>Home team</Label><Input value={form.home_team} onChange={(e) => setForm({ ...form, home_team: e.target.value })} /></div>
              <div><Label>Away team</Label><Input value={form.away_team} onChange={(e) => setForm({ ...form, away_team: e.target.value })} /></div>
              <div><Label>Home score</Label><Input value={form.home_score} onChange={(e) => setForm({ ...form, home_score: e.target.value })} placeholder="180/4" /></div>
              <div><Label>Away score</Label><Input value={form.away_score} onChange={(e) => setForm({ ...form, away_score: e.target.value })} placeholder="120/3" /></div>
              <div><Label>Status</Label><Input value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} placeholder="Live · 18.2 overs" /></div>
              <div><Label>Match time</Label><Input value={form.match_time} onChange={(e) => setForm({ ...form, match_time: e.target.value })} placeholder="Today 7:30 PM" /></div>
              <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Show as Live</Label><Switch checked={form.is_live} onCheckedChange={(v) => setForm({ ...form, is_live: v })} /></div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
