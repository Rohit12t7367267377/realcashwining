import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Bell, Pencil } from "lucide-react";
import { toast } from "sonner";
import { adminUpsertRow, adminDeleteRow } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/broadcasts")({ component: Page });
const empty = { title: "", body: "", audience: "all", active: true };

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try { await adminUpsertRow({ data: { table: "broadcasts", id: edit?.id, values: f } }); toast.success("Saved"); setOpen(false); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) {
    if (!confirm("Delete?")) return;
    try { await adminDeleteRow({ data: { table: "broadcasts", id } }); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><Bell className="w-6 h-6" /> Notifications</h1><p className="text-muted-foreground">Broadcast in-app announcements to all users.</p></div>
        <Button onClick={() => { setEdit(null); setF(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> New</Button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex justify-between">
              <div><div className="font-semibold">{r.title} {!r.active && <span className="text-xs text-muted-foreground">(off)</span>}</div><div className="text-sm text-muted-foreground">{r.body}</div></div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setF(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} notification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Body</Label><Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={4} /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
