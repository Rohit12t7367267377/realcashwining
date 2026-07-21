import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { adminReplyFeedback } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/feedback")({ component: Page });

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase.from("feedback").select("*, profiles(full_name)").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function send(id: string, status: "resolved" | "closed") {
    try { await adminReplyFeedback({ data: { id, admin_reply: reply[id] ?? "", status } }); toast.success("Saved"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><MessageSquare className="w-6 h-6" /> Feedback</h1>
      <p className="text-muted-foreground mb-6">User ratings and support tickets.</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm">{"★".repeat(r.rating ?? 0)}{"☆".repeat(5 - (r.rating ?? 0))} · <b>{r.profiles?.full_name ?? "Anon"}</b> · <span className="text-xs uppercase">{r.category ?? "general"}</span> · <span className="text-xs">{r.status}</span></div>
                <div className="text-sm mt-1">{r.body}</div>
                {r.admin_reply && <div className="mt-2 text-sm bg-muted/40 rounded p-2"><b>Reply:</b> {r.admin_reply}</div>}
              </div>
              {r.status === "open" && (
                <div className="w-72 space-y-2">
                  <Textarea rows={2} placeholder="Admin reply" value={reply[r.id] ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => send(r.id, "resolved")}>Resolve</Button>
                    <Button size="sm" variant="outline" onClick={() => send(r.id, "closed")}>Close</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
        {!rows.length && <Card className="p-8 text-center text-muted-foreground">No feedback yet.</Card>}
      </div>
    </div>
  );
}
