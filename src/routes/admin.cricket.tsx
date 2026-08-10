import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, Radio, Sparkles, ShieldCheck, BookOpenCheck, Link2, Bot } from "lucide-react";
import {
  getSportsConfig,
  saveSportsConfig,
  refreshSportsFeed,
  listSportsMatchesAdmin,
  listMatchContests,
  linkContestToMatch,
  generateMatchDrafts,
  generateMatchReading,
  listQuizDrafts,
  updateQuizDraft,
  approveQuizDrafts,
  rejectQuizDrafts,
  runSportsAutomationNow,
} from "@/lib/admin-sports.functions";

export const Route = createFileRoute("/admin/cricket")({ component: Page });

type Cfg = Awaited<ReturnType<typeof getSportsConfig>>;
type Match = Awaited<ReturnType<typeof listSportsMatchesAdmin>>[number];
type Contest = Awaited<ReturnType<typeof listMatchContests>>[number];
type Draft = Awaited<ReturnType<typeof listQuizDrafts>>[number];

function Page() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [approveCat, setApproveCat] = useState("");
  const [genMatch, setGenMatch] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, m, ct, d] = await Promise.all([
        getSportsConfig(),
        listSportsMatchesAdmin(),
        listMatchContests(),
        listQuizDrafts({ data: { status: "pending" } }),
      ]);
      setCfg(c);
      setMatches(m);
      setContests(ct);
      setDrafts(d);
      const { data: categories } = await supabase.from("categories").select("id, name").order("sort_order");
      setCats(categories ?? []);
      if (!approveCat && categories?.length) setApproveCat(categories[0].id);
      if (!genMatch && m.length) setGenMatch(m[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sports settings");
    }
  }, [approveCat, genMatch]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Cfg>(k: K) => (v: Cfg[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function save() {
    if (!cfg) return;
    setBusy(true);
    try {
      await saveSportsConfig({
        data: {
          enabled: cfg.enabled,
          refreshSeconds: cfg.refreshSeconds,
          autoQuiz: cfg.autoQuiz,
          autoResult: cfg.autoResult,
          autoReading: cfg.autoReading,
          questionsPerMatch: cfg.questionsPerMatch,
          requireReview: cfg.requireReview,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        },
      });
      setApiKey("");
      toast.success("Sports settings saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<string>) {
    setBusy(true);
    try {
      toast.success(await fn());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-3xl font-bold">
        <Radio className="h-6 w-6" /> Sports Automation
      </h1>
      <p className="mb-6 text-muted-foreground">
        Live sports feed, AI question drafting from verified match data, and automatic sports results. Every AI draft
        needs your approval before it goes live.
      </p>

      <div className="max-w-4xl space-y-4">
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Live sports data provider</h2>
          <div className="flex items-center justify-between">
            <Label>Live sports feed enabled</Label>
            <Switch checked={!!cfg?.enabled} onCheckedChange={set("enabled")} />
          </div>
          <div>
            <Label>API key {cfg?.hasKey ? "(saved — leave blank to keep)" : "(required)"}</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={cfg?.hasKey ? "•••••••• saved" : "paste-your-live-sports-api-key"}
              className="font-mono"
              type="password"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Stored on the server only — it is never sent to the app or shown here again.
            </p>
          </div>
          <div>
            <Label>Refresh interval (seconds)</Label>
            <Input
              type="number"
              min={30}
              value={cfg?.refreshSeconds ?? 60}
              onChange={(e) => set("refreshSeconds")(Number(e.target.value) as never)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || !cfg}>Save</Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act(async () => {
                const r = await refreshSportsFeed();
                return `Fetched ${r.total} matches (${r.upserted} stored)`;
              })}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh live matches
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Sports automation switches</h2>
          <Row label="Auto quiz drafting" hint="Draft match questions from verified live data for the linked contests.">
            <Switch checked={!!cfg?.autoQuiz} onCheckedChange={set("autoQuiz")} />
          </Row>
          <Row label="Auto sports results" hint="Finalise a sports contest only after the provider confirms the match ended.">
            <Switch checked={!!cfg?.autoResult} onCheckedChange={set("autoResult")} />
          </Row>
          <Row label="Auto reading passages" hint="Allow AI to draft match reading-comprehension passages (saved inactive).">
            <Switch checked={!!cfg?.autoReading} onCheckedChange={set("autoReading")} />
          </Row>
          <Row label="Admin review required" hint="Keep ON so no AI question can reach users without your approval.">
            <Switch checked={!!cfg?.requireReview} onCheckedChange={set("requireReview")} />
          </Row>
          <div className="max-w-xs">
            <Label>Questions drafted per match</Label>
            <Input
              type="number"
              min={1}
              max={25}
              value={cfg?.questionsPerMatch ?? 5}
              onChange={(e) => set("questionsPerMatch")(Number(e.target.value) as never)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || !cfg}>Save switches</Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act(async () => {
                const r = await runSportsAutomationNow();
                return `Drafted ${r.drafted} question(s) · finalised ${r.finalized.length} contest(s)`;
              })}
            >
              <Bot className="mr-1 h-4 w-4" /> Run sports automation now
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" /> Draft from a live match</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Match</Label>
              <Select value={genMatch} onValueChange={setGenMatch}>
                <SelectTrigger><SelectValue placeholder="Pick a match" /></SelectTrigger>
                <SelectContent>
                  {matches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.is_live ? "● " : ""}{m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>How many</Label>
              <Input type="number" min={1} max={25} value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !genMatch}
              onClick={() => act(async () => {
                const r = await generateMatchDrafts({ data: { match_id: genMatch, count: genCount, difficulty: "mixed" } });
                return `${r.drafted} question(s) drafted for review`;
              })}
            >
              <Sparkles className="mr-1 h-4 w-4" /> Draft questions
            </Button>
            <Button
              variant="outline"
              disabled={busy || !genMatch}
              onClick={() => act(async () => {
                const r = await generateMatchReading({
                  data: { match_id: genMatch, category_id: approveCat || null, num_questions: 5 },
                });
                return `Reading passage drafted (${r.questions} questions) — activate it in Reading admin`;
              })}
            >
              <BookOpenCheck className="mr-1 h-4 w-4" /> Draft reading passage
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Question review queue ({drafts.length})</h2>
          <div className="max-w-xs">
            <Label>Publish approved questions into category</Label>
            <Select value={approveCat} onValueChange={setApproveCat}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {drafts.map((d) => (
              <DraftRow
                key={d.id}
                draft={d}
                busy={busy}
                onSave={(vals) => act(async () => {
                  await updateQuizDraft({ data: { id: d.id, ...vals } });
                  return "Draft updated";
                })}
                onApprove={() => act(async () => {
                  if (!approveCat) throw new Error("Pick a category first");
                  const r = await approveQuizDrafts({ data: { ids: [d.id], category_id: approveCat } });
                  return `${r.published} question(s) published`;
                })}
                onReject={() => act(async () => {
                  await rejectQuizDrafts({ data: { ids: [d.id] } });
                  return "Draft rejected";
                })}
              />
            ))}
            {!drafts.length && <div className="text-sm text-muted-foreground">No drafts awaiting review.</div>}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4" /> Link contests to a live match</h2>
          <p className="text-xs text-muted-foreground">
            A linked contest can draft questions from that match and its results wait for the official match result.
          </p>
          <div className="space-y-2">
            {contests.map((c) => (
              <ContestRow
                key={c.id}
                contest={c}
                matches={matches}
                busy={busy}
                onSave={(vals) => act(async () => {
                  await linkContestToMatch({ data: { contest_id: c.id, ...vals } });
                  return "Contest updated";
                })}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Live matches</h2>
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b pb-2 text-sm">
                <div>
                  <div className="font-medium">
                    {m.name} {m.is_live && <span className="ml-2 text-xs font-bold text-destructive">● LIVE</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.status} · {m.venue}</div>
                </div>
                <div className="font-mono text-xs">{m.score_a || "—"} vs {m.score_b || "—"}</div>
              </div>
            ))}
            {!matches.length && <div className="text-sm text-muted-foreground">No matches cached yet. Click refresh.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function DraftRow({
  draft,
  busy,
  onSave,
  onApprove,
  onReject,
}: {
  draft: Draft;
  busy: boolean;
  onSave: (v: { question: string; options: string[]; correct_index: number; explanation: string | null }) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const initial = (Array.isArray(draft.options) ? (draft.options as unknown[]).map(String) : ["", "", "", ""]).slice(0, 4);
  while (initial.length < 4) initial.push("");
  const [q, setQ] = useState(draft.question);
  const [opts, setOpts] = useState<string[]>(initial);
  const [correct, setCorrect] = useState(draft.correct_index);
  const [exp, setExp] = useState(draft.explanation ?? "");

  return (
    <div className="rounded-lg border p-3">
      <Textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={correct === i}
              onChange={() => setCorrect(i)}
              aria-label={`Correct answer ${i + 1}`}
            />
            <Input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
        ))}
      </div>
      <Input className="mt-2" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="Explanation" />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => onSave({ question: q, options: opts, correct_index: correct, explanation: exp || null })}>
          Save edit
        </Button>
        <Button size="sm" disabled={busy} onClick={onApprove}>Approve &amp; publish</Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={onReject}>Reject</Button>
      </div>
    </div>
  );
}

function ContestRow({
  contest,
  matches,
  busy,
  onSave,
}: {
  contest: Contest;
  matches: Match[];
  busy: boolean;
  onSave: (v: { match_id: string | null; auto_quiz: boolean; auto_result: boolean; review_required: boolean }) => void;
}) {
  const [matchId, setMatchId] = useState(contest.match_id ?? "none");
  const [autoQuiz, setAutoQuiz] = useState(!!contest.auto_quiz);
  const [autoResult, setAutoResult] = useState(contest.auto_result !== false);
  const [review, setReview] = useState(contest.review_required !== false);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b pb-2 text-sm">
      <div className="min-w-[160px] flex-1">
        <div className="font-medium">{contest.title}</div>
        <div className="text-xs text-muted-foreground">
          {contest.starts_at ? new Date(contest.starts_at).toLocaleString() : "no start"} → {contest.ends_at ? new Date(contest.ends_at).toLocaleString() : "no end"} · {contest.results_status}
        </div>
      </div>
      <Select value={matchId} onValueChange={setMatchId}>
        <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not linked</SelectItem>
          {matches.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-1 text-xs">
        <Switch checked={autoQuiz} onCheckedChange={setAutoQuiz} /> Auto quiz
      </label>
      <label className="flex items-center gap-1 text-xs">
        <Switch checked={autoResult} onCheckedChange={setAutoResult} /> Auto result
      </label>
      <label className="flex items-center gap-1 text-xs">
        <Switch checked={review} onCheckedChange={setReview} /> Review
      </label>
      <Button size="sm" variant="outline" disabled={busy}
        onClick={() => onSave({
          match_id: matchId === "none" ? null : matchId,
          auto_quiz: autoQuiz,
          auto_result: autoResult,
          review_required: review,
        })}>
        Save
      </Button>
    </div>
  );
}
