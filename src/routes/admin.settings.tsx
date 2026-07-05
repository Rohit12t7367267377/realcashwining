import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { saveAppSetting } from "@/lib/admin-settings.functions";

export const Route = createFileRoute("/admin/settings")({ component: Page });

function Page() {
  const [adminUpi, setAdminUpi] = useState("admin@upi");
  const [adminUpiQr, setAdminUpiQr] = useState("");
  const [minDeposit, setMinDeposit] = useState(20);
  const [maxDeposit, setMaxDeposit] = useState(5000);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [newUserBonus, setNewUserBonus] = useState(0);
  const [correctPoints, setCorrectPoints] = useState(1);
  const [wrongPoints, setWrongPoints] = useState(0);
  const [prizePoolPct, setPrizePoolPct] = useState(50);
  const [prizePoolTotal, setPrizePoolTotal] = useState(0);
  const [branding, setBranding] = useState({ siteName: "Cash Winning League", tagline: "Play. Win. Repeat." });
  const [banner, setBanner] = useState({ message: "", active: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*");
      (data ?? []).forEach((r: any) => {
        if (r.key === "admin_upi_id") setAdminUpi(typeof r.value === "string" ? r.value : String(r.value));
        if (r.key === "admin_upi_qr") setAdminUpiQr(typeof r.value === "string" ? r.value : String(r.value));
        if (r.key === "min_deposit") setMinDeposit(Number(r.value) || 20);
        if (r.key === "max_deposit") setMaxDeposit(Number(r.value) || 5000);
        if (r.key === "min_withdrawal") setMinWithdrawal(Number(r.value) || 100);
        if (r.key === "new_user_bonus") setNewUserBonus(Number(r.value) || 0);
        if (r.key === "correct_points") setCorrectPoints(Number(r.value) || 1);
        if (r.key === "wrong_points") setWrongPoints(Number(r.value) || 0);
        if (r.key === "prize_pool_pct") setPrizePoolPct(Number(r.value) || 0);
        if (r.key === "prize_pool_total") setPrizePoolTotal(Number(r.value) || 0);
        if (r.key === "branding" && r.value && typeof r.value === "object") setBranding({ siteName: "Cash Winning League", tagline: "Play. Win. Repeat.", ...r.value });
        if (r.key === "banner" && r.value && typeof r.value === "object") setBanner({ message: "", active: true, ...r.value });
      });
      setLoading(false);
    })();
  }, []);

  async function save(key: string, value: any) {
    try {
      await saveAppSetting({ data: { key, value } });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Settings</h1>
      <p className="text-muted-foreground mb-6">App-wide configuration.</p>

      <div className="space-y-6 max-w-2xl">
        <Card className="p-5">
          <h2 className="font-semibold mb-1">Payments</h2>
          <p className="text-xs text-muted-foreground mb-3">UPI ID where users send deposits. Only admins can change this.</p>
          <Label>Admin UPI ID</Label>
          <Input value={adminUpi} onChange={(e) => setAdminUpi(e.target.value)} placeholder="yourname@bank" className="font-mono" />
          <Button className="mt-3" onClick={() => save("admin_upi_id", adminUpi.trim())}>Save UPI ID</Button>

          <div className="mt-5 border-t pt-4">
            <Label>UPI QR image (PhonePe / GPay / Paytm)</Label>
            <p className="text-[11px] text-muted-foreground mb-1.5">Upload your UPI QR image from PhonePe / GPay / Paytm. Users will see this QR on the deposit page.</p>
            <Input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              if (f.size > 500_000) return toast.error("Please choose an image under 500 KB");
              const reader = new FileReader();
              reader.onload = () => setAdminUpiQr(String(reader.result || ""));
              reader.readAsDataURL(f);
            }} />
            {adminUpiQr && <img src={adminUpiQr} alt="QR preview" className="mt-2 h-32 w-32 rounded border bg-white object-contain p-1" />}
            <div className="mt-2 flex gap-2">
              <Button onClick={() => save("admin_upi_qr", adminUpiQr)}>Save QR</Button>
              {adminUpiQr && <Button variant="outline" onClick={() => { setAdminUpiQr(""); save("admin_upi_qr", ""); }}>Remove</Button>}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4">
            <div>
              <Label>Min deposit ₹</Label>
              <Input type="number" min={1} value={minDeposit} onChange={(e) => setMinDeposit(Number(e.target.value))} />
            </div>
            <div>
              <Label>Max deposit ₹</Label>
              <Input type="number" min={1} value={maxDeposit} onChange={(e) => setMaxDeposit(Number(e.target.value))} />
            </div>
            <div>
              <Label>Min withdrawal ₹</Label>
              <Input type="number" min={1} value={minWithdrawal} onChange={(e) => setMinWithdrawal(Number(e.target.value))} />
            </div>
          </div>
          <Button className="mt-3" onClick={async () => {
            await save("min_deposit", minDeposit);
            await save("max_deposit", maxDeposit);
            await save("min_withdrawal", minWithdrawal);
          }}>Save limits</Button>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-1">New user starting balance</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Amount auto-credited to a brand-new user's wallet at signup. Set to 0 for no bonus.
          </p>
          <Label>Bonus amount (₹)</Label>
          <Input type="number" min={0} value={newUserBonus} onChange={(e) => setNewUserBonus(Number(e.target.value))} />
          <Button className="mt-3" onClick={() => save("new_user_bonus", newUserBonus)}>Save bonus</Button>
          <p className="text-[11px] text-muted-foreground mt-2">
            To adjust an existing user's balance manually, go to <b>Users &amp; Wallets</b>.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-1">Prize pool</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Percentage of every approved deposit that flows into the prize pool.
          </p>
          <Label>Contribution (%)</Label>
          <Input type="number" min={0} max={100} value={prizePoolPct} onChange={(e) => setPrizePoolPct(Number(e.target.value))} />
          <Button className="mt-3" onClick={() => save("prize_pool_pct", prizePoolPct)}>Save percentage</Button>
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
            Current prize pool: <span className="font-bold">₹{prizePoolTotal.toFixed(2)}</span>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-1">Scoring</h2>
          <p className="text-xs text-muted-foreground mb-3">Points awarded when the admin auto-scores contest submissions.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Points for correct answer</Label>
              <Input type="number" step="0.5" value={correctPoints} onChange={(e) => setCorrectPoints(Number(e.target.value))} />
            </div>
            <div>
              <Label>Points for wrong answer (−ve for penalty)</Label>
              <Input type="number" step="0.5" value={wrongPoints} onChange={(e) => setWrongPoints(Number(e.target.value))} />
            </div>
          </div>
          <Button className="mt-3" onClick={async () => { await save("correct_points", correctPoints); await save("wrong_points", wrongPoints); }}>Save scoring</Button>
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
