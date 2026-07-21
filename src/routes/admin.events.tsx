import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminListEvents, upsertEvent, deleteEvent } from "@/lib/admin-gamification.functions";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/events")({
  head: () => ({ meta: [{ title: "Admin · Seasonal Events" }] }),
  component: AdminEventsPage,
});

type EventForm = {
  id?: string;
  name: string;
  description: string;
  banner_url: string;
  starts_at: string;
  ends_at: string;
  reward_pool: number;
  bonus_xp_multiplier: number;
  active: boolean;
};

const EMPTY: EventForm = { name: "", description: "", banner_url: "", starts_at: "", ends_at: "", reward_pool: 0, bonus_xp_multiplier: 1, active: true };

function toIso(local: string) { return local ? new Date(local).toISOString() : ""; }
function fromIso(iso: string | null) { if (!iso) return ""; const d = new Date(iso); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off*60000).toISOString().slice(0,16); }

function AdminEventsPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListEvents);
  const save = useServerFn(upsertEvent);
  const del = useServerFn(deleteEvent);
  const { data: events = [] } = useQuery({ queryKey: ["admin-events"], queryFn: () => list() });
  const [form, setForm] = useState<EventForm>(EMPTY);

  const saveMut = useMutation({
    mutationFn: () => save({
      data: {
        id: form.id,
        values: {
          name: form.name,
          description: form.description || null,
          banner_url: form.banner_url || null,
          starts_at: toIso(form.starts_at),
          ends_at: toIso(form.ends_at),
          reward_pool: Number(form.reward_pool),
          bonus_xp_multiplier: Number(form.bonus_xp_multiplier),
          active: form.active,
        },
      },
    }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-events"] }); setForm(EMPTY); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
  });

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold">Seasonal Events</h1>
      <p className="text-sm text-muted-foreground">Limited-time events with boosted XP and prize pools.</p>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-bold uppercase">{form.id ? "Edit Event" : "New Event"}</h2>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Banner URL</Label><Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts At</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><Label>Ends At</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Reward Pool (₹)</Label><Input type="number" value={form.reward_pool} onChange={(e) => setForm({ ...form, reward_pool: Number(e.target.value) })} /></div>
              <div><Label>XP Multiplier</Label><Input type="number" step="0.1" value={form.bonus_xp_multiplier} onChange={(e) => setForm({ ...form, bonus_xp_multiplier: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <div className="flex gap-2">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" /> {form.id ? "Update" : "Create"}</Button>
              {form.id && <Button variant="outline" onClick={() => setForm(EMPTY)}>Cancel</Button>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-bold uppercase">All Events</h2>
          <div className="space-y-2 max-h-[70vh] overflow-auto">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-bold">{e.name} {!e.active && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">off</span>}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(e.starts_at).toLocaleString()} → {new Date(e.ends_at).toLocaleString()} · ₹{e.reward_pool} · ×{e.bonus_xp_multiplier} XP</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setForm({
                    id: e.id, name: e.name, description: e.description ?? "", banner_url: e.banner_url ?? "",
                    starts_at: fromIso(e.starts_at), ends_at: fromIso(e.ends_at), reward_pool: Number(e.reward_pool), bonus_xp_multiplier: Number(e.bonus_xp_multiplier), active: e.active,
                  })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && delMut.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
