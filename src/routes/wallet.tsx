import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { getMyWallet, submitDeposit, submitWithdrawal } from "@/lib/wallet.functions";
import { getMyContestStats } from "@/lib/stats.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Smartphone, Copy, CheckCircle2, Clock, XCircle, ShieldCheck, Info, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Guru-G" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { user, loading: authLoading } = useAuthSession();

  if (authLoading) return <AppShell><p className="p-8 text-center text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <WalletIcon className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-2 text-xl font-bold">Sign in to view wallet</h2>
          <Link to="/auth"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  return <WalletInner />;
}

function WalletInner() {
  const fetchWallet = useServerFn(getMyWallet);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => fetchWallet(),
  });

  const [mode, setMode] = useState<"add" | "withdraw">("add");

  if (isLoading || !data) {
    return <AppShell><p className="p-8 text-center text-sm text-muted-foreground">Loading wallet…</p></AppShell>;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["wallet"] });

  const pendingDeposits = data.deposits.filter((d) => d.status === "pending").reduce((s, d) => s + Number(d.amount), 0);
  const pendingWithdrawals = data.withdrawals.filter((w) => w.status === "pending" || w.status === "approved").reduce((s, w) => s + Number(w.amount), 0);
  const credited = data.txns.filter((t) => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-80">
          <WalletIcon className="h-3.5 w-3.5" /> Wallet Balance
        </div>
        <div className="mt-1 text-4xl font-black">₹{data.balance.toFixed(2)}</div>
        <p className="mt-2 text-xs opacity-80">{data.fullName || "Welcome"}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
            <div className="text-base font-black">₹{credited.toFixed(0)}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Credited</div>
          </div>
          <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
            <div className="text-base font-black">₹{pendingDeposits.toFixed(0)}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">In review</div>
          </div>
          <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur">
            <div className="text-base font-black">₹{pendingWithdrawals.toFixed(0)}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Payout</div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={() => setMode("add")} className={cn("press flex items-center justify-center gap-2 rounded-2xl py-3 font-bold transition", mode === "add" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-foreground shadow-soft")}>
          <ArrowDownToLine className="h-4 w-4" /> Add Money
        </button>
        <button onClick={() => setMode("withdraw")} className={cn("press flex items-center justify-center gap-2 rounded-2xl py-3 font-bold transition", mode === "withdraw" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-foreground shadow-soft")}>
          <ArrowUpFromLine className="h-4 w-4" /> Withdraw
        </button>
      </section>

      {mode === "add"
        ? <DepositForm settings={data.settings} onDone={refresh} />
        : <WithdrawForm balance={data.balance} settings={data.settings} onDone={refresh} />}

      <section className="mt-5 grid grid-cols-4 gap-2">
        <QuickTile to="/wallet/history" emoji="🧾" label="History" />
        <QuickTile to="/kyc" emoji="🪪" label="KYC" />
        <QuickTile to="/coupons" emoji="🎟️" label="Coupons" />
        <QuickTile to="/support" emoji="💬" label="Support" />
      </section>

      <PlayStats />



      {/* Pending requests */}
      {data.deposits.some((d) => d.status === "pending") && (
        <Section title="Deposits awaiting review">
          {data.deposits.filter((d) => d.status === "pending").map((d) => (
            <RequestRow key={d.id} amount={d.amount} status={d.status} sub={`UTR ${d.upi_utr}`} at={d.created_at} />
          ))}
        </Section>
      )}
      {data.withdrawals.some((w) => w.status === "pending" || w.status === "approved") && (
        <Section title="Withdrawals in progress">
          {data.withdrawals.filter((w) => w.status === "pending" || w.status === "approved").map((w) => (
            <RequestRow key={w.id} amount={w.amount} status={w.status} sub={`to ${w.upi_id}`} at={w.created_at} />
          ))}
        </Section>
      )}

      <Section title="Recent Transactions">
        {data.txns.length === 0 && <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No transactions yet.</p>}
        {data.txns.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
            <div>
              <div className="text-sm font-semibold">{t.note}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
            </div>
            <div className={`font-black ${t.type === "credit" ? "text-success" : "text-destructive"}`}>
              {t.type === "credit" ? "+" : "−"}₹{Number(t.amount).toFixed(0)}
            </div>
          </div>
        ))}
        <Link to="/wallet/history" className="mt-2 block rounded-2xl bg-card p-3 text-center text-xs font-bold text-primary shadow-soft transition hover:shadow-glow">
          View Full History →
        </Link>
      </Section>

      <section className="mt-6 space-y-2">
        <div className="surface flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-sm font-bold">Secure payments</div>
            <p className="text-[11px] text-muted-foreground">Pay only to the UPI ID shown above. Never share OTPs or your UPI PIN with anyone.</p>
          </div>
        </div>
        <div className="surface flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-sm font-bold">Wallet tips</div>
            <p className="text-[11px] text-muted-foreground">Deposits are credited after admin verifies your UTR. Withdrawals are held from your balance and paid out by admin.</p>
          </div>
        </div>
        <Link to="/support" className="card-lift flex items-center justify-between rounded-2xl bg-gradient-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-bold">Need help with a payment?</div>
              <div className="text-[11px] text-muted-foreground">Raise a support ticket</div>
            </div>
          </div>
          <span className="text-xs font-bold text-primary">Open →</span>
        </Link>
      </section>
    </AppShell>
  );
}

/** Contest performance + history — lives in the wallet, not the profile. */
function PlayStats() {
  const fetchStats = useServerFn(getMyContestStats);
  const { data: stats } = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats(), staleTime: 15_000 });

  const played = Number(stats?.played ?? 0);
  const wins = Number(stats?.wins ?? 0);
  const won = Number(stats?.totalWon ?? 0);
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  const history = stats?.history ?? [];
  const highestWin = history.reduce((max, h) => Math.max(max, Number(h.prize ?? 0)), 0);
  const ranked = history.map((h) => Number(h.rank ?? 0)).filter((r) => r > 0);
  const bestRank = ranked.length ? Math.min(...ranked) : 0;

  return (
    <>
      <Section title="My contest performance">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Wins" value={String(wins)} />
          <MiniStat label="Played" value={String(played)} />
          <MiniStat label="Win %" value={`${winRate}%`} />
          <MiniStat label="Total earnings" value={`₹${won.toFixed(0)}`} />
          <MiniStat label="Best rank" value={bestRank ? `#${bestRank}` : "—"} />
          <MiniStat label="Highest win" value={`₹${highestWin.toFixed(0)}`} />
        </div>
      </Section>

      <Section title="Contest history">
        {history.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
            No contests played yet.
          </p>
        )}
        {history.map((h) => (
          <Link key={h.id} to="/result/$id" params={{ id: h.contestId }} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft transition hover:shadow-glow">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{h.title}</div>
              <div className="text-[10px] text-muted-foreground">
                {h.submittedAt ? new Date(h.submittedAt).toLocaleDateString() : "—"} · Score {h.score}
                {h.rank ? ` · Rank #${h.rank}` : ""}
              </div>
            </div>
            {h.prize > 0 ? (
              <div className="shrink-0 rounded-lg bg-gradient-gold px-2 py-1 text-xs font-black text-amber-950">+₹{h.prize.toFixed(0)}</div>
            ) : (
              <div className="shrink-0 text-xs font-bold text-muted-foreground">{h.status === "in_progress" ? "In progress" : "—"}</div>
            )}
          </Link>
        ))}
      </Section>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-3 text-center">
      <div className="text-base font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function QuickTile({ to, emoji, label }: { to: React.ComponentProps<typeof Link>["to"]; emoji: string; label: string }) {
  return (
    <Link to={to} className="card-lift flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center text-[11px] font-bold shadow-soft">
      <span className="text-2xl leading-none">{emoji}</span>
      {label}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}


