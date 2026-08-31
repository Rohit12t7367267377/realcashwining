import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  adminListVoices, adminSaveVoice, adminDeleteVoice,
  adminListTeachingConfigs, adminSaveTeachingConfig, adminToggleTeachingConfig, adminDeleteTeachingConfig,
} from "@/lib/guru-teaching-admin.functions";

export const Route = createFileRoute("/admin/teaching")({
  head: () => ({
    meta: [
      { title: "Teaching Engine Control — Guru.AI Admin" },
      { name: "description", content: "Configure AI teacher voices, teaching modes, boards and lesson structure for every Guru.AI learning module." },
      { property: "og:title", content: "Teaching Engine Control" },
      { property: "og:description", content: "Admin control centre for the central Guru.AI teaching engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminTeaching,
});

const SCOPES = ["school", "college", "exam", "skill", "galaxy", "universal", "library", "classroom"] as const;

type ConfigForm = {
  id?: string;
  title: string;
  scope: (typeof SCOPES)[number];
  topic_key: string;
  character_id: string;
  voice_code: string;
  teaching_mode: string;
  board_type: string;
  tools: string;
  lesson_structure: string;
  difficulty: string;
  language: "en" | "hi";
  access: "free" | "premium";
  extra_instructions: string;
  priority: number;
};

const EMPTY: ConfigForm = {
  title: "", scope: "school", topic_key: "", character_id: "", voice_code: "",
  teaching_mode: "interactive", board_type: "whiteboard", tools: "", lesson_structure: "",
  difficulty: "", language: "en", access: "free", extra_instructions: "", priority: 0,
};

function AdminTeaching() {
  const qc = useQueryClient();
  const listVoices = useServerFn(adminListVoices);
  const saveVoice = useServerFn(adminSaveVoice);
  const delVoice = useServerFn(adminDeleteVoice);
  const listConfigs = useServerFn(adminListTeachingConfigs);
  const saveConfig = useServerFn(adminSaveTeachingConfig);
  const toggleConfig = useServerFn(adminToggleTeachingConfig);
  const delConfig = useServerFn(adminDeleteTeachingConfig);

  const voices = useQuery({ queryKey: ["admin-voices"], queryFn: () => listVoices() });
  const configs = useQuery({ queryKey: ["admin-teaching-configs"], queryFn: () => listConfigs() });

  const [form, setForm] = useState<ConfigForm>(EMPTY);
  const [voiceForm, setVoiceForm] = useState({ code: "", label: "", provider: "lovable", voice_id: "", language: "en", speed: 1 });

  const configMut = useMutation({
    mutationFn: () =>
      saveConfig({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title,
          scope: form.scope,
          topic_key: form.topic_key || null,
          character_id: form.character_id || null,
          voice_code: form.voice_code || null,
          teaching_mode: form.teaching_mode,
          board_type: form.board_type,
          tools: form.tools.split(",").map((t) => t.trim()).filter(Boolean),
          lesson_structure: form.lesson_structure.split(",").map((t) => t.trim()).filter(Boolean),
          difficulty: form.difficulty || null,
          language: form.language,
          access: form.access,
          extra_instructions: form.extra_instructions || null,
          priority: Number(form.priority) || 0,
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success("Teaching configuration saved");
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin-teaching-configs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voiceMut = useMutation({
    mutationFn: () => saveVoice({ data: { ...voiceForm, speed: Number(voiceForm.speed) || 1, active: true, is_default: false, sort_order: 0 } }),
    onSuccess: () => {
      toast.success("Voice saved");
      setVoiceForm({ code: "", label: "", provider: "lovable", voice_id: "", language: "en", speed: 1 });
      qc.invalidateQueries({ queryKey: ["admin-voices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const characters = (configs.data?.characters ?? []) as Array<Record<string, string>>;

  return (
    <AdminShell>
      <h1 className="text-xl font-black">Teaching Engine Control</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One central AI teaching engine powers School, College, Exams, Skills, Galaxy Classroom and Universal AI.
        Configure who teaches, with which voice, board and lesson structure.
      </p>

      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Teacher voices</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input placeholder="code (e.g. nova)" value={voiceForm.code} onChange={(e) => setVoiceForm({ ...voiceForm, code: e.target.value })} />
          <Input placeholder="Label" value={voiceForm.label} onChange={(e) => setVoiceForm({ ...voiceForm, label: e.target.value })} />
          <Input placeholder="Provider voice id" value={voiceForm.voice_id} onChange={(e) => setVoiceForm({ ...voiceForm, voice_id: e.target.value })} />
          <Input placeholder="Provider (lovable / elevenlabs)" value={voiceForm.provider} onChange={(e) => setVoiceForm({ ...voiceForm, provider: e.target.value })} />
          <Input placeholder="Language (en / hi)" value={voiceForm.language} onChange={(e) => setVoiceForm({ ...voiceForm, language: e.target.value })} />
          <Input type="number" step="0.05" placeholder="Speed" value={voiceForm.speed} onChange={(e) => setVoiceForm({ ...voiceForm, speed: Number(e.target.value) })} />
        </div>
        <Button className="mt-3" onClick={() => voiceMut.mutate()} disabled={voiceMut.isPending || !voiceForm.code || !voiceForm.voice_id}>
          {voiceMut.isPending ? "Saving…" : "Add / update voice"}
        </Button>

        <div className="mt-4 grid gap-2">
          {(voices.data ?? []).map((v) => (
            <div key={String(v.id)} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-2.5">
              <div className="min-w-0 text-xs">
                <div className="font-bold">{String(v.label)} <span className="text-muted-foreground">({String(v.code)})</span></div>
                <div className="text-muted-foreground">{String(v.provider)} · {String(v.voice_id)} · {String(v.language)} · x{String(v.speed)}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await delVoice({ data: { id: String(v.id) } });
                  qc.invalidateQueries({ queryKey: ["admin-voices"] });
                }}
              >
                Delete
              </Button>
            </div>
          ))}
          {voices.data?.length === 0 && <div className="text-xs text-muted-foreground">No voices configured yet.</div>}
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          {form.id ? "Edit teaching configuration" : "New teaching configuration"}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input placeholder="Title (internal)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value as ConfigForm["scope"] })}
          >
            {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Input placeholder="Topic key (optional, matches topic name)" value={form.topic_key} onChange={(e) => setForm({ ...form, topic_key: e.target.value })} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={form.character_id}
            onChange={(e) => setForm({ ...form, character_id: e.target.value })}
          >
            <option value="">Teacher: auto (student's choice / specialist)</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}{c.subject_specialization ? ` — ${c.subject_specialization}` : ""}</option>)}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={form.voice_code}
            onChange={(e) => setForm({ ...form, voice_code: e.target.value })}
          >
            <option value="">Voice: teacher default</option>
            {(voices.data ?? []).map((v) => <option key={String(v.id)} value={String(v.code)}>{String(v.label)}</option>)}
          </select>
          <Input placeholder="Teaching mode (interactive / lecture / socratic)" value={form.teaching_mode} onChange={(e) => setForm({ ...form, teaching_mode: e.target.value })} />
          <Input placeholder="Board type (whiteboard / code / lab / map)" value={form.board_type} onChange={(e) => setForm({ ...form, board_type: e.target.value })} />
          <Input placeholder="Tools (comma separated)" value={form.tools} onChange={(e) => setForm({ ...form, tools: e.target.value })} />
          <Input placeholder="Lesson structure (comma separated steps)" value={form.lesson_structure} onChange={(e) => setForm({ ...form, lesson_structure: e.target.value })} />
          <Input placeholder="Difficulty label" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as "en" | "hi" })}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value as "free" | "premium" })}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <Input type="number" placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
        </div>
        <Textarea
          className="mt-2"
          placeholder="Extra teaching instructions for the AI teacher"
          value={form.extra_instructions}
          onChange={(e) => setForm({ ...form, extra_instructions: e.target.value })}
        />
        <div className="mt-3 flex gap-2">
          <Button onClick={() => configMut.mutate()} disabled={configMut.isPending || form.title.trim().length < 2}>
            {configMut.isPending ? "Saving…" : form.id ? "Update configuration" : "Create configuration"}
          </Button>
          {form.id && <Button variant="outline" onClick={() => setForm(EMPTY)}>Cancel</Button>}
        </div>
      </section>

      <section className="mt-5 grid gap-2">
        {(configs.data?.configs ?? []).map((c) => (
          <div key={String(c.id)} className="rounded-2xl bg-card p-3 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{String(c.title)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {String(c.scope)}{c.topic_key ? ` · ${String(c.topic_key)}` : ""} · {String(c.teaching_mode)} · {String(c.board_type)} · {String(c.language)} · {String(c.access)}
                  {c.active ? "" : " · disabled"}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: String(c.id),
                      title: String(c.title ?? ""),
                      scope: String(c.scope ?? "school") as ConfigForm["scope"],
                      topic_key: String(c.topic_key ?? ""),
                      character_id: String(c.character_id ?? ""),
                      voice_code: String(c.voice_code ?? ""),
                      teaching_mode: String(c.teaching_mode ?? "interactive"),
                      board_type: String(c.board_type ?? "whiteboard"),
                      tools: Array.isArray(c.tools) ? (c.tools as string[]).join(", ") : "",
                      lesson_structure: Array.isArray(c.lesson_structure) ? (c.lesson_structure as string[]).join(", ") : "",
                      difficulty: String(c.difficulty ?? ""),
                      language: (String(c.language) === "hi" ? "hi" : "en") as "en" | "hi",
                      access: (String(c.access) === "premium" ? "premium" : "free") as "free" | "premium",
                      extra_instructions: String(c.extra_instructions ?? ""),
                      priority: Number(c.priority ?? 0),
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await toggleConfig({ data: { id: String(c.id), active: !c.active } });
                    qc.invalidateQueries({ queryKey: ["admin-teaching-configs"] });
                  }}
                >
                  {c.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await delConfig({ data: { id: String(c.id) } });
                    qc.invalidateQueries({ queryKey: ["admin-teaching-configs"] });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {configs.data?.configs.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-xs text-muted-foreground shadow-soft">
            No teaching configurations yet — the engine uses smart defaults until you add one.
          </div>
        )}
      </section>
    </AdminShell>
  );
}
