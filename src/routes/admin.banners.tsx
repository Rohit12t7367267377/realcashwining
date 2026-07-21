import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Image } from "lucide-react";
import { toast } from "sonner";
import { adminUpsertRow, adminDeleteRow } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/banners")({ component: Page });
const empty = { title: "", subtitle: "", image_url: "", link_url: "", cta_label: "Explore", active: true, sort_order: 0 };

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("banners").select("*").order("sort_order");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      await adminUpsertRow({ data: { table: "banners", id: edit?.id, values: { ...f, sort_order: Number(f.sort_order) } } });
      toast.success("Saved"); setOpen(false); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) {
    if (!confirm("Delete banner?")) return;
    try { await adminDeleteRow({ data: { table: "banners", id } }); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><Image className="w-6 h-6" /> Banners</h1><p className="text-muted-foreground">Promotional banners on the home page.</p></div>
        <Button onClick={() => { setEdit(null); setF(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> New banner</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            {r.image_url && <img src={r.image_url} className="w-full h-32 object-cover rounded mb-2" alt="" />}
            <div className="flex justify-between">
              <div><div className="font-bold">{r.title}</div><div className="text-xs text-muted-foreground">{r.subtitle}</div></div>
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
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} banner</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Subtitle</Label><Input value={f.subtitle ?? ""} onChange={(e) => setF({ ...f, subtitle: e.target.value })} /></div>
            <div><Label>Image URL</Label><Input value={f.image_url ?? ""} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Link URL</Label><Input value={f.link_url ?? ""} onChange={(e) => setF({ ...f, link_url: e.target.value })} placeholder="/contest/…" /></div>
              <div><Label>CTA label</Label><Input value={f.cta_label ?? ""} onChange={(e) => setF({ ...f, cta_label: e.target.value })} /></div>
              <div><Label>Sort</Label><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></div>
              <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></div>
            </div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
