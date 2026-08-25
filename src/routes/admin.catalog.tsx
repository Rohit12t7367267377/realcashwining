import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { adminDeleteCatalogRow, adminGetCatalog, adminSaveCatalogRow } from "@/lib/guru-catalog-admin.functions";
import { GraduationCap, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/catalog")({ component: Page });

type Entity =
  | "exam"
  | "exam_subject"
  | "exam_topic"
  | "degree"
  | "regulation"
  | "college_subject"
  | "college_unit"
  | "college_topic";

function Page() {
  const load = useServerFn(adminGetCatalog);
  const save = useServerFn(adminSaveCatalogRow);
  const del = useServerFn(adminDeleteCatalogRow);
  const [side, setSide] = useState<"exams" | "college">("exams");
  const [examId, setExamId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [degreeId, setDegreeId] = useState<string | null>(null);
  const [regId, setRegId] = useState<string | null>(null);
  const [cSubjectId, setCSubjectId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

  const catalog = useQuery({ queryKey: ["admin-catalog"], queryFn: () => load() });

  const saveMut = useMutation({
    mutationFn: (v: { entity: Entity; id?: string; values: Record<string, unknown> }) => save({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      void catalog.refetch();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const delMut = useMutation({
    mutationFn: (v: { entity: Entity; id: string }) => del({ data: v }),
    onSuccess: () => {
      toast.success("Deleted");
      void catalog.refetch();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const d = catalog.data;

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <h1 className="flex items-center gap-2 text-lg font-black">
          <GraduationCap className="h-5 w-5" /> Exams & College catalogue
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Anything you add here appears instantly in Guru.AI → Competitive Exams and College. Levels you leave empty are
          filled by AI so students never hit a dead end.
        </p>
        <div className="mt-3 flex gap-2">
          {(["exams", "college"] as const).map((s) => (
            <Button key={s} size="sm" variant={side === s ? "default" : "secondary"} onClick={() => setSide(s)}>
              {s === "exams" ? "Competitive Exams" : "College"}
            </Button>
          ))}
        </div>
      </Card>

      {catalog.isLoading && <p className="text-sm text-muted-foreground">Loading catalogue…</p>}

      {side === "exams" && d && (
        <>
          <ListCard
            title="Exams"
            fields={[
              { key: "code", label: "Code (url)" },
              { key: "name", label: "Name" },
              { key: "category", label: "Category" },
              { key: "emoji", label: "Emoji" },
              { key: "conducting_body", label: "Conducted by" },
              { key: "blurb", label: "Short description" },
            ]}
            rows={d.exams.map((e) => ({ id: e.id, label: `${e.emoji} ${e.name} — ${e.category}`, active: e.active }))}
            selectedId={examId}
            onSelect={(id) => {
              setExamId(id);
              setSubjectId(null);
            }}
            onSave={(values, id) => saveMut.mutate({ entity: "exam", id, values })}
            onDelete={(id) => delMut.mutate({ entity: "exam", id })}
            onToggle={(id, active) => saveMut.mutate({ entity: "exam", id, values: { active } })}
          />
          {examId && (
            <ListCard
              title="Exam subjects"
              fields={[
                { key: "name", label: "Subject" },
                { key: "emoji", label: "Emoji" },
                { key: "weightage", label: "Weightage" },
                { key: "sort_order", label: "Order", numeric: true },
              ]}
              rows={d.examSubjects
                .filter((s) => s.exam_id === examId)
                .map((s) => ({ id: s.id, label: `${s.emoji} ${s.name}`, active: s.active }))}
              selectedId={subjectId}
              onSelect={setSubjectId}
              onSave={(values, id) => saveMut.mutate({ entity: "exam_subject", id, values: { ...values, exam_id: examId } })}
              onDelete={(id) => delMut.mutate({ entity: "exam_subject", id })}
              onToggle={(id, active) => saveMut.mutate({ entity: "exam_subject", id, values: { active } })}
            />
          )}
          {subjectId && (
            <ListCard
              title="Exam topics"
              fields={[
                { key: "title", label: "Topic" },
                { key: "sort_order", label: "Order", numeric: true },
              ]}
              rows={d.examTopics
                .filter((t) => t.subject_id === subjectId)
                .map((t) => ({ id: t.id, label: t.title, active: t.active }))}
              onSave={(values, id) =>
                saveMut.mutate({ entity: "exam_topic", id, values: { ...values, subject_id: subjectId } })
              }
              onDelete={(id) => delMut.mutate({ entity: "exam_topic", id })}
              onToggle={(id, active) => saveMut.mutate({ entity: "exam_topic", id, values: { active } })}
            />
          )}
        </>
      )}

      {side === "college" && d && (
        <>
          <ListCard
            title="Degrees"
            fields={[
              { key: "code", label: "Code" },
              { key: "name", label: "Name" },
              { key: "level", label: "Level (UG/PG)" },
              { key: "emoji", label: "Emoji" },
              { key: "blurb", label: "Short description" },
            ]}
            rows={d.degrees.map((x) => ({ id: x.id, label: `${x.emoji} ${x.name} (${x.level})`, active: x.active }))}
            selectedId={degreeId}
            onSelect={(id) => {
              setDegreeId(id);
              setRegId(null);
              setCSubjectId(null);
              setUnitId(null);
            }}
            onSave={(values, id) => saveMut.mutate({ entity: "degree", id, values })}
            onDelete={(id) => delMut.mutate({ entity: "degree", id })}
            onToggle={(id, active) => saveMut.mutate({ entity: "degree", id, values: { active } })}
          />
          {degreeId && (
            <ListCard
              title="Universities / regulations"
              fields={[
                { key: "university", label: "University" },
                { key: "name", label: "Regulation" },
                { key: "sort_order", label: "Order", numeric: true },
              ]}
              rows={d.regulations
                .filter((r) => r.degree_id === degreeId)
                .map((r) => ({ id: r.id, label: `${r.university} — ${r.name}`, active: r.active }))}
              selectedId={regId}
              onSelect={(id) => {
                setRegId(id);
                setCSubjectId(null);
              }}
              onSave={(values, id) => saveMut.mutate({ entity: "regulation", id, values: { ...values, degree_id: degreeId } })}
              onDelete={(id) => delMut.mutate({ entity: "regulation", id })}
              onToggle={(id, active) => saveMut.mutate({ entity: "regulation", id, values: { active } })}
            />
          )}
          {regId && (
            <ListCard
              title="Subjects"
              fields={[
                { key: "term", label: "Semester / Year" },
                { key: "name", label: "Subject" },
                { key: "code", label: "Subject code" },
                { key: "sort_order", label: "Order", numeric: true },
                { key: "is_programming", label: "Programming? (true/false)" },
              ]}
              rows={d.subjects
                .filter((s) => s.regulation_id === regId)
                .map((s) => ({ id: s.id, label: `${s.term} • ${s.name}${s.is_programming ? " 💻" : ""}`, active: s.active }))}
              selectedId={cSubjectId}
              onSelect={(id) => {
                setCSubjectId(id);
                setUnitId(null);
              }}
              onSave={(values, id) =>
                saveMut.mutate({
                  entity: "college_subject",
                  id,
                  values: { ...values, regulation_id: regId, is_programming: String(values.is_programming) === "true" },
                })
              }
              onDelete={(id) => delMut.mutate({ entity: "college_subject", id })}
              onToggle={(id, active) => saveMut.mutate({ entity: "college_subject", id, values: { active } })}
            />
          )}
          {cSubjectId && (
            <ListCard
              title="Units"
              fields={[
                { key: "unit_number", label: "Unit no.", numeric: true },
                { key: "title", label: "Unit title" },
                { key: "sort_order", label: "Order", numeric: true },
              ]}
              rows={d.units
                .filter((u) => u.subject_id === cSubjectId)
                .map((u) => ({ id: u.id, label: `Unit ${u.unit_number}: ${u.title}`, active: u.active }))}
              selectedId={unitId}
              onSelect={setUnitId}
              onSave={(values, id) =>
                saveMut.mutate({ entity: "college_unit", id, values: { ...values, subject_id: cSubjectId } })
              }
              onDelete={(id) => delMut.mutate({ entity: "college_unit", id })}
              onToggle={(id, active) => saveMut.mutate({ entity: "college_unit", id, values: { active } })}
            />
          )}
          {unitId && (
            <ListCard
              title="Topics"
              fields={[
                { key: "title", label: "Topic" },
                { key: "sort_order", label: "Order", numeric: true },
              ]}
              rows={d.topics
                .filter((t) => t.unit_id === unitId)
                .map((t) => ({ id: t.id, label: t.title, active: t.active }))}
              onSave={(values, id) =>
                saveMut.mutate({ entity: "college_topic", id, values: { ...values, unit_id: unitId } })
              }
              onDelete={(id) => delMut.mutate({ entity: "college_topic", id })}
              onToggle={(id, active) => saveMut.mutate({ entity: "college_topic", id, values: { active } })}
            />
          )}
        </>
      )}
    </div>
  );
}

type Field = { key: string; label: string; numeric?: boolean };

function ListCard(props: {
  title: string;
  fields: Field[];
  rows: { id: string; label: string; active: boolean }[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onSave: (values: Record<string, unknown>, id?: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black">{props.title}</h2>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid gap-2 rounded-2xl bg-secondary/40 p-3 sm:grid-cols-2">
          {props.fields.map((f) => (
            <label key={f.key} className="grid gap-1 text-[11px] font-bold">
              {f.label}
              <Input
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                placeholder={f.label}
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <Button
              size="sm"
              onClick={() => {
                const values: Record<string, unknown> = {};
                for (const f of props.fields) {
                  const raw = (form[f.key] ?? "").trim();
                  if (!raw) continue;
                  values[f.key] = f.numeric ? Number(raw) : raw;
                }
                if (!Object.keys(values).length) {
                  toast.error("Fill at least one field");
                  return;
                }
                props.onSave(values);
                setForm({});
                setOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-1.5">
        {props.rows.map((r) => (
          <div
            key={r.id}
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${props.selectedId === r.id ? "bg-primary/10 ring-1 ring-primary" : "bg-secondary/40"}`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
              onClick={() => props.onSelect?.(r.id)}
            >
              {r.label}
            </button>
            <Switch checked={r.active} onCheckedChange={(v) => props.onToggle(r.id, v)} />
            <button type="button" onClick={() => props.onDelete(r.id)} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
        {!props.rows.length && <p className="text-xs text-muted-foreground">Nothing added yet.</p>}
      </div>
    </Card>
  );
}
