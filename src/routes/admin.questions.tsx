import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/questions")({ component: Page });

type Q = { id: string; category_id: string; question: string; options: string[]; correct_index: number; explanation: string | null; difficulty: string | null };
type Cat = { id: string; name: string };

function Page() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [rows, setRows] = useState<Q[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Q | null>(null);
  const [form, setForm] = useState({
    category_id: "",
    question: "",
    options: ["", "", "", ""],
    correct_index: 0,
    explanation: "",
    difficulty: "medium",
  });

  async function load() {
    const cQ = supabase.from("categories").select("id, name").order("sort_order");
    const qQ = filter === "all"
      ? supabase.from("questions").select("*").order("created_at", { ascending: false }).limit(200)
      : supabase.from("questions").select("*").eq("category_id", filter).order("created_at", { ascending: false });
    const [c, q] = await Promise.all([cQ, qQ]);
    setCats((c.data ?? []) as Cat[]);
    setRows((q.data ?? []) as Q[]);
  }
  useEffect(() => { load(); }, [filter]);

  function openNew() {
    setEditing(null);
    setForm({ category_id: cats[0]?.id ?? "", question: "", options: ["", "", "", ""], correct_index: 0, explanation: "", difficulty: "medium" });
    setOpen(true);
  }
  function openEdit(r: Q) {
    setEditing(r);
    setForm({
      category_id: r.category_id, question: r.question,
      options: Array.isArray(r.options) ? r.options : ["", "", "", ""],
      correct_index: r.correct_index, explanation: r.explanation ?? "", difficulty: r.difficulty ?? "medium",
    });
    setOpen(true);
  }
  async function save() {
    if (!form.category_id) return toast.error("Pick a category");
    if (!form.question.trim()) return toast.error("Question required");
    if (form.options.some((o) => !o.trim())) return toast.error("All 4 options required");
    const res = editing
      ? await supabase.from("questions").update(form).eq("id", editing.id)
      : await supabase.from("questions").insert(form);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Saved"); setOpen(false); load(); }
  }
  async function del(id: string) {
    if (!confirm("Delete question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Questions</h1>
          <p className="text-muted-foreground">MCQ bank for contests.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} disabled={!cats.length}><Plus className="w-4 h-4 mr-1" /> Add Question</Button>
        </div>
      </div>

      <Card className="divide-y">
        {rows.length === 0 && <div className="p-8 text-center text-muted-foreground">No questions. {!cats.length && "Add a category first."}</div>}
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="font-medium">{r.question}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {cats.find((c) => c.id === r.category_id)?.name} · {r.difficulty} · Answer: <strong>{r.options[r.correct_index]}</strong>
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} question</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-auto">
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Question</Label><Textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={2} /></div>
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="radio" checked={form.correct_index === i} onChange={() => setForm({ ...form, correct_index: i })} title="Correct" />
                <Input value={opt} onChange={(e) => {
                  const o = [...form.options]; o[i] = e.target.value; setForm({ ...form, options: o });
                }} placeholder={`Option ${i + 1}`} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Select the radio next to the correct option.</p>
            <div><Label>Explanation</Label><Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} /></div>
            <div>
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
