import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/user-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Trophy, Users, Zap, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { joinContest } from "@/lib/contests.functions";

export const Route = createFileRoute("/contest/$id")({
  component: ContestPage,
});

type Contest = {
  id: string;
  title: string;
  category_id: string | null;
  entry_fee: number;
  prize_pool: number;
  first_prize: number;
  duration_minutes: number;
  num_questions: number;
  max_participants: number;
  active: boolean;
  results_status: string;
  starts_at: string | null;
  ends_at: string | null;
};

function ContestPage() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Contest | null | undefined>(undefined);
  const [catName, setCatName] = useState<string>("");
  const [joining, setJoining] = useState(false);
  const { state } = useUser();
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("contests")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setC((data ?? null) as Contest | null);
      if (data?.category_id) {
        const { data: cat } = await supabase.from("categories").select("name").eq("id", data.category_id).maybeSingle();
        setCatName(cat?.name ?? "");
      }
    })();
  }, [id]);

  if (c === undefined) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (!c) return <AppShell><p>Contest not found</p></AppShell>;

  const join = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return nav({ to: "/auth" });
    if (c.results_status === "declared") {
      return nav({ to: "/result/$id", params: { id: c.id } });
    }
    setJoining(true);
    try {
      const res = await joinContest({ data: { contest_id: c.id } });
      if (res.already) toast.info("Resuming your attempt");
      else if (res.charged > 0) toast.success(`Joined — ₹${res.charged} deducted from wallet`);
      nav({ to: "/play/$id", params: { id: c.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not join contest");
    } finally {
      setJoining(false);
    }
  };

  return (
    <AppShell>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div>
          <h1 className="text-xl font-black">{c.title}</h1>
          <p className="text-xs opacity-90">{catName || "Contest"}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Pill icon={<Trophy className="h-4 w-4" />} label="Prize Pool" value={Number(c.prize_pool) > 0 ? `₹${c.prize_pool}` : "Practice"} />
          <Pill icon={<Zap className="h-4 w-4" />} label="Entry Fee" value={Number(c.entry_fee) > 0 ? `₹${c.entry_fee}` : "FREE"} />
          <Pill icon={<Clock className="h-4 w-4" />} label="Duration" value={`${c.duration_minutes} min`} />
          <Pill icon={<Users className="h-4 w-4" />} label="Max Players" value={`${c.max_participants}`} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">How it works</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            `${c.num_questions} MCQ questions`,
            `${c.duration_minutes} minute timer — auto submit`,
            "Your answers are submitted to the admin.",
            "Winners & prizes are declared by the admin after the contest ends.",
            "One attempt only. Anti-cheat monitoring enabled.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-2 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <strong>Manual result declaration:</strong> Scores are calculated after the admin
            verifies the correct answers and finalises winners. You will see your result on the
            Result page once the admin declares it.
          </p>
        </div>
      </section>

      <div className="sticky bottom-24 mt-6">
        {(() => {
          const now = Date.now();
          const notStarted = c.starts_at && new Date(c.starts_at).getTime() > now;
          const ended = c.ends_at && new Date(c.ends_at).getTime() < now;
          const disabled = joining || !c.active || !!notStarted || !!ended;
          let label = joining ? "Joining…" :
            !c.active ? "Waiting for admin approval" :
            c.results_status === "declared" ? "View Results" :
            notStarted ? `Starts at ${new Date(c.starts_at!).toLocaleString()}` :
            ended ? "Contest ended" :
            Number(c.entry_fee) > 0 ? `Pay ₹${c.entry_fee} & Join Contest` : "Start Free Quiz";
          return (
            <Button onClick={join} disabled={disabled} size="lg" className="h-14 w-full bg-gradient-primary text-base font-bold shadow-glow">
              {label}
            </Button>
          );
        })()}
        {Number(c.entry_fee) > 0 && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Wallet balance: ₹{state.wallet.toFixed(0)}
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Pill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-90">{icon}{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}
