import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { purchaseMembership } from "@/lib/social.functions";

export const Route = createFileRoute("/vip")({
  head: () => ({ meta: [
    { title: "VIP Membership — Cash Winning League" },
    { name: "description", content: "Upgrade to VIP for exclusive contests, ad-free play and bonus XP." },
    { property: "og:title", content: "VIP Membership" },
    { property: "og:description", content: "Unlock premium contests and rewards." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Page,
});

function Page() {
  const [plans, setPlans] = useState<any[]>([]);
  const [mine, setMine] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [{ data: p }, { data: u }] = await Promise.all([
      supabase.from("memberships").select("*").eq("active", true).order("sort_order"),
      supabase.auth.getUser().then(async ({ data }) => data.user
        ? await supabase.from("user_memberships").select("*, memberships(name)").eq("user_id", data.user.id).eq("status", "active").gt("ends_at", new Date().toISOString()).maybeSingle()
        : { data: null }),
    ]);
    setPlans(p ?? []);
    setMine(u ?? null);
  }
  useEffect(() => { load(); }, []);

  async function buy(id: string) {
    setBusy(id);
    try { const r = await purchaseMembership({ data: { membership_id: id } }); toast.success(`Active until ${new Date(r.ends_at).toLocaleDateString()}`); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><Crown className="w-8 h-8 text-yellow-500" /> VIP Membership</h1>
        <p className="text-muted-foreground mb-6">Unlock premium contests, ad-free play, and bonus rewards.</p>

        {mine && (
          <Card className="p-4 mb-6 border-yellow-500/40 bg-yellow-500/5">
            <div className="font-semibold">✓ You are a {mine.memberships?.name} member</div>
            <div className="text-xs text-muted-foreground">Active until {new Date(mine.ends_at).toLocaleString()}</div>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="font-bold text-lg">{p.name}</div>
              <div className="text-3xl font-black mt-2">₹{p.price}<span className="text-sm font-normal text-muted-foreground"> / {p.duration_days}d</span></div>
              <ul className="mt-3 space-y-1 text-sm">
                {(p.perks ?? []).map((perk: string, i: number) => <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> {perk}</li>)}
              </ul>
              <Button className="w-full mt-4" onClick={() => buy(p.id)} disabled={busy === p.id}>{busy === p.id ? "…" : "Buy with wallet"}</Button>
            </Card>
          ))}
          {!plans.length && <Card className="p-8 text-center text-muted-foreground md:col-span-3">No plans available.</Card>}
        </div>
      </div>
    </AppShell>
  );
}
