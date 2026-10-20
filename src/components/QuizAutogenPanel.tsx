import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getQuizAutogen, saveQuizAutogen, runQuizAutogenNow } from "@/lib/quiz-autogen.functions";
import { DEFAULT_QUIZ_AUTOGEN, EXAM_PRESETS, type QuizAutogenConfig } from "@/lib/quiz-autogen";

type Runs = Awaited<ReturnType<typeof getQuizAutogen>>["runs"];

/** Admin control for automatic school quiz contests (free only). Lives inside the existing Contests admin page. */
export function QuizAutogenPanel({ onChanged }: { onChanged?: () => void }) {
  const [cfg, setCfg] = useState<QuizAutogenConfig>(DEFAULT_QUIZ_AUTOGEN);
  const [runs, setRuns] = useState<Runs>([]);
  const [busy, setBusy] = useState<"save" | "run" | null>(null);

  async function load() {
    try { const r = await getQuizAutogen(); setCfg(r.config); setRuns(r.runs); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load automation settings"); }
  }
  useEffect(() => { void load(); }, []);

  const num = (k: keyof QuizAutogenConfig, label: string, min: number, max: number) => (
    <div><Label className="text-xs">{label}</Label>
      <Input type="number" min={min} max={max} value={Number(cfg[k])} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} /></div>
  );
  const presetFields = (key: string) => { const p = EXAM_PRESETS[key]; return p ? { questionCount: p.questionCount, durationMinutes: p.durationMinutes, marksCorrect: p.marksCorrect, marksWrong: p.marksWrong, difficulty: p.difficulty } : {}; };
  const patchScope = (i: number, p: Partial<QuizAutogenConfig["scopes"][number]>) => setCfg({ ...cfg, scopes: cfg.scopes.map((s, n) => (n === i ? { ...s, ...p } : s)) });

  async function save() {
    setBusy("save");
    try { await saveQuizAutogen({ data: cfg }); toast.success("Automation settings saved"); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save (check every field)"); }
    finally { setBusy(null); }
  }
  async function runNow() {
    setBusy("run");
    try {
      const r = await runQuizAutogenNow();
      if (r.status === "created") toast.success(`Contest created (${r.published ? "published" : "saved as draft for review"})`);
      else if (r.status === "failed") toast.error(`Generation failed: ${r.error}`);
      else toast.info(`Nothing created: ${r.status.replace("_", " ")}`);
      await load(); onChanged?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Run failed"); }
    finally { setBusy(null); }
  }

  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Automatic quiz contests (school, college, exams)</h2>
          <p className="text-xs text-muted-foreground">Free contests only (no entry fee or cash prize). Needs the cron call to <code>/api/public/hooks/quiz-autogen</code> with the automation secret.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold"><Switch checked={cfg.enabled} onCheckedChange={(enabled) => setCfg({ ...cfg, enabled })} /> {cfg.enabled ? "On" : "Off"}</label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {num("intervalMinutes", "New contest every (minutes)", 15, 1440)}
        {num("questionCount", "Questions", 5, 50)}
        {num("durationMinutes", "Duration (min)", 5, 180)}
        {num("maxParticipants", "Max participants", 2, 100000)}
        {num("startsAfterMinutes", "Starts after slot (min)", 0, 1440)}
        {num("openForMinutes", "Open for (min)", 15, 10080)}
        {num("maxAttempts", "Retry attempts", 1, 10)}
        <div><Label className="text-xs">After generation</Label>
          <Select value={cfg.publishMode} onValueChange={(publishMode: "draft" | "auto") => setCfg({ ...cfg, publishMode })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="draft">Save as draft (I review)</SelectItem><SelectItem value="auto">Publish automatically</SelectItem></SelectContent>
          </Select></div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between"><Label>School / college / exam rotation</Label>
          <Button size="sm" variant="outline" onClick={() => setCfg({ ...cfg, scopes: [...cfg.scopes, { track: "school", board: "UP Board", className: "10", subject: "", topic: "", difficulty: "medium", language: "en" }] })}><Plus /> School</Button>
          <Button size="sm" variant="outline" onClick={() => setCfg({ ...cfg, scopes: [...cfg.scopes, { track: "college", board: "University", className: "Year 1", subject: "", topic: "", difficulty: "medium", language: "en" }] })}><Plus /> College</Button>
          <Button size="sm" variant="outline" onClick={() => setCfg({ ...cfg, scopes: [...cfg.scopes, { track: "exam", board: "Exam", className: "Prelims", subject: "", topic: "", difficulty: "medium", language: "en", examPreset: "ssc-cgl", ...presetFields("ssc-cgl") }] })}><Plus /> Exam</Button></div>
        <p className="text-xs text-muted-foreground">Each slot uses the next row in turn. Only rows you add here are ever generated.</p>
        <div className="mt-2 space-y-2">
          {cfg.scopes.map((s, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-border p-2 md:grid-cols-7">
              <Input aria-label="Board" placeholder="Board" value={s.board} onChange={(e) => patchScope(i, { board: e.target.value })} />
              {s.track === "school"
                ? <Select value={s.className} onValueChange={(className) => patchScope(i, { className })}><SelectTrigger aria-label="Class"><SelectValue /></SelectTrigger><SelectContent>{["10", "11", "12"].map((c) => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent></Select>
                : <Input aria-label={s.track === "exam" ? "Paper / stage" : "Year / semester"} placeholder={s.track === "exam" ? "Paper / stage" : "Year / semester"} value={s.className} onChange={(e) => patchScope(i, { className: e.target.value })} />}
              <Input aria-label="Subject" placeholder="Subject" value={s.subject} onChange={(e) => patchScope(i, { subject: e.target.value })} />
              <Input aria-label="Topic (optional)" placeholder="Topic (optional)" value={s.topic} onChange={(e) => patchScope(i, { topic: e.target.value })} />
              <Select value={s.difficulty} onValueChange={(difficulty: "easy" | "medium" | "hard") => patchScope(i, { difficulty })}><SelectTrigger aria-label="Difficulty"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select>
              <Select value={s.language} onValueChange={(language: "en" | "hi") => patchScope(i, { language })}><SelectTrigger aria-label="Language"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="hi">हिन्दी</SelectItem></SelectContent></Select>
              {s.track === "exam" && (
                <Select value={s.examPreset ?? ""} onValueChange={(examPreset) => patchScope(i, { examPreset, board: EXAM_PRESETS[examPreset]?.label ?? s.board, ...presetFields(examPreset) })}>
                  <SelectTrigger aria-label="Exam preset"><SelectValue placeholder="Exam" /></SelectTrigger>
                  <SelectContent>{Object.entries(EXAM_PRESETS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {s.track !== "school" && (<>
                <Input aria-label="Questions" type="number" min={5} max={100} placeholder="Questions" value={s.questionCount ?? ""} onChange={(e) => patchScope(i, { questionCount: e.target.value ? Number(e.target.value) : undefined })} />
                <Input aria-label="Minutes" type="number" min={5} max={240} placeholder="Minutes" value={s.durationMinutes ?? ""} onChange={(e) => patchScope(i, { durationMinutes: e.target.value ? Number(e.target.value) : undefined })} />
                <Input aria-label="Marks per correct" type="number" step="0.25" min={0.25} placeholder="+ marks" value={s.marksCorrect ?? ""} onChange={(e) => patchScope(i, { marksCorrect: e.target.value ? Number(e.target.value) : undefined })} />
                <Input aria-label="Marks per wrong" type="number" step="0.25" max={0} placeholder="− marks" value={s.marksWrong ?? ""} onChange={(e) => patchScope(i, { marksWrong: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </>)}
              <Button size="icon" variant="ghost" aria-label="Remove row" onClick={() => setCfg({ ...cfg, scopes: cfg.scopes.filter((_, n) => n !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={busy !== null}>{busy === "save" && <Loader2 className="animate-spin" />} Save settings</Button>
        <Button variant="outline" onClick={() => void runNow()} disabled={busy !== null}>{busy === "run" ? <Loader2 className="animate-spin" /> : <Play />} Run now (current slot)</Button>
      </div>

      {runs.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-muted-foreground"><th className="py-1 pr-2">Slot</th><th className="pr-2">Scope</th><th className="pr-2">Status</th><th className="pr-2">Tries</th><th>Detail</th></tr></thead>
            <tbody>{runs.map((r) => (
              <tr key={r.slot_key} className="border-t border-border align-top">
                <td className="py-1 pr-2 font-mono">{r.slot_key}</td>
                <td className="pr-2">{r.scope?.board} · {r.scope?.className} · {r.scope?.subject}</td>
                <td className="pr-2 font-bold">{r.status}</td><td className="pr-2">{r.attempts}</td>
                <td className="text-destructive">{r.error ?? (r.question_count ? `${r.question_count} questions` : "")}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
