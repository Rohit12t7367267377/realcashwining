import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthSession } from "@/hooks/use-auth-session";
import { cn } from "@/lib/utils";
import { Loader2, Trophy, Code2 } from "lucide-react";
import { toast } from "sonner";
import { getCodingLeaderboard, listCodingProblems, submitCode } from "@/lib/coding.functions";
import { LANGUAGES, type Language } from "@/lib/coding";

export const Route = createFileRoute("/coding/$id")({
  head: () => ({ meta: [{ title: "Coding contest — Guru-G" }] }),
  component: CodingContest,
});

type Data = Awaited<ReturnType<typeof listCodingProblems>>;
type Board = Awaited<ReturnType<typeof getCodingLeaderboard>>;
type Prob = { id: string; title: string; statement: string; input_format: string; output_format: string; constraints_text: string; sample_input: string; sample_output: string; difficulty: string; points: number; time_limit_ms: number; memory_limit_mb: number };
type Sub = { id: string; problem_id: string; language: string; status: string; passed: number; total: number; score: number; created_at: string };
const STARTER: Record<Language, string> = {
  python: "n = int(input())\nprint(n)\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\nint main(){ long long n; cin>>n; cout<<n<<endl; }\n",
  c: "#include <stdio.h>\nint main(){ long long n; scanf(\"%lld\",&n); printf(\"%lld\\n\",n); return 0; }\n",
  java: "import java.util.*;\npublic class Main { public static void main(String[] a){ Scanner s=new Scanner(System.in); System.out.println(s.nextLong()); } }\n",
  javascript: "const n = require('fs').readFileSync(0,'utf8').trim();\nconsole.log(n);\n",
};
const LABEL: Record<string, string> = {
  accepted: "Accepted", partial: "Partially correct", wrong_answer: "Wrong answer", time_limit: "Time limit exceeded", memory_limit: "Memory limit exceeded",
  runtime_error: "Runtime error", compile_error: "Compile error", judge_unavailable: "Judge unavailable", internal_error: "Judge error", queued: "Queued", running: "Running",
};

