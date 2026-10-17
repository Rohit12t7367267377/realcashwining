import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, AlertTriangle, CheckCircle2, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  approvePredContest, cancelPredContest, correctPredQuestion, createCustomPredContest, deletePredTemplate,
  getPredAdmin, getPredMonitoring, listPredContestQuestions, runPredNow, savePredSettings, setPredSportEnabled,
  testPredBallFeed, upsertPredCategory, upsertPredTemplate,
} from "@/lib/admin-pred.functions";
import { listSportsMatchesAdmin } from "@/lib/admin-sports.functions";

export const Route = createFileRoute("/admin/predict")({
  head: () => ({ meta: [{ title: "Prediction Engine — Guru-G Admin" }] }),
  component: Page,
});

type Overview = Awaited<ReturnType<typeof getPredAdmin>>;
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  published: "default", scheduled: "secondary", draft: "outline", locked: "secondary", settling: "secondary", completed: "default", cancelled: "destructive",
  ok: "default", failed: "destructive", running: "secondary",
};

function Page() {
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await getPredAdmin()); setLoadError(null); } catch (e) { setLoadError(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loadError) return <Card className="p-4 text-sm text-destructive">Could not load the prediction engine: {loadError}. If the database migration has not been applied yet, apply <code>20261016000000_pred_engine.sql</code> first.</Card>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black">Prediction Engine</h1>
        <p className="text-xs text-muted-foreground">Free-to-play, virtual points only. Automation, contests, scoring and rewards.</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview & jobs</TabsTrigger>
          <TabsTrigger value="contests">Contests</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="builder">Custom builder</TabsTrigger>
          <TabsTrigger value="config">Categories & settings</TabsTrigger>
          <TabsTrigger value="monitor">Monitoring & audit</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab d={data} reload={load} /></TabsContent>
        <TabsContent value="contests" className="mt-4"><ContestsTab d={data} reload={load} /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesTab d={data} reload={load} /></TabsContent>
        <TabsContent value="builder" className="mt-4"><BuilderTab d={data} reload={load} /></TabsContent>
        <TabsContent value="config" className="mt-4"><ConfigTab d={data} reload={load} /></TabsContent>
        <TabsContent value="monitor" className="mt-4"><MonitorTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
function OverviewTab({ d, reload }: { d: Overview; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const health = d.providerHealth as null | { status?: string; provider?: string; finishedAt?: string; error?: string | null; fallbackUsed?: boolean };
  const lastOk = d.jobs.find((j: any) => j.status === "ok");
  async function run(refreshFixtures: boolean) {
    setBusy(true);
    try {
      const out = await runPredNow({ data: { refreshFixtures } });
      if (out.skipped) toast.message(`Skipped: ${out.skipped.replace(/_/g, " ")}`);
      else toast.success(`Done · ${out.report?.generated ?? 0} generated, ${out.report?.completed ?? 0} completed`);
      if (out.report?.errors?.length) toast.warning(out.report.errors[0]);
      await reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  const pending = d.contests.filter((c: any) => c.status === "draft").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Engine" value={d.settings.engineEnabled ? "On" : "Off"} tone={d.settings.engineEnabled ? "ok" : "bad"} />
        <Stat label="Sports provider" value={health?.status === "healthy" ? "Healthy" : health?.status === "failed" ? "Failing" : "Unknown"} tone={health?.status === "healthy" ? "ok" : "bad"} sub={health?.finishedAt ? `Last sync ${fmt(health.finishedAt)}` : "Never synced"} />
        <Stat label="Failed jobs (24h)" value={String(d.failedJobs24h)} tone={d.failedJobs24h ? "bad" : "ok"} sub={lastOk ? `Last OK ${fmt(lastOk.finished_at)}` : "No successful run yet"} />
        <Stat label="Awaiting approval" value={String(pending)} tone={pending ? "warn" : "ok"} />
      </div>
      {health?.error && <Card className="flex gap-2 border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /> Provider: {health.error}</Card>}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button size="sm" onClick={() => run(true)} disabled={busy}><Play className="mr-1 h-3.5 w-3.5" /> Run full cycle now</Button>
        <Button size="sm" variant="outline" onClick={() => run(false)} disabled={busy}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Run without fixture refresh</Button>
        <span className="text-[11px] text-muted-foreground">Cron endpoint: <code>POST /api/public/hooks/pred-tick</code> (header <code>x-automation-secret</code>). Retrying is always safe.</span>
      </Card>
      <Card className="overflow-x-auto">
        <div className="border-b p-3 text-sm font-semibold"><Activity className="mr-1 inline h-4 w-4" /> Recent jobs</div>
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground"><tr><th className="p-2">Started</th><th className="p-2">Status</th><th className="p-2">Result</th><th className="p-2">Error</th></tr></thead>
          <tbody>
            {d.jobs.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No jobs yet. Schedule the cron endpoint or press “Run full cycle now”.</td></tr>}
            {d.jobs.map((j: any) => (
              <tr key={j.id} className="border-t align-top">
                <td className="whitespace-nowrap p-2">{fmt(j.started_at)}</td>
                <td className="p-2"><Badge variant={STATUS_TONE[j.status]}>{j.status}</Badge></td>
                <td className="p-2 text-muted-foreground">{j.result ? `gen ${j.result.generated ?? 0} · pub ${j.result.published ?? 0} · lock ${j.result.locked ?? 0} · done ${j.result.completed ?? 0} · pts ${j.result.credited ?? 0}` : "—"}</td>
                <td className="max-w-xs break-words p-2 text-destructive">{j.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "ok" | "bad" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "text-amber-600";
  return <Card className="p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className={`text-xl font-black ${color}`}>{value}</div>{sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}</Card>;
}

// ---------------------------------------------------------------------------
function ReasonDialog({ title, open, onClose, onConfirm, confirmLabel }: { title: string; open: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void>; confirmLabel: string }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Label>Reason (recorded in the audit log, min 5 characters)</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button disabled={reason.trim().length < 5 || busy} onClick={async () => { setBusy(true); try { await onConfirm(reason.trim()); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContestsTab({ d, reload }: { d: Overview; reload: () => void }) {
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [review, setReview] = useState<any | null>(null);
  async function approve(id: string) {
    try { await approvePredContest({ data: { id } }); toast.success("Approved. It publishes automatically when its window opens."); reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="space-y-2">
      {d.contests.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No contests yet. They are generated automatically from templates, or build one in “Custom builder”.</Card>}
      {d.contests.map((c: any) => (
        <Card key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{c.title}</div>
            <div className="text-[11px] text-muted-foreground">Opens {fmt(c.opens_at)} · locks {fmt(c.locks_at)} · {c.trigger.replace("_", " ")}{c.correction_version ? ` · corrections v${c.correction_version}` : ""}</div>
            {c.cancel_reason && <div className="text-[11px] text-destructive">Cancelled: {c.cancel_reason}</div>}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={STATUS_TONE[c.status]}>{c.status}</Badge>
            {c.status === "draft" && <Button size="sm" onClick={() => approve(c.id)}>Approve</Button>}
            {["locked", "settling", "completed"].includes(c.status) && <Button size="sm" variant="outline" onClick={() => setReview(c)}>Results</Button>}
            {["draft", "scheduled", "published"].includes(c.status) && <Button size="sm" variant="ghost" onClick={() => setCancelId(c.id)}>Cancel</Button>}
          </div>
        </Card>
      ))}
      <ReasonDialog title="Cancel contest" open={!!cancelId} onClose={() => setCancelId(null)} confirmLabel="Cancel contest"
        onConfirm={async (reason) => { await cancelPredContest({ data: { id: cancelId!, reason } }); toast.success("Contest cancelled"); reload(); }} />
      {review && <ResultsDialog contest={review} onClose={() => setReview(null)} reload={reload} />}

      {d.corrections.length > 0 && (
        <Card className="mt-4 overflow-x-auto">
          <div className="border-b p-3 text-sm font-semibold">Result correction log</div>
          <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="p-2">When</th><th className="p-2">By</th><th className="p-2">Change</th><th className="p-2">Reason</th></tr></thead>
            <tbody>{d.corrections.map((c: any) => (
              <tr key={c.id} className="border-t"><td className="whitespace-nowrap p-2">{fmt(c.created_at)}</td><td className="p-2">{String(c.actor).slice(0, 8)}</td>
                <td className="p-2">{c.before_state?.status}/{c.before_state?.option ?? "-"} → {c.after_state?.status}/{c.after_state?.option ?? "-"}</td><td className="p-2 text-muted-foreground">{c.reason}</td></tr>
            ))}</tbody></table>
        </Card>
      )}
    </div>
  );
}

function ResultsDialog({ contest, onClose, reload }: { contest: any; onClose: () => void; reload: () => void }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof listPredContestQuestions>> | null>(null);
  const [target, setTarget] = useState<{ q: any; result: { status: "resolved"; optionId: string } | { status: "void"; reason: string } } | null>(null);
  const refresh = useCallback(async () => { setState(await listPredContestQuestions({ data: { id: contest.id } })); }, [contest.id]);
  useEffect(() => { refresh().catch((e) => toast.error(errMsg(e))); }, [refresh]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{contest.title}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{state ? `${state.entries} entries` : "Loading…"} · Results come from verified provider data. Changing one needs a reason, is logged, and re-scores everyone safely.</p>
        <div className="space-y-2">
          {(state?.questions ?? []).map((q: any) => (
            <Card key={q.id} className="p-3">
              <div className="text-sm font-medium">{q.position}. {q.prompt}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Status: <b>{q.status}</b>{q.resolved_option ? ` · answer: ${q.options.find((o: any) => o.id === q.resolved_option)?.label}` : ""}{q.void_reason ? ` · void: ${q.void_reason}` : ""} · rule: {q.rule.kind}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {q.options.map((o: any) => (
                  <Button key={o.id} size="sm" variant={q.resolved_option === o.id ? "default" : "outline"} onClick={() => setTarget({ q, result: { status: "resolved", optionId: o.id } })}>{o.label}</Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setTarget({ q, result: { status: "void", reason: "admin_void" } })}>Void</Button>
              </div>
            </Card>
          ))}
        </div>
        <ReasonDialog title="Set / correct this result" open={!!target} onClose={() => setTarget(null)} confirmLabel="Apply"
          onConfirm={async (reason) => {
            const out = await correctPredQuestion({ data: { contestId: contest.id, questionId: target!.q.id, result: target!.result, reason } });
            toast.success(out.outcome === "unchanged" ? "No change (already set)" : `Result ${out.outcome}`);
            await refresh(); reload();
          }} />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
type TForm = {
  id?: string; categoryId: string; name: string; sport: string; formats: string; generator: "match_winner" | "over_by_over" | "innings_balls" | "innings_total";
  innings: number; over: number; balls: number; overs: string; thresholds: string; points: string;
  trigger: "pre_match" | "innings_break" | "after_over" | "match_completed";
  createBeforeMin: number; opensBeforeMin: number; locksBeforeMin: number; lockAfterMin: number; catchUp: "skip" | "shorten"; minOpenMin: number; afterOver: number; tInnings: number;
  pointsPerCorrect: number; negativePerWrong: number; participantLimit: string;
  autoGenerate: boolean; requireApproval: boolean; allowEdit: boolean; enabled: boolean; rawPlan?: any;
};
const blankTemplate = (): TForm => ({
  categoryId: "", name: "", sport: "cricket", formats: "t20, odi", generator: "match_winner", innings: 1, over: 1, balls: 6, overs: "", thresholds: "", points: "",
  trigger: "pre_match", createBeforeMin: 60, opensBeforeMin: 30, locksBeforeMin: 1, lockAfterMin: 5, catchUp: "shorten", minOpenMin: 5, afterOver: 1, tInnings: 1,
  pointsPerCorrect: 10, negativePerWrong: 0, participantLimit: "", autoGenerate: true, requireApproval: false, allowEdit: false, enabled: true,
});
function toForm(t: any): TForm {
  const f = blankTemplate();
  return {
    ...f, id: t.id, categoryId: t.category_id ?? "", name: t.name, sport: t.sport, formats: (t.formats ?? []).join(", "),
    generator: ["match_winner", "over_by_over", "innings_balls", "innings_total"].includes(t.plan.generator) ? t.plan.generator : "match_winner",
    innings: t.plan.innings ?? 1, over: t.plan.over ?? 1, balls: t.plan.balls ?? 6, overs: t.plan.overs ? String(t.plan.overs) : "", thresholds: (t.plan.thresholds ?? []).join(", "), points: t.plan.points ? String(t.plan.points) : "",
    trigger: t.timing.trigger, createBeforeMin: t.timing.createBeforeMin, opensBeforeMin: t.timing.opensBeforeMin, locksBeforeMin: t.timing.locksBeforeMin,
    lockAfterMin: t.timing.lockAfterMin, catchUp: t.timing.catchUp, minOpenMin: t.timing.minOpenMin, afterOver: t.timing.afterOver ?? 1, tInnings: t.timing.innings ?? 1,
    pointsPerCorrect: t.scoring.pointsPerCorrect, negativePerWrong: t.scoring.negativePerWrong, participantLimit: t.participant_limit ? String(t.participant_limit) : "",
    autoGenerate: t.auto_generate, requireApproval: t.require_approval, allowEdit: t.allow_edit, enabled: t.enabled,
    rawPlan: t.plan.generator === "static" ? t.plan : undefined,
  };
}
const nums = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).map(Number);

function TemplatesTab({ d, reload }: { d: Overview; reload: () => void }) {
  const [form, setForm] = useState<TForm | null>(null);
  const catName = (id: string | null) => d.categories.find((c: any) => c.id === id)?.name ?? "—";
  async function toggle(t: any, enabled: boolean) {
    try { await upsertPredTemplate({ data: { ...payload(toForm(t)), enabled } }); reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  async function remove(t: any) {
    if (!window.confirm(`Delete template “${t.name}”? Existing contests are kept.`)) return;
    try { await deletePredTemplate({ data: { id: t.id } }); reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><Button size="sm" onClick={() => setForm(blankTemplate())}><Plus className="mr-1 h-3.5 w-3.5" /> New template</Button></div>
      {d.templates.map((t: any) => (
        <Card key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{t.name}</div>
            <div className="text-[11px] text-muted-foreground">{catName(t.category_id)} · {t.sport} · {t.plan.generator.replace(/_/g, " ")} · {t.timing.trigger.replace(/_/g, " ")} · {t.auto_generate ? "auto" : "manual"}{t.require_approval ? " · needs approval" : ""}</div>
            {t.description && <div className="text-[11px] text-muted-foreground">{t.description}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={t.enabled} onCheckedChange={(v) => toggle(t, v)} aria-label="Enabled" />
            <Button size="sm" variant="outline" onClick={() => setForm(toForm(t))}>Edit</Button>
            <Button size="icon" variant="ghost" onClick={() => remove(t)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </Card>
      ))}
      {form && <TemplateDialog init={form} cats={d.categories} onClose={() => setForm(null)} reload={reload} />}
    </div>
  );
}

function payload(f: TForm) {
  const plan = f.rawPlan ?? {
    generator: f.generator,
    ...(f.generator === "over_by_over" ? { innings: f.innings, over: f.over, balls: f.balls } : {}),
    ...(f.generator === "innings_balls" ? { innings: f.innings, ...(f.overs ? { overs: Number(f.overs) } : {}) } : {}),
    ...(f.generator === "innings_total" ? { innings: f.innings, ...(nums(f.thresholds).length ? { thresholds: nums(f.thresholds) } : {}) } : {}),
    ...(f.points ? { points: Number(f.points) } : {}),
  };
  return {
    id: f.id, categoryId: f.categoryId || null, name: f.name.trim(), sport: f.sport.trim(), description: null,
    formats: f.formats.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean), plan,
    timing: {
      trigger: f.trigger, createBeforeMin: f.createBeforeMin, opensBeforeMin: f.opensBeforeMin, locksBeforeMin: f.locksBeforeMin, lockAfterMin: f.lockAfterMin,
      catchUp: f.catchUp, minOpenMin: f.minOpenMin,
      ...(f.trigger === "after_over" ? { afterOver: f.afterOver, innings: f.tInnings } : {}), ...(f.trigger === "innings_break" ? { innings: f.tInnings } : {}),
    },
    scoring: { pointsPerCorrect: f.pointsPerCorrect, negativePerWrong: f.negativePerWrong },
    participantLimit: f.participantLimit ? Number(f.participantLimit) : null,
    autoGenerate: f.autoGenerate, requireApproval: f.requireApproval, allowEdit: f.allowEdit, enabled: f.enabled,
  };
}

function NumField({ label, value, onChange, min = 0, max = 10080 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return <div><Label className="text-[11px]">{label}</Label><Input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}

function TemplateDialog({ init, cats, onClose, reload }: { init: TForm; cats: any[]; onClose: () => void; reload: () => void }) {
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TForm>(k: K, v: TForm[K]) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setBusy(true);
    try { await upsertPredTemplate({ data: payload(f) }); toast.success("Template saved"); reload(); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label className="text-[11px]">Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} /></div>
          <div><Label className="text-[11px]">Category</Label>
            <Select value={f.categoryId || "none"} onValueChange={(v) => set("categoryId", v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">None</SelectItem>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-[11px]">Sport key</Label><Input value={f.sport} onChange={(e) => set("sport", e.target.value)} /></div>
          <div className="col-span-2"><Label className="text-[11px]">Match formats (comma separated, empty = any)</Label><Input value={f.formats} onChange={(e) => set("formats", e.target.value)} placeholder="t20, odi, t10" /></div>
          {f.rawPlan ? <p className="col-span-2 text-xs text-muted-foreground">This is a trivia template; its questions are kept unchanged.</p> : (<>
            <div><Label className="text-[11px]">What it asks</Label>
              <Select value={f.generator} onValueChange={(v) => set("generator", v as TForm["generator"])}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="match_winner">Match winner</SelectItem><SelectItem value="innings_total">Innings total (score range)</SelectItem><SelectItem value="over_by_over">One over, ball by ball</SelectItem><SelectItem value="innings_balls">Every ball of the innings (4 options)</SelectItem></SelectContent></Select></div>
            <div><Label className="text-[11px]">Points per question (blank = scoring default)</Label><Input value={f.points} onChange={(e) => set("points", e.target.value.replace(/\D/g, ""))} /></div>
            {f.generator !== "match_winner" && <NumField label="Innings" value={f.innings} min={1} max={4} onChange={(n) => set("innings", n)} />}
            {f.generator === "over_by_over" && <><NumField label="Over" value={f.over} min={1} max={50} onChange={(n) => set("over", n)} /><NumField label="Balls asked" value={f.balls} min={1} max={6} onChange={(n) => set("balls", n)} /></>}
            {f.generator === "innings_total" && <div className="col-span-2"><Label className="text-[11px]">Score thresholds (comma separated, blank = format defaults)</Label><Input value={f.thresholds} onChange={(e) => set("thresholds", e.target.value)} placeholder="140, 170, 200" /></div>}
            {f.generator === "innings_balls" && <><div className="space-y-1"><Label className="text-xs">Overs (blank = full innings)</Label><Input inputMode="numeric" value={f.overs} onChange={(e) => set("overs", e.target.value.replace(/\D/g, "").slice(0, 2))} /></div></>}
            {(f.generator === "over_by_over" || f.generator === "innings_balls") && <p className="col-span-2 rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">Over-by-over contests settle from ball-by-ball data. Keep this template disabled until “Test feed” in Settings recognises your provider's data.</p>}
          </>)}
          <div><Label className="text-[11px]">Trigger</Label>
            <Select value={f.trigger} onValueChange={(v) => set("trigger", v as TForm["trigger"])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pre_match">Before the match</SelectItem><SelectItem value="innings_break">At the innings break</SelectItem><SelectItem value="after_over">After an over</SelectItem><SelectItem value="match_completed">After the match</SelectItem></SelectContent></Select></div>
          <div><Label className="text-[11px]">If discovered late</Label>
            <Select value={f.catchUp} onValueChange={(v) => set("catchUp", v as TForm["catchUp"])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="shorten">Shorten the window</SelectItem><SelectItem value="skip">Skip it</SelectItem></SelectContent></Select></div>
          {f.trigger === "pre_match" ? (<>
            <NumField label="Create (min before start)" value={f.createBeforeMin} onChange={(n) => set("createBeforeMin", n)} />
            <NumField label="Registration opens (min before)" value={f.opensBeforeMin} onChange={(n) => set("opensBeforeMin", n)} />
            <NumField label="Questions lock (min before)" value={f.locksBeforeMin} onChange={(n) => set("locksBeforeMin", n)} />
          </>) : <NumField label="Lock after (min)" value={f.lockAfterMin} onChange={(n) => set("lockAfterMin", n)} />}
          <NumField label="Min open window (min)" value={f.minOpenMin} onChange={(n) => set("minOpenMin", n)} />
          {(f.trigger === "after_over" || f.trigger === "innings_break") && <NumField label="Innings" value={f.tInnings} min={1} max={4} onChange={(n) => set("tInnings", n)} />}
          {f.trigger === "after_over" && <NumField label="After over no." value={f.afterOver} min={1} max={50} onChange={(n) => set("afterOver", n)} />}
          <NumField label="Points per correct" value={f.pointsPerCorrect} min={1} max={1000} onChange={(n) => set("pointsPerCorrect", n)} />
          <NumField label="Penalty per wrong" value={f.negativePerWrong} min={0} max={1000} onChange={(n) => set("negativePerWrong", n)} />
          <div><Label className="text-[11px]">Participant limit (blank = none)</Label><Input value={f.participantLimit} onChange={(e) => set("participantLimit", e.target.value.replace(/\D/g, ""))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {([["autoGenerate", "Generate automatically"], ["requireApproval", "Needs admin approval"], ["allowEdit", "Players may edit before lock"], ["enabled", "Enabled"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between rounded-md border p-2">{label}<Switch checked={f[k]} onCheckedChange={(v) => set(k, v)} /></label>
          ))}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={save} disabled={busy || f.name.trim().length < 2}>Save template</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
type BQ = { prompt: string; options: string[]; correct: number | null; points: number };
const localInput = (offsetMin: number) => { const d = new Date(Date.now() + offsetMin * 60_000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function BuilderTab({ d, reload }: { d: Overview; reload: () => void }) {
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("general");
  const [categoryId, setCategoryId] = useState("");
  const [opens, setOpens] = useState(() => localInput(5));
  const [locks, setLocks] = useState(() => localInput(65));
  const [limit, setLimit] = useState("");
  const [publish, setPublish] = useState(false);
  const [allowEdit, setAllowEdit] = useState(false);
  const [ppc, setPpc] = useState(10);
  const [qs, setQs] = useState<BQ[]>([{ prompt: "", options: ["", ""], correct: null, points: 10 }]);
  const [busy, setBusy] = useState(false);
  const upd = (i: number, patch: Partial<BQ>) => setQs((a) => a.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  async function create() {
    setBusy(true);
    try {
      await createCustomPredContest({ data: {
        title, sport, categoryId: categoryId || null, matchId: null, opensAt: new Date(opens).toISOString(), locksAt: new Date(locks).toISOString(),
        participantLimit: limit ? Number(limit) : null, allowEdit, publish, scoring: { pointsPerCorrect: ppc, negativePerWrong: 0 },
        questions: qs.map((q) => ({ prompt: q.prompt, options: q.options.map((o) => o.trim()).filter(Boolean), correctIndex: q.correct, points: q.points })),
      } });
      toast.success(publish ? "Contest scheduled" : "Saved as draft — approve it in Contests");
      setTitle(""); setQs([{ prompt: "", options: ["", ""], correct: null, points: 10 }]); reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Card className="space-y-3 p-4">
      <p className="text-xs text-muted-foreground">Build a free contest with no code. Give a correct answer for trivia (auto-settled), or leave it unset to settle manually after the lock. Everything is virtual points.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label className="text-[11px]">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
        <div><Label className="text-[11px]">Sport key</Label><Input value={sport} onChange={(e) => setSport(e.target.value)} /></div>
        <div><Label className="text-[11px]">Category</Label>
          <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem>{d.categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-[11px]">Registration opens</Label><Input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></div>
        <div><Label className="text-[11px]">Questions lock</Label><Input type="datetime-local" value={locks} onChange={(e) => setLocks(e.target.value)} /></div>
        <div><Label className="text-[11px]">Participant limit (blank = none)</Label><Input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} /></div>
        <NumField label="Default points per question" value={ppc} min={1} max={1000} onChange={setPpc} />
      </div>
      {qs.map((q, i) => (
        <Card key={i} className="space-y-2 p-3">
          <div className="flex items-center justify-between"><Label className="text-[11px]">Question {i + 1}</Label>{qs.length > 1 && <Button size="icon" variant="ghost" onClick={() => setQs((a) => a.filter((_, k) => k !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>}</div>
          <Input value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} placeholder="Question text" maxLength={300} />
          {q.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type="radio" name={`correct-${i}`} checked={q.correct === k} onChange={() => upd(i, { correct: k })} aria-label="Correct answer" />
              <Input value={o} onChange={(e) => upd(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Option ${k + 1}`} maxLength={120} />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {q.options.length < 8 && <Button size="sm" variant="outline" onClick={() => upd(i, { options: [...q.options, ""] })}>Add option</Button>}
            {q.correct !== null && <Button size="sm" variant="ghost" onClick={() => upd(i, { correct: null })}>Settle manually instead</Button>}
            <span className="text-[11px] text-muted-foreground">{q.correct === null ? "Manual settlement" : `Correct: option ${q.correct + 1}`}</span>
            <div className="ml-auto w-24"><Input type="number" min={1} max={1000} value={q.points} onChange={(e) => upd(i, { points: Number(e.target.value) })} aria-label="Points" /></div>
          </div>
        </Card>
      ))}
      {qs.length < 50 && <Button size="sm" variant="outline" onClick={() => setQs((a) => [...a, { prompt: "", options: ["", ""], correct: null, points: ppc }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add question</Button>}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex items-center justify-between rounded-md border p-2">Schedule now (skip draft review)<Switch checked={publish} onCheckedChange={setPublish} /></label>
        <label className="flex items-center justify-between rounded-md border p-2">Players may edit before lock<Switch checked={allowEdit} onCheckedChange={setAllowEdit} /></label>
      </div>
      <Button onClick={create} disabled={busy || title.trim().length < 3}>{publish ? "Create & schedule" : "Save as draft"}</Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function ConfigTab({ d, reload }: { d: Overview; reload: () => void }) {
  const [engine, setEngine] = useState(d.settings.engineEnabled);
  const [bbb, setBbb] = useState(d.settings.bbbEnabled);
  const r = (d.settings.rewards ?? { participation: 5, perCorrect: 2, rankBonus: [50, 30, 20], maxPerContest: 200, dailyCap: 1000 }) as any;
  const [rw, setRw] = useState({ participation: r.participation, perCorrect: r.perCorrect, rankBonus: (r.rankBonus ?? []).join(", "), maxPerContest: r.maxPerContest, dailyCap: r.dailyCap });
  const [cat, setCat] = useState({ key: "", name: "", sport: "cricket", description: "" });
  const [matches, setMatches] = useState<any[]>([]);
  const [matchId, setMatchId] = useState("");
  const [probe, setProbe] = useState<any | null>(null);
  useEffect(() => { listSportsMatchesAdmin().then((m: any) => setMatches(m ?? [])).catch(() => undefined); }, []);
  const liveFirst = useMemo(() => [...matches].sort((a, b) => Number(b.is_live) - Number(a.is_live)).slice(0, 40), [matches]);

  async function saveSettings() {
    try {
      await savePredSettings({ data: { engineEnabled: engine, bbbEnabled: bbb, rewards: { participation: rw.participation, perCorrect: rw.perCorrect, rankBonus: nums(String(rw.rankBonus)), maxPerContest: rw.maxPerContest, dailyCap: rw.dailyCap } } });
      toast.success("Settings saved"); reload();
    } catch (e) { toast.error(errMsg(e)); }
  }
  async function addCategory() {
    try { await upsertPredCategory({ data: { key: cat.key, name: cat.name, sport: cat.sport, description: cat.description || null, enabled: true, sortOrder: 100 } }); toast.success("Category added"); setCat({ key: "", name: "", sport: "cricket", description: "" }); reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="text-sm font-semibold">Engine & rewards</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center justify-between rounded-md border p-2">Automation enabled<Switch checked={engine} onCheckedChange={setEngine} /></label>
          <label className="flex items-center justify-between rounded-md border p-2">Fetch ball-by-ball data<Switch checked={bbb} onCheckedChange={setBbb} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <NumField label="Participation points" value={rw.participation} max={1000} onChange={(n) => setRw({ ...rw, participation: n })} />
          <NumField label="Points per correct answer" value={rw.perCorrect} max={1000} onChange={(n) => setRw({ ...rw, perCorrect: n })} />
          <div><Label className="text-[11px]">Rank bonus (rank 1, 2, 3…)</Label><Input value={rw.rankBonus} onChange={(e) => setRw({ ...rw, rankBonus: e.target.value })} /></div>
          <NumField label="Max per contest" value={rw.maxPerContest} max={100000} onChange={(n) => setRw({ ...rw, maxPerContest: n })} />
          <NumField label="Daily cap per player" value={rw.dailyCap} max={1000000} onChange={(n) => setRw({ ...rw, dailyCap: n })} />
        </div>
        <Button onClick={saveSettings}><CheckCircle2 className="mr-1 h-4 w-4" /> Save settings</Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="text-sm font-semibold">Ball-by-ball feed check</div>
        <p className="text-xs text-muted-foreground">Fetches the provider's ball-by-ball data for one match and shows how many rows were recognised. Nothing is stored. Over-by-over contests should only be enabled when this recognises the data.</p>
        <div className="flex flex-wrap gap-2">
          <Select value={matchId} onValueChange={setMatchId}><SelectTrigger className="w-72"><SelectValue placeholder="Choose a match" /></SelectTrigger>
            <SelectContent>{liveFirst.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.is_live ? "🔴 " : ""}{m.name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" disabled={!matchId} onClick={async () => { try { setProbe(await testPredBallFeed({ data: { matchId } })); } catch (e) { setProbe(null); toast.error(errMsg(e)); } }}>Test feed</Button>
        </div>
        {probe && <div className="rounded-md border p-2 text-xs">{probe.match}: <b>{probe.recognised}</b> of {probe.total} rows recognised, {probe.rejected} rejected.{probe.total > 0 && probe.recognised === 0 ? " The provider's format is not supported yet — keep over-by-over contests disabled." : ""}</div>}
      </Card>

      <Card className="space-y-2 p-4">
        <div className="text-sm font-semibold">Sports</div>
        {d.sports.map((s: any) => (
          <label key={s.key} className="flex items-center justify-between rounded-md border p-2 text-xs">
            <span>{s.name} {!s.provider_supported && <span className="text-muted-foreground">· admin-built contests only (no live provider)</span>}</span>
            <Switch checked={s.enabled} onCheckedChange={async (v) => { try { await setPredSportEnabled({ data: { key: s.key, enabled: v } }); reload(); } catch (e) { toast.error(errMsg(e)); } }} />
          </label>
        ))}
      </Card>

      <Card className="space-y-2 p-4">
        <div className="text-sm font-semibold">Categories</div>
        {d.categories.map((c: any) => (
          <label key={c.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
            <span><b>{c.name}</b> <span className="text-muted-foreground">· {c.sport}{c.description ? ` · ${c.description}` : ""}</span></span>
            <Switch checked={c.enabled} onCheckedChange={async (v) => { try { await upsertPredCategory({ data: { id: c.id, key: c.key, name: c.name, description: c.description, sport: c.sport, enabled: v, sortOrder: c.sort_order } }); reload(); } catch (e) { toast.error(errMsg(e)); } }} />
          </label>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2 md:grid-cols-4">
          <Input placeholder="key (a_b_c)" value={cat.key} onChange={(e) => setCat({ ...cat, key: e.target.value.toLowerCase() })} />
          <Input placeholder="Name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
          <Input placeholder="Sport" value={cat.sport} onChange={(e) => setCat({ ...cat, sport: e.target.value })} />
          <Button variant="outline" onClick={addCategory} disabled={cat.key.length < 2 || cat.name.length < 2}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
type Monitoring = Awaited<ReturnType<typeof getPredMonitoring>>;
function MonitorTab() {
  const [m, setM] = useState<Monitoring | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { setM(await getPredMonitoring()); setErr(null); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err) return <Card className="p-4 text-sm text-destructive">{err}</Card>;
  if (!m) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const kinds = Object.entries(m.notificationKinds);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={load} disabled={busy}><RefreshCw className={`mr-1 h-3 w-3 ${busy ? "animate-spin" : ""}`} /> Refresh</Button></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Entries (24h)" value={String(m.activity24h.entries)} tone="ok" />
        <Stat label="Point credits (24h)" value={String(m.activity24h.pointCredits)} tone="ok" />
        {Object.entries(m.contestsByStatus).map(([k, v]) => <Stat key={k} label={`Contests · ${k}`} value={String(v)} tone="ok" />)}
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b p-3 text-sm font-semibold">Overall leaderboard (top 20)</div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Points</th><th className="p-2">Correct</th><th className="p-2">Contests</th></tr></thead>
          <tbody>
            {m.leaderboard.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No scored contests yet.</td></tr>}
            {m.leaderboard.map((r) => <tr key={r.rank} className="border-t"><td className="p-2">{r.rank}</td><td className="p-2">{r.name ?? "Player"}</td><td className="p-2 font-semibold">{r.points}</td><td className="p-2">{r.correct}</td><td className="p-2">{r.contests}</td></tr>)}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="border-b p-3 text-sm font-semibold">Notifications created (latest 200)</div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">Type</th><th className="p-2">Total</th><th className="p-2">Last 24h</th></tr></thead>
          <tbody>
            {kinds.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">None yet.</td></tr>}
            {kinds.map(([k, v]) => <tr key={k} className="border-t"><td className="p-2">{k}</td><td className="p-2">{v.total}</td><td className="p-2">{v.last24h}</td></tr>)}
          </tbody>
        </table>
        <div className="border-t p-3 text-[11px] text-muted-foreground">These are in-app alerts (bell and Notifications page). Delivery is by database insert, so “created” means “visible to the user”. Push delivery is handled by the existing push campaigns.</div>
        <table className="w-full text-xs">
          <tbody>{m.recentNotifications.map((n) => <tr key={n.id} className="border-t"><td className="p-2">{fmt(n.created_at)}</td><td className="p-2"><Badge variant="outline">{n.kind}</Badge></td><td className="p-2">{n.title}</td><td className="p-2 text-muted-foreground">{n.audience}</td></tr>)}</tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="border-b p-3 text-sm font-semibold">Audit log (engine and admin actions)</div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">When</th><th className="p-2">Action</th><th className="p-2">Subject</th><th className="p-2">Actor</th><th className="p-2">Result</th></tr></thead>
          <tbody>
            {m.audit.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No actions logged yet.</td></tr>}
            {m.audit.map((a) => <tr key={a.id} className="border-t"><td className="p-2">{fmt(a.created_at)}</td><td className="p-2">{a.action}</td><td className="max-w-[10rem] truncate p-2">{a.target_id ?? ""}</td><td className="p-2">{a.actor}</td><td className="p-2"><Badge variant={a.result === "success" ? "default" : "destructive"}>{a.result}</Badge></td></tr>)}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
