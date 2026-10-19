import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BoardBlockView } from "@/components/GuruBoardCanvas";
import { guruPracticeSet, guruEvaluateAnswer, guruClassroomProgress } from "@/lib/guru-classroom.functions";
import type { PracticeQuestion } from "@/lib/guru-engine.server";
import type { ClassroomPreferences } from "@/lib/classroom-preferences";
import { toast } from "sonner";
import { Loader2, Lightbulb, Eye, Plus, Send, ListChecks } from "lucide-react";

type Item = PracticeQuestion & { answer_text: string; hintShown: boolean; solutionShown: boolean; verdict?: "correct" | "partial" | "wrong"; feedback?: string; checking?: boolean };
type Difficulty = "basic" | "intermediate" | "advanced" | "exam";
type Kind = "mixed" | "numerical" | "conceptual" | "derivation";

/**
 * Topic-specific practice inside the existing classroom. There is no app-imposed question cap: each
 * request asks the model for a fresh set (previous prompts are sent so it avoids repeats). The real
 * limits are the model/provider's — errors and "no new questions" are reported, not hidden.
 * Weak areas are kept for this lesson session only (no new storage); XP/answer counts use the existing progress call.
 */
export function ClassroomPractice({ topic, level, preferences }: { topic: string; level: number; preferences: ClassroomPreferences }) {
  const practiceFn = useServerFn(guruPracticeSet);
  const evalFn = useServerFn(guruEvaluateAnswer);
  const saveFn = useServerFn(guruClassroomProgress);
  const [items, setItems] = useState<Item[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [kind, setKind] = useState<Kind>("mixed");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [weak, setWeak] = useState<string[]>([]);
  const seen = useRef<string[]>([]);
  const attempted = items.filter((i) => i.verdict).length;
  const correct = items.filter((i) => i.verdict === "correct").length;

  async function more() {
    setBusy(true);
    setNote(null);
    try {
      const res = await practiceFn({ data: { topic, difficulty, kind, count: 3, avoid: seen.current.slice(-40) } });
      if (!res.questions.length) {
        setNote("The AI did not return any new valid questions this time. Try again, or change difficulty/type.");
        return;
      }
      seen.current.push(...res.questions.map((q) => q.prompt));
      setItems((old) => [...old, ...res.questions.map((q) => ({ ...q, answer_text: "", hintShown: false, solutionShown: false }))]);
      if (res.questions.length < res.requested) setNote(`Got ${res.questions.length} of ${res.requested} (repeats were filtered out). Ask again for more.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not generate questions right now. Please retry.");
    } finally { setBusy(false); }
  }

  const patch = (id: string, p: Partial<Item>) => setItems((old) => old.map((i) => (i.id === id ? { ...i, ...p } : i)));

  async function check(q: Item) {
    const a = q.answer_text.trim();
    if (!a || q.checking) return;
    patch(q.id, { checking: true });
    try {
      const res = await evalFn({ data: { topic, question: q.prompt, expected: q.answer, answer: a, level } });
      patch(q.id, { verdict: res.verdict, feedback: res.feedback, checking: false });
      if (res.verdict !== "correct") setWeak((w) => [...new Set([...w, res.misunderstanding ?? `${q.kind} questions (${q.difficulty})`])].slice(-8));
      void saveFn({ data: { questions: 1, correct: res.verdict === "correct" ? 1 : 0, lessonCompleted: false } }).catch(() => {});
    } catch (err) {
      patch(q.id, { checking: false });
      toast.error(err instanceof Error ? err.message : "Could not check that answer");
    }
  }

  return (
    <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft" aria-label="Practice">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary"><ListChecks className="h-3.5 w-3.5" /> Practice: {topic}</div>
        <span className="text-xs text-muted-foreground" aria-live="polite">{correct}/{attempted} correct · {items.length} seen</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={difficulty} onValueChange={(v: Difficulty) => setDifficulty(v)}><SelectTrigger className="w-36" aria-label="Difficulty"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="basic">Basic</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem><SelectItem value="exam">Exam-style</SelectItem></SelectContent></Select>
        <Select value={kind} onValueChange={(v: Kind) => setKind(v)}><SelectTrigger className="w-36" aria-label="Question type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="mixed">Mixed</SelectItem><SelectItem value="numerical">Numerical</SelectItem><SelectItem value="conceptual">Conceptual</SelectItem><SelectItem value="derivation">Derivation</SelectItem></SelectContent></Select>
        <Button onClick={() => void more()} disabled={busy} className="bg-gradient-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {items.length ? "More questions" : "Start practice"}</Button>
      </div>
      {note && <p role="status" className="mt-2 text-sm text-muted-foreground">{note}</p>}
      {weak.length > 0 && <p className="mt-2 text-xs"><b>Revise these:</b> {weak.join(" • ")} <span className="text-muted-foreground">(this session only)</span></p>}

      <ol className="mt-3 space-y-3">
        {items.map((q, n) => (
          <li key={q.id} className="rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><span>Q{n + 1} · {q.difficulty} · {q.kind}</span>{q.verdict && <span>{q.verdict}</span>}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{q.prompt}</p>
            {q.figure && <div className="learning-board mt-2 !min-h-0 p-2" data-preset={preferences.preset} data-font={preferences.font}><BoardBlockView block={q.figure} /></div>}
            {q.hintShown && <p className="mt-2 text-xs text-muted-foreground">Hint: {q.hint ?? "Re-read the definition and the formula this question uses."}</p>}
            <div className="mt-2 flex gap-2">
              <Input value={q.answer_text} disabled={!!q.verdict} onChange={(e) => patch(q.id, { answer_text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") void check(q); }} placeholder="Your answer (try it first)" aria-label={`Answer for question ${n + 1}`} />
              <Button size="icon" onClick={() => void check(q)} disabled={!!q.verdict || q.checking || !q.answer_text.trim()} aria-label="Check answer">{q.checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => patch(q.id, { hintShown: true })} disabled={q.hintShown}><Lightbulb /> Hint</Button>
              <Button size="sm" variant="outline" onClick={() => patch(q.id, { solutionShown: true })} disabled={q.solutionShown || (!q.verdict && !q.answer_text.trim() && !q.hintShown)} title="Attempt it first — then reveal the solution">
                <Eye /> {q.verdict || q.answer_text.trim() ? "Show solution" : "Show solution (try or take a hint first)"}
              </Button>
            </div>
            {q.feedback && <p className="mt-2 text-sm">{q.feedback}</p>}
            {q.solutionShown && (
              <div className="mt-2 rounded-xl bg-secondary/60 p-3 text-sm">
                <ol className="list-decimal space-y-1 pl-5">{q.steps.map((s, i) => <li key={i} className="whitespace-pre-wrap">{s}</li>)}</ol>
                <p className="mt-2 font-bold">Answer: {q.answer}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