function RequestRow({ amount, status, sub, at }: { amount: number; status: string; sub: string; at: string }) {
  const Icon = status === "pending" ? Clock : status === "approved" || status === "paid" ? CheckCircle2 : XCircle;
  const color = status === "pending" ? "text-amber-600" : status === "rejected" ? "text-destructive" : "text-success";
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-sm font-semibold">₹{Number(amount).toFixed(0)} <span className="text-xs font-normal text-muted-foreground capitalize">· {status}</span></div>
          <div className="text-[10px] text-muted-foreground">{sub} · {new Date(at).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function DepositForm({ settings, onDone }: { settings: any; onDone: () => void }) {
  const submit = useServerFn(submitDeposit);
  const [amt, setAmt] = useState<number>(Math.max(20, settings.min_deposit));
  const [utr, setUtr] = useState("");
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(settings.admin_upi_id);
    toast.success("UPI ID copied");
  };

  const handle = async () => {
    if (amt < settings.min_deposit) return toast.error(`Minimum ₹${settings.min_deposit}`);
    if (amt > settings.max_deposit) return toast.error(`Maximum ₹${settings.max_deposit}`);
    if (utr.trim().length < 6) return toast.error("Enter the 12-digit UTR/reference from your UPI app");
    setBusy(true);
    try {
      await submit({ data: { amount: amt, upi_utr: utr.trim(), payer_upi: payer.trim() || null } });
      toast.success("Deposit submitted — admin will verify and credit your wallet.");
      setUtr(""); setPayer("");
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 p-4">
      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 1 — Pay to this UPI</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="font-mono text-lg font-bold break-all">{settings.admin_upi_id}</div>
          <Button type="button" size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5" /></Button>
        </div>
        {settings.admin_upi_id ? (
          <div className="mt-3 flex flex-col items-center gap-1">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(`upi://pay?pa=${settings.admin_upi_id}&pn=Guru-G&cu=INR`)}`}
              alt="Admin UPI QR"
              className="h-64 w-64 rounded-lg border bg-white object-contain p-2"
            />
            <p className="text-[11px] text-muted-foreground text-center">Scan with any UPI app (GPay, PhonePe, Paytm) or pay to the UPI ID above.</p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Open any UPI app (GPay, PhonePe, Paytm) → Pay → enter the UPI ID above → pay the amount below.
          </p>
        )}
      </div>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)</label>
      <Input type="number" value={amt} onChange={(e) => setAmt(Number(e.target.value))} className="h-12 mt-1.5 text-lg font-bold" min={settings.min_deposit} max={settings.max_deposit} />
      <div className="mt-1 text-[11px] text-muted-foreground">Min ₹{settings.min_deposit} · Max ₹{settings.max_deposit}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {[20, 50, 100, 500, 1000, 2000, 5000].filter((v) => v >= settings.min_deposit && v <= settings.max_deposit).map((v) => (
          <button key={v} type="button" onClick={() => setAmt(v)} className={cn("rounded-full border px-3 py-1 text-xs font-bold transition", amt === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50")}>
            ₹{v}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 2 — UTR / Reference No.</label>
      <Input value={utr} onChange={(e) => setUtr(e.target.value.toUpperCase())} placeholder="123456789012" className="h-12 mt-1.5 font-mono" />
      <p className="mt-1 text-[11px] text-muted-foreground">Find this in your UPI app's transaction history (12-digit number).</p>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Your UPI ID (optional)</label>
      <Input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="yourname@paytm" className="h-12 mt-1.5" />

      <Button onClick={handle} disabled={busy} className="mt-5 h-12 w-full bg-gradient-primary font-bold shadow-glow">
        {busy ? "Submitting…" : `Submit Deposit of ₹${amt}`}
      </Button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">Wallet is credited within minutes once admin verifies your UTR.</p>
    </Card>
  );
}

function WithdrawForm({ balance, settings, onDone }: { balance: number; settings: any; onDone: () => void }) {
  const submit = useServerFn(submitWithdrawal);
  const [amt, setAmt] = useState<number>(settings.min_withdrawal);
  const [upi, setUpi] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (amt < settings.min_withdrawal) return toast.error(`Minimum ₹${settings.min_withdrawal}`);
    if (amt > balance) return toast.error("Insufficient balance");
    if (!/^[\w.\-]+@[\w.\-]+$/.test(upi)) return toast.error("Enter a valid UPI ID like name@bank");
    setBusy(true);
    try {
      await submit({ data: { amount: amt, upi_id: upi.trim() } });
      toast.success(`Withdrawal of ₹${amt} requested. Admin will pay out shortly.`);
      setUpi("");
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 p-4">
      <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        Available: <span className="font-bold text-foreground">₹{balance.toFixed(2)}</span> · Min ₹{settings.min_withdrawal} · Daily limit ₹{settings.max_withdrawal_per_day}
      </div>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)</label>
      <Input type="number" value={amt} onChange={(e) => setAmt(Number(e.target.value))} className="h-12 mt-1.5 text-lg font-bold" min={settings.min_withdrawal} />
      <div className="mt-2 flex flex-wrap gap-2">
        {[100, 200, 500, 1000, 2000].map((v) => (
          <button key={v} type="button" onClick={() => setAmt(v)} className={cn("rounded-full border px-3 py-1 text-xs font-bold transition", amt === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50")}>
            ₹{v}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Your UPI ID</label>
      <div className="relative mt-1.5">
        <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@paytm" className="h-12 pl-9" />
      </div>

      <Button onClick={handle} disabled={busy} className="mt-5 h-12 w-full bg-gradient-primary font-bold shadow-glow">
        {busy ? "Submitting…" : `Request Withdrawal of ₹${amt}`}
      </Button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">Amount is held from your wallet immediately and paid out by admin.</p>
    </Card>
  );
}
