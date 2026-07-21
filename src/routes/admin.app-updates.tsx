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
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { adminUpsertRow, adminDeleteRow } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/app-updates")({ component: Page });
const empty = { version: "1.0.0", message: "", url: "", force_update: false, active: true };

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("app_updates").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try { await adminUpsertRow({ data: { table: "app_updates", id: edit?.id, values: f } }); toast.success("Saved"); setOpen(false); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) { if (!confirm("Delete?")) return; try { await adminDeleteRow({ data: { table: "app_updates", id } }); load(); } catch (e: any) { toast.error(e?.message ?? "Failed"); } }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><Download className="w-6 h-6" /> App Updates</h1><p className="text-muted-foreground">Push update notices to users.</p></div>
        <Button onClick={() => { setEdit(null); setF(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> New</Button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-4 flex justify-between">
            <div>
              <div className="font-mono font-semibold">v{r.version} {r.force_update && <span className="text-xs text-destructive">FORCE</span>} {!r.active && <span className="text-xs text-muted-foreground">off</span>}</div>
              <div className="text-sm text-muted-foreground">{r.message}</div>
              {r.url && <a className="text-xs text-primary" href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a>}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setF(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} update</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Version</Label><Input value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></div>
            <div><Label>Message</Label><Textarea value={f.message ?? ""} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
            <div><Label>Download URL</Label><Input value={f.url ?? ""} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Force update</Label><Switch checked={f.force_update} onCheckedChange={(v) => setF({ ...f, force_update: v })} /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
