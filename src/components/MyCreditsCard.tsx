import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getMyCredits } from "@/lib/monetization.functions";

/** AI credits and today's limits. Renders nothing while the admin has the credit system switched off. */
export function MyCreditsCard() {
  const fn = useServerFn(getMyCredits);
  const { data } = useQuery({ queryKey: ["my-credits"], queryFn: () => fn(), staleTime: 30_000 });
  if (!data || !data.enabled) return null;
  const limited = data.features.filter((f: any) => f.enabled && (f.daily_limit != null || f.monthly_limit != null)).slice(0, 6);
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold"><Zap className="h-4 w-4 text-primary" /> AI credits</div>
        <Link to="/subscribe" className="text-xs font-semibold text-primary">{data.plan ? "Manage plan" : "Get more"}</Link>
      </div>
      <div className="flex gap-4 text-sm">
        <div><div className="text-xl font-bold">{data.free + data.paid}</div><div className="text-[11px] text-muted-foreground">available</div></div>
        <div><div className="font-semibold">{data.free}</div><div className="text-[11px] text-muted-foreground">free{data.free_expires_at ? ` · till ${new Date(data.free_expires_at).toLocaleDateString()}` : ""}</div></div>
        <div><div className="font-semibold">{data.paid}</div><div className="text-[11px] text-muted-foreground">plan / bonus</div></div>
      </div>
      {data.plan && <div className="text-xs text-muted-foreground">{data.plan.name}{data.plan.unlimited ? " · unlimited AI" : ""} · renews/ends {new Date(data.plan.ends_at).toLocaleDateString()}</div>}
      {limited.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {limited.map((f: any) => (
            <div key={f.key} className="flex justify-between gap-1"><span className="truncate">{f.label}</span>
              <span className="font-mono">{f.daily_limit != null ? `${f.used_today}/${f.daily_limit} today` : `${f.used_month}/${f.monthly_limit} mo`}</span></div>
          ))}
        </div>
      )}
    </Card>
  );
}
