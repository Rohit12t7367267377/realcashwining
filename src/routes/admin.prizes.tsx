import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award } from "lucide-react";
import { toast } from "sonner";
import { adminPeriodLeaderboard, adminListPrizeAwards, adminAwardPrize } from "@/lib/admin-prizes.functions";

export const Route = createFileRoute("/admin/prizes")({ component: Page });

type Period = "week" | "month" | "year";

function Page() {
  const board = useServerFn(adminPeriodLeaderboard);
  const listAwards = useServerFn(adminListPrizeAwards);
  const award = useServerFn(adminAwardPrize);
  const qc = useQueryClient();

  const [period, setPeriod] = useState<Period>("week");
  const [kind, setKind] = useState<"cash" | "xp" | "box" | "physical">("cash");
  const [amount, setAmount] = useState(100);
  const [desc, setDesc] = useState("");

  const { data: lb, isLoading } = useQuery({
    queryKey: ["admin-period-lb", period],
    queryFn: () => board({ data: { period } }),
  });
  const { data: awards } = useQuery({ queryKey: ["admin-awards"], queryFn: () => listAwards() });

  async function give(userId: string, rank: number) {
    try {
      await award({
        data: {
          userId, period, periodKey: lb?.periodKey ?? "", rank, kind,
          amount: kind === "physical" ? 0 : amount,
          description: desc || null,
        },
      });
      toast.success("Prize awarded");
      qc.invalidateQueries({ queryKey: ["admin-awards"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-primary" /> Prize Distribution</h1>
        <p className="text-muted-foreground">Reward weekly, monthly and yearly leaderboard winners with cash, XP, boxes or physical gifts.</p>
      </div>

      <Card className="p-4 mb-6 grid gap-3 md:grid-cols-4">
        <div>
          <Label>Period</Label>
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        </div>
        <div>
          <Label>Prize type</Label>
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="cash">Cash (wallet)</option>
            <option value="xp">XP</option>
            <option value="box">Reward box</option>
            <option value="physical">Physical gift</option>
          </select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} disabled={kind === "physical" || kind === "box"} />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Weekly champion trophy" />
        </div>
      </Card>

      <h2 className="mb-3 text-xl font-bold">Leaderboard · {lb?.periodKey ?? "—"}</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="space-y-2">
        {(lb?.rows ?? []).map((r) => (
          <Card key={r.userId} className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
              <span className="w-8 text-center font-black">#{r.rank}</span>
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground">Score {r.score} · Played {r.played} · Wins {r.wins} · Won ₹{r.prize.toFixed(0)}</div>
              </div>
            </div>
            <Button size="sm" onClick={() => give(r.userId, r.rank)}>Give prize</Button>
          </Card>
        ))}
        {!isLoading && (lb?.rows ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No declared results in this period yet.</p>
        )}
      </div>

      <h2 className="mt-10 mb-3 text-xl font-bold">Awarded prizes</h2>
      <div className="space-y-2">
        {(awards ?? []).map((a: any) => (
          <Card key={a.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-semibold">{a.name} · rank #{a.rank}</div>
              <div className="text-xs text-muted-foreground">
                {a.period} {a.period_key} · {a.kind} {Number(a.amount) > 0 ? `· ${Number(a.amount).toFixed(0)}` : ""} {a.description ? `· ${a.description}` : ""}
              </div>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold capitalize">{a.status}</span>
          </Card>
        ))}
        {(awards ?? []).length === 0 && <p className="text-sm text-muted-foreground">No prizes awarded yet.</p>}
      </div>
    </div>
  );
}
