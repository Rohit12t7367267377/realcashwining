import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Cog, Gavel, RefreshCw } from "lucide-react";
import {
  getAutomationSettings,
  saveAutomationSettings,
  runAutomationNow,
  finalizeContestNow,
  listPendingFinalization,
} from "@/lib/automation.functions";

export const Route = createFileRoute("/admin/automation")({ component: Page });

type Settings = Awaited<ReturnType<typeof getAutomationSettings>>;

const numList = (s: string) =>
  s.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n >= 0);

function Page() {
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [split, setSplit] = useState("50,30,20");
  const [week, setWeek] = useState("100,50,25");
  const [month, setMonth] = useState("500,250,100");
  const [year, setYear] = useState("2000,1000,500");
  const [pending, setPending] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const s = await getAutomationSettings();
      setCfg(s);
      setSplit((s.prize_split ?? []).join(","));
      setWeek((s.leaderboard_prizes?.week ?? []).join(","));
      setMonth((s.leaderboard_prizes?.month ?? []).join(","));
      setYear((s.leaderboard_prizes?.year ?? []).join(","));
      setPending(await listPendingFinalization());
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load automation settings");
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!cfg) return;
    setBusy(true);
    try {
      await saveAutomationSettings({
        data: {
          auto_quiz_generation: cfg.auto_quiz_generation,
          auto_result: cfg.auto_result,
          auto_leaderboard: cfg.auto_leaderboard,
          auto_prize_distribution: cfg.auto_prize_distribution,
          prize_split: numList(split),
          leaderboard_prizes: { week: numList(week), month: numList(month), year: numList(year) },
        },
      });
      toast.success("Automation settings saved");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusy(false); }
  }

  async function runNow() {
    setBusy(true);
    try {
      const r = await runAutomationNow();
      toast.success(`Finalized ${r.results.processed.length} contest(s) · ${r.week.awarded + r.month.awarded} leaderboard prize(s)`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  async function finalize(id: string) {
    setBusy(true);
    try {
      const r = await finalizeContestNow({ data: { contest_id: id } });
      toast.success(r.skipped ? `Skipped: ${r.skipped}` : `Ranked ${r.ranked} player(s)`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  const toggle = (k: keyof Settings) => (v: boolean) => setCfg((c) => (c ? { ...c, [k]: v } as Settings : c));

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-3xl font-bold"><Cog className="h-6 w-6" /> Automation</h1>
      <p className="mb-6 text-muted-foreground">
        Automatic result engine, leaderboards and prize distribution. Manual override is always available below.
      </p>

      <div className="max-w-3xl space-y-4">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Automation switches</h2>
          {cfg ? (
            <>
              <Row label="Auto quiz generation" hint="Allow AI to draft questions from match/official data for admin review.">
                <Switch checked={cfg.auto_quiz_generation} onCheckedChange={toggle("auto_quiz_generation")} />
              </Row>
              <Row label="Auto result" hint="Lock submissions, evaluate answers, rank and declare when a contest ends.">
                <Switch checked={cfg.auto_result} onCheckedChange={toggle("auto_result")} />
              </Row>
              <Row label="Auto leaderboard" hint="Contest, daily, weekly, monthly and all-time boards rebuild from declared results.">
                <Switch checked={cfg.auto_leaderboard} onCheckedChange={toggle("auto_leaderboard")} />
              </Row>
              <Row label="Auto prize distribution" hint="Credit contest prizes and period leaderboard prizes automatically.">
                <Switch checked={cfg.auto_prize_distribution} onCheckedChange={toggle("auto_prize_distribution")} />
              </Row>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Prize rules</h2>
          <div>
            <Label>Contest prize pool split % (rank 1,2,3…)</Label>
            <Input value={split} onChange={(e) => setSplit(e.target.value)} placeholder="50,30,20" />
            <p className="mt-1 text-xs text-muted-foreground">Rank 1 uses the contest's First prize when it is set.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Weekly prizes ₹</Label><Input value={week} onChange={(e) => setWeek(e.target.value)} /></div>
            <div><Label>Monthly prizes ₹</Label><Input value={month} onChange={(e) => setMonth(e.target.value)} /></div>
            <div><Label>Yearly prizes ₹</Label><Input value={year} onChange={(e) => setYear(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || !cfg}>Save settings</Button>
            <Button variant="outline" onClick={runNow} disabled={busy}>
              <RefreshCw className={`mr-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Run automation now
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Awaiting results (manual override)</h2>
          <div className="space-y-2">
            {pending.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b pb-2 text-sm">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Ends: {c.ends_at ? new Date(c.ends_at).toLocaleString() : "no end time"} · Pool ₹{c.prize_pool}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => finalize(c.id)} disabled={busy}>
                  <Gavel className="mr-1 h-3 w-3" /> Finalize
                </Button>
              </div>
            ))}
            {!pending.length && <div className="text-sm text-muted-foreground">Nothing pending.</div>}
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
