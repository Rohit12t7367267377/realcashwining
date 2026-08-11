import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, BookOpenCheck, ListChecks, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  listReadingPassagesAdmin,
  listReadingQuestionsAdmin,
  listReadingAttemptsAdmin,
  upsertReadingPassage,
  deleteReadingPassage,
  upsertReadingQuestion,
  deleteReadingQuestion,
} from "@/lib/admin-reading.functions";

export const Route = createFileRoute("/admin/reading")({ component: Page });

type Passage = {
  id: string;
  title: string;
  passage: string;
  category_id: string | null;
  reading_seconds: number;
  quiz_seconds: number;
  num_questions: number;
  difficulty: string;
  marks_per_question: number;
  negative_marks: number;
  keep_passage_visible: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_explanations: boolean;
  entry_fee: number;
  prize_pool: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};
type RQ = {
  id: string;
  passage_id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  marks: number | null;
  sort_order: number;
};

const READING_PRESETS = [30, 60, 120, 180, 300];

function toLocal(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const emptyPassage = {
  title: "",
  passage: "",
  category_id: "",
  reading_seconds: 60,
  quiz_seconds: 300,
  num_questions: 5,
  difficulty: "medium",
  marks_per_question: 1,
  negative_marks: 0,
  keep_passage_visible: false,
  shuffle_questions: false,
  shuffle_options: false,
  show_explanations: true,
  entry_fee: 0,
  prize_pool: 0,
  active: false,
  starts_at: "",
  ends_at: "",
};

function Page() {
  const [rows, setRows] = useState<Passage[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Passage | null>(null);
  const [form, setForm] = useState({ ...emptyPassage });
  const [selected, setSelected] = useState<Passage | null>(null);
  const [questions, setQuestions] = useState<RQ[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [qOpen, setQOpen] = useState(false);
  const [qEditing, setQEditing] = useState<RQ | null>(null);
  const [qForm, setQForm] = useState({
    question: "",
    options: ["", "", "", ""] as string[],
    correct_index: 0,
    explanation: "",
    marks: "" as string,
    sort_order: 0,
  });

  const load = useCallback(async () => {
    try {
      const [list, c] = await Promise.all([
        listReadingPassagesAdmin(),
        supabase.from("categories").select("id, name").order("sort_order"),
      ]);
      setRows(list as unknown as Passage[]);
      setCats((c.data ?? []) as { id: string; name: string }[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (p: Passage) => {
    setSelected(p);
    try {
      const [qs, ats] = await Promise.all([
        listReadingQuestionsAdmin({ data: { passage_id: p.id } }),
        listReadingAttemptsAdmin({ data: { passage_id: p.id } }),
      ]);
      setQuestions(qs as unknown as RQ[]);
      setAttempts(ats as any[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load questions");
    }
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...emptyPassage });
    setOpen(true);
  }
  function openEdit(p: Passage) {
    setEditing(p);
    setForm({
      title: p.title,
      passage: p.passage,
      category_id: p.category_id ?? "",
      reading_seconds: p.reading_seconds,
      quiz_seconds: p.quiz_seconds,
      num_questions: p.num_questions,
      difficulty: p.difficulty,
      marks_per_question: Number(p.marks_per_question),
      negative_marks: Number(p.negative_marks),
      keep_passage_visible: p.keep_passage_visible,
      shuffle_questions: p.shuffle_questions,
      shuffle_options: p.shuffle_options,
      show_explanations: p.show_explanations,
      entry_fee: Number(p.entry_fee),
      prize_pool: Number(p.prize_pool),
      active: p.active,
      starts_at: toLocal(p.starts_at),
      ends_at: toLocal(p.ends_at),
    });
    setOpen(true);
  }

  async function save() {
    try {
      const values = {
        ...form,
        category_id: form.category_id || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      const res = await upsertReadingPassage({ data: editing ? { id: editing.id, values } : { values } });
      toast.success("Saved");
      setOpen(false);
      await load();
      if (!editing && res?.id) {
        const created = { ...(values as any), id: res.id } as Passage;
        loadDetail(created);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function del(p: Passage) {
    if (!confirm(`Delete "${p.title}" with all its questions and attempts?`)) return;
    try {
      await deleteReadingPassage({ data: { id: p.id } });
      toast.success("Deleted");
      if (selected?.id === p.id) { setSelected(null); setQuestions([]); setAttempts([]); }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  function openNewQuestion() {
    setQEditing(null);
    setQForm({ question: "", options: ["", "", "", ""], correct_index: 0, explanation: "", marks: "", sort_order: questions.length });
    setQOpen(true);
  }
  function openEditQuestion(q: RQ) {
    setQEditing(q);
    const opts = Array.isArray(q.options) && q.options.length >= 2 ? [...q.options] : ["", "", "", ""];
    setQForm({
      question: q.question,
      options: opts,
      correct_index: q.correct_index,
      explanation: q.explanation ?? "",
      marks: q.marks === null ? "" : String(q.marks),
      sort_order: q.sort_order,
    });
    setQOpen(true);
  }

  async function saveQuestion() {
    if (!selected) return;
    try {
      if (!qForm.question.trim()) throw new Error("Write the question first");
      // Keep only filled options, and follow the correct answer to its new position.
      const kept: { text: string; index: number }[] = qForm.options
        .map((o, i) => ({ text: o.trim(), index: i }))
        .filter((o) => o.text.length > 0);
      if (kept.length < 2) throw new Error("Fill at least 2 options");
      const correct = kept.findIndex((o) => o.index === qForm.correct_index);
      if (correct < 0) throw new Error("The option you marked correct is empty — fill it or mark another one");
      const values = {
        passage_id: selected.id,
        question: qForm.question.trim(),
        options: kept.map((o) => o.text),
        correct_index: correct,
        explanation: qForm.explanation.trim() || null,
        marks: qForm.marks === "" ? null : Number(qForm.marks),
        sort_order: qForm.sort_order,
      };
      await upsertReadingQuestion({ data: qEditing ? { id: qEditing.id, values } : { values } });
      toast.success("Question saved");
      setQOpen(false);
      loadDetail(selected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save question");
    }
  }


  async function delQuestion(q: RQ) {
    if (!selected || !confirm("Delete this question?")) return;
    try {
      await deleteReadingQuestion({ data: { id: q.id } });
      toast.success("Deleted");
      loadDetail(selected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold"><BookOpenCheck className="h-7 w-7" /> Reading Comprehension</h1>
          <p className="text-muted-foreground">Create unlimited passage-based quizzes with timed reading, then timed questions.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> New Passage Quiz</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card className="divide-y self-start">
          {rows.length === 0 && <div className="p-8 text-center text-muted-foreground">No passage quizzes yet.</div>}
          {rows.map((r) => (
            <div key={r.id} className={`flex items-center justify-between gap-2 p-4 ${selected?.id === r.id ? "bg-muted/50" : ""}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => loadDetail(r)}>
                <div className="truncate font-medium">
                  {r.title} {!r.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Read {r.reading_seconds}s · Quiz {Math.round(r.quiz_seconds / 60)}m · {r.num_questions} Q · {r.difficulty}
                </div>
              </button>
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </Card>

        <div>
          {!selected && <Card className="p-8 text-center text-muted-foreground">Select a passage quiz to manage its questions and results.</Card>}
          {selected && (
            <div className="space-y-6">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold">{selected.title}</h2>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{selected.passage}</p>
                  </div>
                  <Button onClick={openNewQuestion}><Plus className="mr-1 h-4 w-4" /> Add Question</Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Info label="Reading time" value={`${selected.reading_seconds}s`} />
                  <Info label="Quiz time" value={`${selected.quiz_seconds}s`} />
                  <Info label="Marks / Q" value={String(selected.marks_per_question)} />
                  <Info label="Negative" value={String(selected.negative_marks)} />
                  <Info label="Passage in quiz" value={selected.keep_passage_visible ? "Visible" : "Hidden"} />
                  <Info label="Shuffle Q" value={selected.shuffle_questions ? "Yes" : "No"} />
                  <Info label="Shuffle options" value={selected.shuffle_options ? "Yes" : "No"} />
                  <Info label="Explanations" value={selected.show_explanations ? "Shown" : "Hidden"} />
                </div>
              </Card>

              <Card className="divide-y">
                <div className="flex items-center gap-2 p-4 text-sm font-bold"><ListChecks className="h-4 w-4" /> Questions ({questions.length})</div>
                {questions.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No questions yet.</div>}
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-start justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{i + 1}. {q.question}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.options.map((o, oi) => (
                          <span key={oi} className={`rounded px-2 py-0.5 text-xs ${oi === q.correct_index ? "bg-success/15 font-bold text-success" : "bg-muted text-muted-foreground"}`}>
                            {String.fromCharCode(65 + oi)}. {o}
                          </span>
                        ))}
                      </div>
                      {q.explanation && <div className="mt-1 text-xs text-muted-foreground">💡 {q.explanation}</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditQuestion(q)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => delQuestion(q)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </Card>

              <Card className="divide-y">
                <div className="flex items-center gap-2 p-4 text-sm font-bold"><BarChart3 className="h-4 w-4" /> Results &amp; analytics ({attempts.length})</div>
                {attempts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No attempts yet.</div>}
                {attempts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.status} · {a.reading_completed ? "read ✓" : "read ✗"} · {a.quiz_seconds_spent}s taken
                        {a.submitted_at ? ` · ${new Date(a.submitted_at).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 text-xs font-bold">
                      <span className="rounded bg-success/15 px-2 py-0.5 text-success">✔ {a.correct_count}</span>
                      <span className="rounded bg-destructive/15 px-2 py-0.5 text-destructive">✖ {a.wrong_count}</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">− {a.unanswered_count}</span>
                      <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">{Number(a.score).toFixed(2)} pts</span>
                      <span className="rounded bg-muted px-2 py-0.5">{Number(a.accuracy).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Passage dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} reading comprehension quiz</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Passage title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Full passage / paragraph</Label>
              <Textarea rows={10} value={form.passage} onChange={(e) => setForm({ ...form, passage: e.target.value })} placeholder="Paste the full reading passage here. Line breaks are preserved." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category (optional)</Label>
                <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div>
              <Label>Reading time (seconds)</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                {READING_PRESETS.map((s) => (
                  <Button key={s} type="button" size="sm" variant={form.reading_seconds === s ? "default" : "outline"} onClick={() => setForm({ ...form, reading_seconds: s })}>
                    {s < 60 ? `${s} sec` : `${s / 60} min`}
                  </Button>
                ))}
              </div>
              <Input type="number" min={5} value={form.reading_seconds} onChange={(e) => setForm({ ...form, reading_seconds: Number(e.target.value) })} placeholder="Custom seconds" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Quiz time (seconds)</Label><Input type="number" min={10} value={form.quiz_seconds} onChange={(e) => setForm({ ...form, quiz_seconds: Number(e.target.value) })} /></div>
              <div><Label>Number of questions</Label><Input type="number" min={1} value={form.num_questions} onChange={(e) => setForm({ ...form, num_questions: Number(e.target.value) })} /></div>
              <div><Label>Marks per question</Label><Input type="number" step="0.25" min={0} value={form.marks_per_question} onChange={(e) => setForm({ ...form, marks_per_question: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Negative marks (per wrong)</Label><Input type="number" step="0.25" min={0} value={form.negative_marks} onChange={(e) => setForm({ ...form, negative_marks: Number(e.target.value) })} /></div>
              <div><Label>Entry fee ₹</Label><Input type="number" min={0} value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: Number(e.target.value) })} /></div>
              <div><Label>Prize pool ₹</Label><Input type="number" min={0} value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts at (optional)</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><Label>Ends at (optional)</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
            </div>
            <Toggle label="Keep passage visible during quiz" hint="Off = passage is hidden once the reading timer ends" checked={form.keep_passage_visible} onChange={(v) => setForm({ ...form, keep_passage_visible: v })} />
            <Toggle label="Shuffle / randomize question order" checked={form.shuffle_questions} onChange={(v) => setForm({ ...form, shuffle_questions: v })} />
            <Toggle label="Shuffle options" checked={form.shuffle_options} onChange={(v) => setForm({ ...form, shuffle_options: v })} />
            <Toggle label="Show explanations in results" checked={form.show_explanations} onChange={(v) => setForm({ ...form, show_explanations: v })} />
            <Toggle label="Active (visible to students)" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question dialog */}
      <Dialog open={qOpen} onOpenChange={setQOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{qEditing ? "Edit" : "New"} question</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Question</Label><Textarea rows={3} value={qForm.question} onChange={(e) => setQForm({ ...qForm, question: e.target.value })} /></div>
            {qForm.options.map((o, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Option {String.fromCharCode(65 + i)}</Label>
                  <Input value={o} onChange={(e) => {
                    const next = [...qForm.options];
                    next[i] = e.target.value;
                    setQForm({ ...qForm, options: next });
                  }} />
                </div>
                <Button type="button" size="sm" variant={qForm.correct_index === i ? "default" : "outline"} onClick={() => setQForm({ ...qForm, correct_index: i })}>
                  {qForm.correct_index === i ? "Correct" : "Mark correct"}
                </Button>
              </div>
            ))}
            <div><Label>Explanation (optional)</Label><Textarea rows={2} value={qForm.explanation} onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Marks (blank = passage default)</Label><Input type="number" step="0.25" value={qForm.marks} onChange={(e) => setQForm({ ...qForm, marks: e.target.value })} /></div>
              <div><Label>Order</Label><Input type="number" value={qForm.sort_order} onChange={(e) => setQForm({ ...qForm, sort_order: Number(e.target.value) })} /></div>
            </div>
            <Button onClick={saveQuestion} className="w-full">Save question</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
