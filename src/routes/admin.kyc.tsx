import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Check, X } from "lucide-react";
import { toast } from "sonner";
import { adminReviewKyc } from "@/lib/admin-crud.functions";
import { attachProfileNames } from "@/lib/admin-names";

export const Route = createFileRoute("/admin/kyc")({ component: Page });

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase.from("kyc_submissions").select("*").order("created_at", { ascending: false });
    setRows(await attachProfileNames(data ?? []));
  }
  useEffect(() => { load(); }, []);

  async function review(id: string, status: "approved" | "rejected") {
    try { await adminReviewKyc({ data: { id, status, admin_note: notes[id] } }); toast.success(status); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> KYC Verification</h1>
      <p className="text-muted-foreground mb-6">Review identity submissions.</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{r.full_name} · <span className="text-xs uppercase text-muted-foreground">{r.doc_type}</span></div>
                <div className="text-sm font-mono">{r.doc_number}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                <div className="flex gap-2 mt-2">
                  {r.doc_image_url && <a href={r.doc_image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Doc image</a>}
                  {r.selfie_url && <a href={r.selfie_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Selfie</a>}
                </div>
                <div className="mt-2 text-xs">Status: <span className={r.status === "approved" ? "text-green-600" : r.status === "rejected" ? "text-destructive" : "text-yellow-600"}>{r.status}</span></div>
              </div>
              {r.status === "pending" && (
                <div className="w-64 space-y-2">
                  <Textarea placeholder="Admin note (optional)" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => review(r.id, "approved")}><Check className="w-4 h-4 mr-1" /> Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => review(r.id, "rejected")}><X className="w-4 h-4 mr-1" /> Reject</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
        {!rows.length && <Card className="p-8 text-center text-muted-foreground">No submissions yet.</Card>}
      </div>
    </div>
  );
}
