import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { adminUpsertRow, adminDeleteRow } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/coupons")({ component: Page });

const empty = { code: "", kind: "wallet_credit", amount: 10, xp_amount: 0, max_redemptions: 100, per_user_limit: 1, expires_at: "", active: true, note: "" };

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEdit(null); setF(empty); setOpen(true); }
  function openEdit(r: any) { setEdit(r); setF({ ...r, expires_at: r.expires_at ? String(r.expires_at).slice(0, 16) : "", note: r.note ?? "" }); setOpen(true); }
  async function save() {
    try {
      const values = { ...f, code: String(f.code).toUpperCase(), amount: Number(f.amount), xp_amount: Number(f.xp_amount), max_redemptions: f.max_redemptions ? Number(f.max_redemptions) : null, per_user_limit: Number(f.per_user_limit), expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null };
      await adminUpsertRow({ data: { table: "coupons", id: edit?.id, values } });
      toast.success("Saved"); setOpen(false); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) {
    if (!confirm("Delete coupon?")) return;
    try { await adminDeleteRow({ data: { table: "coupons", id } }); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><Ticket className="w-6 h-6" /> Coupons & Gift Codes</h1><p className="text-muted-foreground">Create redeemable codes for wallet credit or XP.</p></div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New code</Button>
      </div>

      <Card className="p-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left p-2">Code</th><th className="text-left">Reward</th><th className="text-left">Used</th><th className="text-left">Expires</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2 font-mono">{r.code}{!r.active && <span className="ml-2 text-xs text-muted-foreground">(off)</span>}</td>
                <td>₹{r.amount} {r.xp_amount > 0 && `+ ${r.xp_amount} XP`}</td>
                <td>{r.redemptions}/{r.max_redemptions ?? "∞"}</td>
                <td className="text-xs">{r.expires_at ? new Date(r.expires_at).toLocaleString() : "—"}</td>
                <td className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} coupon</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="WELCOME50" /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></div>
            <div><Label>Amount ₹</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><Label>XP reward</Label><Input type="number" value={f.xp_amount} onChange={(e) => setF({ ...f, xp_amount: e.target.value })} /></div>
            <div><Label>Max redemptions</Label><Input type="number" value={f.max_redemptions ?? ""} onChange={(e) => setF({ ...f, max_redemptions: e.target.value })} placeholder="empty = ∞" /></div>
            <div><Label>Per-user limit</Label><Input type="number" value={f.per_user_limit} onChange={(e) => setF({ ...f, per_user_limit: e.target.value })} /></div>
            <div className="col-span-2"><Label>Expires at</Label><Input type="datetime-local" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></div>
            <div className="col-span-2"><Label>Note</Label><Input value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          </div>
          <Button className="mt-3 w-full" onClick={save}>Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
