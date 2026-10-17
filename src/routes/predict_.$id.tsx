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
    refetchInterval: (q) => (q.state.data?.contest.status === "completed" ? false : 20_000),
  });
  const [picked, setPicked] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setPicked(data.answers); }, [data?.entry?.id, data?.contest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = useCountdown(data?.contest.locks_at, data?.serverNow);
  const save = useMutation({
    mutationFn: () => submit({ data: { contestId: id, answers: picked } }),
    onSuccess: () => { toast.success("Answers saved"); qc.invalidateQueries({ queryKey: ["pred-contests"] }); refetch(); },
    onError: (e: Error) => { toast.error(e.message || "Could not save your answers"); refetch(); },
  });

  if (isLoading) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (error || !data) return <AppShell><Card className="p-4 text-sm text-destructive">Could not load this contest.</Card></AppShell>;

  const { contest, questions, entry, scores, match } = data;
  const open = contest.status === "published" && left !== null && left > 0 && Date.now() >= 0;
  const canEdit = open && (!entry || contest.allow_edit);
  const answeredAll = questions.length > 0 && questions.every((q: any) => picked[q.id]);
  const dirty = JSON.stringify(picked) !== JSON.stringify(data.answers);
  const showResults = ["locked", "settling", "completed"].includes(contest.status);
  const total = Object.values(scores).reduce((s: number, x: any) => s + x.points, 0);

  return (
    <AppShell>
      <Link to="/predict" className="mb-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeft className="h-3 w-3" /> All contests</Link>
      <Card className="mb-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-black leading-tight">{contest.title}</h1>
          <Badge variant={contest.status === "published" ? "default" : "secondary"}>{contest.status === "published" ? "Open" : contest.status}</Badge>
        </div>
        {match && (
          <div className="mt-1 text-xs text-muted-foreground">
            {match.team_a} vs {match.team_b}{match.status ? ` · ${match.status}` : ""}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {open && left !== null ? <span className="inline-flex items-center gap-1 font-semibold text-primary"><Timer className="h-3.5 w-3.5" /> Locks in {fmtLeft(left)}</span> : <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Answers locked</span>}
          <span>{data.participants} playing</span>
          <span>Free · virtual points</span>
        </div>
        {contest.status === "cancelled" && <p className="mt-2 text-xs text-destructive">This contest was cancelled{contest.cancel_reason ? `: ${contest.cancel_reason}` : "."}</p>}
        {entry && showResults && (
          <div className="mt-3 rounded-md bg-primary/10 p-2 text-sm font-semibold">
            Your score: {contest.status === "completed" ? entry.points : total} pts · {entry.correct} correct
            {contest.status !== "completed" && <span className="ml-1 text-[11px] font-normal text-muted-foreground">(provisional until verified)</span>}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {questions.map((q: any) => {
          const mine = picked[q.id];
          const score = scores[q.id];
          return (
            <Card key={q.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-sm font-semibold"><span className="mr-1.5 text-muted-foreground">{q.position}.</span>{q.prompt}</div>
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
        })}
      </div>

      {canEdit && (
        <div className="sticky bottom-24 z-30 mt-4">
          <Button className="w-full" size="lg" disabled={!answeredAll || !dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : entry ? "Update answers" : "Lock in my answers"}
          </Button>
          {!answeredAll && <p className="mt-1 text-center text-[11px] text-muted-foreground">Answer every question to submit.</p>}
          {!contest.allow_edit && !entry && <p className="mt-1 text-center text-[11px] text-muted-foreground">Answers are final once submitted.</p>}
        </div>
      )}
      {entry && !canEdit && contest.status === "published" && (
        <p className="mt-4 text-center text-xs text-muted-foreground">✓ Your answers are locked in. Good luck!</p>
      )}
    </AppShell>
  );
}
