import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import { guruRagStats, guruIndexLessons, guruAddSource } from "@/lib/guru-rag.functions";
import { toast } from "sonner";
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
