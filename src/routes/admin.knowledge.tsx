import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  adminListKnowledgeSources, adminSaveKnowledgeSource, adminToggleKnowledgeSource,
  adminDeleteKnowledgeSource, adminTestKnowledgeSource, adminKnowledgeStatus,
  SOURCE_TYPES, type KnowledgeSource,
} from "@/lib/guru-knowledge-admin.functions";
import { Database, Plug, Plus, ShieldCheck, Trash2, Loader2, Pencil, Activity } from "lucide-react";

export const Route = createFileRoute("/admin/knowledge")({
  head: () => ({
    meta: [
      { title: "AI Knowledge Sources — Admin" },
      { name: "description", content: "Configure approved AI and content providers, retrieval settings and indexing status for Guru.AI." },
      { property: "og:title", content: "AI Knowledge Sources" },
      { property: "og:description", content: "Providers, credentials, retrieval and indexing status — all server-side." },
    ],
  }),
  component: AdminKnowledgePage,
});

type Form = {
  id?: string;
  provider: string; label: string; source_type: (typeof SOURCE_TYPES)[number];
  endpoint: string; description: string; api_key_secret_name: string;
  api_key: string; api_secret: string; enabled: boolean; sort_order: number;
};

const EMPTY: Form = {
  provider: "", label: "", source_type: "content_api", endpoint: "", description: "",
  api_key_secret_name: "", api_key: "", api_secret: "", enabled: false, sort_order: 0,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function AdminKnowledgePage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListKnowledgeSources);
  const save = useServerFn(adminSaveKnowledgeSource);
  const toggle = useServerFn(adminToggleKnowledgeSource);
  const remove = useServerFn(adminDeleteKnowledgeSource);
  const test = useServerFn(adminTestKnowledgeSource);
  const status = useServerFn(adminKnowledgeStatus);
  const [form, setForm] = useState<Form | null>(null);

  const { data: sources = [], isLoading } = useQuery({ queryKey: ["admin-knowledge-sources"], queryFn: () => list() });
  const { data: stats } = useQuery({ queryKey: ["admin-knowledge-status"], queryFn: () => status() });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-knowledge-sources"] });
    qc.invalidateQueries({ queryKey: ["admin-knowledge-status"] });
  };

  const saveMut = useMutation({
    mutationFn: (f: Form) => save({ data: { ...(f.id ? { id: f.id } : {}), ...f, sort_order: Number(f.sort_order) || 0 } }),
    onSuccess: () => { toast.success("Provider saved"); setForm(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const testMut = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (r) => { r.ok ? toast.success(r.message) : toast.error(r.message); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toEdit = (s: KnowledgeSource): Form => ({
    id: s.id, provider: s.provider, label: s.label,
    source_type: (SOURCE_TYPES as readonly string[]).includes(s.source_type) ? (s.source_type as Form["source_type"]) : "content_api",
    endpoint: s.endpoint ?? "", description: s.description ?? "",
    api_key_secret_name: s.api_key_secret_name ?? "", api_key: "", api_secret: "",
    enabled: s.enabled, sort_order: s.sort_order,
  });

  return (
    <AdminShell>
      <h1 className="text-xl font-black">AI Knowledge Sources</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Approved APIs and services that Guru.AI may use. Keys are stored and used only on the server — they are never sent to the app.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {[
          { label: "Knowledge chunks", value: stats?.chunks ?? 0, icon: Database },
          { label: "With embeddings", value: stats?.embedded ?? 0, icon: Activity },
          { label: "Active resources", value: stats?.resources ?? 0, icon: ShieldCheck },
          { label: "Indexed resources", value: stats?.indexedResources ?? 0, icon: Plug },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <c.icon className="h-3.5 w-3.5" /> {c.label}
            </div>
            <div className="mt-1 text-xl font-black">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
        Retrieval settings: hybrid retrieval (vector first, keyword fallback) over the knowledge library, embedding model{" "}
        <span className="font-bold">{stats?.embedModel}</span>, top 4–5 passages per answer.{" "}
        {stats?.aiConfigured
          ? "The Lovable AI provider is configured, so embeddings and AI teaching are live."
          : "No AI provider key is configured yet — indexing stores text without embeddings and retrieval falls back to keyword search."}
      </div>

      <div className="mt-3">
        <Button size="sm" className="bg-gradient-primary" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add provider
        </Button>
      </div>

      {form && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-black">{form.id ? "Edit provider" : "New provider"}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Provider *"><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="openstax / cricket-api / ncert" className="h-9 text-xs" /></Field>
            <Field label="Label *"><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="OpenStax Content API" className="h-9 text-xs" /></Field>
            <Field label="Source type">
              <select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value as Form["source_type"] })} className="h-9 w-full rounded-xl border border-border bg-background px-2 text-xs font-semibold">
                {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Endpoint (used by Test connection)"><Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://api.example.com/v1/status" className="h-9 text-xs" /></Field>
            <Field label="Backend secret name" hint="Preferred: store the key as a backend secret and reference its name here.">
              <Input value={form.api_key_secret_name} onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })} placeholder="MY_PROVIDER_API_KEY" className="h-9 text-xs" />
            </Field>
            <Field label="API key" hint="Write-only. Stored server-side and never returned to the browser. Leave blank to keep the existing key.">
              <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="••••••••" className="h-9 text-xs" />
            </Field>
            <Field label="API secret" hint="Optional second credential. Write-only.">
              <Input type="password" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} placeholder="••••••••" className="h-9 text-xs" />
            </Field>
            <Field label="Sort order"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="h-9 text-xs" /></Field>
            <Field label="Enabled">
              <label className="flex h-9 items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Guru.AI may use this provider
              </label>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16 text-xs" /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="bg-gradient-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
              {saveMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-2">
        {isLoading && <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Loading providers…</div>}
        {sources.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Plug className="h-4 w-4 text-primary" />
                  <span className="text-sm font-black">{s.label}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{s.provider}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{s.source_type}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {s.enabled ? "enabled" : "disabled"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.status === "connected" ? "bg-primary/15 text-primary" : s.status === "error" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {s.status}
                  </span>
                </div>
                {s.description && <p className="mt-1 text-[11px] text-muted-foreground">{s.description}</p>}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {s.endpoint || "no endpoint"} • credential: {s.has_key ? (s.api_key_secret_name ? `backend secret ${s.api_key_secret_name}` : "stored server-side") : "not set"}
                </div>
                {s.last_test_message && (
                  <div className={`mt-1 text-[10px] font-semibold ${s.last_test_ok ? "text-primary" : "text-destructive"}`}>
                    Last test: {s.last_test_message}
                    {s.last_tested_at ? ` (${new Date(s.last_tested_at).toLocaleString()})` : ""}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setForm(toEdit(s))}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="secondary" disabled={testMut.isPending} onClick={() => testMut.mutate(s.id)}>
                  {testMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Test connection
                </Button>
                <Button
                  size="sm" variant="secondary"
                  onClick={async () => {
                    try { await toggle({ data: { id: s.id, enabled: !s.enabled } }); refresh(); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                >
                  {s.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm" variant="destructive"
                  onClick={async () => {
                    if (!confirm(`Delete provider "${s.label}"?`)) return;
                    try { await remove({ data: { id: s.id } }); refresh(); toast.success("Deleted"); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && sources.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No providers configured yet. Add one — Guru.AI keeps working on its built-in AI provider and admin-added content until then.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
