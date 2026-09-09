import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { redeemCoupon } from "@/lib/social.functions";

export const Route = createFileRoute("/coupons")({
  head: () => ({ meta: [
    { title: "Redeem Coupon — Guru-G" },
    { name: "description", content: "Redeem gift codes for wallet credit and XP." },
    { property: "og:title", content: "Redeem Coupon" },
    { property: "og:description", content: "Enter a coupon code to unlock rewards." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Page,
});

function Page() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await redeemCoupon({ data: { code: code.trim() } });
      const bits = [];
      if (r.amount > 0) bits.push(`₹${r.amount} wallet credit`);
      if (r.xp > 0) bits.push(`${r.xp} XP`);
      toast.success(`Redeemed! ${bits.join(" + ")}`);
      setCode("");
    } catch (e: any) { toast.error(e?.message ?? "Invalid code"); }
    finally { setBusy(false); }
  }

  return (
    <AppShell>
      <div className="max-w-md mx-auto p-4">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Ticket className="w-7 h-7" /> Redeem Code</h1>
        <p className="text-muted-foreground mb-6">Have a gift code? Enter it below.</p>
        <Card className="p-5 space-y-3">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="text-center font-mono text-lg" />
          <Button className="w-full" onClick={submit} disabled={busy || !code.trim()}>{busy ? "…" : "Redeem"}</Button>
        </Card>
      </div>
    </AppShell>
  );
}
