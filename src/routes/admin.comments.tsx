import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { adminHideComment } from "@/lib/admin-crud.functions";

export const Route = createFileRoute("/admin/comments")({ component: Page });

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("contest_comments").select("*, profiles(full_name), contests(title)").order("created_at", { ascending: false }).limit(100);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);
  async function toggle(id: string, hidden: boolean) {
    try { await adminHideComment({ data: { id, hidden } }); toast.success(hidden ? "Hidden" : "Shown"); load(); } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Content Moderation</h1>
      <p className="text-muted-foreground mb-6">Hide inappropriate contest comments.</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className={`p-3 ${r.hidden ? "opacity-50" : ""}`}>
            <div className="flex justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{r.profiles?.full_name ?? "?"} on <b>{r.contests?.title ?? "?"}</b> · {new Date(r.created_at).toLocaleString()}</div>
                <div className="text-sm">{r.body}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => toggle(r.id, !r.hidden)}>
                {r.hidden ? <><Eye className="w-4 h-4 mr-1" /> Show</> : <><EyeOff className="w-4 h-4 mr-1" /> Hide</>}
              </Button>
            </div>
          </Card>
        ))}
        {!rows.length && <Card className="p-8 text-center text-muted-foreground">No comments yet.</Card>}
      </div>
    </div>
  );
}
