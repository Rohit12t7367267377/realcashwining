import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/contests")({ component: Page });

type Contest = {
  id: string; title: string; category_id: string | null; entry_fee: number; prize_pool: number; first_prize: number;
  duration_minutes: number; num_questions: number; contest_type: string; active: boolean; max_participants: number;
};
type Cat = { id: string; name: string };

const empty = {
  title: "", category_id: "", entry_fee: 20, prize_pool: 200, first_prize: 100,
  duration_minutes: 10, num_questions: 10, contest_type: "paid", active: true, max_participants: 100,
};

function Page() {
  const [rows, setRows] = useState<Contest[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contest | null>(null);
  const [form, setForm] = useState(empty);

  async function load() {
    const [c, ct] = await Promise.all([
      supabase.from("categories").select("id, name"),
      supabase.from("contests").select("*").order("created_at", { ascending: false }),
    ]);
    setCats((c.data ?? []) as Cat[]);
    setRows((ct.data ?? []) as Contest[]);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm({ ...empty, category_id: cats[0]?.id ?? "" }); setOpen(true); }
  function openEdit(r: Contest) {
    setEditing(r);
    setForm({
      title: r.title, category_id: r.category_id ?? "", entry_fee: Number(r.entry_fee), prize_pool: Number(r.prize_pool),
      first_prize: Number(r.first_prize), duration_minutes: r.duration_minutes, num_questions: r.num_questions,
      contest_type: r.contest_type, active: r.active, max_participants: r.max_participants ?? 100,
    });
    setOpen(true);
  }
  async function save() {
    const payload = { ...form, category_id: form.category_id || null };
    const res = editing
      ? await supabase.from("contests").update(payload).eq("id", editing.id)
      : await supabase.from("contests").insert(payload);
    if (res.error) toast.error(res.error.message); else { toast.success("Saved"); setOpen(false); load(); }
  }
  async function del(id: string) {
    if (!confirm("Delete contest?")) return;
    const { error } = await supabase.from("contests").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Contests</h1>
          <p className="text-muted-foreground">Paid & free quiz competitions.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add Contest</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-lg">{r.title}</div>
                <div className="text-xs text-muted-foreground">{cats.find((c) => c.id === r.category_id)?.name ?? "—"} · {r.contest_type}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div>Entry: <strong>₹{r.entry_fee}</strong></div>
              <div>Prize pool: <strong>₹{r.prize_pool}</strong></div>
              <div>1st: ₹{r.first_prize}</div>
              <div>{r.num_questions} Q · {r.duration_minutes}m</div>
              <div className="col-span-2">Max participants: <strong>{r.max_participants ?? "—"}</strong></div>
            </div>
            {!r.active && <div className="text-xs text-muted-foreground mt-2">Hidden</div>}
          </Card>
        ))}
        {!rows.length && <Card className="p-8 text-center text-muted-foreground md:col-span-2">No contests yet.</Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} contest</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-auto">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Entry fee ₹</Label><Input type="number" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: Number(e.target.value) })} /></div>
              <div><Label>Prize pool ₹</Label><Input type="number" value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: Number(e.target.value) })} /></div>
              <div><Label>1st prize ₹</Label><Input type="number" value={form.first_prize} onChange={(e) => setForm({ ...form, first_prize: Number(e.target.value) })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.contest_type} onValueChange={(v) => setForm({ ...form, contest_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="mega">Mega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label># Questions</Label><Input type="number" value={form.num_questions} onChange={(e) => setForm({ ...form, num_questions: Number(e.target.value) })} /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Max participants</Label><Input type="number" min={1} value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
