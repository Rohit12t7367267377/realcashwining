import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Coins, Crown, Medal, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  claimPredBonus, getPredBoard, getPredWallet, listPredContests, listPredNotifications, redeemPredInvite, savePredNotificationPrefs,
} from "@/lib/pred.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/predict")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Free Predictions — Guru-G" },
      { name: "description", content: "Free-to-play sports prediction quizzes. Earn virtual points, climb the leaderboard. No deposits, no cash." },
    ],
  }),
  component: PredictPage,
});

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function PredictPage() {
  const { user, loading } = useAuthSession();
  return (
    <AppShell>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black"><Target className="h-5 w-5 text-primary" /> Free Predictions</h1>
          <p className="text-xs text-muted-foreground">Play free. Earn virtual points. No deposits or cash involved.</p>
        </div>
        <Link to="/live-scores" className="shrink-0 text-xs text-primary hover:underline">Live scores →</Link>
      </div>
      {loading ? null : !user ? (
        <Card className="p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">Sign in to play prediction contests and track your points.</p>
          <Button asChild><Link to="/auth">Sign in</Link></Button>
        </Card>
      ) : (
        <Tabs defaultValue="contests">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contests">Contests</TabsTrigger>
            <TabsTrigger value="board">Ranks</TabsTrigger>
            <TabsTrigger value="wallet">Points</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
          <TabsContent value="contests" className="mt-4"><Contests /></TabsContent>
          <TabsContent value="board" className="mt-4"><Board /></TabsContent>
          <TabsContent value="wallet" className="mt-4"><Wallet /></TabsContent>
          <TabsContent value="alerts" className="mt-4"><Alerts /></TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

const STATUS_LABEL: Record<string, string> = { published: "Open", locked: "Locked", live: "Live", settling: "Pending settlement", completed: "Settled", cancelled: "Cancelled", void: "Void" };

function InviteBox() {
  const redeem = useServerFn(redeemPredInvite);
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const go = useMutation({
    mutationFn: () => redeem({ data: { code } }),
    onSuccess: () => { toast.success("Private contest unlocked"); setCode(""); qc.invalidateQueries({ queryKey: ["pred-contests"] }); },
    onError: (e: Error) => toast.error(e.message || "Invalid invite code"),
  });
  return (
    <div className="mb-3 flex gap-2">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Private contest invite code" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" />
      <Button size="sm" variant="outline" disabled={code.trim().length < 4 || go.isPending} onClick={() => go.mutate()}>Join</Button>
    </div>
  );
}

function Contests() {
  const list = useServerFn(listPredContests);
  const { data, isLoading, error } = useQuery({ queryKey: ["pred-contests"], queryFn: () => list(), refetchInterval: 30_000 });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading contests…</p>;
  if (error) return <Card className="p-4 text-sm text-destructive">Could not load contests. Please try again.</Card>;
  if (!data?.length) {
    return <><InviteBox /><Card className="p-6 text-center text-sm text-muted-foreground">No contests are open right now. New contests appear automatically about 3 hours before each match.</Card></>;
  }
  const order = { published: 0, live: 1, locked: 2, settling: 3, completed: 4, cancelled: 5, void: 5 } as Record<string, number>;
  const sorted = [...data].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  return (
    <div className="space-y-2">
      <InviteBox />
      {sorted.map((c) => (
        <Link key={c.id} to="/predict/$id" params={{ id: c.id }}>
          <Card className="p-4 transition-colors hover:bg-accent/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {c.status === "published" ? `Locks ${fmt(c.locks_at)}` : `Locked ${fmt(c.locks_at)}`} · {c.participants} playing · {c.entry_fee > 0 ? `${c.entry_fee} pts` : "Free"}
                  {c.cancel_reason && ["cancelled", "void"].includes(c.status) ? ` · ${String(c.cancel_reason).replace(/_/g, " ")}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={c.status === "published" ? "default" : "secondary"}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                {c.entered && <span className="text-[11px] font-semibold text-primary">{c.my_points !== null && c.status !== "published" ? `${c.my_points} pts` : "Entered ✓"}</span>}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

const PERIODS = [["daily", "Today"], ["weekly", "Week"], ["monthly", "Month"], ["all", "All time"]] as const;

function Board() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("all");
  const [friends, setFriends] = useState(false);
  const fetchBoard = useServerFn(getPredBoard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["pred-board", period, friends],
    queryFn: () => fetchBoard({ data: { scope: "overall", scopeId: "", period, friends } }),
    staleTime: 15_000,
  });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {PERIODS.map(([k, label]) => (
          <Button key={k} size="sm" variant={period === k ? "default" : "outline"} onClick={() => setPeriod(k)}>{label}</Button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          Following <Switch checked={friends} onCheckedChange={setFriends} />
        </label>
      </div>
      {data?.me && (
        <Card className="mb-3 flex items-center justify-between bg-primary/10 p-3 text-sm">
          <span className="font-semibold">Your rank #{data.me.rank}</span>
          <span className="text-xs text-muted-foreground">{data.me.points} pts · {data.me.correct} correct · {data.me.contests} contests</span>
        </Card>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : error ? (
        <Card className="p-4 text-sm text-destructive">Could not load the leaderboard.</Card>
      ) : !data?.rows.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No ranked players yet for this period. Rankings update after contests are verified.</Card>
      ) : (
        <Card className="divide-y">
          {data.rows.map((r: { rank: number; userId: string; name: string; points: number; correct: number; contests: number }) => (
            <div key={r.userId} className="flex items-center gap-3 p-3">
              <div className="flex w-8 justify-center">
                {r.rank === 1 ? <Crown className="h-5 w-5 text-amber-500" /> : r.rank <= 3 ? <Medal className={cn("h-5 w-5", r.rank === 2 ? "text-slate-400" : "text-orange-600")} /> : <span className="text-sm font-bold text-muted-foreground">{r.rank}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">{r.correct} correct · {r.contests} contests</div>
              </div>
              <div className="text-right text-sm font-black tabular-nums">{r.points}<span className="ml-0.5 text-[10px] font-medium text-muted-foreground">pts</span></div>
            </div>
          ))}
        </Card>
      )}
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Ranks are computed on the server from verified results only.</p>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  participation: "Participation", answers: "Correct answers", rank_bonus: "Rank bonus", contest_reward: "Contest reward", adjustment: "Adjustment",
  entry_fee: "Contest entry", prize: "Contest prize", refund: "Entry refunded", welcome_bonus: "Welcome points", daily_bonus: "Daily free points",
};

function Wallet() {
  const fetchWallet = useServerFn(getPredWallet);
  const claim = useServerFn(claimPredBonus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["pred-wallet"], queryFn: () => fetchWallet(), staleTime: 15_000 });
  const bonus = useMutation({
    mutationFn: () => claim(),
    onSuccess: (r) => {
      const total = r.welcome + r.daily;
      if (total > 0) toast.success(`${total} free points added`); else toast.message("You already claimed today's free points");
      qc.invalidateQueries({ queryKey: ["pred-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not claim points"),
  });
  return (
    <div>
      <Card className="mb-3 flex items-center justify-between bg-gradient-primary p-4 text-primary-foreground">
        <div>
          <div className="text-xs opacity-80">Virtual points balance</div>
          <div className="text-3xl font-black tabular-nums">{data?.balance ?? 0}</div>
        </div>
        <Coins className="h-8 w-8 opacity-80" />
      </Card>
      <Button className="mb-3 w-full" variant="outline" disabled={bonus.isPending} onClick={() => bonus.mutate()}>Claim free daily points</Button>
      <p className="mb-3 text-[11px] text-muted-foreground">Virtual points are for fun and ranking only. They have no cash value and cannot be bought, sold or withdrawn.</p>
      {isLoading ? null : !data?.ledger.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No points yet. Play a contest — points are added after the results are verified.</Card>
      ) : (
        <Card className="divide-y">
          {data.ledger.map((l: { id: string; amount: number; kind: string; created_at: string }) => (
            <div key={l.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{KIND_LABEL[l.kind] ?? l.kind}</div>
                <div className="text-[11px] text-muted-foreground">{fmt(l.created_at)}</div>
              </div>
              <div className={cn("font-bold tabular-nums", l.amount < 0 ? "text-destructive" : "text-emerald-600")}>{l.amount > 0 ? "+" : ""}{l.amount}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

const PREF_LABEL: Record<string, string> = {
  match: "Match updates", contest: "New contests", deadline: "Deadlines", result: "Results", reward: "Point rewards", rank: "Rank changes", correction: "Corrections",
};

function Alerts() {
  const qc = useQueryClient();
  const fetchAlerts = useServerFn(listPredNotifications);
  const savePrefs = useServerFn(savePredNotificationPrefs);
  const { data, isLoading } = useQuery({ queryKey: ["pred-alerts"], queryFn: () => fetchAlerts(), refetchInterval: 60_000 });
  const save = useMutation({
    mutationFn: (prefs: NonNullable<typeof data>["prefs"]) => savePrefs({ data: prefs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pred-alerts"] }),
    onError: () => toast.error("Could not save your notification settings."),
  });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Bell className="h-4 w-4" /> Notify me about</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(data.prefs).map(([k, v]) => (
            <label key={k} className="flex items-center justify-between rounded-md border p-2 text-xs">
              {PREF_LABEL[k] ?? k}
              <Switch checked={v} onCheckedChange={(on) => save.mutate({ ...data.prefs, [k]: on })} />
            </label>
          ))}
        </div>
      </Card>
      {!data.items.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</Card>
      ) : (
        <Card className="divide-y">
          {data.items.map((n: any) => (
            <div key={n.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{n.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmt(n.created_at)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
              {n.link && <Link to={n.link} className="mt-1 inline-block text-xs text-primary hover:underline">Open →</Link>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
