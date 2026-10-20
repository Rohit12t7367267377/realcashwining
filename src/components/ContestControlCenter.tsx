import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { adminContestNote, adminContestOverview } from "@/lib/contest-admin.functions";
import { adminAddTestcase, adminDeleteProblem, adminDeleteTestcase, adminListCoding, adminRejudge, adminUpsertProblem } from "@/lib/coding.functions";

type C = { id: string; title: string; contest_type: string };
const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");

/** Admin: dashboard / participants / results / anti-cheat flags / audit, and the coding-problem manager. Read-mostly. */
export function ContestControlCenter() {
  const [contests, setContests] = useState<C[]>([]);
  const [cid, setCid] = useState("");
  useEffect(() => {
    void supabase.from("contests").select("id, title, contest_type").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { const rows = (data ?? []) as C[]; setContests(rows); if (rows[0]) setCid(rows[0].id); });
  }, []);
  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Contest control center</h2>
        <Select value={cid} onValueChange={setCid}>
          <SelectTrigger className="w-full max-w-sm" aria-label="Contest"><SelectValue placeholder="Pick a contest" /></SelectTrigger>
          <SelectContent>{contests.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}{c.contest_type === "coding" ? " · coding" : ""}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {cid ? (
        <Tabs defaultValue="overview" className="mt-3">
          <TabsList><TabsTrigger value="overview">Dashboard &amp; results</TabsTrigger><TabsTrigger value="flags">Review flags</TabsTrigger><TabsTrigger value="coding">Coding</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger></TabsList>
          <Overview contestId={cid} />
          <TabsContent value="coding"><CodingAdmin contestId={cid} /></TabsContent>
        </Tabs>
      ) : <p className="mt-3 text-sm text-muted-foreground">No contests yet.</p>}
    </Card>
  );
}

function Overview({ contestId }: { contestId: string }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof adminContestOverview>> | null>(null);
  const [note, setNote] = useState("");
  const load = useCallback(() => { setD(null); adminContestOverview({ data: { contestId } }).then(setD).catch(err); }, [contestId]);
  useEffect(load, [load]);
  if (!d) return <TabsContent value="overview"><Loader2 className="mx-auto mt-4 animate-spin" /></TabsContent>;
  const s = d.stats;
  const tile = (l: string, v: string | number) => <div className="rounded-xl bg-muted p-3"><div className="text-[10px] uppercase text-muted-foreground">{l}</div><div className="text-xl font-black">{v}</div></div>;
  return (
    <>
      <TabsContent value="overview">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">{tile("Participants", s.participants)}{tile("Submitted", s.submitted)}{tile("Completion", `${s.completionRate}%`)}{tile("Avg score", s.avgScore)}{tile("Top score", s.maxScore)}{tile("Flagged", s.flagged)}</div>
        <p className="mt-2 text-xs text-muted-foreground">Scoring: {d.contest.marks_correct != null ? `+${d.contest.marks_correct} / ${d.contest.marks_wrong ?? 0} per question (exam marking)` : "global points setting"} · {d.contest.num_questions} questions · {d.contest.duration_minutes} min · results: {d.contest.results_status ?? "pending"}</p>
        <table className="mt-3 w-full text-left text-xs"><thead><tr className="text-muted-foreground"><th className="py-1">Rank</th><th>Player</th><th>Score</th><th>Violations</th></tr></thead>
          <tbody>{d.top.map((r, i) => <tr key={r.attemptId} className="border-t border-border"><td className="py-1">{r.rank ?? i + 1}</td><td>{r.name}</td><td>{r.score}</td><td>{r.violations}</td></tr>)}</tbody></table>
        {d.top.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No submitted attempts yet.</p>}
      </TabsContent>
      <TabsContent value="flags">
        <p className="text-xs text-muted-foreground">Advisory signals only: nothing is disqualified automatically. Review and decide through the normal results flow.</p>
        <table className="mt-2 w-full text-left text-xs"><thead><tr className="text-muted-foreground"><th className="py-1">Player</th><th>Signal</th><th>Detail</th></tr></thead>
          <tbody>{d.flags.map((f, i) => <tr key={i} className="border-t border-border"><td className="py-1">{f.name}</td><td className="font-bold">{f.code.replace("_", " ")}</td><td>{f.detail}</td></tr>)}</tbody></table>
        {d.flags.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nothing flagged.</p>}
        <div className="mt-3 flex gap-2"><Input aria-label="Review note" placeholder="Add a review note to the audit log" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => adminContestNote({ data: { contestId, note } }).then(() => { toast.success("Note saved"); setNote(""); load(); }).catch(err)} disabled={note.trim().length < 3}>Save</Button></div>
      </TabsContent>
      <TabsContent value="audit">
        <table className="w-full text-left text-xs"><thead><tr className="text-muted-foreground"><th className="py-1">When</th><th>Action</th><th>Target</th><th>Note</th></tr></thead>
          <tbody>{d.audit.map((a: any) => <tr key={a.id} className="border-t border-border"><td className="py-1">{new Date(a.created_at).toLocaleString()}</td><td className="font-bold">{a.action}</td><td>{a.target_type}</td><td>{a.reason ?? ""}</td></tr>)}</tbody></table>
        {d.audit.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No audit entries for this contest yet.</p>}
      </TabsContent>
    </>
  );
}

