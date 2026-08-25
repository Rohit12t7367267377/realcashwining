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
  adminListResources, adminSaveResource, adminToggleResource, adminDeleteResource, adminIndexResource,
  type AdminResourceRow,
} from "@/lib/guru-library-admin.functions";
import { BookOpen, Plus, Search, Trash2, Database, Pencil, ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/library")({
  head: () => ({
    meta: [
      { title: "Book & Resource Management — Admin" },
      { name: "description", content: "Add, edit, categorise, activate and index every library book, note and study resource." },
      { property: "og:title", content: "Book & Resource Management" },
      { property: "og:description", content: "Full control of the Guru.AI Library catalogue and its AI knowledge index." },
    ],
  }),
  component: AdminLibraryPage,
});

const TYPES = ["book", "notes", "reference", "study", "paper", "video", "link"] as const;
const ACCESS = ["free", "signed_in", "premium"] as const;
const STATUS = ["published", "draft", "archived"] as const;

type Form = {
  id?: string;
  title: string; author: string; publisher: string; isbn: string; description: string; cover_url: string;
  language: string; resource_type: (typeof TYPES)[number];
  board: string; class_name: string; degree: string; semester: string; subject: string; chapter: string; topic: string; exam: string;
  source_name: string; source_url: string; license: string;
  access_type: (typeof ACCESS)[number]; tags: string; status: (typeof STATUS)[number]; active: boolean;
  content: string; sort_order: number;
};

const EMPTY: Form = {
  title: "", author: "", publisher: "", isbn: "", description: "", cover_url: "",
  language: "en", resource_type: "book",
  board: "", class_name: "", degree: "", semester: "", subject: "", chapter: "", topic: "", exam: "",
  source_name: "", source_url: "", license: "", access_type: "free", tags: "", status: "published",
  active: true, content: "", sort_order: 0,
};

