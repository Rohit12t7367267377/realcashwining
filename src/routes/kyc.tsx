import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { submitKyc } from "@/lib/social.functions";

export const Route = createFileRoute("/kyc")({
  head: () => ({ meta: [
    { title: "KYC Verification — Guru-G" },
    { name: "description", content: "Submit ID documents to verify your account and unlock withdrawals." },
    { property: "og:title", content: "KYC Verification" },
    { property: "og:description", content: "Verify your identity to withdraw winnings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Page,
});

function Page() {
  const [mine, setMine] = useState<any>(null);
  const [f, setF] = useState({ full_name: "", doc_type: "aadhaar", doc_number: "", doc_image_url: "", selfie_url: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("kyc_submissions").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    setMine(data);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    setBusy(true);
    try {
      await submitKyc({ data: { full_name: f.full_name, doc_type: f.doc_type as any, doc_number: f.doc_number, doc_image_url: f.doc_image_url || null, selfie_url: f.selfie_url || null } });
      toast.success("Submitted. Admin will review shortly.");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto p-4">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><ShieldCheck className="w-7 h-7" /> KYC Verification</h1>
        <p className="text-muted-foreground mb-6">Required to withdraw winnings.</p>

        {mine ? (
          <Card className="p-5">
            <div className="text-sm mb-2">Status: <b className={mine.status === "approved" ? "text-green-600" : mine.status === "rejected" ? "text-destructive" : "text-yellow-600"}>{mine.status.toUpperCase()}</b></div>
            <div className="text-sm">Name: {mine.full_name}</div>
            <div className="text-sm">Document: {mine.doc_type} · {mine.doc_number}</div>
            {mine.admin_note && <div className="mt-2 text-sm bg-muted/40 rounded p-2">Admin note: {mine.admin_note}</div>}
            {mine.status === "rejected" && <Button className="mt-3" onClick={() => setMine(null)}>Resubmit</Button>}
          </Card>
        ) : (
          <Card className="p-5 space-y-3">
            <div><Label>Full legal name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
            <div><Label>Document type</Label>
              <select className="w-full border rounded p-2 bg-background" value={f.doc_type} onChange={(e) => setF({ ...f, doc_type: e.target.value })}>
                <option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="passport">Passport</option><option value="driving_license">Driving license</option>
              </select>
            </div>
            <div><Label>Document number</Label><Input value={f.doc_number} onChange={(e) => setF({ ...f, doc_number: e.target.value })} /></div>
            <div><Label>Document photo URL (optional)</Label><Input value={f.doc_image_url} onChange={(e) => setF({ ...f, doc_image_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Selfie URL (optional)</Label><Input value={f.selfie_url} onChange={(e) => setF({ ...f, selfie_url: e.target.value })} placeholder="https://..." /></div>
            <Button className="w-full" onClick={submit} disabled={busy || !f.full_name || !f.doc_number}>{busy ? "…" : "Submit for review"}</Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
