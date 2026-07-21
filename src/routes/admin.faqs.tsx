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
import { Plus, Pencil, Trash2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { adminUpsertRow, adminDeleteRow } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/faqs")({ component: Page });
const empty = { question: "", answer: "", category: "General", sort_order: 0, active: true };

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("faqs").select("*").order("sort_order");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      await adminUpsertRow({ data: { table: "faqs", id: edit?.id, values: { ...f, sort_order: Number(f.sort_order) } } });
      toast.success("Saved"); setOpen(false); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function del(id: string) {
    if (!confirm("Delete FAQ?")) return;
    try { await adminDeleteRow({ data: { table: "faqs", id } }); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><HelpCircle className="w-6 h-6" /> FAQs</h1><p className="text-muted-foreground">Manage help center content.</p></div>
        <Button onClick={() => { setEdit(null); setF(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> New FAQ</Button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-muted-foreground">{r.category} {!r.active && "· hidden"}</div>
                <div className="font-medium">{r.question}</div>
                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.answer}</div>
              </div>
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
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} FAQ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Question</Label><Input value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} /></div>
            <div><Label>Answer</Label><Textarea value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} rows={5} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
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
