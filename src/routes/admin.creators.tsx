import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { adminListCreators, adminSetMonetization } from "@/lib/admin-creators.functions";

export const Route = createFileRoute("/admin/creators")({ component: Page });

function Page() {
  const list = useServerFn(adminListCreators);
  const setMon = useServerFn(adminSetMonetization);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-creators"], queryFn: () => list() });

  async function act(userId: string, status: "approved" | "rejected", monetized: boolean) {
    const note = prompt("Note for the creator (optional)") ?? "";
    try {
      await setMon({ data: { userId, status, monetized, admin_note: note || null } });
      toast.success(monetized ? "Monetization enabled" : "Updated");
      qc.invalidateQueries({ queryKey: ["admin-creators"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Star className="w-6 h-6 text-primary" /> Creators & Monetization</h1>
        <p className="text-muted-foreground">Approve creators who cross 500 followers, 3.5★ average from 500 ratings and 100 watch hours. KYC must be approved first.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="space-y-2">
        {(data ?? []).map((c: any) => (
          <Card key={c.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {c.followers_count} followers · {Number(c.avg_rating).toFixed(1)}★ ({c.ratings_count}) · {c.watchHours}h watched · {c.total_views} views · KYC {c.kycStatus}
              </div>
              {c.admin_note && <div className="text-xs">Note: {c.admin_note}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold capitalize">
                {c.monetized ? "monetized" : c.status}
              </span>
              {!c.monetized && (
                <Button size="sm" onClick={() => act(c.user_id, "approved", true)}>Enable monetization</Button>
              )}
              {c.monetized && (
                <Button size="sm" variant="outline" onClick={() => act(c.user_id, "approved", false)}>Disable</Button>
              )}
              {c.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => act(c.user_id, "rejected", false)}>Reject</Button>
              )}
            </div>
          </Card>
        ))}
        {!isLoading && (data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No monetization applications yet.</p>}
      </div>
    </div>
  );
}
