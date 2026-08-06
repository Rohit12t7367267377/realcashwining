import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getMyCreatorStats, applyForMonetization } from "@/lib/creator.functions";
import { BadgeCheck, Eye, Star, Clock, Users, IdCard } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { ScrollText } from "lucide-react";

/** Creator dashboard: YouTube-style analytics + monetization progress. */
export function CreatorPanel() {
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const fetchStats = useServerFn(getMyCreatorStats);
  const apply = useServerFn(applyForMonetization);
  const { data } = useQuery({ queryKey: ["my-creator"], queryFn: () => fetchStats(), staleTime: 60_000 });

  const applyMut = useMutation({
    mutationFn: () => apply(),
    onSuccess: () => {
      toast.success("Application sent — admin will review it.");
      qc.invalidateQueries({ queryKey: ["my-creator"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not apply"),
  });

  if (!data) return null;
  const rules = data.rules;
  const badge = data.monetized ? "Monetized" : data.status === "pending" ? "In review" : data.eligible ? "Eligible" : "Growing";

  return (
    <section className="mt-5 rounded-3xl bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <BadgeCheck className="h-4 w-4" /> Creator studio
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{badge}</span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Metric icon={<Eye className="h-4 w-4" />} value={String(data.views)} label="Views" />
        <Metric icon={<Clock className="h-4 w-4" />} value={`${data.watchHours}h`} label="Watch" />
        <Metric icon={<Star className="h-4 w-4" />} value={data.avgRating.toFixed(1)} label={`${data.ratingsCount}★`} />
        <Metric icon={<Users className="h-4 w-4" />} value={String(data.followers)} label="Followers" />
      </div>

      <div className="mt-3 space-y-2">
        <Bar label={`Followers ${data.followers}/${rules.followers}`} pct={data.followers / rules.followers} />
        <Bar label={`Watch hours ${data.watchHours}/${rules.watchHours}`} pct={data.watchHours / rules.watchHours} />
        <Bar label={`Ratings ${data.ratingsCount}/${rules.ratingsCount}`} pct={data.ratingsCount / rules.ratingsCount} />
        <Bar label={`Average rating ${data.avgRating.toFixed(1)}/${rules.avgRating}★`} pct={data.avgRating / rules.avgRating} />
      </div>

      {data.adminNote && <p className="mt-2 text-[11px] text-muted-foreground">Admin note: {data.adminNote}</p>}

      <div className="mt-3 rounded-2xl bg-muted/50 p-3">
        <button type="button" onClick={() => setShowTerms((v) => !v)} className="flex w-full items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-primary" /> Creator terms & conditions</span>
          <span className="text-muted-foreground">{showTerms ? "Hide" : "Read"}</span>
        </button>
        {showTerms && (
          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            <li>• Post only study-related and informative content (notes, explainers, exam tips, short study reels).</li>
            <li>• No copyrighted, adult, violent, hateful, gambling-promoting or misleading content.</li>
            <li>• Reach {rules.followers} followers, {rules.watchHours} watch hours and {rules.avgRating}★ average from {rules.ratingsCount} ratings to become eligible.</li>
            <li>• Monetization is granted, paused or revoked by the admin at their discretion.</li>
            <li>• KYC verification is mandatory before any payout is released.</li>
            <li>• Engagement farming, fake views/followers or multiple accounts lead to permanent removal.</li>
            <li>• Earnings are paid to the verified UPI ID only, after the admin approves the payout.</li>
          </ul>
        )}
        <label className="mt-2 flex items-center gap-2 text-[11px] font-bold">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
          I have read and accept the creator terms
        </label>
      </div>

      {data.monetized ? (
        <Link to="/kyc" className="press mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-3 py-2 text-xs font-black text-amber-950">
          <IdCard className="h-4 w-4" /> Complete KYC to receive payouts
        </Link>
      ) : (
        <Button
          className="press mt-3 w-full bg-gradient-primary font-bold"
          disabled={!agreed || !data.eligible || data.status === "pending" || applyMut.isPending}
          onClick={() => applyMut.mutate()}
        >
          {data.status === "pending" ? "Application in review" : !agreed ? "Accept the terms to continue" : data.eligible ? "Apply for monetization" : "Keep creating to unlock"}
        </Button>
      )}
    </section>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2">
      <span className="mx-auto flex h-6 w-6 items-center justify-center text-primary">{icon}</span>
      <div className="text-sm font-black">{value}</div>
      <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  const width = Math.max(0, Math.min(100, Math.round(pct * 100)));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
        <span>{label}</span>
        <span>{width}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-gradient-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