function CodingAdmin({ contestId }: { contestId: string }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof adminListCoding>> | null>(null);
  const [p, setP] = useState({ title: "", statement: "", sampleInput: "", sampleOutput: "", points: 100, timeLimitMs: 2000 });
  const [tc, setTc] = useState({ problemId: "", input: "", expectedOutput: "" });
  const load = useCallback(() => { adminListCoding({ data: { contestId } }).then(setD).catch(err); }, [contestId]);
  useEffect(load, [load]);
  if (!d) return <Loader2 className="mx-auto mt-4 animate-spin" />;
  return (
    <div className="space-y-4">
      {!d.judgeConfigured && <p className="rounded-xl bg-destructive/10 p-3 text-xs">No code judge is configured. Set <code>JUDGE0_URL</code> (https) and optionally <code>JUDGE0_AUTH_TOKEN</code> in the server secrets. Until then submissions are saved but not scored, and no code is ever run on this server.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        <div><Label className="text-xs">Title</Label><Input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">Points</Label><Input type="number" value={p.points} onChange={(e) => setP({ ...p, points: Number(e.target.value) })} /></div><div><Label className="text-xs">Time limit (ms)</Label><Input type="number" value={p.timeLimitMs} onChange={(e) => setP({ ...p, timeLimitMs: Number(e.target.value) })} /></div></div>
        <div className="md:col-span-2"><Label className="text-xs">Statement</Label><Textarea value={p.statement} onChange={(e) => setP({ ...p, statement: e.target.value })} /></div>
        <div><Label className="text-xs">Sample input</Label><Textarea value={p.sampleInput} onChange={(e) => setP({ ...p, sampleInput: e.target.value })} /></div>
        <div><Label className="text-xs">Sample output</Label><Textarea value={p.sampleOutput} onChange={(e) => setP({ ...p, sampleOutput: e.target.value })} /></div>
      </div>
      <Button onClick={() => adminUpsertProblem({ data: { values: { contestId, title: p.title, statement: p.statement, sampleInput: p.sampleInput, sampleOutput: p.sampleOutput, points: p.points, timeLimitMs: p.timeLimitMs, inputFormat: "", outputFormat: "", constraintsText: "", difficulty: "medium", memoryLimitMb: 256, sortOrder: d.problems.length, active: true } } }).then(() => { toast.success("Problem added"); setP({ ...p, title: "", statement: "" }); load(); }).catch(err)}>Add problem</Button>

      {d.problems.map((x: any) => (
        <div key={x.id} className="rounded-xl border border-border p-3 text-sm">
          <div className="flex items-center justify-between"><b>{x.title}</b><span className="text-xs text-muted-foreground">{x.points} pts · {x.coding_testcases?.length ?? 0} hidden tests</span>
            <Button size="icon" variant="ghost" aria-label="Delete problem" onClick={() => adminDeleteProblem({ data: { id: x.id } }).then(load).catch(err)}><Trash2 className="h-4 w-4" /></Button></div>
          {(x.coding_testcases ?? []).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{x.coding_testcases.map((t: any, i: number) => <Button key={t.id} size="sm" variant="outline" onClick={() => adminDeleteTestcase({ data: { id: t.id } }).then(load).catch(err)}>test {i + 1} ✕</Button>)}</div>}
        </div>
      ))}
      {d.problems.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-3">
          <Label className="text-xs">Add hidden test case</Label>
          <Select value={tc.problemId} onValueChange={(problemId) => setTc({ ...tc, problemId })}><SelectTrigger aria-label="Problem"><SelectValue placeholder="Problem" /></SelectTrigger><SelectContent>{d.problems.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.title}</SelectItem>)}</SelectContent></Select>
          <div className="mt-2 grid gap-2 md:grid-cols-2"><Textarea aria-label="Input" placeholder="stdin" value={tc.input} onChange={(e) => setTc({ ...tc, input: e.target.value })} /><Textarea aria-label="Expected output" placeholder="expected stdout" value={tc.expectedOutput} onChange={(e) => setTc({ ...tc, expectedOutput: e.target.value })} /></div>
          <Button className="mt-2" disabled={!tc.problemId || !tc.expectedOutput} onClick={() => adminAddTestcase({ data: { problemId: tc.problemId, input: tc.input, expectedOutput: tc.expectedOutput, weight: 1, sortOrder: 0 } }).then(() => { toast.success("Test added"); setTc({ ...tc, input: "", expectedOutput: "" }); load(); }).catch(err)}>Add test</Button>
        </div>)}

      <div><h3 className="text-xs font-bold uppercase">Recent submissions</h3>
        <table className="mt-1 w-full text-left text-xs"><tbody>{d.submissions.slice(0, 30).map((s: any) => (
          <tr key={s.id} className="border-t border-border"><td className="py-1">{new Date(s.created_at).toLocaleString()}</td><td>{s.language}</td><td className="font-bold">{s.status}</td><td>{s.passed}/{s.total}</td><td>{s.score}</td>
            <td><Button size="icon" variant="ghost" aria-label="Rejudge" onClick={() => adminRejudge({ data: { submissionId: s.id } }).then(() => { toast.success("Rejudged"); load(); }).catch(err)}><RotateCw className="h-3 w-3" /></Button></td></tr>))}</tbody></table></div>
    </div>
  );
}
