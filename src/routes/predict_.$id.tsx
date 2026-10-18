import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Lock, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPredContest, submitPredAnswers } from "@/lib/pred.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/predict_/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Prediction contest — Guru-G" }] }),
  component: ContestPage,
});

function useCountdown(targetIso: string | undefined, serverNow: string | undefined) {
  // Offset by the server clock so a wrong phone clock cannot extend or shorten the window.
  const offset = useMemo(() => (serverNow ? Date.parse(serverNow) - Date.now() : 0), [serverNow]);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return null;
  return Math.max(0, Date.parse(targetIso) - (Date.now() + offset));
}

function fmtLeft(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

function ContestPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchContest = useServerFn(getPredContest);
  const submit = useServerFn(submitPredAnswers);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["pred-contest", id],
    queryFn: () => fetchContest({ data: { id } }),
    refetchInterval: (q) => (["completed", "cancelled", "void"].includes(q.state.data?.contest.status ?? "") ? false : 20_000),
  });
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => { if (data) setPicked(data.answers); }, [data?.entry?.id, data?.contest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = useCountdown(data?.contest.locks_at, data?.serverNow);
  const save = useMutation({
    mutationFn: () => submit({ data: { contestId: id, answers: picked } }),
    onSuccess: () => { setReviewing(false); toast.success("Answers saved"); qc.invalidateQueries({ queryKey: ["pred-contests"] }); refetch(); },
    onError: (e: Error) => { toast.error(e.message || "Could not save your answers"); refetch(); },
  });

  if (isLoading) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (error || !data) return <AppShell><Card className="p-4 text-sm text-destructive">Could not load this contest.</Card></AppShell>;

  const { contest, questions, entry, scores, match } = data;
  const open = contest.status === "published" && left !== null && left > 0 && Date.now() >= 0;
  const canEdit = open && (!entry || contest.allow_edit);
  // Long "every ball" contests: group by over, and allow a partial entry (unanswered balls score 0).
  const OVER_RE = /Over (\d+) · (?:Ball|Delivery) (\d+)/;
  const grouped = questions.length > 12 && questions.every((q: any) => OVER_RE.test(q.prompt));
  const answeredCount = questions.filter((q: any) => picked[q.id]).length;
  const answeredAll = questions.length > 0 && (grouped ? answeredCount >= 1 : answeredCount === questions.length);
  const overs: Array<{ over: number; qs: any[] }> = [];
  if (grouped) {
    for (const q of questions as any[]) {
      const o = Number(OVER_RE.exec(q.prompt)![1]);
      (overs.at(-1)?.over === o ? overs.at(-1)! : overs[overs.push({ over: o, qs: [] }) - 1]).qs.push(q);
    }
  }
  const dirty = JSON.stringify(picked) !== JSON.stringify(data.answers);
  const showResults = ["locked", "live", "settling", "completed", "void"].includes(contest.status);
  const fee: number = contest.entry_fee ?? 0;
  const split: number[] = Array.isArray(contest.prize_split) ? contest.prize_split : [70];
  const tooPoor = !entry && fee > 0 && data.balance < fee;
  const label: Record<string, string> = { published: "Open", locked: "Locked", live: "Live", settling: "Pending settlement", completed: "Settled", cancelled: "Cancelled", void: "Void" };
  const total = Object.values(scores).reduce((s: number, x: any) => s + x.points, 0);

  const renderQuestion = (q: any) => {
          const mine = picked[q.id];
          const score = scores[q.id];
          return (
            <Card key={q.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-sm font-semibold">{!grouped && <span className="mr-1.5 text-muted-foreground">{q.position}.</span>}{grouped ? `Ball ${OVER_RE.exec(q.prompt)?.[2] ?? q.position}` : q.prompt}</div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{q.points} pts</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((o: { id: string; label: string }) => {
                  const isMine = mine === o.id;
                  const isCorrect = q.status === "resolved" && q.resolved_option === o.id;
                  const isWrongMine = q.status === "resolved" && isMine && !isCorrect;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setPicked((p) => ({ ...p, [q.id]: o.id }))}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        isMine && !showResults && "border-primary bg-primary/10 font-semibold",
                        isCorrect && "border-emerald-500 bg-emerald-500/15 font-semibold",
                        isWrongMine && "border-destructive bg-destructive/10",
                        isMine && showResults && q.status !== "resolved" && "border-primary bg-primary/10",
                        !canEdit && "cursor-default",
                      )}
                    >
                      <span>{o.label}</span>
                      {isCorrect ? <Check className="h-4 w-4 text-emerald-600" /> : isWrongMine ? <X className="h-4 w-4 text-destructive" /> : null}
                    </button>
                  );
                })}
              </div>
              {showResults && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {q.status === "open" && "Waiting for the verified result."}
                  {q.status === "void" && "Void — no points awarded or deducted."}
                  {q.status === "resolved" && (mine ? (score ? `${score.correct ? "Correct" : "Incorrect"} · ${score.points >= 0 ? "+" : ""}${score.points} pts` : "Result verified") : "Not answered")}
                </div>
              )}
            </Card>
          );
  };

  return (
    <AppShell>
      <Link to="/predict" className="mb-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeft className="h-3 w-3" /> All contests</Link>
      <Card className="mb-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-black leading-tight">{contest.title}</h1>
          <Badge variant={contest.status === "published" ? "default" : "secondary"}>{label[contest.status] ?? contest.status}</Badge>
        </div>
        {match && (
          <div className="mt-1 text-xs text-muted-foreground">
            {match.team_a} vs {match.team_b}{match.status ? ` · ${match.status}` : ""}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {open && left !== null ? <span className="inline-flex items-center gap-1 font-semibold text-primary"><Timer className="h-3.5 w-3.5" /> Locks in {fmtLeft(left)}</span> : <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Answers locked</span>}
          <span>{data.participants} playing</span>
          <span className="font-semibold">{fee > 0 ? `${fee} pts to join` : "Free practice"}</span>
        </div>
        {fee > 0 && (
          <p className="mt-2 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
            Prize pool = every player's entry points added together ({data.participants} × {fee} = {data.participants * fee} pts so far).
            Rank 1 gets {split[0] ?? 0}% of the pool{split.length > 1 ? `, rank 2 gets ${split[1]}%` : ""}; whatever is left (and any rounding) goes to the platform's virtual-points bucket.
            {contest.min_participants > 0 ? ` At least ${contest.min_participants} players are needed, otherwise everyone is refunded.` : ""}
            {" "}Entries are refunded if the contest is cancelled or voided. Points have no cash value.
          </p>
        )}
        {contest.status === "cancelled" && <p className="mt-2 text-xs text-destructive">This contest was cancelled{contest.cancel_reason ? `: ${String(contest.cancel_reason).replace(/_/g, " ")}` : "."}{fee > 0 ? " Your entry points were refunded." : ""}</p>}
        {contest.status === "void" && <p className="mt-2 text-xs text-destructive">This contest was voided{contest.cancel_reason ? `: ${String(contest.cancel_reason).replace(/_/g, " ")}` : "."}{fee > 0 ? " Your entry points were refunded." : ""}</p>}
        {data.settlement && contest.status === "completed" && (
          <p className="mt-2 text-[11px] text-muted-foreground">Settled: pool {data.settlement.pool} pts · prizes {data.settlement.prize_total} · platform bucket {data.settlement.platform_share}.</p>
        )}
        {entry && showResults && (
          <div className="mt-3 rounded-md bg-primary/10 p-2 text-sm font-semibold">
            Your score: {contest.status === "completed" ? entry.points : total} pts · {entry.correct} correct
            {contest.status !== "completed" && <span className="ml-1 text-[11px] font-normal text-muted-foreground">(provisional until verified)</span>}
          </div>
        )}
      </Card>

      {grouped && (
        <Card className="mb-3 p-3 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">How it works</div>
          Pick what happens on each ball. <b>+{questions[0]?.points ?? 5}</b> for a correct pick, <b>−{contest.scoring?.negativePerWrong ?? 1}</b> for a wrong one, <b>0</b> if you skip a ball.
          Wides and no-balls don't count as a ball. Picks lock when the first ball is bowled.
        </Card>
      )}
      {grouped ? (
        <div className="space-y-4">
          {overs.map((g) => {
            const done = g.qs.filter((q: any) => picked[q.id]).length;
            return (
              <section key={g.over}>
                <h2 className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Over {g.over}</span><span className={done === g.qs.length ? "text-emerald-600" : ""}>{done}/{g.qs.length}</span>
                </h2>
                <div className="space-y-2">{g.qs.map((q: any) => renderQuestion(q))}</div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">{questions.map((q: any) => renderQuestion(q))}</div>
      )}

      {canEdit && (
        <div className="sticky bottom-24 z-30 mt-4">
          {reviewing && (
            <Card className="mb-2 max-h-64 overflow-y-auto p-3 text-xs">
              <div className="mb-1 font-semibold">Review your picks ({answeredCount}/{questions.length})</div>
              {(questions as any[]).map((q) => (
                <div key={q.id} className="flex justify-between gap-2 py-0.5">
                  <span className="truncate text-muted-foreground">{q.prompt.replace(/: what happens\?$/, "")}</span>
                  <span className="shrink-0 font-medium">{q.options.find((o: any) => o.id === picked[q.id])?.label ?? "— skip (0 pts)"}</span>
                </div>
              ))}
              {!entry && fee > 0 && <div className="mt-2 font-semibold">{fee} points will be taken from your balance of {data.balance}.</div>}
            </Card>
          )}
          <Button
            className="w-full" size="lg"
            disabled={!answeredAll || !dirty || save.isPending || tooPoor}
            onClick={() => (reviewing ? save.mutate() : setReviewing(true))}
          >
            {save.isPending ? "Saving…" : !reviewing ? "Review my picks" : entry ? "Confirm update" : fee > 0 ? `Confirm & join for ${fee} pts` : "Confirm & lock my answers"}
          </Button>
          {tooPoor && <p className="mt-1 text-center text-[11px] text-destructive">You need {fee} points (you have {data.balance}). Claim your free points in the Points tab.</p>}
          {grouped
            ? <p className="mt-1 text-center text-[11px] text-muted-foreground">{answeredCount}/{questions.length} balls picked · skipped balls score 0</p>
            : !answeredAll && <p className="mt-1 text-center text-[11px] text-muted-foreground">Answer every question to submit.</p>}
          {!contest.allow_edit && !entry && <p className="mt-1 text-center text-[11px] text-muted-foreground">Answers are final once submitted.</p>}
        </div>
      )}
      {entry && !canEdit && contest.status === "published" && (
        <p className="mt-4 text-center text-xs text-muted-foreground">✓ Your answers are locked in. Good luck!</p>
      )}
    </AppShell>
  );
}
