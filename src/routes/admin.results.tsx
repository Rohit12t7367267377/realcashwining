import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Check, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { listContestAttempts, declareContestResult, setContestResultsDeclared, autoScoreContest } from "@/lib/admin-results.functions";

export const Route = createFileRoute("/admin/results")({ component: Page });

type Contest = { id: string; title: string; first_prize: number; prize_pool: number; results_status: string };
type Attempt = {
  id: string;
  user_id: string;
  score: number | null;
  violations: number;
  status: string;
  submitted_at: string | null;
  answers: unknown;
  rank: number | null;
  prize_awarded: number;
  is_winner: boolean;
  profile: { full_name: string | null; phone: string | null };
};

function Page() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { rank: string; prize: string }>>({});

  async function loadContests() {
    const { data } = await supabase.from("contests").select("id, title, first_prize, prize_pool, results_status").order("created_at", { ascending: false });
    setContests((data ?? []) as Contest[]);
    if (!selected && data && data.length) setSelected(data[0].id);
  }
  useEffect(() => { loadContests(); }, []);

  async function loadAttempts(contestId: string) {
    if (!contestId) return;
    setLoading(true);
    try {
      const rows = await listContestAttempts({ data: { contest_id: contestId } });
      setAttempts(rows as Attempt[]);
      const d: Record<string, { rank: string; prize: string }> = {};
      rows.forEach((r: Attempt) => {
        d[r.id] = { rank: r.rank ? String(r.rank) : "", prize: r.prize_awarded ? String(r.prize_awarded) : "" };
      });
      setDrafts(d);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load attempts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (selected) loadAttempts(selected); }, [selected]);

  const currentContest = contests.find((c) => c.id === selected);

  async function declare(attemptId: string) {
    const d = drafts[attemptId];
    const rank = Number(d?.rank || 0);
    const prize = Number(d?.prize || 0);
    if (!rank || rank < 1) return toast.error("Enter a valid rank (1 or higher)");
    if (prize < 0) return toast.error("Prize must be 0 or more");
    try {
      await declareContestResult({ data: { contest_id: selected, attempt_id: attemptId, rank, prize } });
      toast.success(prize > 0 ? `₹${prize} credited to winner's wallet` : "Rank saved");
      loadAttempts(selected);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to declare result");
    }
  }

  async function publish(status: "pending" | "declared") {
    if (!selected) return;
    try {
      await setContestResultsDeclared({ data: { contest_id: selected, status } });
      toast.success(status === "declared" ? "Results published to users" : "Results marked pending");
      loadContests();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Declare Results</h1>
          <p className="text-muted-foreground">Review submissions, assign ranks, credit prizes.</p>
        </div>
        <Button variant="outline" onClick={() => selected && loadAttempts(selected)}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      <Card className="p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <Label>Contest</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Select contest" /></SelectTrigger>
              <SelectContent>
                {contests.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title} — {c.results_status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {currentContest && (
            <div className="flex gap-2">
              {currentContest.results_status !== "declared" ? (
                <Button onClick={() => publish("declared")} className="bg-gradient-primary">
                  <ShieldCheck className="w-4 h-4 mr-1" /> Publish Results to Users
                </Button>
              ) : (
                <Button variant="outline" onClick={() => publish("pending")}>Mark as Pending</Button>
              )}
            </div>
          )}
        </div>
        {currentContest && (
          <div className="mt-3 text-xs text-muted-foreground">
            Prize pool: ₹{currentContest.prize_pool} · Suggested 1st prize: ₹{currentContest.first_prize} · Status:{" "}
            <span className={currentContest.results_status === "declared" ? "text-success font-bold" : "text-amber-600 font-bold"}>
              {currentContest.results_status}
            </span>
          </div>
        )}
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Loading attempts…</p>}

      {!loading && attempts.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">No submissions yet for this contest.</Card>
      )}

      <div className="space-y-3">
        {attempts.map((a) => {
          const ans = Array.isArray(a.answers) ? (a.answers as (number | null)[]) : [];
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {a.profile.full_name || "Unknown"} <span className="text-xs text-muted-foreground">· {a.profile.phone || "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status: {a.status} · Violations: {a.violations}
                    {a.submitted_at && <> · Submitted {new Date(a.submitted_at).toLocaleString()}</>}
                  </div>
                  <div className="mt-2 text-xs">
                    <strong>Answers:</strong>{" "}
                    {ans.length ? ans.map((v, i) => (
                      <span key={i} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-muted">
                        Q{i + 1}: {v === null || v === -1 ? "—" : String.fromCharCode(65 + Number(v))}
                      </span>
                    )) : "—"}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <Label className="text-xs">Rank</Label>
                    <Input
                      className="w-20"
                      value={drafts[a.id]?.rank ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], rank: e.target.value } }))}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Prize ₹</Label>
                    <Input
                      className="w-24"
                      value={drafts[a.id]?.prize ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], prize: e.target.value } }))}
                      placeholder="0"
                    />
                  </div>
                  <Button onClick={() => declare(a.id)} className="bg-gradient-primary">
                    <Check className="w-4 h-4 mr-1" /> Declare
                  </Button>
                </div>
              </div>
              {a.is_winner && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                  <Trophy className="w-3 h-3" /> Winner · Rank #{a.rank} · ₹{Number(a.prize_awarded).toFixed(0)} credited
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
