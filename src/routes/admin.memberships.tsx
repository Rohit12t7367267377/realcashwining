import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Crown } from "lucide-react";
import { toast } from "sonner";
import { adminUpsertRow, adminDeleteRow } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/memberships")({ component: Page });

const empty = { code: "", name: "", description: "", price: 99, duration_days: 30, perks: "", active: true, sort_order: 0 };

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("memberships").select("*").order("sort_order");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEdit(null); setF(empty); setOpen(true); }
  function openEdit(r: any) {
    setEdit(r);
    setF({ ...r, perks: Array.isArray(r.perks) ? r.perks.join("\n") : "" });
    setOpen(true);
  }
  async function save() {
    try {
      const perks = String(f.perks || "").split("\n").map((s) => s.trim()).filter(Boolean);
      await adminUpsertRow({ data: { table: "memberships", id: edit?.id, values: { ...f, perks, price: Number(f.price), duration_days: Number(f.duration_days), sort_order: Number(f.sort_order) } } });
      toast.success("Saved"); setOpen(false); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) {
    if (!confirm("Delete plan?")) return;
    try { await adminDeleteRow({ data: { table: "memberships", id } }); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Crown className="w-6 h-6 text-yellow-500" /> VIP Memberships</h1>
          <p className="text-muted-foreground">Create paid membership tiers.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New plan</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-lg">{r.name} <span className="text-xs text-muted-foreground">({r.code})</span></div>
                <div className="text-2xl font-black">₹{r.price}<span className="text-xs font-normal text-muted-foreground"> / {r.duration_days}d</span></div>
                <div className="text-xs mt-1">{Array.isArray(r.perks) && r.perks.join(" · ")}</div>
                <div className="text-xs text-muted-foreground mt-1">{r.active ? "Active" : "Hidden"}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {!rows.length && <Card className="p-8 text-center text-muted-foreground md:col-span-2">No plans yet.</Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="pro" /></div>
              <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Pro" /></div>
              <div><Label>Price ₹</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
              <div><Label>Duration (days)</Label><Input type="number" value={f.duration_days} onChange={(e) => setF({ ...f, duration_days: e.target.value })} /></div>
              <div><Label>Sort order</Label><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></div>
              <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><Label>Perks (one per line)</Label><Textarea value={f.perks} onChange={(e) => setF({ ...f, perks: e.target.value })} placeholder="Ad-free\nExclusive contests\nBonus XP" /></div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
