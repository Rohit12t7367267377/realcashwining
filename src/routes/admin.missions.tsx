import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListMissions, upsertMission, deleteMission } from "@/lib/admin-gamification.functions";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/missions")({
  head: () => ({ meta: [{ title: "Admin · Missions" }] }),
  component: AdminMissionsPage,
});

type MissionRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  kind: "daily" | "weekly" | "monthly";
  goal_type: "play_quiz" | "win_contest" | "correct_answers" | "xp_gain" | "deposit";
  goal_value: number;
  reward_xp: number;
  reward_coins: number;
  reward_box_tier: string | null;
  active: boolean;
  sort_order: number;
};

const EMPTY: Omit<MissionRow, "id"> = {
  code: "", title: "", description: "", kind: "daily", goal_type: "play_quiz",
  goal_value: 1, reward_xp: 30, reward_coins: 0, reward_box_tier: null, active: true, sort_order: 0,
};

function AdminMissionsPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListMissions);
  const save = useServerFn(upsertMission);
  const del = useServerFn(deleteMission);

  const { data: missions = [] } = useQuery({ queryKey: ["admin-missions"], queryFn: () => list() });
  const [form, setForm] = useState<Omit<MissionRow, "id"> & { id?: string }>(EMPTY);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { id: form.id, values: { ...form, description: form.description || null, reward_box_tier: form.reward_box_tier || null } } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-missions"] }); setForm(EMPTY); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-missions"] }); },
  });

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold">Missions</h1>
      <p className="text-sm text-muted-foreground">Create and manage daily / weekly / monthly missions.</p>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-bold uppercase">{form.id ? "Edit Mission" : "New Mission"}</h2>
          <div className="grid gap-3">
            <div><Label>Code (unique)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as MissionRow["kind"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Goal Type</Label>
                <Select value={form.goal_type} onValueChange={(v) => setForm({ ...form, goal_type: v as MissionRow["goal_type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="play_quiz">Play Quizzes</SelectItem>
                    <SelectItem value="win_contest">Win Contests</SelectItem>
                    <SelectItem value="correct_answers">Correct Answers</SelectItem>
                    <SelectItem value="xp_gain">XP Gained</SelectItem>
                    <SelectItem value="deposit">Deposit (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Goal Value</Label><Input type="number" value={form.goal_value} onChange={(e) => setForm({ ...form, goal_value: Number(e.target.value) })} /></div>
              <div><Label>Reward XP</Label><Input type="number" value={form.reward_xp} onChange={(e) => setForm({ ...form, reward_xp: Number(e.target.value) })} /></div>
              <div><Label>Reward Coins</Label><Input type="number" value={form.reward_coins} onChange={(e) => setForm({ ...form, reward_coins: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Box Tier (optional)</Label>
                <Select value={form.reward_box_tier ?? "none"} onValueChange={(v) => setForm({ ...form, reward_box_tier: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="common">Common</SelectItem>
                    <SelectItem value="rare">Rare</SelectItem>
                    <SelectItem value="epic">Epic</SelectItem>
                    <SelectItem value="legendary">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <div className="flex gap-2">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-gradient-primary">
                <Plus className="mr-1 h-4 w-4" /> {form.id ? "Update" : "Create"}
              </Button>
              {form.id && <Button variant="outline" onClick={() => setForm(EMPTY)}>Cancel</Button>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-bold uppercase">All Missions</h2>
          <div className="space-y-2 max-h-[70vh] overflow-auto">
            {missions.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold">{m.title} <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{m.kind}</span> {!m.active && <span className="ml-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">off</span>}</div>
                  <div className="text-[11px] text-muted-foreground">{m.goal_type} · goal {m.goal_value} · +{m.reward_xp} XP{Number(m.reward_coins) > 0 ? ` · +₹${m.reward_coins}` : ""}{m.reward_box_tier ? ` · 🎁 ${m.reward_box_tier}` : ""}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setForm({ ...(m as MissionRow) })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && delMut.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