function toForm(r: AdminResourceRow): Form {
  return {
    id: r.id,
    title: r.title ?? "", author: r.author ?? "", publisher: r.publisher ?? "", isbn: r.isbn ?? "",
    description: r.description ?? "", cover_url: r.cover_url ?? "", language: r.language ?? "en",
    resource_type: (TYPES as readonly string[]).includes(r.resource_type) ? (r.resource_type as Form["resource_type"]) : "book",
    board: r.board ?? "", class_name: r.class_name ?? "", degree: r.degree ?? "", semester: r.semester ?? "",
    subject: r.subject ?? "", chapter: r.chapter ?? "", topic: r.topic ?? "", exam: r.exam ?? "",
    source_name: r.source_name ?? "", source_url: r.source_url ?? "", license: r.license ?? "",
    access_type: (ACCESS as readonly string[]).includes(r.access_type) ? (r.access_type as Form["access_type"]) : "free",
    tags: (r.tags ?? []).join(", "),
    status: (STATUS as readonly string[]).includes(r.status) ? (r.status as Form["status"]) : "published",
    active: Boolean(r.active), content: r.content ?? "", sort_order: r.sort_order ?? 0,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function AdminLibraryPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListResources);
  const save = useServerFn(adminSaveResource);
  const toggle = useServerFn(adminToggleResource);
  const remove = useServerFn(adminDeleteResource);
  const index = useServerFn(adminIndexResource);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState<Form | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-resources", query, typeFilter, statusFilter],
    queryFn: () =>
      list({
        data: {
          ...(query ? { search: query } : {}),
          ...(typeFilter ? { resource_type: typeFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-resources"] });

  const saveMut = useMutation({
    mutationFn: async (f: Form) =>
      save({
        data: {
          ...(f.id ? { id: f.id } : {}),
          title: f.title, author: f.author, publisher: f.publisher, isbn: f.isbn,
          description: f.description, cover_url: f.cover_url, language: f.language,
          resource_type: f.resource_type, board: f.board, class_name: f.class_name, degree: f.degree,
          semester: f.semester, subject: f.subject, chapter: f.chapter, topic: f.topic, exam: f.exam,
          source_name: f.source_name, source_url: f.source_url, license: f.license,
          access_type: f.access_type,
          tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
          status: f.status, active: f.active, content: f.content, sort_order: Number(f.sort_order) || 0,
        },
      }),
    onSuccess: () => { toast.success("Resource saved"); setForm(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const indexMut = useMutation({
    mutationFn: (id: string) => index({ data: { id } }),
    onSuccess: (r) => { toast.success(`Indexed ${r.chunks} chunks (${r.embedded} embedded)`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Book & Resource Management">
      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            Add only legally available material: public domain, open-licensed (CC / OpenStax / NCERT / NPTEL), or resources you are
            authorised to distribute. For everything else store the official link and your own notes — never upload copyrighted files
            or paste full copyrighted text into the AI extract.
          </span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, author, ISBN…" className="h-9 w-56 text-xs" />
          <Button type="submit" size="sm" variant="secondary"><Search className="h-3.5 w-3.5" /></Button>
        </form>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2 text-xs font-semibold">
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2 text-xs font-semibold">
          <option value="">All statuses</option>
          {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button size="sm" className="bg-gradient-primary" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add resource
        </Button>
      </div>

      {form && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-black">{form.id ? "Edit resource" : "New resource"}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Title *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Author"><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Publisher"><Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="ISBN"><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Cover image URL"><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Language">
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="h-9 w-full rounded-xl border border-border bg-background px-2 text-xs font-semibold">
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
              </select>
            </Field>
            <Field label="Resource type">
              <select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value as Form["resource_type"] })} className="h-9 w-full rounded-xl border border-border bg-background px-2 text-xs font-semibold">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Board"><Input value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} placeholder="CBSE / UP Board…" className="h-9 text-xs" /></Field>
            <Field label="Class"><Input value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="Class 10" className="h-9 text-xs" /></Field>
            <Field label="Degree"><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="B.Tech" className="h-9 text-xs" /></Field>
            <Field label="Semester"><Input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="Sem 3" className="h-9 text-xs" /></Field>
            <Field label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Chapter"><Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Topic"><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Exam"><Input value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value })} placeholder="JEE Main" className="h-9 text-xs" /></Field>
            <Field label="Source name"><Input value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} placeholder="NCERT / OpenStax" className="h-9 text-xs" /></Field>
            <Field label="Source / API URL"><Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Licence"><Input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} placeholder="CC BY 4.0 / Public domain" className="h-9 text-xs" /></Field>
            <Field label="Access type">
              <select value={form.access_type} onChange={(e) => setForm({ ...form, access_type: e.target.value as Form["access_type"] })} className="h-9 w-full rounded-xl border border-border bg-background px-2 text-xs font-semibold">
                {ACCESS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Form["status"] })} className="h-9 w-full rounded-xl border border-border bg-background px-2 text-xs font-semibold">
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Sort order"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="h-9 text-xs" /></Field>
            <Field label="Tags (comma separated)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="h-9 text-xs" /></Field>
            <Field label="Active">
              <label className="flex h-9 items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible in Library
              </label>
            </Field>
          </div>
          <div className="mt-3 grid gap-3">
            <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16 text-xs" /></Field>
            <Field label="Authorised text for AI (chunked + embedded for retrieval)">
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Paste open-licensed / public-domain text, or your own summary and notes. This is what the AI teacher retrieves."
                className="min-h-32 text-xs"
              />
            </Field>
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
        {isLoading && <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Loading catalogue…</div>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="truncate text-sm font-black">{r.title}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{r.resource_type}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.active && r.status === "published" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.active ? r.status : "inactive"}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {[r.author, r.publisher, r.isbn ? `ISBN ${r.isbn}` : null, r.license].filter(Boolean).join(" • ")}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[r.board, r.class_name, r.degree, r.semester, r.subject, r.chapter, r.topic, r.exam, r.language]
                    .filter(Boolean)
                    .map((c, i) => <span key={`${r.id}-${i}`} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{c}</span>)}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  AI index: {r.chunk_count} chunks{r.indexed_at ? ` • ${new Date(r.indexed_at).toLocaleDateString()}` : " • not indexed"}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setForm(toForm(r))}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="secondary" disabled={indexMut.isPending} onClick={() => indexMut.mutate(r.id)}>
                  <Database className="mr-1 h-3.5 w-3.5" /> Index for AI
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try { await toggle({ data: { id: r.id, active: !r.active } }); refresh(); toast.success(r.active ? "Deactivated" : "Activated"); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                >
                  {r.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm(`Delete "${r.title}"? Its AI index is removed too.`)) return;
                    try { await remove({ data: { id: r.id } }); refresh(); toast.success("Deleted"); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No resources match these filters.</div>
        )}
      </div>
    </AdminShell>
  );
}
