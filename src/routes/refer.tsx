import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";
import { Gift, Copy, Share2, Users, IndianRupee, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/refer")({
  head: () => ({ meta: [{ title: "Refer & Earn — Guru-G" }] }),
  component: ReferPage,
});

function ReferPage() {
  const { state, claimDaily } = useUser();

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <Gift className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-2 text-xl font-bold">Sign in to refer friends</h2>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  const code = state.referralCode;
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${code}` : "";

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text);
    toast.success(`${what} copied!`);
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Guru-G", text: `Join me on CWL and win cash! Use code ${code}`, url: link }); }
      catch {}
    } else copy(link, "Link");
  };

  const today = new Date().toDateString();
  const claimed = state.dailyClaimedOn === today;

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-center text-primary-foreground shadow-lift">
        <Gift className="mx-auto h-10 w-10" />
        <h1 className="mt-2 text-2xl font-black">Refer & Earn ₹50</h1>
        <p className="mt-1 text-sm opacity-90">Invite friends. Both get bonus cash when they play their first contest.</p>
      </section>

      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Referral Code</div>
        <button onClick={() => copy(code, "Code")} className="mt-2 flex w-full items-center justify-between rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3">
          <span className="text-2xl font-black tracking-widest text-primary">{code}</span>
          <Copy className="h-5 w-5 text-primary" />
        </button>
        <Button onClick={share} className="mt-3 h-12 w-full bg-gradient-primary font-bold shadow-glow">
          <Share2 className="mr-2 h-4 w-4" /> Share with friends
        </Button>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Stat icon={<Users className="h-5 w-5 text-primary" />} label="Friends Joined" value={state.referrals} />
        <Stat icon={<IndianRupee className="h-5 w-5 text-success" />} label="Referral Earnings" value={`₹${state.referrals * 50}`} />
      </section>

      <section className="mt-6 rounded-2xl bg-gradient-success p-5 text-success-foreground shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span className="text-xs font-bold uppercase">Daily Login Reward</span></div>
            <p className="mt-1 text-sm font-semibold">Claim ₹5–₹20 every day!</p>
          </div>
          <Button
            onClick={() => {
              const r = claimDaily();
              if (r === 0) toast.info("Already claimed today");
              else toast.success(`+₹${r} added!`);
            }}
            disabled={claimed}
            variant="secondary"
            className="bg-white text-emerald-700 hover:bg-white/90 disabled:opacity-70"
          >
            {claimed ? <><CheckCircle2 className="mr-1 h-4 w-4" /> Claimed</> : "Claim Now"}
          </Button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">How it works</h2>
        <div className="mt-3 space-y-2">
          {[
            { n: 1, t: "Share your code", d: "Send your unique code to friends via WhatsApp or social media" },
            { n: 2, t: "They sign up & play", d: "Friend signs up using your code and plays their first contest" },
            { n: 3, t: "Both earn ₹50", d: "You both get ₹50 bonus added instantly to your wallets" },
          ].map((s) => (
            <div key={s.n} className="flex gap-3 rounded-2xl bg-card p-3 shadow-soft">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary font-black text-primary-foreground">{s.n}</div>
              <div>
                <div className="text-sm font-bold">{s.t}</div>
                <div className="text-xs text-muted-foreground">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}
