import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BLOCK_EVENT, type BlockInfo } from "@/lib/monetization";
import { claimOfferCode, getUpgradeOptions } from "@/lib/monetization.functions";

const REASON_LINE: Record<string, string> = {
  no_credits: "You are out of credits.",
  limit_daily: "You reached today's limit for this feature.",
  limit_monthly: "You reached this month's limit for this feature.",
  feature_disabled: "This feature is turned off right now.",
};

/** Admin-configured upgrade options, opened automatically whenever the server refuses a request for credits or limits. */
export function UpgradePrompt() {
  const [block, setBlock] = useState<BlockInfo | null>(null);
  const [code, setCode] = useState("");
  const last = useRef(0);
  const qc = useQueryClient();
  const options = useServerFn(getUpgradeOptions);
  const claim = useServerFn(claimOfferCode);
  const q = useQuery({ queryKey: ["upgrade-options"], queryFn: () => options(), enabled: !!block, staleTime: 60_000 });

  useEffect(() => {
    const on = (e: Event) => {
      if (Date.now() - last.current < 1500) return;
      last.current = Date.now();
      setBlock((e as CustomEvent<BlockInfo>).detail);
    };
    window.addEventListener(BLOCK_EVENT, on);
    return () => window.removeEventListener(BLOCK_EVENT, on);
  }, []);

  const d = q.data;
  async function redeem(c: string) {
    try {
      const r = await claim({ data: { code: c } });
      if (r.ok) { toast.success(`+${r.credits} credits added`); qc.invalidateQueries({ queryKey: ["my-credits"] }); setBlock(null); }
      else toast.error({ not_found: "Code not found", not_active: "This offer is not active", sold_out: "This offer is fully claimed", already_claimed: "You already used this code" }[r.reason ?? ""] ?? "Could not apply code");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not apply code"); }
  }

  return (
    <Dialog open={!!block} onOpenChange={(o) => !o && setBlock(null)}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d?.upgrade.title ?? "Upgrade to keep learning"}</DialogTitle>
          <DialogDescription>{block ? REASON_LINE[block.reason] : ""} {d?.upgrade.message}</DialogDescription>
        </DialogHeader>
        {d && d.plans.length > 0 && (
          <div className="space-y-2">
            {d.plans.map((p: any) => (
              <div key={p.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}{p.recommended ? " ⭐" : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    ₹{p.price} · {p.duration_days} days · {p.unlimited_ai ? "Unlimited AI" : p.credits_per_cycle > 0 ? `${p.credits_per_cycle} credits / 30 days` : p.description ?? ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {d && d.offers.length > 0 && (
          <div className="space-y-2">
            {d.offers.map((o: any) => (
              <div key={o.code} className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold text-sm truncate">{o.title}</div><div className="text-xs text-muted-foreground">{o.bonus_credits > 0 ? `+${o.bonus_credits} credits` : ""}{o.discount_percent ? ` ${o.discount_percent}% off` : ""}</div></div>
                {o.bonus_credits > 0 && <Button size="sm" onClick={() => redeem(o.code)}>Claim</Button>}
              </div>
            ))}
          </div>
        )}
        {d?.upgrade.show_offers && (
          <div className="flex gap-2">
            <Input placeholder="Have an offer code?" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="outline" disabled={code.trim().length < 2} onClick={() => redeem(code)}>Apply</Button>
          </div>
        )}
        <Button asChild className="w-full bg-gradient-primary font-bold" onClick={() => setBlock(null)}>
          <Link to={(d?.upgrade.cta_url ?? "/subscribe") as never}>{d?.upgrade.cta_label ?? "See plans"}</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
