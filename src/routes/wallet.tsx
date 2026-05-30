import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Smartphone, CreditCard, Building2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Cash Winning League" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { state, addMoney, debit } = useUser();
  const [amt, setAmt] = useState<number>(100);
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [upi, setUpi] = useState("");

  if (!state.loggedIn) {
    return (
      <AppShell>
        <LoggedOut />
      </AppShell>
    );
  }

  const submit = () => {
    if (!amt || amt < 10) return toast.error("Minimum ₹10");
    if (mode === "add") {
      addMoney(amt, `Added via UPI${upi ? ` (${upi})` : ""}`);
      toast.success(`₹${amt} added to wallet 🎉`);
    } else {
      if (!upi.includes("@")) return toast.error("Enter a valid UPI ID");
      const ok = debit(amt, `Withdrawn to ${upi}`);
      if (!ok) return toast.error("Insufficient balance");
      toast.success(`Withdrawal of ₹${amt} initiated to ${upi}`);
    }
    setAmt(100);
  };

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-80">
          <WalletIcon className="h-3.5 w-3.5" /> Total Balance
        </div>
        <div className="mt-1 text-4xl font-black">₹{state.wallet.toFixed(2)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
            <div className="text-[10px] uppercase tracking-wider opacity-80">Winnings</div>
            <div className="text-lg font-black">₹{state.winnings.toFixed(0)}</div>
          </div>
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
            <div className="text-[10px] uppercase tracking-wider opacity-80">Bonus Cash</div>
            <div className="text-lg font-black">₹{Math.max(0, 50).toFixed(0)}</div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={() => setMode("add")} className={cn("flex items-center justify-center gap-2 rounded-2xl py-3 font-bold transition", mode === "add" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-foreground shadow-soft")}>
          <ArrowDownToLine className="h-4 w-4" /> Add Money
        </button>
        <button onClick={() => setMode("withdraw")} className={cn("flex items-center justify-center gap-2 rounded-2xl py-3 font-bold transition", mode === "withdraw" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-card text-foreground shadow-soft")}>
          <ArrowUpFromLine className="h-4 w-4" /> Withdraw
        </button>
      </section>

      <section className="mt-4 rounded-2xl bg-card p-4 shadow-soft">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹)</label>
        <Input type="number" value={amt} onChange={(e) => setAmt(Number(e.target.value))} className="h-12 mt-1.5 text-lg font-bold" />
        <div className="mt-3 flex flex-wrap gap-2">
          {[50, 100, 200, 500, 1000].map((v) => (
            <button key={v} onClick={() => setAmt(v)} className={cn("rounded-full border px-3 py-1 text-xs font-bold transition", amt === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50")}>
              ₹{v}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{mode === "withdraw" ? "Your UPI ID" : "UPI / Bank (optional)"}</label>
        <div className="relative mt-1.5">
          <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@paytm" className="h-12 pl-9" />
        </div>

        {mode === "add" && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { i: <Smartphone className="h-5 w-5" />, l: "UPI" },
              { i: <CreditCard className="h-5 w-5" />, l: "Card" },
              { i: <Building2 className="h-5 w-5" />, l: "NetBank" },
            ].map((p) => (
              <div key={p.l} className="flex flex-col items-center rounded-xl border border-border bg-background p-3 text-xs font-bold">
                {p.i}<span className="mt-1">{p.l}</span>
              </div>
            ))}
          </div>
        )}

        <Button onClick={submit} className="mt-5 h-12 w-full bg-gradient-primary font-bold shadow-glow">
          {mode === "add" ? `Add ₹${amt}` : `Withdraw ₹${amt}`}
        </Button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Demo only — no real transactions are processed.</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Transactions</h2>
        <div className="mt-3 space-y-2">
          {state.txns.length === 0 && <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">No transactions yet.</p>}
          {state.txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
              <div>
                <div className="text-sm font-semibold">{t.note}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(t.at).toLocaleString()}</div>
              </div>
              <div className={`font-black ${t.type === "credit" ? "text-success" : "text-destructive"}`}>
                {t.type === "credit" ? "+" : "−"}₹{t.amount}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function LoggedOut() {
  return (
    <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
      <WalletIcon className="mx-auto h-10 w-10 text-primary" />
      <h2 className="mt-2 text-xl font-bold">Sign in to view wallet</h2>
      <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
    </div>
  );
}
