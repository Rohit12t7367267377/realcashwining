import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminGenerateQuestions,
  adminGenerateReadingPassage,
  saveAiSettings,
  readAiSettingsAdmin,
  listAllCategories,
} from "@/lib/admin-ai.functions";
import { adminAiStatus } from "@/lib/admin-ai.functions";
import { adminPregenerateSubject } from "@/lib/admin-pregen.functions";
import { adminPregenOptions, adminCollegeLevel, adminPregenExam, adminPregenLibrary, adminPregenCollege } from "@/lib/admin-pregen-more.functions";
import { schoolSubjects } from "@/lib/school-curriculum";
import { guruRagStats, guruIndexLessons, guruAddSource } from "@/lib/guru-rag.functions";
import { toast } from "sonner";
import { saveAppSetting } from "@/lib/admin-settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Wand2, BookOpen, Library } from "lucide-react";



export const Route = createFileRoute("/admin/ai")({
  head: () => ({ meta: [{ title: "Admin · AI Studio" }] }),
  component: AdminAiPage,
});

const MODEL_CHOICES = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (default, fast)" },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (highest quality)" },
];

function AdminAiPage() {
  const qc = useQueryClient();
  const readSettings = useServerFn(readAiSettingsAdmin);
  const saveSettings = useServerFn(saveAiSettings);
  const generate = useServerFn(adminGenerateQuestions);
  const listCats = useServerFn(listAllCategories);

  const { data: settings } = useQuery({ queryKey: ["ai-settings"], queryFn: () => readSettings() });
  const { data: cats = [] } = useQuery({ queryKey: ["ai-cats"], queryFn: () => listCats() });

  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [genEnabled, setGenEnabled] = useState(true);
  const [recsEnabled, setRecsEnabled] = useState(true);
  const [doubtEnabled, setDoubtEnabled] = useState(true);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!settings) return;
    const s = settings as Record<string, unknown>;
    if (typeof s.ai_enabled === "boolean") setEnabled(s.ai_enabled);
    if (typeof s.ai_model === "string") setModel(s.ai_model);
    if (typeof s.ai_gen_enabled === "boolean") setGenEnabled(s.ai_gen_enabled);
    if (typeof s.ai_recs_enabled === "boolean") setRecsEnabled(s.ai_recs_enabled);
    if (typeof s.ai_doubt_enabled === "boolean") setDoubtEnabled(s.ai_doubt_enabled);
    if (typeof s.ai_doubt_system_prompt === "string") setPrompt(s.ai_doubt_system_prompt);
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          ai_enabled: enabled,
          ai_model: model,
          ai_gen_enabled: genEnabled,
          ai_recs_enabled: recsEnabled,
          ai_doubt_enabled: doubtEnabled,
          ai_doubt_system_prompt: prompt,
        },
      }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["ai-settings"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Generator form
  const [categoryId, setCategoryId] = useState<string>("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [topic, setTopic] = useState("");
  useEffect(() => { if (!categoryId && cats.length) setCategoryId(cats[0].id); }, [cats, categoryId]);

  const genMut = useMutation({
    mutationFn: () => generate({ data: { category_id: categoryId, count, difficulty, topic_hint: topic || undefined } }),
    onSuccess: (r) => toast.success(`Inserted ${r.inserted} questions`),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  // Reading comprehension generator
  const genReading = useServerFn(adminGenerateReadingPassage);
  const [rCategoryId, setRCategoryId] = useState<string>("");
  const [rCount, setRCount] = useState(5);
  const [rWords, setRWords] = useState(250);
  const [rDifficulty, setRDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [rRead, setRRead] = useState(120);
  const [rQuiz, setRQuiz] = useState(180);
  const [rTopic, setRTopic] = useState("");
  useEffect(() => { if (!rCategoryId && cats.length) setRCategoryId(cats[0].id); }, [cats, rCategoryId]);

  const readingMut = useMutation({
    mutationFn: () =>
      genReading({
        data: {
          category_id: rCategoryId || null,
          num_questions: rCount,
          word_count: rWords,
          difficulty: rDifficulty,
          reading_seconds: rRead,
          quiz_seconds: rQuiz,
          topic_hint: rTopic || undefined,
        },
      }),
    onSuccess: (r) => toast.success(`Created "${r.title}" with ${r.questions} questions (inactive — publish it from Reading)`),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });



  return (
    <AdminShell>
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">AI Studio</h1>
      </div>
      <p className="text-sm text-muted-foreground">Control every AI-powered feature in the app. Nothing to install — powered by Lovable AI.</p>


      <GuruModelCard />
      <PregenerateCard />
      <PregenerateMoreCard />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-bold">Feature toggles</h2>
            <p className="text-xs text-muted-foreground">Turn each AI feature on or off instantly.</p>
          </div>
          <Row label="Master AI switch" hint="Kill switch — turns every AI feature off if disabled.">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </Row>
          <Row label="AI Question Generation" hint="Admin generates MCQs with AI.">
            <Switch checked={genEnabled} onCheckedChange={setGenEnabled} />
          </Row>
          <Row label="Personalized Recommendations" hint="Show AI-picked contests on home.">
            <Switch checked={recsEnabled} onCheckedChange={setRecsEnabled} />
          </Row>
          <Row label="AI Doubt Assistant" hint="User-facing chat tutor.">
            <Switch checked={doubtEnabled} onCheckedChange={setDoubtEnabled} />
          </Row>
          <div>
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODEL_CHOICES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Doubt Assistant personality (system prompt)</Label>
            <Textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-gradient-primary">
            Save AI settings
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-bold flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Generate questions with AI</h2>
            <p className="text-xs text-muted-foreground">Instantly create MCQs for any category. Results are inserted into the question bank and can be edited from <b>Questions</b>.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Count (1-25)</Label>
              <Input type="number" min={1} max={25} value={count} onChange={(e) => setCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))} />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Topic hint (optional)</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cricket World Cup 2023" />
            </div>
          </div>
          <Button
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending || !categoryId || !enabled || !genEnabled}
            className="bg-gradient-primary"
          >
            <Wand2 className="mr-1 h-4 w-4" />
            {genMut.isPending ? "Generating…" : `Generate ${count} question${count === 1 ? "" : "s"}`}
          </Button>
          {(!enabled || !genEnabled) && <p className="text-xs text-destructive">AI generation is disabled. Enable it in the settings on the left.</p>}
        </Card>

        <Card className="p-5 space-y-4 lg:col-span-2">
          <div>
            <h2 className="font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Generate a Reading Comprehension set</h2>
            <p className="text-xs text-muted-foreground">
              Writes an original paragraph plus its MCQs for any category — Sports, General Knowledge, Coding and more.
              The set is saved <b>inactive</b> so you can review and edit it in <b>Reading</b> before publishing.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="sm:col-span-1">
              <Label>Category</Label>
              <Select value={rCategoryId} onValueChange={setRCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Questions</Label>
              <Input type="number" min={2} max={15} value={rCount} onChange={(e) => setRCount(Math.max(2, Math.min(15, Number(e.target.value) || 2)))} />
            </div>
            <div>
              <Label>Words</Label>
              <Input type="number" min={80} max={700} step={10} value={rWords} onChange={(e) => setRWords(Math.max(80, Math.min(700, Number(e.target.value) || 80)))} />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={rDifficulty} onValueChange={(v) => setRDifficulty(v as typeof rDifficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Read secs</Label>
              <Input type="number" min={15} max={3600} value={rRead} onChange={(e) => setRRead(Math.max(15, Math.min(3600, Number(e.target.value) || 15)))} />
            </div>
            <div>
              <Label>Quiz secs</Label>
              <Input type="number" min={30} max={7200} value={rQuiz} onChange={(e) => setRQuiz(Math.max(30, Math.min(7200, Number(e.target.value) || 30)))} />
            </div>
          </div>
          <div>
            <Label>Topic hint (optional)</Label>
            <Input value={rTopic} onChange={(e) => setRTopic(e.target.value)} placeholder="e.g. IPL history, Big-O notation, Indian monuments" />
          </div>
          <Button
            onClick={() => readingMut.mutate()}
            disabled={readingMut.isPending || !enabled || !genEnabled}
            className="bg-gradient-primary"
          >
            <BookOpen className="mr-1 h-4 w-4" />
            {readingMut.isPending ? "Writing passage…" : "Generate reading set"}
          </Button>
        </Card>
      </div>

      <GuruKnowledgeCard />
    </AdminShell>

  );
}

function GuruKnowledgeCard() {
  const qc = useQueryClient();
  const stats = useServerFn(guruRagStats);
  const indexLessons = useServerFn(guruIndexLessons);
  const addSource = useServerFn(guruAddSource);

  const { data } = useQuery({ queryKey: ["guru-rag-stats"], queryFn: () => stats() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const indexMut = useMutation({
    mutationFn: () => indexLessons({ data: { limit: 10 } }),
    onSuccess: (r) => {
      toast.success(`Indexed ${r.documents} lessons into ${r.chunks} searchable pieces`);
      if (r.failures.length) toast.error(r.failures[0]!);
      qc.invalidateQueries({ queryKey: ["guru-rag-stats"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Indexing failed"),
  });

  const addMut = useMutation({
    mutationFn: () => addSource({ data: { title: title.trim(), content: body.trim(), scope: "library" as const, language: "en" as const } }),
    onSuccess: (r) => {
      toast.success(`Added ${r.chunks} searchable pieces`);
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["guru-rag-stats"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add document"),
  });

  return (
    <Card className="mt-4 space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Library className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">Guru.AI Knowledge Library</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Guru.AI searches this library before answering, so students get answers grounded in your own study material
        instead of generic AI knowledge.
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Pieces", value: data?.chunks ?? 0 },
          { label: "Searchable", value: data?.embedded ?? 0 },
          { label: "Lessons", value: data?.lessons ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-muted p-3">
            <div className="text-lg font-black">{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <Button onClick={() => indexMut.mutate()} disabled={indexMut.isPending} variant="secondary">
        {indexMut.isPending ? "Indexing lessons…" : "Index latest lessons"}
      </Button>

      <div className="space-y-2 border-t pt-4">
        <Label>Add a study document</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Paste notes, syllabus or reference material Guru.AI should learn from…"
        />
        <Button
          onClick={() => addMut.mutate()}
          disabled={addMut.isPending || title.trim().length < 2 || body.trim().length < 20}
          className="bg-gradient-primary"
        >
          {addMut.isPending ? "Saving…" : "Add to knowledge library"}
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** Which AI model teaches Guru.AI lessons for every student. Admin-only: students no longer see a model picker. */
function GuruModelCard() {
  const [value, setValue] = useState<"default" | "openai">("default");
  const [busy, setBusy] = useState(false);
  const statusFn = useServerFn(adminAiStatus);
  const status = useQuery({ queryKey: ["admin-ai-status"], queryFn: () => statusFn(), staleTime: 30_000 });
  useEffect(() => {
    void supabase.from("app_settings").select("value").eq("key", "guru_ai_provider").maybeSingle().then(({ data }) => {
      const v = typeof data?.value === "string" ? data.value : (data?.value as { provider?: string } | null)?.provider;
      setValue(v === "openai" ? "openai" : "default");
    });
  }, []);
  async function save(next: "default" | "openai") {
    setBusy(true);
    try { await saveAppSetting({ data: { key: "guru_ai_provider", value: next === "openai" ? "openai" : "default", reason: "Guru.AI lesson model changed" } }); setValue(next); toast.success(next === "openai" ? "Guru.AI lessons now use ChatGPT" : "Guru.AI lessons now use the default model"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  }
  return (
    <Card className="mt-6 p-5">
      <h2 className="font-semibold">Guru.AI lesson model</h2>
      <p className="text-xs text-muted-foreground">Applies to every student's lessons, practice and classroom. Students do not see this setting. ChatGPT needs <code>OPENAI_API_KEY</code> in the server secrets.</p>
      <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs" role="status">
        {status.isLoading ? "Checking which AI is active…" : status.data
          ? `Active AI: ${status.data.active === "openai" ? `OpenAI (${status.data.model})` : "Lovable gateway"} · OPENAI_API_KEY ${status.data.openaiKey ? "found ✓" : "NOT found ✗"} · LOVABLE_API_KEY ${status.data.lovableKey ? "found" : "not set"}${status.data.forced ? ` · AI_PROVIDER=${status.data.forced}` : ""}${!status.data.openaiKey ? ` · OpenAI-like names seen: ${status.data.seenNames.length ? status.data.seenNames.join(", ") : "none"}` : ""}`
          : "Could not read AI status."}
      </p>
      <div className="mt-3 max-w-xs">
        <Select value={value} disabled={busy} onValueChange={(v: "default" | "openai") => void save(v)}>
          <SelectTrigger aria-label="Guru.AI lesson model"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="default">Guru.AI default (Gemini)</SelectItem><SelectItem value="openai">ChatGPT (OpenAI)</SelectItem></SelectContent>
        </Select>
      </div>
    </Card>
  );
}


const BOARDS = ["Uttar Pradesh Board of High School and Intermediate Education", "Central Board of Secondary Education (CBSE)", "Bihar School Examination Board (BSEB)"];

/** Generate every chapter, topic, note and quiz once and save it in the backend so students never trigger the AI. */
function PregenerateCard() {
  const run = useServerFn(adminPregenerateSubject);
  const [board, setBoard] = useState(BOARDS[0]);
  const [grade, setGrade] = useState(10);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [withQuiz, setWithQuiz] = useState(true);
  const [all, setAll] = useState(true);
  const subjects = schoolSubjects(board, grade);
  const [subject, setSubject] = useState(subjects[0] ?? "Mathematics");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  useEffect(() => { if (!subjects.includes(subject)) setSubject(subjects[0] ?? ""); }, [board, grade]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = (line: string) => setLog((l) => [...l.slice(-40), line]);

  async function start() {
    stop.current = false; setBusy(true); setLog([]);
    const list = all ? subjects : [subject];
    try {
      for (const sub of list) {
        let guard = 0;
        while (!stop.current && guard++ < 400) {
          const r = await run({ data: { board, className: String(grade), subject: sub, language, withQuiz } });
          add(`${sub}: ${r.chapters} chapters · ${r.topics} topics seen · ${r.notesReady} notes saved${withQuiz ? ` · ${r.quizReady} quizzes` : ""}${r.error ? ` · ⚠ ${r.error}` : ""}`);
          if (r.error) { toast.error(`${sub}: ${r.error}`); stop.current = true; break; }
          if (r.done) { add(`✅ ${sub} fully saved`); break; }
        }
        if (stop.current) break;
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Generation stopped"); }
    finally { setBusy(false); }
  }

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-semibold">Pre-generate lessons (save once, reuse forever)</h2>
      <p className="text-xs text-muted-foreground">Builds every chapter, topic, notes and quiz for the chosen class and saves them in the backend. Students then read saved content and no AI credit is used. Uses your OpenAI balance once; you can stop and continue any time — finished items are never regenerated.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><Label>Board</Label>
          <Select value={board} onValueChange={setBoard}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BOARDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Class</Label>
          <Select value={String(grade)} onValueChange={(v) => setGrade(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <SelectItem key={g} value={String(g)}>Class {g}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Subject</Label>
          <Select value={subject} disabled={all} onValueChange={setSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{subjects.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Language</Label>
          <Select value={language} onValueChange={(v: "en" | "hi") => setLanguage(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="hi">हिन्दी</SelectItem></SelectContent></Select></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><Switch checked={all} onCheckedChange={setAll} /> All subjects of this class</label>
        <label className="flex items-center gap-2"><Switch checked={withQuiz} onCheckedChange={setWithQuiz} /> Also save quizzes</label>
      </div>
      <div className="mt-3 flex gap-2">
        <Button disabled={busy} onClick={() => void start()}>{busy ? "Generating…" : "Generate & save"}</Button>
        {busy && <Button variant="outline" onClick={() => { stop.current = true; }}>Stop</Button>}
      </div>
      {log.length > 0 && <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-snug whitespace-pre-wrap" role="log">{log.join("\n")}</pre>}
    </Card>
  );
}


type Item = { id: string; name: string };

/** Same save-once idea for Exams, Library and College. */
function PregenerateMoreCard() {
  const opts = useServerFn(adminPregenOptions);
  const level = useServerFn(adminCollegeLevel);
  const runExam = useServerFn(adminPregenExam);
  const runLib = useServerFn(adminPregenLibrary);
  const runCol = useServerFn(adminPregenCollege);
  const q = useQuery({ queryKey: ["pregen-options"], queryFn: () => opts(), staleTime: 60_000 });
  const [section, setSection] = useState<"exams" | "library" | "college">("exams");
  const [exam, setExam] = useState<string>("all");
  const [degree, setDegree] = useState<Item | null>(null);
  const [regs, setRegs] = useState<Item[]>([]); const [reg, setReg] = useState<Item | null>(null);
  const [terms, setTerms] = useState<Item[]>([]); const [term, setTerm] = useState<Item | null>(null);
  const [withLessons, setWithLessons] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  const add = (l: string) => setLog((x) => [...x.slice(-40), l]);

  async function pickDegree(id: string) {
    const d = q.data?.degrees.find((x) => x.id === id) ?? null;
    setDegree(d); setReg(null); setTerm(null); setRegs([]); setTerms([]);
    if (!d) return;
    try { setRegs(await level({ data: { level: "regulations", degreeId: d.id, degree: d.name } })); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load universities"); }
  }
  async function pickReg(id: string) {
    const r = regs.find((x) => x.id === id) ?? null;
    setReg(r); setTerm(null); setTerms([]);
    if (!r || !degree) return;
    try { setTerms(await level({ data: { level: "terms", degreeId: degree.id, degree: degree.name, regulationId: r.id, regulation: r.name } })); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load semesters"); }
  }

  async function loopUntilDone(label: string, step: () => Promise<{ done: boolean; error: string | null; line: string }>) {
    let guard = 0;
    while (!stop.current && guard++ < 400) {
      const r = await step();
      add(`${label}: ${r.line}${r.error ? ` · ⚠ ${r.error}` : ""}`);
      if (r.error) { toast.error(`${label}: ${r.error}`); stop.current = true; return; }
      if (r.done) { add(`✅ ${label} fully saved`); return; }
    }
  }

  async function start() {
    stop.current = false; setBusy(true); setLog([]);
    try {
      if (section === "exams") {
        const list = exam === "all" ? (q.data?.exams ?? []) : (q.data?.exams ?? []).filter((e) => e.code === exam);
        for (const e of list) {
          if (stop.current) break;
          await loopUntilDone(e.name, async () => { const r = await runExam({ data: { code: e.code, language: "en", withLessons } }); return { ...r, line: `${r.subjects} subjects · ${r.topics} topics · ${r.lessons} lessons` }; });
        }
      } else if (section === "library") {
        let offset = 0;
        await loopUntilDone("Library", async () => { const r = await runLib({ data: { offset } }); offset = r.next; return { ...r, line: `${r.next}/${r.total} resources · ${r.lessons} lessons` }; });
      } else {
        if (!degree || !reg || !term) { toast.error("Choose degree, university and semester first"); return; }
        await loopUntilDone(`${degree.name} · ${term.name}`, async () => { const r = await runCol({ data: { degree: degree.name, regulation: reg, term, withQuiz: true } }); return { ...r, line: `${r.subjects} subjects · ${r.topics} topics · ${r.notes} notes · ${r.quizzes} quizzes` }; });
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Generation stopped"); }
    finally { setBusy(false); }
  }

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-semibold">Pre-generate Exams, Library and College</h2>
      <p className="text-xs text-muted-foreground">Same idea as above: build once, save in the backend, students read saved content. Safe to stop and run again — saved parts are skipped without using AI.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><Label>Section</Label>
          <Select value={section} onValueChange={(v: "exams" | "library" | "college") => setSection(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="exams">Competitive exams</SelectItem><SelectItem value="library">Library ({q.data?.resources ?? 0} resources)</SelectItem><SelectItem value="college">College</SelectItem></SelectContent></Select></div>
        {section === "exams" && (
          <div><Label>Exam</Label>
            <Select value={exam} onValueChange={setExam}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">All exams</SelectItem>{(q.data?.exams ?? []).map((e) => <SelectItem key={e.code} value={e.code}>{e.name}</SelectItem>)}</SelectContent></Select></div>
        )}
        {section === "college" && (<>
          <div><Label>Degree</Label>
            <Select value={degree?.id ?? ""} onValueChange={(v) => void pickDegree(v)}><SelectTrigger><SelectValue placeholder="Choose degree" /></SelectTrigger><SelectContent>
              {(q.data?.degrees ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>University / regulation</Label>
            <Select value={reg?.id ?? ""} disabled={!regs.length} onValueChange={(v) => void pickReg(v)}><SelectTrigger><SelectValue placeholder="Choose university" /></SelectTrigger><SelectContent>
              {regs.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Semester / year</Label>
            <Select value={term?.id ?? ""} disabled={!terms.length} onValueChange={(v) => setTerm(terms.find((t) => t.id === v) ?? null)}><SelectTrigger><SelectValue placeholder="Choose semester" /></SelectTrigger><SelectContent>
              {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
        </>)}
      </div>
      {section === "exams" && <label className="mt-3 flex items-center gap-2 text-sm"><Switch checked={withLessons} onCheckedChange={setWithLessons} /> Also save "Explain Easy / Deeply" lessons for every topic</label>}
      <div className="mt-3 flex gap-2">
        <Button disabled={busy} onClick={() => void start()}>{busy ? "Generating…" : "Generate & save"}</Button>
        {busy && <Button variant="outline" onClick={() => { stop.current = true; }}>Stop</Button>}
      </div>
      {log.length > 0 && <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-snug whitespace-pre-wrap" role="log">{log.join("\n")}</pre>}
    </Card>
  );
}
