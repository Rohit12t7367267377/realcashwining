import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { listAdminAuditLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/audit-logs")({ component: AuditLogsPage });

function AuditLogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  async function load() {
    setLoading(true);
    try {
      const result = await listAdminAuditLogs({ data: { page, pageSize, action: filter || undefined } });
      setRows(result.rows);
      setCount(result.count);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load audit history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-3xl font-bold"><ScrollText className="h-7 w-7" /> Audit Logs</h1>
      <p className="mb-6 text-muted-foreground">Immutable administrator actions, reasons, targets, and outcomes.</p>
      <Card className="mb-4 flex gap-2 p-3">
        <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter action, for example wallet.adjust" onKeyDown={(event) => event.key === "Enter" && (setPage(1), load())} />
        <Button onClick={() => { setPage(1); load(); }}>Filter</Button>
      </Card>
      <div className="space-y-2">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><strong>{row.action}</strong><Badge variant={row.result === "success" ? "secondary" : "destructive"}>{row.result}</Badge><Badge variant="outline">{row.permission_key}</Badge></div>
                <div className="mt-1 text-sm text-muted-foreground">{row.actorName} · {row.target_type}{row.target_id ? ` · ${row.target_id}` : ""}</div>
                {row.reason && <div className="mt-2 text-sm">Reason: {row.reason}</div>}
              </div>
              <time className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</time>
            </div>
          </Card>
        ))}
        {!loading && rows.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No matching audit records.</Card>}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{count} records</span>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button><span className="text-sm">Page {page}</span><Button variant="outline" size="sm" disabled={page * pageSize >= count || loading} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight className="h-4 w-4" /></Button></div>
      </div>
    </div>
  );
}