function CodingContest() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuthSession();
  const [data, setData] = useState<Data | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [active, setActive] = useState(0);
  const [lang, setLang] = useState<Language>("python");
  const [code, setCode] = useState(STARTER.python);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ verdict: string; passed: number; total: number; score: number; message?: string | null; compileOutput?: string | null } | null>(null);
  const [tab, setTab] = useState<"problem" | "board">("problem");

  const load = useCallback(async () => {
    try { setData(await listCodingProblems({ data: { contestId: id } })); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load"); }
  }, [id]);
  useEffect(() => { if (!authLoading && !user) void nav({ to: "/auth" }); else if (user) void load(); }, [authLoading, user, load, nav]);
  useEffect(() => { if (tab === "board") void getCodingLeaderboard({ data: { contestId: id } }).then(setBoard).catch(() => setBoard(null)); }, [tab, id]);

  const problem = (data?.problems as Prob[] | undefined)?.[active];
  const mine = ((data?.submissions ?? []) as Sub[]).filter((s) => s.problem_id === problem?.id);

  async function submit() {
    if (!problem) return;
    setBusy(true); setLast(null);
    try {
      const r = await submitCode({ data: { problemId: problem.id, language: lang, source: code } });
      setLast(r as never);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not submit"); } finally { setBusy(false); }
  }

  if (!data) return <AppShell><div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></div></AppShell>;
  if (!data.contest) return <AppShell><p className="p-6 text-center text-sm">Contest not found. <Link to="/" className="font-bold text-primary">Back</Link></p></AppShell>;

  return (
    <AppShell>
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0"><h1 className="flex items-center gap-2 truncate text-lg font-black"><Code2 className="h-5 w-5 shrink-0" /> {data.contest.title}</h1>
          <p className="text-[11px] text-muted-foreground">Free practice contest · virtual points only · code runs on an isolated judge</p></div>
        <div className="flex gap-1">
          <Button size="sm" variant={tab === "problem" ? "default" : "outline"} onClick={() => setTab("problem")}>Problems</Button>
          <Button size="sm" variant={tab === "board" ? "default" : "outline"} onClick={() => setTab("board")}><Trophy className="mr-1 h-4 w-4" />Ranking</Button>
        </div>
      </header>

      {tab === "board" ? (
        <div className="rounded-2xl bg-card p-3 shadow-soft">
          {!board ? <Loader2 className="mx-auto animate-spin" /> : board.rows.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">No scored submissions yet.</p> : (
            <table className="w-full text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="py-1">#</th><th>Player</th><th>Solved</th><th className="text-right">Score</th></tr></thead>
              <tbody>{board.rows.map((r) => <tr key={r.userId} className={cn("border-t border-border", r.userId === board.me && "bg-primary/10 font-bold")}><td className="py-1">{r.rank}</td><td>{r.name}</td><td>{r.solved}</td><td className="text-right">{r.score}</td></tr>)}</tbody></table>
          )}
        </div>
      ) : !problem ? <p className="p-6 text-center text-sm text-muted-foreground">No problems have been added yet.</p> : (
        <>
          <div className="mb-3 flex gap-1 overflow-x-auto">{(data.problems as Prob[]).map((p, i) => <Button key={p.id} size="sm" variant={i === active ? "default" : "outline"} onClick={() => { setActive(i); setLast(null); }}>{i + 1}. {p.title}</Button>)}</div>
          <article className="rounded-2xl bg-card p-4 text-sm shadow-soft">
            <div className="flex items-center justify-between"><h2 className="font-black">{problem.title}</h2><span className="text-[11px] text-muted-foreground">{problem.difficulty} · {problem.points} pts · {problem.time_limit_ms} ms · {problem.memory_limit_mb} MB</span></div>
            <p className="mt-2 whitespace-pre-wrap">{problem.statement}</p>
            {problem.input_format && <><h3 className="mt-3 text-xs font-bold uppercase">Input</h3><p className="whitespace-pre-wrap">{problem.input_format}</p></>}
            {problem.output_format && <><h3 className="mt-3 text-xs font-bold uppercase">Output</h3><p className="whitespace-pre-wrap">{problem.output_format}</p></>}
            {problem.constraints_text && <><h3 className="mt-3 text-xs font-bold uppercase">Constraints</h3><p className="whitespace-pre-wrap">{problem.constraints_text}</p></>}
            {(problem.sample_input || problem.sample_output) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div><h3 className="text-xs font-bold uppercase">Sample input</h3><pre className="overflow-x-auto rounded-lg bg-muted p-2 text-xs">{problem.sample_input}</pre></div>
                <div><h3 className="text-xs font-bold uppercase">Sample output</h3><pre className="overflow-x-auto rounded-lg bg-muted p-2 text-xs">{problem.sample_output}</pre></div>
              </div>)}
          </article>

          <div className="mt-3 rounded-2xl bg-card p-3 shadow-soft">
            <div className="mb-2 flex items-center gap-2">
              <Select value={lang} onValueChange={(v: Language) => { setLang(v); setCode(STARTER[v]); }}>
                <SelectTrigger className="w-44" aria-label="Language"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(LANGUAGES) as Language[]).map((k) => <SelectItem key={k} value={k}>{LANGUAGES[k].label}</SelectItem>)}</SelectContent>
              </Select>
              <Button className="ml-auto bg-gradient-primary font-bold" disabled={busy || !code.trim()} onClick={() => void submit()}>{busy ? <Loader2 className="animate-spin" /> : "Submit"}</Button>
            </div>
            <Textarea aria-label="Code editor" spellCheck={false} className="min-h-64 font-mono text-xs" value={code} onChange={(e) => setCode(e.target.value)} />
            {last && (
              <div className={cn("mt-2 rounded-xl p-3 text-sm", last.verdict === "accepted" ? "bg-success/15" : "bg-muted")} role="status">
                <b>{LABEL[last.verdict] ?? last.verdict}</b> · {last.passed}/{last.total} tests · {last.score} pts
                {last.message && <p className="mt-1 text-xs">{last.message}</p>}
                {last.compileOutput && <pre className="mt-1 overflow-x-auto text-xs">{last.compileOutput}</pre>}
              </div>)}
          </div>

          {mine.length > 0 && (
            <div className="mt-3 rounded-2xl bg-card p-3 shadow-soft"><h3 className="mb-1 text-xs font-bold uppercase">Your submissions</h3>
              {mine.slice(0, 10).map((s) => <div key={s.id} className="flex justify-between border-t border-border py-1 text-xs"><span>{new Date(s.created_at).toLocaleTimeString()} · {s.language}</span><span className="font-bold">{LABEL[s.status] ?? s.status} · {s.passed}/{s.total} · {s.score}</span></div>)}
            </div>)}
        </>
      )}
    </AppShell>
  );
}
