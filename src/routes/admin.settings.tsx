import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: Page });

function Page() {
  const [rewards, setRewards] = useState({ dailyMin: 5, dailyMax: 20, referralBonus: 25, signupBonus: 50 });
  const [branding, setBranding] = useState({ siteName: "Cash Winning League", tagline: "Play. Win. Repeat." });
  const [banner, setBanner] = useState({ message: "", active: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*");
      (data ?? []).forEach((r: any) => {
        if (r.key === "rewards") setRewards({ ...rewards, ...r.value });
        if (r.key === "branding") setBranding({ ...branding, ...r.value });
        if (r.key === "banner") setBanner({ ...banner, ...r.value });
      });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(key: string, value: any) {
    const { error } = await supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else toast.success("Saved");
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Settings</h1>
      <p className="text-muted-foreground mb-6">App-wide configuration.</p>

      <div className="space-y-6 max-w-2xl">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Rewards</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Daily reward min ₹</Label><Input type="number" value={rewards.dailyMin} onChange={(e) => setRewards({ ...rewards, dailyMin: Number(e.target.value) })} /></div>
            <div><Label>Daily reward max ₹</Label><Input type="number" value={rewards.dailyMax} onChange={(e) => setRewards({ ...rewards, dailyMax: Number(e.target.value) })} /></div>
            <div><Label>Referral bonus ₹</Label><Input type="number" value={rewards.referralBonus} onChange={(e) => setRewards({ ...rewards, referralBonus: Number(e.target.value) })} /></div>
            <div><Label>Signup bonus ₹</Label><Input type="number" value={rewards.signupBonus} onChange={(e) => setRewards({ ...rewards, signupBonus: Number(e.target.value) })} /></div>
          </div>
          <Button className="mt-4" onClick={() => save("rewards", rewards)}>Save rewards</Button>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Branding</h2>
          <div className="space-y-3">
            <div><Label>Site name</Label><Input value={branding.siteName} onChange={(e) => setBranding({ ...branding, siteName: e.target.value })} /></div>
            <div><Label>Tagline</Label><Input value={branding.tagline} onChange={(e) => setBranding({ ...branding, tagline: e.target.value })} /></div>
          </div>
          <Button className="mt-4" onClick={() => save("branding", branding)}>Save branding</Button>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Homepage banner</h2>
          <div className="space-y-3">
            <div><Label>Message</Label><Input value={banner.message} onChange={(e) => setBanner({ ...banner, message: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Show banner</Label><Switch checked={banner.active} onCheckedChange={(v) => setBanner({ ...banner, active: v })} /></div>
          </div>
          <Button className="mt-4" onClick={() => save("banner", banner)}>Save banner</Button>
        </Card>
      </div>
    </div>
  );
}
